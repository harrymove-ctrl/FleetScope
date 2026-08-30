/* Measured, table-driven sunset-slam renderer adapted for FleetScope. */
const FPS = 25,
  FRAMES = 89,
  REF_W = 1500,
  VP_DEPTH = 2.17,
  WORD_W = 726,
  WORD_H = 122;
const OUTLINE = 0.084,
  IGNITE_AT = 15,
  BRIDGE_AT = 38,
  SETTLE_BRIDGE = 5,
  OUTRO = 11;
const RAMP: [number, [number, number, number]][] = [
  [0, [18, 24, 66]],
  [0.22, [24, 30, 84]],
  [0.42, [38, 40, 108]],
  [0.58, [58, 49, 128]],
  [0.7, [86, 58, 142]],
  [0.79, [124, 68, 148]],
  [0.86, [168, 84, 142]],
  [0.885, [186, 100, 132]],
  [0.91, [206, 122, 120]],
  [0.945, [234, 152, 106]],
  [0.968, [248, 184, 104]],
  [0.985, [253, 214, 128]],
  [1, [255, 240, 190]],
];
const WW = [
  506, 552, 600, 617, 625, 631, 635, 636, 634, 631, 625, 617, 593, 412, 302, 309, 335, 403, 612,
  726, 792, 835, 864, 885, 901, 913, 922, 930, 937, 942, 946, 950, 952, 952, 949, 937, 919, 904,
  870, 476, 519, 545, 582, 611, 621, 628, 632, 635, 635, 635, 637, 637, 637, 637, 637, 637, 637,
  637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637,
  637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637, 637,
];
const WCY = [
  500, 495, 489.5, 487.5, 486.5, 486, 485.5, 485.5, 485.5, 486, 486.5, 487.5, 492, 515, 532, 529.5,
  527, 507.5, 425, 393.5, 378, 367.5, 360, 353, 345, 338, 332, 328, 324, 321, 318, 316.5, 315.5,
  315.5, 316, 320, 325.5, 329, 341, 545, 540, 513, 499, 491, 487, 485.5, 485.5, 486, 486, 486,
  485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5,
  485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5,
  485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5, 485.5,
  485.5,
];
const D = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17, 29, 63, 160, 215, 246, 267, 281, 290, 298, 304,
  309, 312, 315, 318, 320, 321, 322, 322, 321, 314, 305, 291, 259, 47, 44, 50, 56, 60, 63, 65, 66,
  66, 66, 66, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
  67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
];
const OFF = [
  0.784, 0.884, 0.055, 1.031, 0.952, 0.774, 0.65, 0.518, 0.397, 0.312, 0.246, 0.173, 0.133, 0.001,
  -0.018, -0.001, -0.024, 0.104, 0.104, 0.104, 0.003, -0.003, 0.163, 0.177, 0.15, 0.12, 0.1, 0.08,
  0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
  0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
  0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08,
];
const SPAN = [
  -0.025, 0.097, 0.635, -0.539, -0.156, 0.117, 0.282, 0.446, 0.578, 0.654, 0.716, 0.791, 0.806,
  0.934, 0.959, 0.925, 0.965, 0.799, 0.799, 0.804, 0.923, 0.952, 0.768, 0.598, 0.1, 0.06, 0.04, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const TIPP = [
  0.756, 0.977, 0.673, 0.37, 0.7, 0.773, 0.845, 0.878, 0.908, 0.932, 0.95, 0.977, 1, 0.977, 0.977,
  0.977, 0.977, 0.977, 0.977, 0.977, 0.967, 0.967, 0.977, 0.87, 0.4, 0.252, 0.252, 0.254, 0.252,
  0.252, 0.252, 0.254, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252,
  0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252,
  0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252,
  0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252,
  0.252, 0.252, 0.252, 0.252, 0.252, 0.252, 0.252,
];
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => {
  const k = clamp(v);
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const at = (table: number[], u: number): number => {
  if (u <= 0) return table[0]!;
  if (u >= table.length - 1) return table[table.length - 1]!;
  const i = Math.floor(u);
  return table[i]! + (table[i + 1]! - table[i]!) * (u - i);
};
const bridge = (u: number): number => {
  if (u < BRIDGE_AT) return u;
  const span = SETTLE_BRIDGE + 1;
  if (u < BRIDGE_AT + span) {
    const k = (u - BRIDGE_AT) / span;
    return BRIDGE_AT + 1 - (1 - k) ** 3;
  }
  return u - SETTLE_BRIDGE;
};

export class DashboardSunsetSlam {
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private t0 = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private hover = 0;
  private hoverTo = 0;
  private lut: string[] = [];
  private key = '';
  readonly ok: boolean;
  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.ok = this.ctx !== null;
    this.buildLut();
    this.resizeNow();
  }
  private buildLut(): void {
    let src: [number, number, number][] = [];
    for (let i = 0; i < 256; i++) {
      const u = i / 255;
      let j = 0;
      while (j < RAMP.length - 2 && RAMP[j + 1]![0] < u) j++;
      const a = RAMP[j]!,
        b = RAMP[j + 1]!,
        k = smooth((u - a[0]) / (b[0] - a[0]));
      src.push([lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k)]);
    }
    for (let pass = 0; pass < 2; pass++)
      src = src.map((_, i) => {
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let o = -7; o <= 7; o++) {
          const j = Math.max(0, Math.min(255, i + o));
          r += src[j]![0];
          g += src[j]![1];
          b += src[j]![2];
          n++;
        }
        return [r / n, g / n, b / n];
      });
    this.lut = src.map(([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
  }
  private color(v: number): string {
    return this.lut[Math.max(0, Math.min(255, Math.round(clamp(v) * 255)))]!;
  }
  resizeNow(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.key = '';
  }
  setHover(on: boolean): void {
    this.hoverTo = on ? 1 : 0;
  }
  start(): void {
    if (this.running || !this.ok) return;
    this.running = true;
    this.t0 = performance.now();
    this.last = this.t0;
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(Math.max((now - this.last) / 1000, 1 / 240), 0.1);
      this.last = now;
      const rate = this.hoverTo > this.hover ? 0.24 : 0.48;
      this.hover += (this.hoverTo - this.hover) * (1 - Math.exp(-dt / rate));
      this.draw(bridge((((now - this.t0) / 1000) * FPS) % (FRAMES + SETTLE_BRIDGE + OUTRO)));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  destroy(): void {
    this.stop();
    this.ctx = null;
  }
  private draw(u: number): void {
    const c = this.ctx;
    if (!c) return;
    const ok = u <= FRAMES - 1 ? 0 : smooth(clamp((u - FRAMES + 1) / OUTRO));
    const og = ok < 0.28 ? 0 : smooth((ok - 0.28) / 0.72);
    const ww = lerp(at(WW, u), WW[0]!, og),
      wcy = lerp(at(WCY, u), WCY[0]!, og),
      depth = at(D, u) * (1 - ok);
    let off = at(OFF, Math.max(0, u - IGNITE_AT)),
      span = at(SPAN, Math.max(0, u - IGNITE_AT)),
      tipp = at(TIPP, Math.max(0, u - IGNITE_AT));
    if (u > 42) {
      const k = smooth(clamp((u - 42) / 10));
      off = lerp(off, 0.06, k);
      span = lerp(span, 0.42, k);
      tipp = lerp(tipp, 0.62, k);
    }
    off += 0.075 * this.hover;
    span += 0.06 * this.hover * Math.sign(span || 1);
    tipp += 0.075 * this.hover;
    const key = `${ww.toFixed(1)}|${wcy.toFixed(1)}|${depth.toFixed(1)}|${off.toFixed(3)}|${span.toFixed(3)}|${tipp.toFixed(3)}|${this.hover.toFixed(3)}`;
    if (key === this.key) return;
    this.key = key;
    const dpr = this.dpr,
      W = this.canvas.width / dpr,
      H = this.canvas.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#080b16');
    sky.addColorStop(0.78, '#171a33');
    sky.addColorStop(1, '#0b0f1f');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    const sc = W / REF_W;
    c.translate(0, H / 2 - 467.5 * sc);
    c.scale(sc, sc);
    const ws = ww / WORD_W,
      wh = WORD_H * ws,
      wx = REF_W / 2 - ww / 2,
      wy = wcy - wh / 2,
      base = wy + wh,
      vp = VP_DEPTH * wh;
    const word = (fill: string | CanvasGradient, stroke: string | null, a: number, s: number) => {
      c.save();
      c.translate(REF_W / 2, base + vp);
      c.scale(s, s);
      c.translate(-REF_W / 2, -(base + vp));
      c.translate(wx, wy);
      c.scale(ws, ws);
      c.font = '800 122px ui-sans-serif,system-ui,sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.globalAlpha = a;
      c.fillStyle = fill;
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = (2 * OUTLINE * WORD_H) / ws;
        c.strokeText('FleetScope', WORD_W / 2, WORD_H / 2);
      }
      c.fillText('FleetScope', WORD_W / 2, WORD_H / 2);
      c.restore();
    };
    const glow = c.createRadialGradient(REF_W / 2, base + 0.35 * wh, 0, REF_W / 2, base, 0.95 * ww);
    glow.addColorStop(0, 'rgba(255,198,120,.24)');
    glow.addColorStop(0.42, 'rgba(168,84,142,.09)');
    glow.addColorStop(1, 'rgba(9,12,28,0)');
    c.fillStyle = glow;
    c.fillRect(-REF_W, -REF_W, REF_W * 3, REF_W * 3);
    if (u >= IGNITE_AT && depth > 1) {
      const n = Math.min(260, Math.max(12, Math.ceil(depth)));
      c.lineJoin = 'miter';
      for (let i = n; i >= 0; i--) {
        const dd = (depth * i) / n,
          f = dd / Math.max(depth, 1),
          q = 1 - dd / vp;
        let p = off + span * f;
        if (f > 0.9) p = lerp(p, tipp, Math.min(1, (f - 0.9) / 0.07));
        const col = this.color(p);
        word(col, col, 0.12 + 0.83 * (1 - f), q);
      }
    }
    const face = c.createLinearGradient(0, 0, 0, WORD_H);
    face.addColorStop(0, '#f4f4fb');
    face.addColorStop(0.18, '#fff');
    face.addColorStop(1, '#c9cbe4');
    word(face, null, 1, 1);
    if (u >= IGNITE_AT) {
      const rim = c.createLinearGradient(0, WORD_H * (1 - 0.45), 0, WORD_H);
      rim.addColorStop(0, 'rgba(255,220,150,0)');
      rim.addColorStop(1, `rgba(255,190,120,${(0.3 * (1 - ok)).toFixed(3)})`);
      word(rim, null, 1, 1);
    }
  }
}
