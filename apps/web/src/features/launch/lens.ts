/**
 * The card renderer and the liquid-glass lens over it.
 *
 * # Attribution
 *
 * The lens mathematics — elliptical mask, inward pull, tangential rim waves,
 * weighted multi-sample chromatic dispersion, centre nova, ring plus aura, and
 * the bright rim line — are adapted from the `liquid-glass-carousel` engine,
 * MIT licensed, Copyright (c) 2026 Yousuf Soomro, as vendored into NeuroPay at
 * commit 010d0ec187e038e6e57d945f63b57fd21ad373a9
 * (`packages/carousel/src/engine.js`). See THIRD-PARTY-NOTICES.md.
 *
 * This is an adaptation: the original is three.js and GSAP, this is raw WebGL
 * with no dependency. The two-pass structure is the same, because that is what
 * makes the effect read as glass — the lens bends a rendered scene, including
 * the gaps between cards, rather than blurring each card separately.
 *
 * # Tuning
 *
 * The appearance constants are the reference's dark-page values, not its
 * upstream defaults. Upstream (glow 4.2, ring 6, rim line 1.4) was built
 * against a white page; the NeuroPay configuration dials them back hard for a
 * near-black one, noting that otherwise they "bloom into an opaque band that
 * swallows the cards". This page is near-black, so the dialled-back set is
 * correct here.
 */

import { cappedPixelRatio } from './motion';

const QUAD_VERT = `#version 100
attribute vec2 a_position;
uniform vec4 u_rect;   // x, y, w, h in clip space
varying vec2 v_uv;
void main() {
  // No V flip here: the image is flipped once, at upload, by
  // UNPACK_FLIP_Y_WEBGL. Doing it in both places cancels out to upside down.
  v_uv = a_position;
  vec2 pos = u_rect.xy + a_position * u_rect.zw;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const CARD_FRAG = `#version 100
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
void main() {
  vec3 c = texture2D(u_tex, v_uv).rgb;
  gl_FragColor = vec4(c * u_alpha, 1.0);
}`;

const FULL_VERT = `#version 100
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const LENS_FRAG = `#version 100
precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_phase;
uniform float u_fx;

/*
 * Theme uniforms.
 *
 * These were GLSL constants. They are uniforms so the shader can be themed
 * from theme.css like everything else on the page: the mount reads the
 * the --lens-* CSS custom properties and feeds them here. A theme that stopped at the
 * DOM boundary would leave the most visible element on the page unthemed.
 */
uniform vec3 u_tint;
uniform float u_glow;
uniform float u_whiteGlow;
uniform float u_dispersion;
uniform float u_ring;
uniform float u_rimLine;
uniform vec2 u_size;

const int MAX_SAMPLES = 10;

/* Lens geometry, appearance and tint now arrive as uniforms from theme.css.
   Only the static rotation stays here — it shapes the rim wave and is not a
   thing a theme should be choosing. */
const float ROTATION = 1.134;

/* Shape constants the theme has no business choosing. */
const float NOVA_SIZE = 12.0;
const float RING_RADIUS = 0.49;
const float RING_WIDTH = 0.012;
const float RIM_LINE_POS = 0.488;
const float RIM_LINE_WIDTH = 0.003;
const float SHIMMER_FREQ = 12.0;
const float SHIMMER_DEPTH = 0.1;
const float RIM_START = 0.578;
const float RIM_TANGENTIAL = 0.6;
const float RIM_FREQ1 = 2.0;
const float RIM_FREQ2 = 1.0;
const float ZOOM = 0.55;

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec3 outc = texture2D(u_tex, v_uv).rgb;

  if (u_fx > 0.001) {
    vec2 p = v_uv - u_center;
    p.x *= aspect;
    float ca = cos(ROTATION), sa = sin(ROTATION);
    p = mat2(ca, -sa, sa, ca) * p;

    float nd = length(p / u_size);
    if (nd <= 1.0) {
      float shapeND = clamp(nd, 0.0, 1.0);
      vec2 offset = v_uv - u_center;
      vec2 radialDir = normalize(offset + 1e-6);
      vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
      float angle = atan(p.y, p.x);

      float pull = ZOOM * 0.30 * (nd * nd);
      float rimStrength = smoothstep(RIM_START, 1.0, nd);
      float fluidWave = sin(angle * RIM_FREQ1) * 0.55 + sin(angle * RIM_FREQ2) * 0.25;
      float rScreen = (u_size.x + u_size.y) * 0.5;
      vec2 rimOff = tangentDir * fluidWave * rimStrength * rScreen * RIM_TANGENTIAL;
      vec2 baseUV = u_center + offset * (1.0 - pull) + rimOff;

      float rimMask = smoothstep(0.55, 1.0, nd);
      vec2 dispDir = offset * u_dispersion * 0.004 * rimMask;
      vec3 col = vec3(0.0);
      vec3 weight = vec3(0.0);
      for (int i = 0; i < MAX_SAMPLES; i++) {
        float t = float(i) / float(MAX_SAMPLES - 1);
        vec3 s = texture2D(u_tex, baseUV + dispDir * (t - 0.5)).rgb;
        vec3 w = vec3(
          exp(-pow((t - 0.00) / 0.38, 2.0)),
          exp(-pow((t - 0.50) / 0.38, 2.0)),
          exp(-pow((t - 1.00) / 0.38, 2.0))
        );
        col += s * w;
        weight += w;
      }
      col /= max(weight, vec3(0.001));

      col *= mix(0.91, 1.0, smoothstep(0.0, 0.38, shapeND));

      float r2 = shapeND * shapeND * 0.25;
      float gs = max(NOVA_SIZE * u_glow * 0.003, 0.004);
      float nova = exp(-r2 / gs) + exp(-r2 / (gs * 7.0)) * 0.18;
      col += vec3(nova * u_whiteGlow * (u_glow / 17.0) * 1.15);

      float dC = shapeND * 0.5;
      float ring = exp(-pow((dC - RING_RADIUS) / RING_WIDTH, 2.0));
      ring *= u_ring * (u_glow / 17.0) * 1.8;
      ring *= sin(angle * SHIMMER_FREQ + u_phase) * SHIMMER_DEPTH + (1.0 - SHIMMER_DEPTH);
      float aura = exp(-pow((dC - RING_RADIUS) / (RING_WIDTH * 6.0), 2.0)) * 0.28 * u_ring * (u_glow / 17.0);
      col += u_tint * (ring + aura);
      col += vec3(exp(-pow((dC - RIM_LINE_POS) / RIM_LINE_WIDTH, 2.0)) * u_rimLine);

      outc = mix(outc, col, smoothstep(1.0, 0.93, nd) * u_fx);
    }
  }

  gl_FragColor = vec4(outc, 1.0);
}`;

