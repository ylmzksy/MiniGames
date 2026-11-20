/**
 * Twin Rings page. The rings are drawn with SVG; every bead is one <g> element,
 * built once per level and only moved afterwards. A turn slides the beads of one
 * ring along its circle (time-based animation). Dragging a bead around a ring turns
 * it live and snaps to whole places when released.
 * Keys: Up / Down (or 1 2 3) pick a ring, Left / Right turn it, Z undoes.
 */
const TURN_MS = 200;
const R = 100;   // ring radius in SVG units
const SVGNS = 'http://www.w3.org/2000/svg';
const GLYPHS = { R: '●', G: '▲', B: '■', Y: '◆', P: '★', O: '✚' };
const COLOURS = ['R', 'G', 'B', 'Y', 'P', 'O'];

let currentLevelIdx = 0;
let state = null;
let history = [];
let moves = 0;
let solved = false;
let statusKey = 'status_play';
let selected = 0;
let beadR = 18;
let beadEls = [];   // beadEls[position] = the element of the bead at that position
let trackEls = [];
let anim = null;
let drag = null;

const board = document.getElementById('board');
const targetEl = document.getElementById('target');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    finishAnim();
    drag = null;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = RingsEngine.parse(level);
    history = [];
    moves = 0;
    solved = false;
    selected = 0;
    beadR = Math.min(20, 0.34 * 2 * Math.PI * R / state.n);
    setStatus('status_play');
    updateLevelInfo();
    buildTarget();
    buildBoard();
    update();
}

/* ---------- Building ---------- */

const el = (tag, attrs = {}) => {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
};

function viewBox(svg) {
    const xs = state.rings.map(r => r.cx * R);
    const ys = state.rings.map(r => r.cy * R);
    const m = R + beadR + 6;
    const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
    svg.setAttribute('viewBox', `${x0} ${y0} ${Math.max(...xs) + m - x0} ${Math.max(...ys) + m - y0}`);
}

// A numbered bead is tinted by the ring it belongs on (its first ring in the target)
function beadClass(token) {
    if (!state.numbered) return `c-${token}`;
    const p = Number(token) - 1;
    const ring = state.rings.findIndex(r => r.slots.includes(p));
    return `num c-${COLOURS[ring]}`;
}

function buildTarget() {
    targetEl.innerHTML = '';
    viewBox(targetEl);
    state.rings.forEach(r => targetEl.appendChild(el('circle', { class: 'track', cx: r.cx * R, cy: r.cy * R, r: R })));
    state.target.forEach((t, p) => {
        const [x, y] = state.pos[p];
        targetEl.appendChild(el('circle', { class: `dot ${beadClass(t)}`, cx: x * R, cy: y * R, r: beadR }));
        if (state.numbered) {
            const txt = el('text', { x: x * R, y: y * R + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
            txt.textContent = t;
            targetEl.appendChild(txt);
        }
    });
    targetEl.classList.toggle('big', state.numbered);
}

function buildBoard() {
    board.innerHTML = '';
    viewBox(board);
    trackEls = state.rings.map((r, i) => {
        const t = el('circle', { class: 'track', cx: r.cx * R, cy: r.cy * R, r: R });
        t.dataset.ring = i;
        board.appendChild(t);
        return t;
    });
    // Turn buttons in the middle of each ring, set apart from beads of other rings that reach inside
    state.rings.forEach((r, i) => {
        const [ax, ay] = buttonAxis(i);
        [[-1, '↺'], [1, '↻']].forEach(([d, label]) => {
            const x = r.cx * R + d * ax * 25, y = r.cy * R + d * ay * 25;
            const g = el('g', { class: 'spin', transform: `translate(${x.toFixed(2)}, ${y.toFixed(2)})`, role: 'button' });
            g.dataset.ring = i;
            g.dataset.d = d;
            g.setAttribute('aria-label', `${i + 1} ${d > 0 ? 'clockwise' : 'counter-clockwise'}`);
            g.appendChild(el('circle', { r: 19 }));
            const txt = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', dy: 1 });
            txt.textContent = label;
            g.appendChild(txt);
            board.appendChild(g);
        });
    });
    beadEls = state.beads.map((t, p) => {
        const g = el('g', { class: `bead ${beadClass(t)}` });
        g.appendChild(el('circle', { r: beadR }));
        g.appendChild(el('circle', { class: 'shine', r: beadR * 0.55, cx: -beadR * 0.25, cy: -beadR * 0.3 }));
        const txt = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', dy: 1 });
        txt.textContent = state.numbered ? t : GLYPHS[t] || '';
        txt.style.fontSize = `${state.numbered ? beadR * 0.95 : beadR * 0.8}px`;
        g.appendChild(txt);
        board.appendChild(g);
        placeAt(g, ...state.pos[p]);
        return g;
    });
}

// The two buttons sit side by side, or stacked when beads of other rings reach in from the side
function buttonAxis(i) {
    const r = state.rings[i];
    const inside = state.pos.filter((p, j) => !r.slots.includes(j) && Math.hypot(p[0] - r.cx, p[1] - r.cy) < 0.9);
    if (!inside.length) return [1, 0];
    const [dx, dy] = [inside[0][0] - r.cx, inside[0][1] - r.cy];
    const len = Math.hypot(dx, dy);
    // ↺ always comes first (left or top), ↻ second
    const [ax, ay] = [-dy / len, dx / len];
    return ay < -1e-6 || (Math.abs(ay) <= 1e-6 && ax < 0) ? [-ax, -ay] : [ax, ay];
}

function placeAt(g, x, y) {
    g.setAttribute('transform', `translate(${(x * R).toFixed(2)}, ${(y * R).toFixed(2)})`);
}

/* ---------- Turning a ring ---------- */

// Draws the beads of a ring turned by `off` radians from their slots
function showRing(ring, off) {
    const r = state.rings[ring];
    const n = state.n;
    r.slots.forEach((p, k) => {
        const a = 2 * Math.PI * k / n + off;
        placeAt(beadEls[p], r.cx + Math.cos(a), r.cy + Math.sin(a));
    });
}

// The ring has already turned in the state: slide its beads from `from` radians to their slots
function animateRing(ring, from) {
    finishAnim();
    const a = { ring, from, start: performance.now() };
    anim = a;
    showRing(ring, from);
    const step = (now) => {
        if (anim !== a) return;
        const t = Math.min(1, (now - a.start) / TURN_MS);
        if (t < 1) {
            showRing(ring, from * (1 - t) ** 3);
            requestAnimationFrame(step);
        } else {
            finishAnim();
        }
    };
    requestAnimationFrame(step);
}

function finishAnim() {
    if (!anim) return;
    const a = anim;
    anim = null;
    showRing(a.ring, 0);
}

/* ---------- Moves ---------- */

function commit(move) {
    state.beads = RingsEngine.apply(state.beads, state.rings, move);
    beadEls = RingsEngine.apply(beadEls, state.rings, move);
}

function turn(ring, d) {
    if (!state || solved || ring >= state.rings.length) return;
    finishAnim();
    const move = { ring, d };
    commit(move);
    history.push(move);
    moves++;
    selected = ring;
    animateRing(ring, -d * 2 * Math.PI / state.n);
    afterMove();
}

function undo() {
    if (!state || solved || !history.length) return;
    finishAnim();
    const move = RingsEngine.inverse(history.pop());
    commit(move);
    moves--;
    animateRing(move.ring, -move.d * 2 * Math.PI / state.n);
    setStatus('status_play');
    update();
}

function afterMove() {
    if (RingsEngine.isSolved(state.beads, state.target)) {
        solved = true;
        setStatus(moves <= state.par ? 'status_perfect' : 'status_solved');
        Progress.markSolved(currentLevelIdx);
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx && solved) nextLevel(); }, 2000);
    }
    update();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Rendering ---------- */

