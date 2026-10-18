// Sons d'ambiance du minuteur, synthétisés dans le navigateur (Web Audio) : aucun fichier à télécharger, aucun droit
// d'auteur, rien qui sorte du téléphone.
//
// Tout est fabriqué une fois au lancement (bruits, gouttes, oiseaux, voitures, notes), puis joué en boucle par le
// moteur audio lui-même : aucun script ne tourne pendant la lecture. Le son ne hoquette donc pas quand la page est
// occupée, et il continue écran verrouillé.
//
// Sans coupure : chaque boucle est raccordée sur elle-même en fondu enchaîné (aucun silence, aucun claquement), et
// les couches d'une même ambiance ont des longueurs premières entre elles (17 s, 19 s, 23 s, 29 s, 61 s, 89 s…) :
// l'ensemble ne repasse jamais deux fois par le même mélange avant plusieurs heures.
//
// Le pavé (comme Endel) règle deux axes : x de « fluide » (0) à « structuré » (1), y de « calme » (0) à « intense » (1).
// Calme → son plus sombre et plus clairsemé ; intense → plus brillant et plus dense. Fluide → nature pure, qui ondule
// lentement ; structuré → une pulsation musicale douce se glisse dans l'ambiance.

export const AMBIENCES = ["none", "focus", "rain", "forest", "ocean", "road", "fire", "brown"] as const;
export type AmbienceKind = (typeof AMBIENCES)[number];
export type Pad = { x: number; y: number };
export const PAD_DEFAULT: Pad = { x: 0.5, y: 0.5 };

const RATE = 32000;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Laisse respirer la page entre deux gros calculs. */
const idle = () => new Promise<void>((r) => setTimeout(r, 0));

// ——— Fabrication des pistes ———————————————————————————————————————————————————————————————————————————

type Track = { L: Float32Array; R: Float32Array; n: number };

function track(seconds: number): Track {
  const n = Math.round(seconds * RATE);
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}

/** Gains gauche/droite à puissance constante, pan de −1 à 1. */
function panGains(pan: number): [number, number] {
  const a = ((clamp((pan + 1) / 2) * Math.PI) / 2);
  return [Math.cos(a), Math.sin(a)];
}

/** Raccord sans couture : les `x` échantillons en trop se fondent dans le début de la boucle. */
function seamless(d: Float32Array, n: number, x: number): Float32Array {
  const out = d.slice(0, n);
  for (let i = 0; i < x; i++) {
    const a = i / x;
    out[i] = d[i] * Math.sqrt(a) + d[n + i] * Math.sqrt(1 - a);
  }
  return out;
}

function noiseChannel(kind: "white" | "pink" | "brown", n: number): Float32Array {
  const x = Math.round(RATE * 1.5);
  const d = new Float32Array(n + x);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n + x; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.3;
    else if (kind === "pink") {
      // Filtre de Paul Kellet.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.1;
      b6 = w * 0.115926;
    } else {
      // Marche aléatoire qui revient doucement vers zéro : pas de dérive, pas de bosse au raccord.
      last = last * 0.998 + w * 0.045;
      d[i] = last;
    }
  }
  return seamless(d, n, x);
}

/** Bruit stéréo (deux canaux indépendants : un son large, qui enveloppe). */
function noise(kind: "white" | "pink" | "brown", seconds: number): Track {
  const n = Math.round(seconds * RATE);
  return { L: noiseChannel(kind, n), R: noiseChannel(kind, n), n };
}

/** Ramène une piste à un niveau moyen donné : les gains des couches restent lisibles d'une piste à l'autre. */
function normalize(t: Track, rms = 0.1): Track {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < t.n; i++) {
    sum += t.L[i] * t.L[i] + t.R[i] * t.R[i];
    peak = Math.max(peak, Math.abs(t.L[i]), Math.abs(t.R[i]));
  }
  // Jamais plus haut que 0,6 en crête : un crépitement isolé ne sature pas.
  const k = Math.min(rms / Math.max(1e-6, Math.sqrt(sum / (2 * t.n))), 0.6 / Math.max(1e-6, peak));
  for (let i = 0; i < t.n; i++) {
    t.L[i] *= k;
    t.R[i] *= k;
  }
  return t;
}

/** Écrit un échantillon en bouclant : un évènement à cheval sur la fin repart au début, sans coupure. */
function put(t: Track, k: number, v: number, gl: number, gr: number) {
  const i = k % t.n;
  t.L[i] += v * gl;
  t.R[i] += v * gr;
}

/** Fondu d'entrée et de sortie (u de 0 à 1). */
function fade(u: number, a: number, r: number): number {
  if (u < a) return Math.sin((Math.PI / 2) * (u / a)) ** 2;
  if (u > 1 - r) return Math.sin((Math.PI / 2) * ((1 - u) / r)) ** 2;
  return 1;
}

/** Note tenue dont la hauteur et le volume suivent des courbes (oiseaux). */
function tone(t: Track, at: number, dur: number, freq: (u: number) => number, amp: (u: number) => number, gain: number, pan: number, h2: number) {
  const len = Math.floor(dur * RATE);
  const [gl, gr] = panGains(pan);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    ph += (TAU * freq(u)) / RATE;
    put(t, at + i, (Math.sin(ph) + h2 * Math.sin(2 * ph)) * amp(u) * gain, gl, gr);
  }
}

