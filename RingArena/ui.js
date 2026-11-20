/**
 * Ring Arena page. The arena is drawn with SVG around (0, 0); every figure is one <g>
 * placed with a CSS transform "rotate(angle) translate(0, -t)", so a ring turn animates
 * around the hub (angle changes) and a slide runs straight through it (t changes, and
 * may become negative on the far side of the hub).
 * A move is one ring or one line turned by any amount: further steps on the same ring
 * or line right after it still count as that move, and turning it back cancels it.
 * Keys: Left / Right turn the selected cell's ring, Up / Down slide its line out / in, Z undoes.
 */
const HUB = 46;     // hub radius
const RW = 42;      // ring width
const SVGNS = 'http://www.w3.org/2000/svg';
// Symbol on each figure kind, as SVG so it has the same size in every font
const star = [...Array(10).keys()].map(i => {
    const a = i * Math.PI / 5, rad = i % 2 ? 4.4 : 10.5;
    return `${(rad * Math.sin(a)).toFixed(1)},${(-rad * Math.cos(a)).toFixed(1)}`;
}).join(' ');
const SYMBOLS = {
    A: ['circle', { r: 7.5 }],
    B: ['polygon', { points: '0,-10 9,6.5 -9,6.5' }],
    C: ['rect', { x: -7, y: -7, width: 14, height: 14, rx: 1.5 }],
    D: ['polygon', { points: '0,-10.5 9,0 0,10.5 -9,0' }],
    E: ['polygon', { points: star }]
};
const STEP = 360 / ArenaEngine.SECTORS;

let currentLevelIdx = 0;
let state = null;
let cells = [];
let history = [];   // moves made: { kind, index, steps }
let solved = false;
let statusKey = 'status_play';
let selected = null; // [ring, sector]
let figEls = [];     // figEls[cell] = the element of the figure in that cell
let cellEls = [];
let drag = null;

const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const goalEl = document.getElementById('goal');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    drag = null;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = ArenaEngine.parse(level);
    cells = state.cells;
    history = [];
    solved = false;
    selected = null;
    setStatus('status_play');
    updateLevelInfo();
    buildBoard();
    update();
}

/* ---------- Geometry ---------- */

const radius = r => HUB + RW * (r + 0.5);
const angleOf = s => s * STEP + STEP / 2;
const mod = (a, n) => ((a % n) + n) % n;

// Shortest equivalent number of steps, e.g. 11 sectors clockwise -> 1 counter-clockwise
function shortest(steps, period) {
    const k = mod(steps, period);
    return k > period / 2 ? k - period : k;
}

function point(rad, deg) {
    const a = deg * Math.PI / 180;
    return `${(rad * Math.sin(a)).toFixed(2)} ${(-rad * Math.cos(a)).toFixed(2)}`;
}

function sectorPath(r, s) {
    const r0 = HUB + RW * r, r1 = r0 + RW, a0 = s * STEP, a1 = a0 + STEP;
    return `M ${point(r0, a0)} L ${point(r1, a0)} A ${r1} ${r1} 0 0 1 ${point(r1, a1)} ` +
        `L ${point(r0, a1)} A ${r0} ${r0} 0 0 0 ${point(r0, a0)} Z`;
}

// Signed distance from the hub of path position i on a line (negative: the far end)
function lineCoord(i) {
    const R = ArenaEngine.RINGS;
    return i < R ? -radius(R - 1 - i) : radius(i - R);
}

// Position u along a line, fractional while dragging; past an end it comes back at the other
function coordAt(u) {
    const n = 2 * ArenaEngine.RINGS;
    const w = mod(u + 0.5, n) - 0.5;
    if (w < 0) return lineCoord(0) + w * RW;
    if (w > n - 1) return lineCoord(n - 1) + (w - (n - 1)) * RW;
    const i = Math.floor(w);
    return lineCoord(i) + (w - i) * (lineCoord(i + 1) - lineCoord(i));
}

/* ---------- Building ---------- */

const el = (tag, attrs = {}) => {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
};

function glyph(kind, cls) {
    const g = el('g', { class: `${cls} k-${kind}` });
    const body = el('g', { class: 'body' });
    body.appendChild(el('circle', { class: 'disc', r: RW * 0.38 }));
    const [tag, attrs] = SYMBOLS[kind] || SYMBOLS.A;
    body.appendChild(el(tag, { ...attrs, class: 'sym' }));
    g.appendChild(body);
    return g;
}

