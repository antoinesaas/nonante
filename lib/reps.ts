// Comptage des répétitions à partir des points du corps (MediaPipe PoseLandmarker), sur l'appareil.
//
// Plus précis que la première version (angles 2D et seuils fixes, qui se trompaient dès que le téléphone n'était pas
// pile de profil) :
// 1. Angles en 3D (points « monde » de MediaPipe, en mètres) : le coude ou le genou garde le même angle quel que soit
//    l'endroit où est posé le téléphone.
// 2. Les deux côtés du corps comptent, pondérés par leur visibilité (un bras caché ne fait plus sauter l'angle).
// 3. Lissage « One Euro » : stable à l'arrêt, réactif en mouvement.
// 4. Seuils calibrés sur la personne : la position haute est mesurée, une répétition doit descendre d'assez de degrés
//    sous cette position ET sous un seuil absolu, puis remonter près du haut (hystérésis).
// 5. Posture vérifiée : corps à l'horizontale pour les pompes, debout pour les squats (pas de pompes « en l'air »).
// 6. Répétition à moitié (pas assez bas) signalée au lieu d'être comptée ; points perdus moins d'une seconde : on
//    garde l'état au lieu de tout recommencer.

export type Exercise = "pushup" | "squat";
export type Point = { x: number; y: number; z?: number; visibility?: number };

/** Réglages par exercice (degrés). */
export const THRESHOLDS: Record<Exercise, { down: number; depth: number; up: number; start: number; partial: number }> = {
  // Pompes : coude à 105° ou moins, au moins 45° sous la position haute ; remontée à 145° ou à 20° du haut.
  pushup: { down: 105, depth: 45, up: 145, start: 12, partial: 25 },
  // Squats : genou à 120° ou moins (cuisses proches de l'horizontale), au moins 50° sous la position debout.
  squat: { down: 120, depth: 50, up: 155, start: 12, partial: 25 },
};

export const MIN_REP_MS = 800;
export const MAX_REP_MS = 6000;
const MIN_VISIBILITY = 0.5;
const LOST_GRACE_MS = 1000;

// Indices des points MediaPipe Pose : épaule, coude, poignet / hanche, genou, cheville.
const SIDES = {
  pushup: [
    { joints: [11, 13, 15], required: [11, 13, 15, 23] },
    { joints: [12, 14, 16], required: [12, 14, 16, 24] },
  ],
  squat: [
    { joints: [23, 25, 27], required: [11, 23, 25, 27] },
    { joints: [24, 26, 28], required: [12, 24, 26, 28] },
  ],
} as const;

/** Angle ABC en degrés (en 3D si les points ont un z). */
export function angle(a: Point, b: Point, c: Point): number {
  const u = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const v = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const nu = Math.hypot(u[0], u[1], u[2]);
  const nv = Math.hypot(v[0], v[1], v[2]);
  if (!nu || !nv) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (nu * nv)))) * 180) / Math.PI;
}

export type Measure = { angle: number; posture: boolean };

/**
 * Angle de l'articulation qui compte (moyenne des deux côtés pondérée par la visibilité) et posture, ou null si le
 * corps n'est pas assez visible. `world` : points 3D de MediaPipe (préférés), `image` : points de l'image (visibilité).
 */
export function measure(image: Point[] | undefined, world: Point[] | undefined, exercise: Exercise): Measure | null {
  if (!image?.length) return null;
  const pts = world?.length === image.length ? world : image;
  let sum = 0;
  let weight = 0;
  for (const side of SIDES[exercise]) {
    const visibility = Math.min(...side.required.map((i) => image[i]?.visibility ?? 0));
    if (visibility < MIN_VISIBILITY) continue;
    const [a, b, c] = side.joints.map((i) => pts[i]);
    sum += angle(a, b, c) * visibility;
    weight += visibility;
  }
  if (!weight) return null;

  // Posture : direction du buste (milieu des épaules → milieu des hanches). Pompes : plutôt horizontal ; squats :
  // plutôt vertical. Seuils larges, pour accepter un téléphone posé de travers.
  const mid = (i: number, j: number) => ({ x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2, z: ((pts[i].z ?? 0) + (pts[j].z ?? 0)) / 2 });
  const s = mid(11, 12);
  const h = mid(23, 24);
  const dx = h.x - s.x;
  const dy = h.y - s.y;
  const dz = h.z - s.z;
  const vertical = Math.abs(dy) / (Math.hypot(dx, dy, dz) || 1);
  const posture = exercise === "pushup" ? vertical < 0.75 : vertical > 0.5;
  return { angle: sum / weight, posture };
}

