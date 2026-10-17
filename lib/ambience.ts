// Sons d'ambiance du minuteur, synthétisés dans le navigateur (Web Audio) : aucun fichier à télécharger, aucun droit
// d'auteur, rien qui sorte du téléphone. Chaque ambiance est faite de bruit filtré (pluie, vent, vagues, moteur)
// et de petits évènements tirés au hasard (gouttes, oiseaux, voitures, crépitements).

export const AMBIENCES = ["none", "rain", "forest", "road", "ocean", "fire", "brown"] as const;
export type AmbienceKind = (typeof AMBIENCES)[number];

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, kind: "white" | "pink" | "brown", seconds = 6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "white") data[i] = white * 0.5;
      else if (kind === "pink") {
        // Filtre de Paul Kellet.
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    // Fondu sur quelques millisecondes aux deux bouts : la boucle ne claque pas.
    const fade = Math.floor(ctx.sampleRate * 0.03);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      data[i] *= g;
      data[length - 1 - i] *= g;
    }
  }
  return buffer;
}

// Sources de l'ambiance en cours : arrêtées ensemble à la fin du fondu.
let running: AudioScheduledSourceNode[] = [];

/** Une couche de bruit en boucle, filtrée, avec son gain. */
function layer(ctx: Ctx, out: AudioNode, buffer: AudioBuffer, filters: BiquadFilterNode[], gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = Math.random() * 2;
  const g = ctx.createGain();
  g.gain.value = gain;
  let node: AudioNode = src;
  for (const f of filters) {
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  src.start(0, Math.random() * buffer.duration);
  running.push(src);
  return { src, gain: g };
}

function filter(ctx: Ctx, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** Oscillation lente d'un paramètre (vagues, vent). */
function lfo(ctx: Ctx, target: AudioParam, rate: number, depth: number) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start();
  running.push(o);
  return o;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambience {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private stops: (() => void)[] = [];
  private timers: number[] = [];
  private white: AudioBuffer | null = null;
  kind: AmbienceKind = "none";
  private volume = 0.7;

  /** À appeler pendant un geste de l'utilisateur (iOS n'autorise le son qu'à ce moment-là). */
  private ensure(): Ctx | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master && this.kind !== "none") this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.15);
  }

  play(kind: AmbienceKind) {
    if (kind === this.kind && this.stops.length) return;
    this.clear();
    this.kind = kind;
    if (kind === "none") return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    running = [];
    this.white ??= noiseBuffer(ctx, "white", 2);
    this.build(ctx, kind, bus);
    const sources = running;
    bus.gain.setTargetAtTime(1, ctx.currentTime, 0.35);
    this.stops.push(() => {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      window.setTimeout(() => {
        for (const n of sources) {
          try {
            n.stop();
          } catch {
            // Déjà arrêtée.
          }
        }
        bus.disconnect();
      }, 700);
    });
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.volume * 0.9, ctx.currentTime, 0.2);
  }

  /** Coupe le son en fondu (fin de session, page quittée). */
  stop() {
    this.clear();
    this.kind = "none";
  }

  dispose() {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    window.setTimeout(() => void ctx?.close().catch(() => {}), 900);
  }

  private clear() {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    const stops = this.stops;
    this.stops = [];
    for (const s of stops) s();
  }

  /** Évènement répété au hasard (goutte, oiseau, voiture…), tant que l'ambiance joue. */
  private every(min: number, max: number, fn: () => void) {
    const loop = () => {
      fn();
      this.timers.push(window.setTimeout(loop, rand(min, max)));
    };
    this.timers.push(window.setTimeout(loop, rand(min, max)));
  }

  /** Petit éclat de bruit filtré (goutte, crépitement). */
  private burst(ctx: Ctx, out: AudioNode, { freq, q, gain, length, pan }: { freq: number; q: number; gain: number; length: number; pan: number }) {
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = filter(ctx, "bandpass", freq, q);
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(p).connect(out);
    src.start(t, Math.random() * 1.5, length + 0.05);
  }

  private build(ctx: Ctx, kind: AmbienceKind, out: GainNode) {
    switch (kind) {
      case "rain": {
        const pink = noiseBuffer(ctx, "pink");
        layer(ctx, out, pink, [filter(ctx, "highpass", 400), filter(ctx, "lowpass", 7000)], 0.55);
        layer(ctx, out, noiseBuffer(ctx, "white"), [filter(ctx, "bandpass", 5000, 0.4)], 0.06);
        this.every(25, 110, () => this.burst(ctx, out, { freq: rand(1800, 5500), q: rand(2, 6), gain: rand(0.05, 0.22), length: rand(0.02, 0.06), pan: rand(-0.9, 0.9) }));
        break;
      }
      case "forest": {
        const wind = layer(ctx, out, noiseBuffer(ctx, "brown"), [filter(ctx, "lowpass", 520)], 0.35);
        lfo(ctx, wind.gain.gain, 0.07, 0.15);
        const leaves = layer(ctx, out, noiseBuffer(ctx, "pink"), [filter(ctx, "highpass", 2500)], 0.035);
        lfo(ctx, leaves.gain.gain, 0.11, 0.025);
        this.every(1800, 5200, () => this.bird(ctx, out));
        break;
      }
      case "road": {
        layer(ctx, out, noiseBuffer(ctx, "brown"), [filter(ctx, "lowpass", 300)], 0.55);
        layer(ctx, out, noiseBuffer(ctx, "pink"), [filter(ctx, "bandpass", 900, 0.5)], 0.05);
        this.every(2500, 7000, () => this.car(ctx, out));
        break;
      }
      case "ocean": {
        const waves = layer(ctx, out, noiseBuffer(ctx, "pink"), [filter(ctx, "lowpass", 1100)], 0.35);
        lfo(ctx, waves.gain.gain, 0.09, 0.3);
        const foam = layer(ctx, out, noiseBuffer(ctx, "white"), [filter(ctx, "highpass", 3000)], 0.03);
        lfo(ctx, foam.gain.gain, 0.09, 0.028);
        break;
      }
      case "fire": {
        layer(ctx, out, noiseBuffer(ctx, "brown"), [filter(ctx, "lowpass", 700)], 0.4);
        this.every(30, 260, () =>
          this.burst(ctx, out, { freq: rand(1500, 6000), q: rand(0.8, 3), gain: rand(0.04, 0.3), length: rand(0.004, 0.025), pan: rand(-0.6, 0.6) }),
        );
        this.every(900, 3000, () => this.burst(ctx, out, { freq: rand(300, 900), q: 1, gain: rand(0.2, 0.45), length: rand(0.04, 0.09), pan: rand(-0.4, 0.4) }));
        break;
      }
      case "brown": {
        layer(ctx, out, noiseBuffer(ctx, "brown"), [filter(ctx, "lowpass", 900)], 0.7);
        break;
      }
    }
  }

  /** Oiseau : quelques notes qui glissent vers l'aigu, placées à gauche ou à droite. */
  private bird(ctx: Ctx, out: AudioNode) {
    const notes = Math.floor(rand(2, 6));
    const base = rand(2200, 3800);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rand(-0.9, 0.9);
    pan.connect(out);
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = "sine";
      const g = ctx.createGain();
      const len = rand(0.05, 0.12);
      o.frequency.setValueAtTime(base * rand(0.9, 1.1), t);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.6), t + len);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(rand(0.025, 0.06), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + len + 0.02);
      t += len + rand(0.03, 0.09);
    }
  }

  /** Voiture qui passe : bruit grave qui monte, traverse de gauche à droite, puis s'éloigne. */
  private car(ctx: Ctx, out: AudioNode) {
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.loop = true;
    const f = filter(ctx, "lowpass", 400, 0.8);
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    const t = ctx.currentTime;
    const dur = rand(3, 5.5);
    const dir = Math.random() < 0.5 ? -1 : 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rand(0.08, 0.18), t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(rand(900, 1400), t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(250, t + dur);
    p.pan.setValueAtTime(-0.9 * dir, t);
    p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
    src.connect(f).connect(g).connect(p).connect(out);
    src.start(t);
    src.stop(t + dur + 0.1);
  }
}