function buildBoard() {
    const m = HUB + RW * ArenaEngine.RINGS + 8;
    board.setAttribute('viewBox', `${-m} ${-m} ${2 * m} ${2 * m}`);
    board.innerHTML = '';
    board.appendChild(el('circle', { class: 'rim', r: m - 4 }));

    cellEls = cells.map((v, i) => {
        const r = Math.floor(i / ArenaEngine.SECTORS), s = i % ArenaEngine.SECTORS;
        const p = el('path', { class: `cell ${(r + s) % 2 ? 'alt' : ''}`, d: sectorPath(r, s) });
        board.appendChild(p);
        return p;
    });
    board.appendChild(el('circle', { class: 'hub', r: HUB - 3 }));

    if (state.target) {
        state.target.forEach((kind, i) => {
            if (!kind) return;
            const mark = glyph(kind, 'mark');
            setPos(mark, angleOf(i % ArenaEngine.SECTORS), radius(Math.floor(i / ArenaEngine.SECTORS)));
            board.appendChild(mark);
        });
    }

    figEls = cells.map((kind, i) => {
        if (!kind) return null;
        const fig = glyph(kind, 'fig');
        board.appendChild(fig);
        return fig;
    });
    instantly(() => figEls.forEach((f, i) => f && setPos(f, ...homePos(i))));
}

function homePos(i) {
    return [angleOf(i % ArenaEngine.SECTORS), radius(Math.floor(i / ArenaEngine.SECTORS))];
}

function setPos(g, angle, t) {
    g.style.transform = `rotate(${angle}deg) translate(0px, ${-t}px)`;
    g.firstChild.style.transform = `rotate(${-angle}deg)`;
}

// Runs fn with transitions switched off, so figures jump instead of sliding
function instantly(fn) {
    board.classList.add('instant');
    fn();
    board.getBoundingClientRect();
    board.classList.remove('instant');
}

/* ---------- Moving figures ---------- */

// Where every figure moved by (kind, index) sits now, in that move's coordinates
function moverPositions(kind, index) {
    const movers = [];
    if (kind === 'ring') {
        for (let s = 0; s < ArenaEngine.SECTORS; s++) {
            const cell = ArenaEngine.idx(index, s);
            if (figEls[cell]) movers.push({ el: figEls[cell], angle: angleOf(s), t: radius(index), u: 0 });
        }
    } else {
        ArenaEngine.linePath(index).forEach((cell, i) => {
            if (figEls[cell]) movers.push({ el: figEls[cell], angle: angleOf(index), t: lineCoord(i), u: i });
        });
    }
    return movers;
}

// Shows a move in progress: `amount` sectors (ring) or cells (line), fractional while dragging
function showOffset(kind, movers, amount) {
    movers.forEach(m => {
        if (kind === 'ring') setPos(m.el, m.angle + amount * STEP, m.t);
        else setPos(m.el, m.angle, coordAt(m.u + amount));
    });
}

// Animates figures from `from` to the whole-step offset `steps`; figures that wrap around jump
function animateTo(kind, movers, from, steps) {
    instantly(() => showOffset(kind, movers, from));
    movers.forEach(m => {
        const jump = kind === 'line' && Math.abs(coordAt(m.u + steps) - coordAt(m.u + from)) > 2.5 * RW;
        m.el.classList.toggle('instant', jump);
    });
    showOffset(kind, movers, steps);
}

// Applies a move to the state; false if it would need one move more than allowed
function act(kind, index, steps) {
    const period = ArenaEngine.period(kind);
    const last = history[history.length - 1];
    if (last && last.kind === kind && last.index === index) {
        last.steps = mod(last.steps + steps, period);
        if (last.steps === 0) history.pop();
    } else {
        if (history.length >= state.limit) {
            setStatus('status_no_moves');
            return false;
        }
        history.push({ kind, index, steps: mod(steps, period) });
    }
    cells = ArenaEngine.apply(cells, kind, index, steps);
    return true;
}

// A move from the buttons or keys: one step
function move(kind, index, steps) {
    if (!state || solved || drag) return;
    const movers = moverPositions(kind, index);
    if (!act(kind, index, steps)) return;
    figEls = ArenaEngine.apply(figEls, kind, index, steps);
    animateTo(kind, movers, 0, steps);
    afterMove();
}

function undo() {
    if (!state || solved || drag || !history.length) return;
    const last = history.pop();
    const steps = -shortest(last.steps, ArenaEngine.period(last.kind));
    const movers = moverPositions(last.kind, last.index);
    cells = ArenaEngine.apply(cells, last.kind, last.index, steps);
    figEls = ArenaEngine.apply(figEls, last.kind, last.index, steps);
    animateTo(last.kind, movers, 0, steps);
    setStatus('status_play');
    update();
}