/** Filtre « One Euro » (Casiez et al., 2012) : lisse le tremblement sans retarder les vrais mouvements. */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.015,
    private readonly dCutoff = 1,
  ) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const d = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export type RepEvent = "rep" | "too_fast" | "too_slow" | "partial" | "posture" | null;

/**
 * Machine à états : en haut → descente (début de la répétition) → en bas → retour en haut (fin).
 * Chaque répétition est notée [début, fin] en ms ; le serveur refuse < 0,8 s ou > 6 s.
 */
export class RepTracker {
  private state: "unknown" | "up" | "descending" | "down" = "unknown";
  private startedAt: number | null = null;
  private lowest = 180;
  private top: number | null = null;
  private lastSeen = 0;
  private wrongPostureSince: number | null = null;
  private readonly smooth = new OneEuro();
  /** Profondeur de la répétition en cours, de 0 (en haut) à 1 (assez bas pour compter). */
  depth = 0;
  readonly reps: [number, number][] = [];

  constructor(private readonly exercise: Exercise) {}

  get phase() {
    return this.state;
  }

  /** Points perdus : on garde l'état une seconde, puis on repart d'en haut. */
  lost(t: number) {
    if (t - this.lastSeen > LOST_GRACE_MS && this.state !== "unknown") {
      this.state = "unknown";
      this.startedAt = null;
      this.depth = 0;
    }
  }

  update(m: Measure, t: number): RepEvent {
    this.lastSeen = t;
    if (!m.posture) {
      this.wrongPostureSince ??= t;
      // Mauvaise posture tenue plus d'une demi-seconde : rien ne compte, la répétition en cours est annulée.
      if (t - this.wrongPostureSince > 500) {
        if (this.state === "descending" || this.state === "down") this.state = "unknown";
        this.startedAt = null;
        this.depth = 0;
        return "posture";
      }
    } else {
      this.wrongPostureSince = null;
    }

    const a = this.smooth.filter(m.angle, t);
    const th = THRESHOLDS[this.exercise];
    // Position haute de la personne : suit lentement l'angle quand elle est en haut (bras ou jambes tendus).
    if (this.top === null) this.top = Math.max(a, th.up);
    if (this.state === "up" || this.state === "unknown") this.top = Math.max(th.up, this.top * 0.9 + Math.max(a, this.top - 5) * 0.1);
    const top = this.top;
    const downAt = Math.min(th.down, top - th.depth);
    const upAt = Math.max(th.up, top - 20);
    this.depth = Math.max(0, Math.min(1, (top - a) / Math.max(1, top - downAt)));

    if (a >= upAt) {
      const wasDown = this.state === "down";
      const wasPartial = this.state === "descending" && this.lowest < top - th.partial;
      const start = this.startedAt;
      this.state = "up";
      this.startedAt = null;
      this.lowest = 180;
      if (wasDown && start !== null) {
        const duration = t - start;
        if (duration < MIN_REP_MS) return "too_fast";
        if (duration > MAX_REP_MS) return "too_slow";
        this.reps.push([Math.round(start), Math.round(t)]);
        return "rep";
      }
      return wasPartial ? "partial" : null;
    }
    if (this.state === "unknown") return null;
    if (this.state === "up" && a < top - th.start) {
      this.state = "descending";
      this.startedAt = t;
    }
    if (this.state === "descending") {
      this.lowest = Math.min(this.lowest, a);
      if (a <= downAt) this.state = "down";
    }
    return null;
  }
}