function update() {
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('par')}: ${state.par}`;
    undoBtn.disabled = solved || !history.length;
    board.classList.toggle('solved', solved);
    trackEls.forEach((t, i) => t.classList.toggle('sel', i === selected));
}

/* ---------- Input: buttons, dragging, keys ---------- */

function svgPoint(e) {
    const m = board.getScreenCTM().inverse();
    return [(e.clientX * m.a + e.clientY * m.c + m.e) / R, (e.clientX * m.b + e.clientY * m.d + m.f) / R];
}

board.addEventListener('click', (e) => {
    const b = e.target.closest('.spin');
    if (b) turn(Number(b.dataset.ring), Number(b.dataset.d));
});

board.addEventListener('pointerdown', (e) => {
    if (!state || solved || e.button > 0 || e.target.closest('.spin')) return;
    const p = svgPoint(e);
    // Rings whose circle passes near the pointer
    const near = state.rings.map((r, i) => i)
        .filter(i => Math.abs(Math.hypot(p[0] - state.rings[i].cx, p[1] - state.rings[i].cy) - 1) < 0.35);
    if (!near.length) return;
    finishAnim();
    drag = { p, near, ring: null, off: 0, id: e.pointerId, sx: e.clientX, sy: e.clientY };
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or finished pointer */ }
});

board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const q = svgPoint(e);
    if (drag.ring === null) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        // On a shared bead, the ring that runs along the drag direction wins
        const mv = [q[0] - drag.p[0], q[1] - drag.p[1]];
        let best = -1;
        drag.near.forEach(i => {
            const r = state.rings[i];
            const rx = drag.p[0] - r.cx, ry = drag.p[1] - r.cy;
            const score = Math.abs(-ry * mv[0] + rx * mv[1]) / Math.hypot(rx, ry);
            if (score > best) { best = score; drag.ring = i; }
        });
        const r = state.rings[drag.ring];
        drag.last = Math.atan2(drag.p[1] - r.cy, drag.p[0] - r.cx);
        selected = drag.ring;
        board.classList.add('dragging');
        update();
    }
    const r = state.rings[drag.ring];
    const a = Math.atan2(q[1] - r.cy, q[0] - r.cx);
    let da = a - drag.last;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    drag.last = a;
    drag.off += da;
    showRing(drag.ring, drag.off);
});

function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    board.classList.remove('dragging');
    if (d.ring === null) return;
    const n = state.n;
    const step = 2 * Math.PI / n;
    const k = Math.round(d.off / step);
    // The shortest equivalent turn
    let steps = ((k % n) + n) % n;
    if (steps > n / 2) steps -= n;
    const dir = Math.sign(steps);
    for (let s = 0; s < Math.abs(steps); s++) {
        const move = { ring: d.ring, d: dir };
        commit(move);
        history.push(move);
        moves++;
    }
    animateRing(d.ring, d.off - k * step);
    if (steps) afterMove();
    else update();
}

board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !state) return;
    const count = state.rings.length;
    if (event.key === 'ArrowLeft') turn(selected, -1);
    else if (event.key === 'ArrowRight') turn(selected, 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        selected = (selected + (event.key === 'ArrowDown' ? 1 : count - 1)) % count;
        update();
    } else if (/^[1-9]$/.test(event.key) && Number(event.key) <= count) {
        selected = Number(event.key) - 1;
        update();
    } else if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') {
        undo();
    } else {
        return;
    }
    event.preventDefault();
});

undoBtn.onclick = undo;
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: moves });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    update();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
