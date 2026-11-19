// Neon Coast Cover Studio — the editor.
//
// Wires the page: photos from the machine (or the bundled samples), the
// layout, grade, size and caption controls, crop-by-drag on the preview,
// undo and redo, and the PNG export. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).

import { drawCover, defaultState, defaultCrop, layoutPanels, panelHit, LAYOUTS, GRADES, SIZES, FRAMES } from './cover.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = defaultState();
let photos = []; // { img, name } — the loaded photos, index 0 is the first sample.
let selected = 0; // The panel the editor is cropping.
let undoStack = [];
let redoStack = [];
let dragging = null;

const $ = (id) => document.getElementById(id);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** A deep copy of the cover state, for the undo history. */
function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

/** Pushes the current state onto the undo stack, as the state before a change. */
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  refreshHistoryButtons();
}

/** Records the pre-change state, then the caller mutates and redraws. */
function commit() {
  pushHistory();
  redraw();
}

/** Replaces the state wholesale (undo, redo, shot scenes) and redraws. */
function applyState(next) {
  Object.assign(state, JSON.parse(JSON.stringify(next)));
  refreshControls();
  redraw();
}

/** Replaces the loaded photo library wholesale (shot scenes). */
function setPhotos(list) {
  photos = list;
  buildPhotoChips();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applyState(undoStack.pop());
  refreshHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applyState(redoStack.pop());
  refreshHistoryButtons();
}

function refreshHistoryButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}

/** Redraws the preview canvas at its backing size. */
function redraw() {
  const size = SIZES[state.size];
  const maxSide = 760;
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  drawCover(canvas, state, photos.map((p) => p.img));
  $('sizeLabel').textContent = `${size.w} x ${size.h}`;
  $('panelLabel').textContent = `Panel ${selected + 1} of ${layoutPanels(state.layout, size.w, size.h).length}`;
}

/** Rebuilds the layout, grade, size and frame buttons from the current state. */
function buildOptionButtons() {
  const layoutBox = $('layouts');
  layoutBox.innerHTML = '';
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.layout = key;
    b.textContent = layout.label;
    b.addEventListener('click', () => { commit(); state.layout = key; selected = 0; redraw(); markOptions(); });
    layoutBox.appendChild(b);
  }
  const gradeBox = $('grades');
  gradeBox.innerHTML = '';
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.grade = key;
    b.title = grade.label;
    b.style.background = `linear-gradient(135deg, ${grade.accent}, ${grade.background})`;
    b.addEventListener('click', () => { commit(); state.grade = key; redraw(); markOptions(); });
    gradeBox.appendChild(b);
  }
  const sizeBox = $('sizes');
  sizeBox.innerHTML = '';
  for (const [key, size] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.size = key;
    b.textContent = size.label;
    b.addEventListener('click', () => { commit(); state.size = key; redraw(); markOptions(); });
    sizeBox.appendChild(b);
  }
  const frameBox = $('frames');
  frameBox.innerHTML = '';
  for (const [key, frame] of Object.entries(FRAMES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.dataset.frame = key;
    b.textContent = frame.label;
    b.addEventListener('click', () => { commit(); state.frame = key; redraw(); markOptions(); });
    frameBox.appendChild(b);
  }
  markOptions();
}

/** Highlights the buttons that match the current state. */
function markOptions() {
  for (const b of document.querySelectorAll('[data-layout]')) b.classList.toggle('active', b.dataset.layout === state.layout);
  for (const b of document.querySelectorAll('[data-grade]')) b.classList.toggle('active', b.dataset.grade === state.grade);
  for (const b of document.querySelectorAll('[data-size]')) b.classList.toggle('active', b.dataset.size === state.size);
  for (const b of document.querySelectorAll('[data-frame]')) b.classList.toggle('active', b.dataset.frame === state.frame);
}

/** Syncs the text inputs and toggles with the current state. */
function refreshControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('onePhoto').checked = state.onePhoto;
  $('grain').checked = state.grain;
  $('zoom').value = String(Math.round((state.crops[selected]?.zoom ?? 1) * 100));
  $('zoomLabel').textContent = `${Math.round((state.crops[selected]?.zoom ?? 1) * 100)}%`;
  buildPhotoChips();
  markOptions();
}

/** The photo chips: one button per loaded photo, marking the selected panel's photo. */
function buildPhotoChips() {
  const box = $('photoChips');
  box.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p.name;
    const crop = state.crops[selected];
    if (crop && crop.photo === i) b.classList.add('active');
    b.addEventListener('click', () => {
      commit();
      if (state.onePhoto) {
        state.crops.forEach((c) => { c.photo = i; });
      } else if (state.crops[selected]) {
        state.crops[selected].photo = i;
      }
      redraw();
      buildPhotoChips();
    });
    box.appendChild(b);
  });
}

/** Adds a loaded photo to the library and assigns it to the selected panel. */
async function addPhoto(img, name) {
  photos.push({ img, name });
  if (!state.onePhoto && state.crops[selected]) {
    state.crops[selected].photo = photos.length - 1;
  }
  buildPhotoChips();
  redraw();
}

/** Pushes one history entry when the user starts editing a field, so typing can be undone. */
function armHistoryOnFocus(el) {
  let armed = false;
  el.addEventListener('focus', () => { armed = true; });
  el.addEventListener('input', () => {
    if (armed) { pushHistory(); armed = false; }
  });
  el.addEventListener('blur', () => { armed = false; });
}