function afterMove() {
    if (statusKey === 'status_no_moves') setStatus('status_play');
    if (ArenaEngine.isSolved(state, cells)) {
        solved = true;
        setStatus('status_solved');
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

/* ---------- Buttons and selection ---------- */

function turnSelected(d) {
    if (!selected) select(0, 0);
    move('ring', selected[0], d);
}

// Slides the selected cell's line so that the selected cell moves out (+1) or in (-1)
function slideSelected(dir) {
    if (!selected) select(0, 0);
    const { d, side } = ArenaEngine.lineOf(selected[1]);
    move('line', d, dir * side);
}

function select(r, s) {
    selected = [r, s];
    update();
}

/* ---------- Rendering ---------- */

function update() {
    countersEl.innerText = `${i18n.t('moves')}: ${history.length} / ${state.limit}`;
    goalEl.innerText = i18n.t(`goal_${state.goal}`);
    undoBtn.disabled = solved || !history.length;
    document.querySelectorAll('.move-pad button').forEach(b => { b.disabled = solved; });
    board.classList.toggle('solved', solved);

    const line = selected ? ArenaEngine.lineOf(selected[1]).d : -1;
    cellEls.forEach((c, i) => {
        const r = Math.floor(i / ArenaEngine.SECTORS), s = i % ArenaEngine.SECTORS;
        const inLine = selected && ArenaEngine.lineOf(s).d === line;
        c.classList.toggle('sel-ring', !!selected && r === selected[0]);
        c.classList.toggle('sel-line', !!inLine);
        c.classList.toggle('sel', !!selected && r === selected[0] && s === selected[1]);
    });
}

/* ---------- Input: dragging and tapping ---------- */

function svgPoint(e) {
    const m = board.getScreenCTM().inverse();
    return [e.clientX * m.a + e.clientY * m.c + m.e, e.clientX * m.b + e.clientY * m.d + m.f];
}

// The cell under an SVG point, or null on the hub or outside the arena
function cellAt([x, y]) {
    const r = Math.floor((Math.hypot(x, y) - HUB) / RW);
    if (r < 0 || r >= ArenaEngine.RINGS) return null;
    const deg = mod(Math.atan2(x, -y) * 180 / Math.PI, 360);
    return [r, Math.floor(deg / STEP)];
}

const pointerAngle = ([x, y]) => Math.atan2(x, -y) * 180 / Math.PI;

board.addEventListener('pointerdown', (e) => {
    if (!state || solved || e.button > 0) return;
    const p = svgPoint(e);
    const cell = cellAt(p);
    if (!cell) return;
    drag = { p, cell, kind: null, id: e.pointerId, sx: e.clientX, sy: e.clientY, amount: 0 };
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or finished pointer */ }
});

board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const q = svgPoint(e);
    if (!drag.kind) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
        // Along the ring turns it; across the rings slides the line
        const [x, y] = drag.p;
        const len = Math.hypot(x, y);
        const [dx, dy] = [q[0] - x, q[1] - y];
        const radial = Math.abs((dx * x + dy * y) / len);
        const tangential = Math.abs((dx * y - dy * x) / len);
        const [r, s] = drag.cell;
        if (tangential > radial) {
            Object.assign(drag, { kind: 'ring', index: r, last: pointerAngle(drag.p) });
        } else {
            const a = angleOf(ArenaEngine.lineOf(s).d) * Math.PI / 180;
            Object.assign(drag, { kind: 'line', index: ArenaEngine.lineOf(s).d, dir: [Math.sin(a), -Math.cos(a)] });
        }
        drag.movers = moverPositions(drag.kind, drag.index);
        selected = drag.cell;
        board.classList.add('dragging');
        update();
    }
    if (drag.kind === 'ring') {
        const a = pointerAngle(q);
        drag.amount += mod(a - drag.last + 180, 360) / STEP - 180 / STEP;
        drag.last = a;
    } else {
        drag.amount = ((q[0] - drag.p[0]) * drag.dir[0] + (q[1] - drag.p[1]) * drag.dir[1]) / RW;
    }
    instantly(() => showOffset(drag.kind, drag.movers, drag.amount));
});

function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    board.classList.remove('dragging');
    if (!d.kind) {
        select(...d.cell);
        return;
    }
    let steps = Math.round(d.amount);
    if (steps && !act(d.kind, d.index, steps)) steps = 0;
    if (steps) figEls = ArenaEngine.apply(figEls, d.kind, d.index, steps);
    animateTo(d.kind, d.movers, d.amount, steps);
    if (steps) afterMove();
    else update();
}

board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !state) return;
    if (event.key === 'ArrowLeft') turnSelected(-1);
    else if (event.key === 'ArrowRight') turnSelected(1);
    else if (event.key === 'ArrowUp') slideSelected(1);
    else if (event.key === 'ArrowDown') slideSelected(-1);
    else if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') undo();
    else return;
    event.preventDefault();
});

undoBtn.onclick = undo;
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    const text = key === 'status_solved' && history.length === 1 ? 'status_solved_one' : key;
    statusEl.innerText = i18n.t(text, { n: history.length });
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