/** Résonateur excité par un petit éclat de bruit (crépitement, braise qui éclate). */
function resonant(t: Track, at: number, f: number, decay: number, burst: number, amp: number, pan: number) {
  const r = Math.exp(-1 / (decay * RATE));
  const w = (TAU * f) / RATE;
  const c1 = 2 * r * Math.cos(w);
  const c2 = -r * r;
  const len = Math.floor(decay * 7 * RATE);
  const kick = Math.max(4, Math.floor(burst * RATE));
  const [gl, gr] = panGains(pan);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x = i < kick ? (Math.random() * 2 - 1) * (1 - i / kick) : 0;
    const y = x + c1 * y1 + c2 * y2;
    y2 = y1;
    y1 = y;
    put(t, at + i, y * (1 - r) * amp, gl, gr);
  }
}

/** Goutte : petit « plic » dont la hauteur remonte (bulle d'air), précédé d'un clic. */
function drop(t: Track, at: number, amp: number, pan: number) {
  const f = rand(1300, 4200);
  const d = rand(0.0025, 0.009);
  const len = Math.floor(d * 6 * RATE);
  const rise = rand(0.25, 0.9);
  const [gl, gr] = panGains(pan);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const s = i / RATE;
    ph += (TAU * f * (1 + (rise * i) / len)) / RATE;
    const click = i < 40 ? (Math.random() * 2 - 1) * (1 - i / 40) * 0.5 : 0;
    put(t, at + i, (Math.sin(ph) * Math.exp(-s / d) + click) * amp, gl, gr);
  }
}

/** Oiseau : quatre familles de chants (pépiements, trille, sifflement de merle, gazouillis). */
function bird(t: Track, at: number, far: boolean) {
  const gain = far ? rand(0.05, 0.12) : rand(0.16, 0.34);
  const pan = rand(-0.9, 0.9);
  const h2 = far ? 0.03 : 0.14;
  const kind = Math.floor(Math.random() * 4);
  let k = at;
  if (kind === 0) {
    const base = rand(2500, 4200);
    const up = Math.random() < 0.6;
    const notes = Math.floor(rand(2, 7));
    for (let i = 0; i < notes; i++) {
      const dur = rand(0.05, 0.11);
      const b = base * rand(0.94, 1.06);
      tone(t, k, dur, (u) => b * (1 + (up ? 0.45 : -0.32) * u), (u) => fade(u, 0.15, 0.5), gain, pan, h2);
      k += Math.floor((dur + rand(0.04, 0.1)) * RATE);
    }
  } else if (kind === 1) {
    const dur = rand(0.5, 1.3);
    const base = rand(3000, 5000);
    const speed = rand(18, 30);
    tone(t, k, dur, (u) => base * (1 + 0.12 * Math.sin(TAU * speed * u * dur)), (u) => fade(u, 0.1, 0.3) * (0.75 + 0.25 * Math.sin(TAU * speed * u * dur)), gain * 0.8, pan, h2);
  } else if (kind === 2) {
    const base = rand(1600, 2600);
    const steps = [1, 9 / 8, 5 / 4, 3 / 2, 4 / 3];
    const notes = Math.floor(rand(2, 5));
    for (let i = 0; i < notes; i++) {
      const dur = rand(0.15, 0.34);
      const f = base * steps[Math.floor(Math.random() * steps.length)];
      const glide = rand(-0.15, 0.2);
      tone(t, k, dur, (u) => f * (1 + glide * u), (u) => fade(u, 0.12, 0.4), gain * 1.1, pan, h2 * 0.6);
      k += Math.floor((dur + rand(0.06, 0.15)) * RATE);
    }
  } else {
    const dur = rand(0.8, 1.6);
    const base = rand(2200, 3600);
    const phi = rand(0, TAU);
    tone(t, k, dur, (u) => base * (1 + 0.25 * Math.sin(TAU * 2.5 * u + phi) + 0.08 * Math.sin(TAU * 11 * u)), (u) => fade(u, 0.1, 0.25), gain * 0.7, pan, h2);
  }
}

/** Voiture qui passe : souffle des pneus qui s'ouvre puis se referme, moteur qui baisse d'un ton (Doppler). */
function car(t: Track, at: number, far: boolean) {
  const dur = rand(4, 7);
  const len = Math.floor(dur * RATE);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const amp = far ? rand(0.12, 0.25) : rand(0.35, 0.7);
  const f0 = rand(45, 85);
  const open = far ? 700 : 1500;
  let ph = 0, lp1 = 0, lp2 = 0;
  for (let i = 0; i < len; i++) {
    const x = (i / len - 0.5) * 2;
    const e = Math.exp(-x * x * 4.5);
    const alpha = 1 - Math.exp((-TAU * (220 + open * e)) / RATE);
    const w = Math.random() * 2 - 1;
    lp1 += alpha * (w - lp1);
    lp2 += alpha * (lp1 - lp2);
    ph += (TAU * f0 * (1 + 0.05 * Math.tanh(-x * 3))) / RATE;
    const engine = (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)) * 0.08;
    const p = dir * x * 0.9;
    put(t, at + i, (lp2 * 3 + engine) * e * amp, Math.sqrt((1 - p) / 2), Math.sqrt((1 + p) / 2));
  }
}