$('photoFile').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      await addPhoto(img, file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo');
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  e.target.value = '';
  status.textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} loaded.` : '';
});

$('title').addEventListener('input', () => { state.title = $('title').value; redraw(); });
$('subtitle').addEventListener('input', () => { state.subtitle = $('subtitle').value; redraw(); });
$('badge').addEventListener('input', () => { state.badge = $('badge').value; redraw(); });
armHistoryOnFocus($('title'));
armHistoryOnFocus($('subtitle'));
armHistoryOnFocus($('badge'));
$('onePhoto').addEventListener('change', () => { commit(); state.onePhoto = $('onePhoto').checked; redraw(); });
$('grain').addEventListener('change', () => { commit(); state.grain = $('grain').checked; redraw(); });

let zoomArmed = false;
$('zoom').addEventListener('focus', () => { zoomArmed = true; });
$('zoom').addEventListener('pointerdown', () => { zoomArmed = true; });
$('zoom').addEventListener('input', () => {
  if (zoomArmed) { pushHistory(); zoomArmed = false; }
  const crop = state.crops[selected];
  if (!crop) return;
  crop.zoom = Number($('zoom').value) / 100;
  $('zoomLabel').textContent = `${$('zoom').value}%`;
  redraw();
});
$('resetCrop').addEventListener('click', () => {
  commit();
  state.crops[selected] = defaultCrop(state.crops[selected]?.photo ?? 0);
  $('zoom').value = '100';
  $('zoomLabel').textContent = '100%';
  redraw();
});
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  }
});

/** The preview canvas: click a panel to select it, drag to pan its photo, wheel to zoom. */
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const size = SIZES[state.size];
  const panels = layoutPanels(state.layout, size.w, size.h);
  const scale = canvas.width / size.w;
  for (let i = panels.length - 1; i >= 0; i--) {
    if (panelHit(panels[i], p.x / scale, p.y / scale)) {
      selected = i;
      const crop = state.crops[i] ?? defaultCrop(0);
      dragging = { panel: i, startX: p.x, startY: p.y, cx: crop.cx, cy: crop.cy, pushed: false };
      canvas.setPointerCapture(e.pointerId);
      refreshControls();
      break;
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const size = SIZES[state.size];
  const scale = canvas.width / size.w;
  const panels = layoutPanels(state.layout, size.w, size.h);
  const panel = panels[dragging.panel];
  const crop = state.crops[dragging.panel];
  if (!panel || !crop) return;
  const photo = photos[state.onePhoto ? 0 : crop.photo] ?? photos[0];
  if (!photo) return;
  if (!dragging.pushed) { pushHistory(); dragging.pushed = true; }
  const base = Math.max(panel.w / photo.img.naturalWidth, panel.h / photo.img.naturalHeight) * crop.zoom;
  const dw = photo.img.naturalWidth * base;
  const dh = photo.img.naturalHeight * base;
  crop.cx = dragging.cx - (p.x - dragging.startX) / scale / dw;
  crop.cy = dragging.cy - (p.y - dragging.startY) / scale / dh;
  redraw();
});

canvas.addEventListener('pointerup', () => { dragging = null; });

let lastWheelPush = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const crop = state.crops[selected];
  if (!crop) return;
  const now = Date.now();
  if (now - lastWheelPush > 800) { pushHistory(); lastWheelPush = now; }
  crop.zoom = Math.min(3, Math.max(1, crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  $('zoom').value = String(Math.round(crop.zoom * 100));
  $('zoomLabel').textContent = `${Math.round(crop.zoom * 100)}%`;
  redraw();
}, { passive: false });

/** Renders the cover at full export size and downloads it as a PNG. */
async function exportPNG() {
  const size = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, photos.map((p) => p.img));
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon-coast-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  status.textContent = `Saved neon-coast-${size.w}x${size.h}.png`;
  return blob;
}

$('export').addEventListener('click', exportPNG);

/** A small handle for verification: state, render and export, nothing else. */
window.__neonCoast = {
  state,
  get photos() { return photos; },
  render() { redraw(); return canvas; },
  async exportDataURL() {
    const size = SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    drawCover(off, state, photos.map((p) => p.img));
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  },
};

/** Loads the display fonts, then either runs a shot scene or starts the editor. */
async function start() {
  try {
    await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('60px Pacifico')]);
    await document.fonts.ready;
  } catch {
    // The display fonts are local files; if they fail, the canvas falls back to sans-serif.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    const { runShot } = await import('./shots.js');
    await runShot(shot, query, { loadImage, setPhotos, state, applyState, buildOptionButtons, refreshControls, redraw, status, canvas });
    return;
  }
  try {
    const [boulevard, pier] = await Promise.all([
      loadImage('samples/boulevard.jpg'),
      loadImage('samples/pier.jpg'),
    ]);
    photos = [{ img: boulevard, name: 'Boulevard' }, { img: pier, name: 'Pier' }];
  } catch {
    status.textContent = 'Sample photos did not load; add your own photos below.';
  }
  buildOptionButtons();
  refreshControls();
  refreshHistoryButtons();
  redraw();
}

start();
