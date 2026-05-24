const grid = document.getElementById('grid');
const inpRows = document.getElementById('inp-rows');
const inpCols = document.getElementById('inp-cols');
const btnApply = document.getElementById('btn-apply');
const btnReloadAll = document.getElementById('btn-reload-all');
const modalOverlay = document.getElementById('modal-overlay');
const modalInput = document.getElementById('modal-input');

let cells = [];
let activeCellIdx = null;

// ── Grid construction ─────────────────────────────────────────

function buildGrid() {
  const rows = clamp(parseInt(inpRows.value) || 2, 1, 6);
  const cols = clamp(parseInt(inpCols.value) || 2, 1, 6);
  inpRows.value = rows;
  inpCols.value = cols;

  const prevUsernames = cells.map(c => c.username);

  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';
  cells = [];

  for (let i = 0; i < rows * cols; i++) {
    const cell = makeCell(i, prevUsernames[i] || null);
    grid.appendChild(cell.el);
    cells.push(cell);
  }

  // Let the DOM paint, then measure and size every webview explicitly
  requestAnimationFrame(() => requestAnimationFrame(sizeWebviews));
}

function sizeWebviews() {
  cells.forEach(({ el, wv }) => {
    const { width, height } = el.getBoundingClientRect();
    wv.style.width = width + 'px';
    wv.style.height = height + 'px';
  });
}

window.addEventListener('resize', sizeWebviews);

function makeCell(idx, username) {
  const el = document.createElement('div');
  el.className = 'cell';

  const wv = document.createElement('webview');
  wv.setAttribute('partition', `persist:ig-${idx}`);
  wv.setAttribute('allowpopups', '');

  // bar (shown on hover)
  const bar = document.createElement('div');
  bar.className = 'cell-bar';

  const uname = document.createElement('span');
  uname.className = 'uname';

  const actions = document.createElement('div');
  actions.className = 'bar-actions';

  const reloadBtn = makeIconBtn('↺', 'Reload', () => {
    if (wv.src) wv.reload();
  });
  const editBtn = makeIconBtn('✎', 'Change account', () => openModal(idx));

  actions.append(reloadBtn, editBtn);
  bar.append(uname, actions);

  // loading spinner
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'cell-loading';
  loadingDiv.innerHTML = '<div class="spinner"></div>';

  // empty state
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'cell-empty';
  emptyDiv.innerHTML = '<div class="plus-icon">+</div><p>Add account</p>';
  emptyDiv.addEventListener('click', () => openModal(idx));

  el.append(wv, bar, loadingDiv, emptyDiv);

  wv.addEventListener('did-start-loading', () => el.classList.add('loading'));
  wv.addEventListener('did-stop-loading', () => el.classList.remove('loading'));
  wv.addEventListener('did-finish-load', () => {
    if (autoscrollActive) injectAutoscroll(wv);
  });

  const cell = { el, wv, uname, username: null };
  if (username) setAccount(cell, username);
  return cell;
}

function makeIconBtn(icon, title, onClick) {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.textContent = icon;
  btn.title = title;
  btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return btn;
}

// ── Account loading ───────────────────────────────────────────