// ——— Musique (gamme pentatonique de ré : tout sonne juste avec tout) ————————————————————————————————————

const PENTA = [0, 2, 4, 7, 9];
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Notes de la gamme entre deux hauteurs MIDI. */
function scale(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (PENTA.includes((((m - 62) % 12) + 12) % 12)) out.push(m);
  return out;
}

/** Note pincée ou cloche douce : attaque, harmoniques qui s'éteignent vite, longue queue. */
function note(t: Track, at: number, f: number, { attack, decay, amp, pan, bright }: { attack: number; decay: number; amp: number; pan: number; bright: number }) {
  const len = Math.floor((attack + decay * 5) * RATE);
  const [gl, gr] = panGains(pan);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const s = i / RATE;
    const e = s < attack ? Math.sin(((Math.PI / 2) * s) / attack) : Math.exp(-(s - attack) / decay);
    ph += (TAU * f) / RATE;
    const v =
      Math.sin(ph) +
      bright * (0.3 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph) * Math.exp(-s / 0.15) + 0.2 * Math.sin(4.01 * ph) * Math.exp(-s / 0.05));
    put(t, at + i, v * e * amp, gl, gr);
  }
}

/** Battement grave et feutré (temps forts de la pulsation). */
function thump(t: Track, at: number, amp: number) {
  const len = Math.floor(0.25 * RATE);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const s = i / RATE;
    ph += (TAU * (48 + 42 * Math.exp(-s / 0.03))) / RATE;
    put(t, at + i, Math.sin(ph) * Math.exp(-s / 0.07) * amp, 0.707, 0.707);
  }
}

/** Petit « tss » léger (contretemps de la pulsation rapide). */
function tick(t: Track, at: number, amp: number, pan: number) {
  const len = Math.floor(0.05 * RATE);
  const [gl, gr] = panGains(pan);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    put(t, at + i, (w - prev) * Math.exp(-i / (0.012 * RATE)) * amp, gl, gr);
    prev = w;
  }
}

// Seizième de temps à environ 76 battements par minute, en nombre entier d'échantillons : les deux pulsations
// (8 et 7 mesures) restent calées l'une sur l'autre indéfiniment.
const STEP = 6316;
const BAR = STEP * 16;

function pulseSoft(): Track {
  const t: Track = { L: new Float32Array(BAR * 8), R: new Float32Array(BAR * 8), n: BAR * 8 };
  const notes = scale(45, 69);
  let at = Math.floor(notes.length / 2);
  for (let beat = 0; beat < 32; beat++) {
    const k = beat * 4 * STEP;
    if (beat % 2 === 0) thump(t, k, beat % 4 === 0 ? 0.5 : 0.3);
    at = Math.max(0, Math.min(notes.length - 1, at + Math.round(rand(-2, 2))));
    if (Math.random() < 0.85) note(t, k, midi(notes[at]), { attack: 0.006, decay: rand(0.35, 0.6), amp: beat % 4 === 0 ? 0.22 : 0.15, pan: rand(-0.3, 0.3), bright: 0.8 });
  }
  return t;
}

function pulseBusy(): Track {
  const t: Track = { L: new Float32Array(BAR * 7), R: new Float32Array(BAR * 7), n: BAR * 7 };
  const notes = scale(62, 86);
  const arp = [0, 2, 4, 2, 5, 3, 1, 3];
  let root = Math.floor(rand(0, 4));
  for (let step = 0; step < 16 * 7; step++) {
    const k = step * STEP;
    if (step % 16 === 0) root = Math.floor(rand(0, notes.length - 6));
    const on = step % 2 === 0 ? Math.random() < 0.75 : Math.random() < 0.22;
    if (on) note(t, k, midi(notes[root + arp[step % arp.length]]), { attack: 0.004, decay: rand(0.12, 0.28), amp: step % 4 === 0 ? 0.13 : 0.09, pan: rand(-0.6, 0.6), bright: 1 });
    if (step % 4 === 2) tick(t, k, 0.05, rand(-0.4, 0.4));
  }
  return t;
}

function freeNotes(): Track {
  const t = track(43);
  const notes = scale(62, 88);
  const count = 20;
  for (let i = 0; i < count; i++) {
    note(t, Math.floor(rand(0, t.n)), midi(notes[Math.floor(Math.random() * notes.length)]), {
      attack: rand(0.06, 0.18),
      decay: rand(1.4, 3),
      amp: rand(0.08, 0.2),
      pan: rand(-0.8, 0.8),
      bright: 0.5,
    });
  }
  return t;
}

// ——— Signaux de commande (lents, joués en boucle par le moteur audio) ———————————————————————————————————

const CONTROL_N = 8192;

