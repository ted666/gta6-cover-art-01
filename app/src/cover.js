// Neon Coast Cover Studio — the cover renderer.
//
// Draws a GTA-style multi-panel poster cover onto a 2D canvas: several photo
// panels in a chosen layout, a sunset or neon colour grade over each panel,
// inked poster frames, a halftone title band with bold lettering, and a
// seeded film grain. Pure rendering: no network, no DOM input except the
// canvas and the loaded photos. The same function paints the live preview,
// the ?shot= cover scenes and the exported PNG, so what you see is what
// the PNG holds.

/** A small seeded random generator, so the grain is identical on every render. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The export sizes the app offers, in pixels. */
export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/**
 * The colour grades. Each grade names the cover background, the title and
 * subtitle colours, the accent, a canvas filter applied when the photo is
 * drawn, and the overlay steps painted over the photo (clipped to the
 * panel): a step is a solid colour, or a top-to-bottom gradient of stops.
 */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    background: '#241031',
    title: '#ffffff',
    sub: '#ffd166',
    accent: '#ff7a3d',
    filter: 'saturate(1.15) contrast(1.05)',
    steps: [
      { op: 'overlay', stops: [[0, 'rgba(255,120,60,0)'], [1, 'rgba(255,80,140,0.32)']] },
      { op: 'soft-light', color: 'rgba(255,150,60,0.35)' },
    ],
  },
  neon: {
    label: 'Neon Nights',
    background: '#0d0518',
    title: '#ffffff',
    sub: '#00e5ff',
    accent: '#ff2e88',
    filter: 'saturate(1.25) contrast(1.08)',
    steps: [
      { op: 'overlay', stops: [[0, 'rgba(255,0,140,0.30)'], [0.55, 'rgba(120,0,180,0.10)'], [1, 'rgba(0,220,255,0.28)']] },
      { op: 'soft-light', color: 'rgba(255,0,160,0.22)' },
    ],
  },
  gold: {
    label: 'Golden Hour',
    background: '#2a1503',
    title: '#fff7e0',
    sub: '#ffb347',
    accent: '#ff9e2c',
    filter: 'saturate(1.2) contrast(1.04) brightness(1.04)',
    steps: [
      { op: 'soft-light', color: 'rgba(255,180,60,0.45)' },
      { op: 'overlay', stops: [[0, 'rgba(255,200,90,0.10)'], [1, 'rgba(180,80,10,0.30)']] },
    ],
  },
  noir: {
    label: 'Noir',
    background: '#111114',
    title: '#f5f2ea',
    sub: '#d8c9a3',
    accent: '#e8e2d2',
    filter: 'grayscale(1) contrast(1.18) brightness(1.06)',
    steps: [
      { op: 'overlay', color: 'rgba(255,190,120,0.14)' },
      { op: 'soft-light', color: 'rgba(255,255,255,0.10)' },
    ],
  },
  palm: {
    label: 'Palm Teal',
    background: '#04241f',
    title: '#ffffff',
    sub: '#7dffd4',
    accent: '#00c9a7',
    filter: 'saturate(1.2) contrast(1.05)',
    steps: [
      { op: 'overlay', stops: [[0, 'rgba(0,200,170,0.22)'], [1, 'rgba(255,190,90,0.20)']] },
      { op: 'soft-light', color: 'rgba(0,220,190,0.20)' },
    ],
  },
};

/** Small invented captions written on the tilted snapshot frames. */
const SNAP_CAPTIONS = ['the boulevard', 'golden hour', 'night drive'];

/**
 * The layouts. Each takes the cover size in pixels and returns the panels
 * and the title band: a panel is {x, y, w, h, rot} in pixels, rot in radians
 * around its centre; the title band is {x, y, w, h, overlay} where overlay
 * means the band floats over the photo instead of sitting below the panels.
 */