function setAccount(cell, raw) {
  let username = raw.trim();

  const urlMatch = username.match(/instagram\.com\/([^/?#\s]+)/);
  if (urlMatch && !['p', 'reel', 'stories', 'explore'].includes(urlMatch[1])) {
    username = urlMatch[1];
  }
  username = username.replace(/^@/, '').replace(/\/$/, '');

  if (!username) return;

  cell.username = username;
  cell.uname.textContent = '@' + username;
  cell.wv.src = `https://www.instagram.com/${username}/reels/`;
  cell.el.classList.add('loaded');
}

function clearCell(cell) {
  cell.username = null;
  cell.uname.textContent = '';
  cell.wv.src = 'about:blank';
  cell.el.classList.remove('loaded');
}

// ── Modal ─────────────────────────────────────────────────────

function openModal(idx) {
  activeCellIdx = idx;
  modalInput.value = cells[idx].username || '';
  modalOverlay.classList.add('open');
  setTimeout(() => { modalInput.focus(); modalInput.select(); }, 30);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  activeCellIdx = null;
}

function confirmModal() {
  if (activeCellIdx === null) return;
  const val = modalInput.value.trim();
  if (val) setAccount(cells[activeCellIdx], val);
  closeModal();
}

document.getElementById('btn-load').addEventListener('click', confirmModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('btn-clear').addEventListener('click', () => {
  if (activeCellIdx !== null) clearCell(cells[activeCellIdx]);
  closeModal();
});

modalInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmModal();
  if (e.key === 'Escape') closeModal();
});

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// ── Autoscroll ────────────────────────────────────────────────

const btnAutoscroll = document.getElementById('btn-autoscroll');
let autoscrollActive = false;

// Script injected into each webview.
// Detects reel end via timeupdate wrap-around or 'ended', then advances
// using multiple fallback strategies since ArrowDown on document doesn't work.
const INJECT_SCRIPT = `
(function () {
  if (window.__igAS !== undefined) { window.__igAS = true; return; }
  window.__igAS = true;

  function advance() {
    if (!window.__igAS) return;

    // Strategy 1: find the scrollable container above the active video and
    // scroll it by one screen height (most reliable for Instagram reels feed)
    var video = document.querySelector('video');
    if (video) {
      var el = video.parentElement;
      for (var i = 0; i < 15 && el && el !== document.body; i++) {
        var s = getComputedStyle(el);
        var oy = s.overflowY || s.overflow;
        if ((oy === 'scroll' || oy === 'auto') && el.scrollHeight > el.clientHeight) {
          el.scrollTop += el.clientHeight;
          return;
        }
        el = el.parentElement;
      }
    }

    // Strategy 2: wheel event on the deepest element containing the video
    var target = (video && video.parentElement) || document.body;
    target.dispatchEvent(new WheelEvent('wheel', {
      deltaY: window.innerHeight, deltaMode: 0,
      bubbles: true, cancelable: true, composed: true
    }));

    // Strategy 3: also try on document and window for anything that listens globally
    document.dispatchEvent(new WheelEvent('wheel', {
      deltaY: window.innerHeight, deltaMode: 0,
      bubbles: true, cancelable: true, composed: true
    }));

    // Strategy 4: window.scrollBy as last resort
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  }

  function watch(video) {
    if (video.__igWatched) return;
    video.__igWatched = true;

    var lastTime = 0;
    var fired = false;

    video.addEventListener('ended', function () {
      if (fired) return;
      fired = true;
      advance();
    });

    video.addEventListener('timeupdate', function () {
      if (fired) return;
      var d = video.duration;
      if (!d || isNaN(d)) return;
      var t = video.currentTime;
      if (lastTime > d * 0.85 && t < 0.5) { fired = true; advance(); }
      lastTime = t;
    });
  }

  function scan() { document.querySelectorAll('video').forEach(watch); }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
`;

function injectAutoscroll(wv) {
  wv.executeJavaScript(INJECT_SCRIPT).catch(() => {});
}

function startAutoscroll() {
  autoscrollActive = true;
  btnAutoscroll.textContent = '⏹ Stop';
  btnAutoscroll.classList.remove('ghost');
  btnAutoscroll.classList.add('active');
  cells.forEach(({ wv, username }) => { if (username) injectAutoscroll(wv); });
}

function stopAutoscroll() {
  autoscrollActive = false;
  btnAutoscroll.textContent = '▶ Autoscroll';
  btnAutoscroll.classList.add('ghost');
  btnAutoscroll.classList.remove('active');
  // Flip the flag inside each webview so pending listeners don't fire
  cells.forEach(({ wv, username }) => {
    if (username) wv.executeJavaScript('window.__igAS = false;').catch(() => {});
  });
}

btnAutoscroll.addEventListener('click', () => {
  if (autoscrollActive) stopAutoscroll(); else startAutoscroll();
});

// ── Toolbar ───────────────────────────────────────────────────

btnApply.addEventListener('click', buildGrid);

inpRows.addEventListener('keydown', e => { if (e.key === 'Enter') buildGrid(); });
inpCols.addEventListener('keydown', e => { if (e.key === 'Enter') buildGrid(); });

btnReloadAll.addEventListener('click', () => {
  cells.forEach(c => { if (c.wv.src && c.wv.src !== 'about:blank') c.wv.reload(); });
});

// ── Helpers ───────────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── Init ──────────────────────────────────────────────────────

buildGrid();