/** Ondulation lente et irrégulière, parfaitement bouclée (somme de sinus à nombres de cycles entiers), de −1 à 1. */
function driftData(cycles: number[]): Float32Array {
  const d = new Float32Array(CONTROL_N);
  const ph = cycles.map(() => rand(0, TAU));
  let max = 0;
  for (let i = 0; i < CONTROL_N; i++) {
    let s = 0;
    cycles.forEach((c, k) => (s += Math.sin((TAU * c * i) / CONTROL_N + ph[k]) / Math.sqrt(c)));
    d[i] = s;
    max = Math.max(max, Math.abs(s));
  }
  for (let i = 0; i < CONTROL_N; i++) d[i] /= max;
  return d;
}

/** Suite de vagues de longueurs inégales : la houle monte, la vague se brise (écume), puis se retire. */
function wavesData(count: number): { swell: Float32Array; crash: Float32Array } {
  const swell = new Float32Array(CONTROL_N);
  const crash = new Float32Array(CONTROL_N);
  const lengths = Array.from({ length: count }, () => rand(0.7, 1.3));
  const total = lengths.reduce((a, b) => a + b, 0);
  let start = 0;
  lengths.forEach((l, w) => {
    const end = w === count - 1 ? CONTROL_N : Math.round(start + (l / total) * CONTROL_N);
    const len = end - start;
    const a = rand(0.6, 1);
    for (let j = 0; j < len; j++) {
      const p = j / len;
      const rise = p < 0.6 ? Math.sin(((Math.PI / 2) * p) / 0.6) ** 2 : Math.exp(-(p - 0.6) / 0.12) * ((1 - p) / 0.4);
      swell[start + j] = 0.1 + 0.9 * a * rise;
      crash[start + j] = p < 0.55 ? 0 : a * smooth(0.55, 0.6, p) * Math.exp(-(p - 0.6) / 0.07) * ((1 - p) / 0.45);
    }
    start = end;
  });
  return { swell, crash };
}

// ——— Scène : une ambiance branchée sur le moteur audio ——————————————————————————————————————————————

type Buffers = Map<string, AudioBuffer>;

class Scene {
  readonly bus: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private updaters: ((p: Pad) => void)[] = [];
  cancelled = false;
  private started = false;

  constructor(
    readonly ctx: AudioContext,
    out: AudioNode,
    private cache: Buffers,
    public pad: Pad,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(out);
  }

  /** Piste fabriquée une seule fois par session de l'appli (les ambiances se rechoisissent sans attente). */
  async buffer(key: string, make: () => Track | Float32Array, rms: number | null = 0.1): Promise<AudioBuffer> {
    const hit = this.cache.get(key);
    if (hit) return hit;
    await idle();
    const made = make();
    let buf: AudioBuffer;
    if (made instanceof Float32Array) {
      buf = this.ctx.createBuffer(1, made.length, RATE);
      buf.getChannelData(0).set(made);
    } else {
      if (rms !== null) normalize(made, rms);
      buf = this.ctx.createBuffer(2, made.n, RATE);
      buf.getChannelData(0).set(made.L);
      buf.getChannelData(1).set(made.R);
    }
    this.cache.set(key, buf);
    return buf;
  }

  noise(kind: "white" | "pink" | "brown", seconds: number) {
    return this.buffer(`${kind}:${seconds}`, () => noise(kind, seconds));
  }

  /** Lecture en boucle d'une piste, démarrée à un endroit au hasard. */
  loop(buffer: AudioBuffer, when?: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(when ?? this.ctx.currentTime + 0.05, when === undefined ? Math.random() * buffer.duration : 0);
    this.sources.push(src);
    return src;
  }

  filter(type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  gain(value: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  /** Branche les nœuds bout à bout ; le dernier part vers `to` (le bus de la scène par défaut). */
  chain(nodes: AudioNode[], to: AudioNode = this.bus): void {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(to);
  }

  /** Une couche : piste en boucle → filtres → gain → bus. */
  layer(buffer: AudioBuffer, filters: BiquadFilterNode[], gain: number, to?: AudioNode): GainNode {
    const g = this.gain(gain);
    this.chain([this.loop(buffer), ...filters, g], to);
    return g;
  }

  /** Fait onduler un réglage selon un signal de commande bouclé, sur une période donnée (en secondes). */
  modulate(param: AudioParam, data: Float32Array, period: number, depth: number): { depth: GainNode; source: AudioBufferSourceNode; period: number } {
    const buf = this.ctx.createBuffer(1, data.length, RATE);
    buf.getChannelData(0).set(data);
    const src = this.loop(buf);
    src.playbackRate.value = buf.duration / period;
    const g = this.gain(depth);
    src.connect(g).connect(param);
    return { depth: g, source: src, period };
  }

  /** Source arrêtée avec la scène. */
  own(node: AudioScheduledSourceNode) {
    this.sources.push(node);
  }

  /** Réglage qui suit le pavé. */
  on(fn: (p: Pad) => void) {
    this.updaters.push(fn);
    if (this.started) fn(this.pad);
  }

  set(param: AudioParam, value: number) {
    param.setTargetAtTime(value, this.ctx.currentTime, 0.25);
  }

  update(p: Pad) {
    this.pad = p;
    for (const fn of this.updaters) fn(p);
  }

  /** `level` : volume propre à l'ambiance, pour que toutes sonnent aussi fort. */
  start(level: number) {
    // Valeurs initiales posées tout de suite (pas de glissement au démarrage).
    this.started = true;
    for (const fn of this.updaters) fn(this.pad);
    this.bus.gain.setTargetAtTime(level, this.ctx.currentTime + 0.05, 0.6);
  }

  stop() {
    this.cancelled = true;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(0, t, 0.25);
    const sources = this.sources;
    window.setTimeout(() => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // Déjà arrêtée.
        }
      }
      this.bus.disconnect();
    }, 1600);
  }
}