export const LAYOUTS = {
  hero3: {
    label: 'Hero + Three',
    build(W, H) {
      const m = Math.round(W * 0.022);
      const g = Math.round(W * 0.014);
      const tb = Math.round(H * 0.155);
      const panels = [];
      if (W >= H) {
        const areaW = W - 2 * m;
        const areaH = H - tb - 2 * m;
        const heroW = Math.round(areaW * 0.6);
        panels.push({ x: m, y: m, w: heroW, h: areaH, rot: 0 });
        const colX = m + heroW + g;
        const colW = W - m - colX;
        const cellH = Math.round((areaH - 2 * g) / 3);
        for (let i = 0; i < 3; i++) {
          panels.push({ x: colX, y: m + i * (cellH + g), w: colW, h: cellH, rot: 0 });
        }
      } else {
        const areaW = W - 2 * m;
        const areaH = H - tb - 2 * m;
        const heroH = Math.round(areaH * 0.58);
        panels.push({ x: m, y: m, w: areaW, h: heroH, rot: 0 });
        const rowY = m + heroH + g;
        const rowH = H - tb - m - rowY;
        const cellW = Math.round((areaW - 2 * g) / 3);
        for (let i = 0; i < 3; i++) {
          panels.push({ x: m + i * (cellW + g), y: rowY, w: cellW, h: rowH, rot: 0 });
        }
      }
      return { panels, title: { x: 0, y: H - tb, w: W, h: tb, overlay: false } };
    },
  },
  grid4: {
    label: 'Four Panel Grid',
    build(W, H) {
      const m = Math.round(W * 0.022);
      const g = Math.round(W * 0.014);
      const tb = Math.round(H * 0.15);
      const cellW = Math.round((W - 2 * m - g) / 2);
      const cellH = Math.round((H - tb - 2 * m - g) / 2);
      const panels = [];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          panels.push({ x: m + c * (cellW + g), y: m + r * (cellH + g), w: cellW, h: cellH, rot: 0 });
        }
      }
      return { panels, title: { x: 0, y: H - tb, w: W, h: tb, overlay: false } };
    },
  },
  grid9: {
    label: 'Nine Panel Grid',
    build(W, H) {
      const m = Math.round(W * 0.022);
      const g = Math.round(W * 0.012);
      const tb = Math.round(H * 0.13);
      const cellW = Math.round((W - 2 * m - 2 * g) / 3);
      const cellH = Math.round((H - tb - 2 * m - 2 * g) / 3);
      const panels = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          panels.push({ x: m + c * (cellW + g), y: m + r * (cellH + g), w: cellW, h: cellH, rot: 0 });
        }
      }
      return { panels, title: { x: 0, y: H - tb, w: W, h: tb, overlay: false } };
    },
  },
  tilt: {
    label: 'Tilted Snapshots',
    build(W, H) {
      const tb = Math.round(H * 0.16);
      const panels = [];
      if (W >= H) {
        const pw = Math.round(W * 0.36);
        const ph = Math.round(pw * 1.22);
        const spots = [
          { cx: W * 0.26, cy: (H - tb) * 0.46, rot: -0.12 },
          { cx: W * 0.53, cy: (H - tb) * 0.42, rot: 0.07 },
          { cx: W * 0.79, cy: (H - tb) * 0.47, rot: -0.05 },
        ];
        for (const s of spots) {
          panels.push({ x: s.cx - pw / 2, y: s.cy - ph / 2, w: pw, h: ph, rot: s.rot, snap: true });
        }
      } else {
        const pw = Math.round(W * 0.52);
        const ph = Math.round(pw * 1.22);
        const spots = [
          { cx: W * 0.32, cy: (H - tb) * 0.22, rot: -0.1 },
          { cx: W * 0.68, cy: (H - tb) * 0.34, rot: 0.08 },
          { cx: W * 0.48, cy: (H - tb) * 0.62, rot: -0.04 },
        ];
        for (const s of spots) {
          panels.push({ x: s.cx - pw / 2, y: s.cy - ph / 2, w: pw, h: ph, rot: s.rot, snap: true });
        }
      }
      return { panels, title: { x: 0, y: H - tb, w: W, h: tb, overlay: false } };
    },
  },
  bleed: {
    label: 'Full Bleed',
    build(W, H) {
      const tb = Math.round(H * 0.2);
      return {
        panels: [{ x: 0, y: 0, w: W, h: H, rot: 0 }],
        title: { x: 0, y: H - tb, w: W, h: tb, overlay: true },
      };
    },
  },
  diptych: {
    label: 'Split Diptych',
    build(W, H) {
      const m = Math.round(W * 0.022);
      const g = Math.round(W * 0.014);
      const tb = Math.round(H * 0.155);
      const panels = [];
      if (W >= H) {
        const cellW = Math.round((W - 2 * m - g) / 2);
        const cellH = H - tb - 2 * m;
        panels.push({ x: m, y: m, w: cellW, h: cellH, rot: 0 });
        panels.push({ x: m + cellW + g, y: m, w: cellW, h: cellH, rot: 0 });
      } else {
        const cellW = W - 2 * m;
        const cellH = Math.round((H - tb - 2 * m - g) / 2);
        panels.push({ x: m, y: m, w: cellW, h: cellH, rot: 0 });
        panels.push({ x: m, y: m + cellH + g, w: cellW, h: cellH, rot: 0 });
      }
      return { panels, title: { x: 0, y: H - tb, w: W, h: tb, overlay: false } };
    },
  },
};

/** The poster frames: white gallery border, black comic ink, or none. */
export const FRAMES = {
  white: { label: 'White frame' },
  ink: { label: 'Black ink' },
  none: { label: 'No frame' },
};

/** A panel's crop: which photo, where its centre sits (0..1 of the photo), how far it is zoomed. */
export function defaultCrop(photo) {
  return { photo, cx: 0.5, cy: 0.5, zoom: 1 };
}