export interface RenderState {
  readonly scroll: number;
  readonly height: number;
  readonly gap: number;
  readonly shrink: number;
  readonly entry: number;
  readonly grow: number;
  readonly entryStaggerMs: number;
  readonly growStaggerMs: number;
  readonly elapsed: number;
  readonly focusIndex: number;
  readonly focusProgress: number;
  readonly closing: boolean;
}

export interface LensPass {
  render(state: RenderState): void;
  dispose(): void;
}

export interface LensPassOptions {
  readonly cards: readonly { readonly src: string; readonly aspect: number }[];
  readonly onFallback: (reason: string) => void;
}

interface CompileResult {
  readonly shader: WebGLShader | null;
  readonly log: string;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): CompileResult {
  const shader = gl.createShader(type);
  if (shader === null) return { shader: null, log: 'createShader returned null' };
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    const log = gl.getShaderInfoLog(shader) ?? 'no info log';
    gl.deleteShader(shader);
    return { shader: null, log };
  }
  return { shader, log: '' };
}

function link(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): { program: WebGLProgram | null; log: string } {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (vert.shader === null || frag.shader === null) {
    return { program: null, log: vert.log || frag.log };
  }
  const program = gl.createProgram();
  if (program === null) return { program: null, log: 'createProgram returned null' };
  gl.attachShader(program, vert.shader);
  gl.attachShader(program, frag.shader);
  gl.linkProgram(program);
  gl.deleteShader(vert.shader);
  gl.deleteShader(frag.shader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    return { program: null, log: gl.getProgramInfoLog(program) ?? 'no info log' };
  }
  return { program, log: '' };
}