/** Plus brillant quand c'est intense, plus sourd quand c'est calme (± 0,8 octave). */
const bright = (p: Pad) => 2 ** ((p.y - 0.5) * 1.6);
/** Profondeur des ondulations : large quand c'est fluide, plus stable quand c'est structuré. */
const flow = (p: Pad) => 0.35 + 0.65 * (1 - p.x);

async function rain(s: Scene) {
  const [pink, white, brown] = await Promise.all([s.noise("pink", 19), s.noise("white", 23), s.noise("brown", 17)]);
  const light = await s.buffer("rain:light", () => {
    const t = track(29);
    for (let i = 0; i < 29 * 16; i++) drop(t, Math.floor(rand(0, t.n)), 0.03 + 0.3 * Math.random() ** 3, rand(-0.95, 0.95));
    return t;
  });
  const heavy = await s.buffer("rain:heavy", () => {
    const t = track(31);
    for (let i = 0; i < 31 * 55; i++) drop(t, Math.floor(rand(0, t.n)), 0.015 + 0.12 * Math.random() ** 3, rand(-0.95, 0.95));
    return t;
  });
  if (s.cancelled) return;

  const bodyLp = s.filter("lowpass", 5000);
  const body = s.layer(pink, [s.filter("highpass", 320), bodyLp], 0.5);
  const sizzleHp = s.filter("highpass", 6000);
  const sizzle = s.layer(white, [sizzleHp], 0.08);
  s.layer(brown, [s.filter("lowpass", 160)], 0.35);
  const dropLp = s.filter("lowpass", 9000);
  const mix = s.gain(1);
  s.chain([dropLp, mix]);
  const gLight = s.layer(light, [], 0.8, dropLp);
  const gHeavy = s.layer(heavy, [], 0.4, dropLp);
  const swell = s.modulate(body.gain, driftData([1, 2, 3, 5]), 41, 0.1);

  s.on((p) => {
    s.set(bodyLp.frequency, 5000 * bright(p));
    s.set(sizzleHp.frequency, 6000 * bright(p) ** 0.5);
    s.set(sizzle.gain, 0.04 + 0.08 * p.y);
    s.set(body.gain, 0.4 + 0.25 * p.y);
    s.set(dropLp.frequency, 4500 * bright(p) ** 1.4);
    s.set(gLight.gain, 0.95 - 0.35 * p.y);
    s.set(gHeavy.gain, 0.15 + 0.85 * p.y);
    s.set(swell.depth.gain, 0.14 * flow(p));
  });
}

async function forest(s: Scene) {
  const [brown, pink, pink2] = await Promise.all([s.noise("brown", 23), s.noise("pink", 19), s.noise("pink", 17)]);
  const near = await s.buffer("forest:near", () => {
    const t = track(61);
    for (let i = 0; i < 17; i++) bird(t, Math.floor(rand(0, t.n)), false);
    return t;
  });
  const far = await s.buffer("forest:far", () => {
    const t = track(89);
    for (let i = 0; i < 14; i++) bird(t, Math.floor(rand(0, t.n)), true);
    return t;
  });
  if (s.cancelled) return;

  const gust = driftData([1, 2, 3, 5, 8]);
  const windBp = s.filter("bandpass", 420, 0.5);
  const wind = s.layer(brown, [windBp], 0.32);
  const windMod = s.modulate(wind.gain, gust, 53, 0.2);
  s.modulate(windBp.frequency, gust, 53, 220);
  const leavesHp = s.filter("highpass", 2400);
  const leaves = s.layer(pink, [leavesHp], 0.035);
  const leavesMod = s.modulate(leaves.gain, gust, 53, 0.03);
  const stream = s.layer(pink2, [s.filter("bandpass", 1300, 1.2)], 0.03);
  s.modulate(stream.gain, driftData([3, 7, 11, 13]), 11, 0.008);
  const birdsLp = s.filter("lowpass", 9000);
  s.chain([birdsLp, s.gain(1)]);
  const gNear = s.layer(near, [], 0.7, birdsLp);
  const gFar = s.layer(far, [], 0.5, birdsLp);

  s.on((p) => {
    s.set(wind.gain, 0.32 + 0.1 * p.y);
    s.set(windMod.depth.gain, 0.22 * flow(p));
    s.set(leavesHp.frequency, 2400 * bright(p) ** 0.6);
    s.set(leavesMod.depth.gain, 0.035 * flow(p));
    s.set(stream.gain, 0.015 + 0.03 * p.y);
    s.set(gNear.gain, 0.6 + 0.4 * p.y);
    s.set(gFar.gain, 0.6);
    s.set(birdsLp.frequency, 6000 * bright(p));
  });
}