/** The default cover state, filled with the two sample photos. */
export function defaultState() {
  const crops = [
    defaultCrop(0), defaultCrop(1), defaultCrop(0), defaultCrop(1),
    defaultCrop(0), defaultCrop(1), defaultCrop(0), defaultCrop(1), defaultCrop(0),
  ];
  return {
    size: 'wide',
    layout: 'hero3',
    grade: 'sunset',
    title: 'Neon Shore',
    subtitle: 'a sunset story',
    badge: 'EST. 2026',
    onePhoto: false,
    frame: 'white',
    grain: true,
    crops,
  };
}

/** Clamps a crop so the photo always covers its panel. */
function clampCrop(crop, photo, pw, ph) {
  const base = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight) * crop.zoom;
  const dw = photo.naturalWidth * base;
  const dh = photo.naturalHeight * base;
  const fx = dw > pw ? (dw - pw) / 2 / dw : 0;
  const fy = dh > ph ? (dh - ph) / 2 / dh : 0;
  crop.cx = Math.min(0.5 + fx, Math.max(0.5 - fx, crop.cx));
  crop.cy = Math.min(0.5 + fy, Math.max(0.5 - fy, crop.cy));
  crop.zoom = Math.min(3, Math.max(1, crop.zoom));
}

/** Paints one grade step (a solid colour, or a top-to-bottom gradient) over a rect. */
function fillGradeStep(ctx, rect, step) {
  ctx.globalCompositeOperation = step.op;
  if (step.stops) {
    const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    for (const [at, color] of step.stops) grad.addColorStop(at, color);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = step.color;
  }
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
}

/** A soft dark vignette inside a rect, so the panel reads like a photograph. */
function drawVignette(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.max(rect.w, rect.h) * 0.72;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Draws one photo panel: the photo with its crop, the grade, the frame. */
function drawPanel(ctx, rect, photo, crop, grade, frame, index) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  if (rect.rot) {
    ctx.translate(cx, cy);
    ctx.rotate(rect.rot);
    ctx.translate(-cx, -cy);
  }
  // A soft drop shadow under the panel, like a cut-out poster piece.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(rect.x + 5, rect.y + 7, rect.w, rect.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo) {
    clampCrop(crop, photo, rect.w, rect.h);
    const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * crop.zoom;
    const dw = photo.naturalWidth * base;
    const dh = photo.naturalHeight * base;
    const dx = rect.x + rect.w / 2 - crop.cx * dw;
    const dy = rect.y + rect.h / 2 - crop.cy * dh;
    ctx.filter = grade.filter;
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, '#3a2b4d');
    grad.addColorStop(1, '#1c1030');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  for (const step of grade.steps) fillGradeStep(ctx, rect, step);
  drawVignette(ctx, rect);
  ctx.restore();
  // The poster frame: a white gallery border, or a black ink line, or none.
  const bw = Math.max(4, Math.round(rect.w * 0.012));
  if (frame === 'white') {
    ctx.lineWidth = bw;
    ctx.strokeStyle = '#fdfbf6';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = Math.max(1.5, bw * 0.22);
    ctx.strokeStyle = 'rgba(10,5,20,0.85)';
    ctx.strokeRect(rect.x + bw / 2, rect.y + bw / 2, rect.w - bw, rect.h - bw);
  } else if (frame === 'ink') {
    ctx.lineWidth = Math.max(3, bw * 0.8);
    ctx.strokeStyle = '#120a1e';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = Math.max(1, bw * 0.2);
    ctx.strokeStyle = 'rgba(253,251,246,0.9)';
    ctx.strokeRect(rect.x + bw * 0.4, rect.y + bw * 0.4, rect.w - bw * 0.8, rect.h - bw * 0.8);
  }
  // A tilted snapshot gets a wider white foot with a handwritten caption.
  if (rect.snap) {
    const foot = Math.round(rect.h * 0.14);
    ctx.fillStyle = '#fdfbf6';
    ctx.fillRect(rect.x, rect.y + rect.h - foot, rect.w, foot);
    ctx.lineWidth = Math.max(1.5, bw * 0.22);
    ctx.strokeStyle = 'rgba(10,5,20,0.85)';
    ctx.strokeRect(rect.x + bw / 2, rect.y + rect.h - foot + bw / 4, rect.w - bw, foot - bw / 2);
    // The next snapshot overlaps this one's right side, so the caption sits
    // left-aligned in the foot's visible part, like handwriting on a print.
    const words = SNAP_CAPTIONS[index % SNAP_CAPTIONS.length];
    let size = Math.round(foot * 0.42);
    ctx.font = `${size}px Pacifico, cursive`;
    const pad = foot * 0.3;
    const maxCaptionW = rect.w - bw * 2 - pad * 2;
    while (ctx.measureText(words).width > maxCaptionW && size > 8) {
      size -= 1;
      ctx.font = `${size}px Pacifico, cursive`;
    }
    ctx.fillStyle = '#2b2b33';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(words, rect.x + bw / 2 + pad, rect.y + rect.h - foot / 2);
  }
  ctx.restore();
}

