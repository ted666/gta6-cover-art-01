// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone at the window's size.
// Query params: layout, grade, size (square|portrait|wide), photo, photo2,
// caption, subtitle, badge, onePhoto. window.__shotReady is set once painted.
import { defaultCrop } from './cover.js';

function waitFrames(n) {
  return new Promise((resolve) => {
    const step = () => (n <= 1 ? resolve() : requestAnimationFrame(() => step(n - 1)));
    requestAnimationFrame(step);
  });
}

export async function runShot(shot, query, api) {
  const layout = query.get('layout') ?? 'hero3';
  const grade = query.get('grade') ?? 'sunset';
  const sizeKey = query.get('size') ?? 'wide';
  const title = query.get('caption') ?? 'Neon Shore';
  const subtitle = query.get('subtitle') ?? 'a sunset story';
  const badge = query.get('badge') ?? 'EST. 2026';
  const onePhoto = query.get('onePhoto') === '1';
  const photoName = query.get('photo') ?? 'boulevard';
  const photo2Name = query.get('photo2') ?? 'pier';

  const [first, second] = await Promise.all([
    api.loadImage(`samples/${photoName}.jpg`),
    api.loadImage(`samples/${photo2Name}.jpg`),
  ]);
  api.setPhotos([
    { img: first, name: 'Boulevard' },
    { img: second, name: 'Pier' },
  ]);

  // Alternate the two photos across the panels, with varied crops, so the
  // multi-panel layouts show both samples at their best.
  const crops = [];
  for (let i = 0; i < 9; i++) {
    const crop = defaultCrop(i % 2);
    crop.cx = 0.5 + (i % 3 === 0 ? -0.12 : i % 3 === 1 ? 0.1 : 0);
    crop.cy = 0.5 + (i % 2 === 0 ? -0.06 : 0.08);
    crop.zoom = 1 + (i % 3) * 0.12;
    crops.push(crop);
  }
  api.applyState({
    size: sizeKey,
    layout,
    grade,
    title,
    subtitle,
    badge,
    onePhoto,
    frame: 'white',
    grain: true,
    crops,
  });

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // In cover mode the canvas fills the window: render at the window's
    // pixel size, which is the screenshot's size.
    api.canvas.width = window.innerWidth;
    api.canvas.height = window.innerHeight;
    const { drawCover } = await import('./cover.js');
    // The layout math needs the cover's own aspect: draw at the window size,
    // which the screenshot sets to the cover's aspect.
    drawCover(api.canvas, api.state, [first, second]);
  } else {
    api.buildOptionButtons();
    api.refreshControls();
    api.redraw();
  }
  await waitFrames(3);
  window.__shotReady = true;
}