async function ocean(s: Scene) {
  const [pink, brown, white, brown2] = await Promise.all([s.noise("pink", 19), s.noise("brown", 23), s.noise("white", 17), s.noise("brown", 29)]);
  if (s.cancelled) return;
  const a = wavesData(10);
  const b = wavesData(7);

  // Deux trains de vagues (97 s et 71 s), l'un un peu à droite, l'autre un peu à gauche.
  const panA = new StereoPannerNode(s.ctx, { pan: 0.25 });
  const panB = new StereoPannerNode(s.ctx, { pan: -0.3 });
  panA.connect(s.bus);
  panB.connect(s.bus);
  const lpA = s.filter("lowpass", 500);
  const waveA = s.layer(pink, [lpA], 0, panA);
  const swellA = s.modulate(waveA.gain, a.swell, 97, 0.55);
  const openA = s.modulate(lpA.frequency, a.swell, 97, 1400);
  const lpB = s.filter("lowpass", 450);
  const waveB = s.layer(brown, [lpB], 0, panB);
  const swellB = s.modulate(waveB.gain, b.swell, 71, 0.5);
  s.modulate(lpB.frequency, b.swell, 71, 900);
  const foamHp = s.filter("highpass", 2600);
  const foam = s.layer(white, [foamHp], 0, panA);
  const crashA = s.modulate(foam.gain, a.crash, 97, 0.12);
  s.layer(brown2, [s.filter("lowpass", 120)], 0.3);

  s.on((p) => {
    // Plus intense : houle plus forte et un peu plus rapide.
    const speed = 0.8 + 0.4 * p.y;
    for (const m of [swellA, openA, crashA]) s.set(m.source.playbackRate, m.source.buffer!.duration / (97 / speed));
    s.set(swellB.source.playbackRate, swellB.source.buffer!.duration / (71 / speed));
    s.set(swellA.depth.gain, 0.4 + 0.3 * p.y);
    s.set(openA.depth.gain, 1400 * bright(p));
    s.set(crashA.depth.gain, 0.06 + 0.12 * p.y);
    s.set(foamHp.frequency, 2600 * bright(p) ** 0.5);
  });
}

async function road(s: Scene) {
  const [brown, pink] = await Promise.all([s.noise("brown", 23), s.noise("pink", 19)]);
  const near = await s.buffer("road:near", () => {
    const t = track(73);
    for (let i = 0; i < 11; i++) car(t, Math.floor(rand(0, t.n)), false);
    return t;
  });
  const far = await s.buffer("road:far", () => {
    const t = track(97);
    for (let i = 0; i < 16; i++) car(t, Math.floor(rand(0, t.n)), true);
    return t;
  });
  if (s.cancelled) return;

  const humLp = s.filter("lowpass", 220);
  const hum = s.layer(brown, [humLp], 0.45);
  const humMod = s.modulate(hum.gain, driftData([1, 2, 3, 4, 7]), 37, 0.1);
  const city = s.layer(pink, [s.filter("bandpass", 700, 0.6)], 0.05);
  const carsLp = s.filter("lowpass", 4000);
  s.chain([carsLp, s.gain(1)]);
  const gNear = s.layer(near, [], 0.7, carsLp);
  const gFar = s.layer(far, [], 0.6, carsLp);

  s.on((p) => {
    s.set(humLp.frequency, 220 * bright(p));
    s.set(humMod.depth.gain, 0.12 * flow(p));
    s.set(city.gain, 0.03 + 0.05 * p.y);
    s.set(gNear.gain, 0.3 + 0.8 * p.y);
    s.set(gFar.gain, 0.5 + 0.2 * p.y);
    s.set(carsLp.frequency, 3000 * bright(p) ** 1.2);
  });
}

async function fire(s: Scene) {
  const [brown, pink] = await Promise.all([s.noise("brown", 23), s.noise("pink", 19)]);
  const crackles = await s.buffer("fire:crackle", () => {
    const t = track(29);
    for (let c = 0; c < 29 * 3; c++) {
      let k = Math.floor(rand(0, t.n));
      const n = Math.floor(rand(1, 8));
      for (let i = 0; i < n; i++) {
        resonant(t, k, rand(1800, 6500), rand(0.0004, 0.002), 0.0003, 0.4 + 2.5 * Math.random() ** 3, rand(-0.6, 0.6));
        k += Math.floor(rand(0.003, 0.03) * RATE);
      }
    }
    return t;
  });
  const pops = await s.buffer("fire:pops", () => {
    const t = track(37);
    for (let i = 0; i < 17; i++) resonant(t, Math.floor(rand(0, t.n)), rand(250, 900), rand(0.008, 0.02), 0.003, rand(0.6, 1.4), rand(-0.4, 0.4));
    return t;
  });
  if (s.cancelled) return;

  const roarLp = s.filter("lowpass", 600);
  const roar = s.layer(brown, [roarLp], 0.38);
  const flicker = s.modulate(roar.gain, driftData([2, 3, 5, 7, 11]), 23, 0.12);
  s.layer(pink, [s.filter("highpass", 3000)], 0.025);
  const crackLp = s.filter("lowpass", 9000);
  s.chain([crackLp, s.gain(1)]);
  const gCrack = s.layer(crackles, [], 0.6, crackLp);
  const gPops = s.layer(pops, [], 0.5, crackLp);

  s.on((p) => {
    s.set(roarLp.frequency, 600 * bright(p));
    s.set(flicker.depth.gain, 0.14 * flow(p));
    s.set(gCrack.gain, 0.3 + 0.7 * p.y);
    s.set(gPops.gain, 0.35 + 0.4 * p.y);
    s.set(crackLp.frequency, 5000 * bright(p) ** 1.3);
  });
}