/** Halftone dots along the top edge of the title band, fading left to right. */
function drawHalftone(ctx, band, accent) {
  const rows = 3;
  const gap = Math.max(10, Math.round(band.h * 0.16));
  ctx.fillStyle = accent;
  for (let r = 0; r < rows; r++) {
    const y = band.y + gap * (r + 0.7);
    const maxR = gap * (0.42 - r * 0.1);
    for (let x = band.x + gap; x < band.x + band.w - gap; x += gap) {
      const fade = 1 - (x - band.x) / band.w;
      const radius = Math.max(0.6, maxR * (0.35 + 0.65 * fade));
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The title band: halftone, the big bold title, the script subtitle, the badge. */
function drawTitleBand(ctx, band, state, grade) {
  if (!band.overlay) {
    ctx.fillStyle = grade.background;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    // A thin accent rule where the band meets the panels.
    ctx.fillStyle = grade.accent;
    ctx.fillRect(band.x, band.y, band.w, Math.max(3, Math.round(band.h * 0.03)));
  } else {
    const grad = ctx.createLinearGradient(0, band.y - band.h * 0.6, 0, band.y + band.h);
    grad.addColorStop(0, 'rgba(8,4,18,0)');
    grad.addColorStop(1, 'rgba(8,4,18,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(band.x, band.y - band.h * 0.6, band.w, band.h * 1.6);
  }
  drawHalftone(ctx, band, grade.accent);
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  const midY = band.y + band.h * (band.overlay ? 0.52 : 0.48);
  if (title) {
    let size = Math.round(band.h * (sub ? 0.46 : 0.58));
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    while (ctx.measureText(title).width > band.w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8,4,18,0.85)';
    ctx.fillText(title, band.w / 2 + size * 0.045, midY + size * 0.05);
    ctx.fillStyle = grade.title;
    ctx.fillText(title, band.w / 2, midY);
  }
  if (sub) {
    const size = Math.round(band.h * 0.2);
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.fillStyle = grade.sub;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sub, band.w / 2, band.y + band.h * 0.86);
  }
  // The badge: a small tilted pill in the band's top corner.
  const badge = (state.badge || '').trim();
  if (badge) {
    const size = Math.round(band.h * 0.16);
    ctx.font = `bold ${size}px Anton, 'Arial Narrow', sans-serif`;
    const tw = ctx.measureText(badge.toUpperCase()).width;
    const pw = tw + size * 1.6;
    const ph = size * 1.9;
    const px = band.w - pw - band.w * 0.02;
    const py = band.y + band.h * 0.1;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate(-0.06);
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#14081f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.toUpperCase(), 0, 1);
    ctx.restore();
  }
}

/** Seeded film grain over the whole cover, identical on every render. */
function drawGrain(ctx, W, H) {
  const rand = mulberry32(20261119);
  const count = Math.round((W * H) / 260);
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    const s = rand() > 0.85 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
}

/**
 * Paints the cover onto `canvas` at the canvas's own size.
 * `state` is the cover state; `photos` is an array of loaded images.
 * When state.onePhoto is set, every panel uses the first photo with its own crop.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero3;
  const { panels, title } = layout.build(W, H);
  ctx.fillStyle = grade.background;
  ctx.fillRect(0, 0, W, H);
  panels.forEach((rect, i) => {
    const crop = state.crops[i] ?? defaultCrop(0);
    const photoIndex = state.onePhoto ? 0 : crop.photo;
    const photo = photos[photoIndex] ?? photos[0] ?? null;
    drawPanel(ctx, rect, photo, crop, grade, state.frame, i);
  });
  drawTitleBand(ctx, title, state, grade);
  if (state.grain) drawGrain(ctx, W, H);
}

/** The panel rectangles for a cover size, for hit-testing clicks in the editor. */
export function layoutPanels(layoutName, W, H) {
  const layout = LAYOUTS[layoutName] ?? LAYOUTS.hero3;
  return layout.build(W, H).panels.map((r) => ({
    x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot || 0,
    cx: r.x + r.w / 2, cy: r.y + r.h / 2, snap: !!r.snap,
  }));
}

/** True when the point (px, py) falls inside a (possibly rotated) panel. */
export function panelHit(panel, px, py) {
  const dx = px - panel.cx;
  const dy = py - panel.cy;
  const cos = Math.cos(-panel.rot);
  const sin = Math.sin(-panel.rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= panel.w / 2 && Math.abs(ly) <= panel.h / 2;
}