/** Mount the two-pass renderer. Returns null when it cannot run. */
export function mountLensPass(
  canvas: HTMLCanvasElement,
  options: LensPassOptions,
): LensPass | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    options.onFallback('zero-size host');
    return null;
  }

  const gl =
    (canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) as WebGLRenderingContext | null) ?? null;

  if (gl === null) {
    options.onFallback('no webgl context');
    return null;
  }

  const cardProgram = link(gl, QUAD_VERT, CARD_FRAG);
  const lensProgram = link(gl, FULL_VERT, LENS_FRAG);
  if (cardProgram.program === null || lensProgram.program === null) {
    options.onFallback(
      `shader failed: ${(cardProgram.log || lensProgram.log).trim().slice(0, 160)}`,
    );
    return null;
  }
  const cardProg: WebGLProgram = cardProgram.program;
  const lensProg: WebGLProgram = lensProgram.program;

  // A unit quad for cards, and a full-screen triangle for the lens pass.
  const unitQuad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, unitQuad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    gl.STATIC_DRAW,
  );
  const fullTri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullTri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const cardPos = gl.getAttribLocation(cardProg, 'a_position');
  const cardRect = gl.getUniformLocation(cardProg, 'u_rect');
  const cardTex = gl.getUniformLocation(cardProg, 'u_tex');
  const cardAlpha = gl.getUniformLocation(cardProg, 'u_alpha');

  /**
   * Read a `--lens-*` custom property.
   *
   * Custom properties come back as their raw token, so a colour needs the
   * browser to resolve it. Assigning it to a probe's `color` and reading the
   * computed value handles hex, `rgb()` and named colours without this module
   * owning a colour parser.
   */
  const readTheme = (): {
    tint: [number, number, number];
    clear: [number, number, number];
    glow: number;
    whiteGlow: number;
    dispersion: number;
    ring: number;
    rimLine: number;
    size: [number, number];
  } => {
    const style = getComputedStyle(canvas);
    const num = (name: string, fallback: number): number => {
      const value = Number.parseFloat(style.getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };

    let tint: [number, number, number] = [0.37, 0.89, 1];
    const raw = style.getPropertyValue('--lens-tint').trim();
    if (raw !== '') {
      const probe = document.createElement('span');
      probe.style.color = raw;
      probe.style.display = 'none';
      canvas.parentElement?.append(probe);
      const resolved = getComputedStyle(probe).color.match(/[\d.]+/g);
      probe.remove();
      if (resolved && resolved.length >= 3) {
        tint = [Number(resolved[0]) / 255, Number(resolved[1]) / 255, Number(resolved[2]) / 255];
      }
    }

    // The clear colour must match the page's carousel backdrop, or the gaps
    // between cards show as seams against the framebuffer.
    let clear: [number, number, number] = [0.02, 0.024, 0.039];
    const rawInk = style.getPropertyValue('--carousel-ink').trim();
    if (rawInk !== '') {
      const probe = document.createElement('span');
      probe.style.color = rawInk;
      probe.style.display = 'none';
      canvas.parentElement?.append(probe);
      const resolved = getComputedStyle(probe).color.match(/[\d.]+/g);
      probe.remove();
      if (resolved && resolved.length >= 3) {
        clear = [Number(resolved[0]) / 255, Number(resolved[1]) / 255, Number(resolved[2]) / 255];
      }
    }

    return {
      tint,
      clear,
      glow: num('--lens-glow', 0.9),
      whiteGlow: num('--lens-white-glow', 0.05),
      dispersion: num('--lens-dispersion', 7),
      ring: num('--lens-ring', 1.1),
      rimLine: num('--lens-rim-line', 0.32),
      size: [num('--lens-size-x', 0.565), num('--lens-size-y', 1)],
    };
  };

  const lensPos = gl.getAttribLocation(lensProg, 'a_position');
  const lensTex = gl.getUniformLocation(lensProg, 'u_tex');
  const lensRes = gl.getUniformLocation(lensProg, 'u_res');
  const lensCenter = gl.getUniformLocation(lensProg, 'u_center');
  const lensPhase = gl.getUniformLocation(lensProg, 'u_phase');
  const lensFx = gl.getUniformLocation(lensProg, 'u_fx');
  const lensTint = gl.getUniformLocation(lensProg, 'u_tint');
  const lensGlow = gl.getUniformLocation(lensProg, 'u_glow');
  const lensWhiteGlow = gl.getUniformLocation(lensProg, 'u_whiteGlow');
  const lensDispersion = gl.getUniformLocation(lensProg, 'u_dispersion');
  const lensRing = gl.getUniformLocation(lensProg, 'u_ring');
  const lensRimLine = gl.getUniformLocation(lensProg, 'u_rimLine');
  const lensSize = gl.getUniformLocation(lensProg, 'u_size');

  let theme = readTheme();

  /*
   * Re-read on a theme change.
   *
   * A colour-scheme switch is a media query, not an event the canvas would
   * otherwise notice, so without this the page would flip to light and the
   * lens would keep its dark tuning.
   */
  const schemeQuery = window.matchMedia('(prefers-color-scheme: light)');
  const onThemeChange = (): void => {
    theme = readTheme();
  };
  schemeQuery.addEventListener('change', onThemeChange);
  const themeObserver =
    typeof MutationObserver === 'function' ? new MutationObserver(onThemeChange) : null;
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // One texture per card. A card whose image has not arrived is skipped, so a
  // slow network shows a shorter row rather than a row of grey rectangles.
  const textures = options.cards.map(() => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      1,
      1,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array([10, 12, 16]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  });
  const ready: boolean[] = options.cards.map(() => false);

  options.cards.forEach((card, index) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, textures[index] ?? null);
      // An HTML image's origin is top-left, a GL texture's bottom-left.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      ready[index] = true;
    };
    image.src = card.src;
  });

  // The offscreen target the lens reads.
  const fbo = gl.createFramebuffer();
  const sceneTex = gl.createTexture();
  let bufferW = 0;
  let bufferH = 0;
  let disposed = false;

  const allocate = (width: number, height: number): void => {
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    bufferW = width;
    bufferH = height;
  };

  const resize = (): void => {
    const box = canvas.getBoundingClientRect();
    const ratio = cappedPixelRatio(window.devicePixelRatio);
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (width !== bufferW || height !== bufferH) allocate(width, height);
  };

  resize();

  const render = (state: RenderState): void => {
    if (disposed) return;
    resize();

    const w = canvas.width;
    const h = canvas.height;
    const scale = w / canvas.getBoundingClientRect().width;

    // ---- pass 1: the card row, into the framebuffer ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(theme.clear[0], theme.clear[1], theme.clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(cardProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, unitQuad);
    gl.enableVertexAttribArray(cardPos);
    gl.vertexAttribPointer(cardPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(cardTex, 0);

    let x = 0;
    options.cards.forEach((card, index) => {
      const cardW = state.height * card.aspect;
      const centre = x + cardW / 2;
      x += cardW + state.gap;
      if (!ready[index]) return;

      // Entry: each card rises from below and then grows, staggered.
      const riseAt = Math.min(1, Math.max(0, state.entry - (index * state.entryStaggerMs) / 1000));
      const growAt = Math.min(1, Math.max(0, state.grow - (index * state.growStaggerMs) / 1000));
      const entered = state.entry >= 1 && state.grow >= 1;

      // Focus: the chosen card scales up, the others drop away, centre-out.
      let drop = 0;
      let focusScale = 1;
      if (state.focusIndex >= 0) {
        if (index === state.focusIndex) focusScale = 1 + 0.06 * state.focusProgress;
        else {
          const distance = Math.abs(index - state.focusIndex);
          drop = state.focusProgress * 1.4 * Math.min(1, distance * 0.4 + 0.6);
        }
      } else if (state.closing) {
        const distance = Math.abs(index - 0);
        drop = (1 - state.focusProgress) * 1.4 * Math.min(1, distance * 0.4 + 0.6);
      }

      const grown = entered ? 1 : 80 / state.height + (1 - 80 / state.height) * growAt;
      const heightPx = state.height * grown * state.shrink * focusScale * scale;
      const widthPx = cardW * grown * state.shrink * focusScale * scale;
      const cx = w / 2 + (centre - state.scroll) * scale - widthPx / 2;
      const riseOffset = entered ? 0 : (1 - riseAt) * h * 0.9;
      const cy = (h - heightPx) / 2 + riseOffset + drop * h;

      // Off-screen cards cost nothing.
      if (cx > w || cx + widthPx < 0) return;

      gl.bindTexture(gl.TEXTURE_2D, textures[index] ?? null);
      gl.uniform4f(
        cardRect,
        (cx / w) * 2 - 1,
        1 - ((cy + heightPx) / h) * 2,
        (widthPx / w) * 2,
        (heightPx / h) * 2,
      );
      gl.uniform1f(cardAlpha, entered ? 1 : riseAt);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    // ---- pass 2: the lens, to the screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(lensProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, fullTri);
    gl.enableVertexAttribArray(lensPos);
    gl.vertexAttribPointer(lensPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(lensTex, 0);
    gl.uniform2f(lensRes, w, h);
    gl.uniform2f(lensCenter, 0.5, 0.5);
    gl.uniform3f(lensTint, theme.tint[0], theme.tint[1], theme.tint[2]);
    gl.uniform1f(lensGlow, theme.glow);
    gl.uniform1f(lensWhiteGlow, theme.whiteGlow);
    gl.uniform1f(lensDispersion, theme.dispersion);
    gl.uniform1f(lensRing, theme.ring);
    gl.uniform1f(lensRimLine, theme.rimLine);
    gl.uniform2f(lensSize, theme.size[0], theme.size[1]);
    gl.uniform1f(lensPhase, state.elapsed / 1000);
    // The lens blooms in with the entry, and fades away in focus mode so the
    // chosen card is seen plainly.
    const bloom = Math.min(1, Math.max(0, (state.elapsed - 500) / 1400));
    gl.uniform1f(lensFx, state.focusIndex >= 0 ? bloom * (1 - state.focusProgress) : bloom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      gl.deleteBuffer(unitQuad);
      gl.deleteBuffer(fullTri);
      gl.deleteProgram(cardProg);
      gl.deleteProgram(lensProg);
      for (const texture of textures) gl.deleteTexture(texture);
      gl.deleteTexture(sceneTex);
      gl.deleteFramebuffer(fbo);
      schemeQuery.removeEventListener('change', onThemeChange);
      themeObserver?.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