async function brownNoise(s: Scene) {
  const brown = await s.noise("brown", 23);
  if (s.cancelled) return;
  const lp = s.filter("lowpass", 700);
  s.layer(brown, [lp], 0.75);
  const sway = s.modulate(lp.frequency, driftData([1, 2, 3, 5]), 47, 150);
  s.on((p) => {
    s.set(lp.frequency, 700 * bright(p));
    s.set(sway.depth.gain, 220 * flow(p));
  });
}

/** Réverbération générée (salle douce de 3 s) : la musique respire. */
function reverb(ctx: AudioContext): ConvolverNode {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * 3);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const s = i / rate;
      const alpha = 0.6 * Math.exp(-s / 0.9) + 0.05;
      lp += alpha * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp(-s / 0.75);
    }
  }
  const c = ctx.createConvolver();
  c.buffer = ir;
  return c;
}

/**
 * Couche musicale : nappe vivante (oscillateurs dont chaque voix gonfle et s'efface à son rythme), notes libres
 * (côté fluide) et pulsations (côté structuré, douce quand c'est calme, rapide quand c'est intense).
 */
async function music(s: Scene, amount: (p: Pad) => number) {
  const [soft, busy, free] = [
    await s.buffer("music:soft", pulseSoft, 0.08),
    await s.buffer("music:busy", pulseBusy, 0.07),
    await s.buffer("music:free", freeNotes, 0.06),
  ];
  if (s.cancelled) return;

  const bus = s.gain(0);
  const dry = s.gain(0.8);
  const wet = s.gain(0.4);
  const verb = reverb(s.ctx);
  bus.connect(dry).connect(s.bus);
  bus.connect(verb).connect(wet).connect(s.bus);

  // Nappe : neuf voix de la gamme, chacune avec sa respiration (périodes premières entre elles).
  const pad = s.gain(0);
  const padLp = s.filter("lowpass", 1100);
  pad.connect(padLp).connect(bus);
  const voices = [38, 45, 50, 52, 54, 57, 59, 64, 66];
  const periods = [37, 41, 43, 47, 53, 59, 61, 67, 71];
  voices.forEach((m, i) => {
    const level = 0.11 / (1 + i * 0.12);
    const g = s.gain(level);
    for (const [type, cents] of [["sine", 0], ["triangle", 4]] as const) {
      const o = new OscillatorNode(s.ctx, { type, frequency: midi(m), detune: cents });
      const og = s.gain(type === "sine" ? 1 : 0.35);
      o.connect(og).connect(g);
      o.start();
      s.own(o);
    }
    g.connect(pad);
    s.modulate(g.gain, driftData([1, 2, 3]), periods[i], level);
  });

  // Les deux pulsations démarrent ensemble : elles restent calées sur la même grille.
  const when = s.ctx.currentTime + 0.1;
  const gSoft = s.gain(0);
  const gBusy = s.gain(0);
  s.chain([s.loop(soft, when), gSoft], bus);
  s.chain([s.loop(busy, when), gBusy], bus);
  const gFree = s.layer(free, [], 0, bus);

  s.on((p) => {
    const m = amount(p);
    s.set(bus.gain, m);
    s.set(pad.gain, 0.55 - 0.2 * p.y);
    s.set(padLp.frequency, 900 * bright(p));
    s.set(gFree.gain, 0.4 * (1 - p.x));
    s.set(gSoft.gain, 0.8 * smooth(0.2, 1, p.x) * (1 - 0.7 * p.y));
    s.set(gBusy.gain, 0.8 * smooth(0.2, 1, p.x) * smooth(0.15, 1, p.y));
    s.set(wet.gain, 0.25 + 0.4 * (1 - p.x));
  });
}

async function focus(s: Scene) {
  const brown = await s.noise("brown", 23);
  if (s.cancelled) return;
  s.layer(brown, [s.filter("lowpass", 300)], 0.12);
  await music(s, () => 1);
}

const LEVEL: Record<Exclude<AmbienceKind, "none">, number> = { focus: 0.75, rain: 1, forest: 0.95, ocean: 1.25, road: 0.85, fire: 1.4, brown: 0.8 };

const SCENES: Record<Exclude<AmbienceKind, "none">, (s: Scene) => Promise<void>> = {
  focus,
  rain,
  forest,
  ocean,
  road,
  fire,
  brown: brownNoise,
};

