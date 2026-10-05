// Comptage des répétitions à partir des points du corps (MediaPipe PoseLandmarker), sur l'appareil.
// Pompes : coude < 90° puis > 160°, épaules et hanches visibles. Squats : genou < 100° puis > 160°.

export type Exercise = "pushup" | "squat";
export type Point = { x: number; y: number; visibility?: number };

export const THRESHOLDS: Record<Exercise, { down: number; up: number }> = {
  pushup: { down: 90, up: 160 },
  squat: { down: 100, up: 160 },
};

export const MIN_REP_MS = 800;
export const MAX_REP_MS = 6000;
const MIN_VISIBILITY = 0.5;

// Indices des points MediaPipe Pose.
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

/** Angle ABC en degrés. */
export function angle(a: Point, b: Point, c: Point): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let deg = Math.abs(((ab - cb) * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

/** Angle de l'articulation qui compte, du côté le mieux vu, ou null si le corps n'est pas assez visible. */
export function jointAngle(landmarks: Point[] | undefined, exercise: Exercise): number | null {
  if (!landmarks?.length) return null;
  let best: { angle: number; visibility: number } | null = null;
  for (const side of SIDES[exercise]) {
    const visibility = Math.min(...side.required.map((i) => landmarks[i]?.visibility ?? 0));
    if (visibility < MIN_VISIBILITY) continue;
    const [a, b, c] = side.joints.map((i) => landmarks[i]);
    const value = angle(a, b, c);
    if (!best || visibility > best.visibility) best = { angle: value, visibility };
  }
  return best?.angle ?? null;
}

export type RepEvent = "rep" | "too_fast" | "too_slow" | null;

/**
 * Machine à états : en haut → descente (début de la répétition) → en bas → retour en haut (fin).
 * Chaque répétition est notée [début, fin] en ms ; le serveur refuse < 0,8 s ou > 6 s.
 */
export class RepTracker {
  private state: "unknown" | "up" | "descending" | "down" = "unknown";
  private startedAt: number | null = null;
  private recent: number[] = [];
  readonly reps: [number, number][] = [];

  constructor(private readonly exercise: Exercise) {}

  get phase() {
    return this.state;
  }

  update(rawAngle: number, t: number): RepEvent {
    // Lissage léger contre le tremblement des points.
    this.recent.push(rawAngle);
    if (this.recent.length > 3) this.recent.shift();
    const a = this.recent.reduce((s, v) => s + v, 0) / this.recent.length;
    const { down, up } = THRESHOLDS[this.exercise];

    if (a >= up) {
      const wasDown = this.state === "down";
      const start = this.startedAt;
      this.state = "up";
      this.startedAt = null;
      if (wasDown && start !== null) {
        const duration = t - start;
        if (duration < MIN_REP_MS) return "too_fast";
        if (duration > MAX_REP_MS) return "too_slow";
        this.reps.push([Math.round(start), Math.round(t)]);
        return "rep";
      }
      return null;
    }
    if (this.state === "up") {
      this.state = "descending";
      this.startedAt = t;
    }
    if (this.state === "descending" && a < down) this.state = "down";
    return null;
  }
}