// ——— Lecteur ———————————————————————————————————————————————————————————————————————————————————————

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Une seconde de silence en WAV : un lecteur média qui tourne garde le son vivant écran verrouillé (iPhone). */
function silentWav(): string {
  const rate = 8000;
  const n = rate;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private scene: Scene | null = null;
  private cache: Buffers = new Map();
  private keepAlive: HTMLAudioElement | null = null;
  private keepAliveUrl: string | null = null;
  private pad: Pad = PAD_DEFAULT;
  private volume = 0.7;
  private title = "Nonante";
  kind: AmbienceKind = "none";
  /** Fin de la fabrication de l'ambiance en cours (le son monte en fondu juste après). */
  ready: Promise<void> = Promise.resolve();

  private onVisible = () => {
    if (document.visibilityState === "visible" && this.kind !== "none") this.wake();
  };

  /** À appeler pendant un geste de l'utilisateur (iOS n'autorise le son qu'à ce moment-là). */
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      // « Lecture » : le son passe même en mode silencieux et continue écran verrouillé (Safari 16.4+).
      const nav = navigator as AudioSessionNavigator;
      try {
        if (nav.audioSession) nav.audioSession.type = "playback";
      } catch {
        // Non pris en charge.
      }
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC({ latencyHint: "playback" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      // Limiteur doux : jamais de saturation, même quand plusieurs couches culminent ensemble.
      const limiter = new DynamicsCompressorNode(this.ctx, { threshold: -10, knee: 8, ratio: 8, attack: 0.005, release: 0.3 });
      // Puis un écrêtage arrondi : les rares crêtes restantes s'arrondissent au lieu de claquer.
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 512 - 1) * 1.5)) / Math.tanh(1.5);
      const clip = new WaveShaperNode(this.ctx, { curve });
      this.master.connect(limiter).connect(clip).connect(this.ctx.destination);
      this.ctx.addEventListener("statechange", () => {
        if (this.ctx && this.ctx.state !== "running" && this.kind !== "none" && document.visibilityState === "visible") void this.ctx.resume().catch(() => {});
      });
      document.addEventListener("visibilitychange", this.onVisible);
    }
    this.wake();
    return this.ctx;
  }

  private wake() {
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    if (this.kind === "none") return;
    if (!this.keepAlive) {
      this.keepAliveUrl = silentWav();
      const el = new Audio(this.keepAliveUrl);
      el.loop = true;
      el.setAttribute("playsinline", "");
      this.keepAlive = el;
    }
    if (this.keepAlive.paused) void this.keepAlive.play().catch(() => {});
    this.mediaSession("playing");
  }

  private mediaSession(state: "playing" | "paused" | "none") {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = state;
      if (state === "playing") {
        ms.metadata = new MediaMetadata({ title: this.title, artist: "Nonante", artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
        ms.setActionHandler("pause", () => {
          void this.ctx?.suspend();
          this.keepAlive?.pause();
          ms.playbackState = "paused";
        });
        ms.setActionHandler("play", () => this.wake());
      } else if (state === "none") {
        ms.metadata = null;
        ms.setActionHandler("pause", null);
        ms.setActionHandler("play", null);
      }
    } catch {
      // Contrôles de l'écran verrouillé indisponibles : sans conséquence.
    }
  }

  /** Nom affiché sur l'écran verrouillé. */
  setTitle(title: string) {
    this.title = title;
    if (this.kind !== "none") this.mediaSession("playing");
  }

  setVolume(v: number) {
    this.volume = clamp(v);
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.15);
  }

  setPad(p: Pad) {
    this.pad = { x: clamp(p.x), y: clamp(p.y) };
    this.scene?.update(this.pad);
  }

  play(kind: AmbienceKind) {
    if (kind === this.kind && this.scene) return;
    this.scene?.stop();
    this.scene = null;
    this.kind = kind;
    if (kind === "none") {
      this.idle();
      return;
    }
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const scene = new Scene(ctx, this.master, this.cache, this.pad);
    this.scene = scene;
    this.ready = (async () => {
      await SCENES[kind](scene);
      if (scene.cancelled) return;
      scene.start(LEVEL[kind]);
      // Ambiances de nature : la pulsation musicale, discrète, n'arrive que vers « structuré » (fabriquée après, sans retarder le son).
      if (kind !== "focus" && kind !== "brown") await music(scene, (p) => 0.45 * smooth(0.3, 1, p.x));
    })().catch(() => {});
  }

  private idle() {
    this.keepAlive?.pause();
    this.mediaSession("none");
  }

  /** Coupe le son en fondu (fin de session, page quittée). */
  stop() {
    this.scene?.stop();
    this.scene = null;
    this.kind = "none";
    this.idle();
  }

  dispose() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisible);
    const ctx = this.ctx;
    this.ctx = null;
    if (this.keepAlive) {
      this.keepAlive.removeAttribute("src");
      this.keepAlive = null;
    }
    if (this.keepAliveUrl) URL.revokeObjectURL(this.keepAliveUrl);
    window.setTimeout(() => void ctx?.close().catch(() => {}), 1800);
  }
}
