/**
 * Star Cube page: draws the cube and its stars in perspective on two canvases,
 * your view and the target, and turns your cube with buttons, keys or dragging.
 */
const QUARTER_MS = 260;
const FINE_STEP = 15;
const DRAG_SPEED = 0.01;

let currentLevelIdx = 0;
let state = null;
let history = [];
let anim = null;
let solved = false;
let statusKey = 'status_play';

const viewCanvas = document.getElementById('view');
const targetCanvas = document.getElementById('target');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const meterEl = document.getElementById('meter');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = StarCube.setup(level);
    history = [];
    anim = null;
    solved = false;
    document.body.classList.toggle('free-mode', state.mode === 'free');
    setStatus(state.mode === 'quarter' ? 'status_quarter' : 'status_free');
    updateLevelInfo();
    resize();
    update();
}

/* ---------- Drawing ---------- */

function resize() {
    StarScene.resize(viewCanvas);
    StarScene.resize(targetCanvas);
}

function update() {
    StarScene.draw(viewCanvas, state, state.orientation);
    StarScene.draw(targetCanvas, state, state.target);
    const parts = [`${i18n.t('turns')}: ${state.moves}`];
    if (state.par !== null) parts.push(`${i18n.t('par')}: ${state.par}`);
    countersEl.innerText = parts.join(' · ');

    const off = StarMath.angle(state.orientation, state.target);
    meterEl.hidden = !state.meter;
    meterEl.firstElementChild.style.width = `${Math.max(0, 100 - off / 1.8)}%`;
    document.getElementById('undoBtn').disabled = !history.length || solved || !!anim;
}

/* ---------- Turning ---------- */

// Animates from the current orientation to `to`, then calls done
function animateTo(to, ms, done) {
    const from = state.orientation;
    const start = performance.now();
    const id = currentLevelIdx;
    anim = true;
    const step = (now) => {
        if (id !== currentLevelIdx || !anim) return;
        const t = Math.min(1, (now - start) / ms);
        const ease = t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2;
        state.orientation = StarMath.slerp(from, to, ease);
        update();
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            state.orientation = to;
            anim = null;
            update();
            done();
        }
    };
    requestAnimationFrame(step);
}

// A button or key turn: 90° in quarter mode, a fine step in free mode
function turn(axis, dir) {
    if (!state || anim || solved) return;
    const degrees = state.mode === 'quarter' ? 90 : FINE_STEP;
    history.push(state.orientation);
    state.moves++;
    const to = StarMath.normalize(StarMath.mul(StarCube.turn(axis, dir, degrees), state.orientation));
    animateTo(to, state.mode === 'quarter' ? QUARTER_MS : 120, checkMatch);
}

function undo() {
    if (anim || solved || !history.length) return;
    state.moves--;
    animateTo(history.pop(), QUARTER_MS, () => setStatus(state.mode === 'quarter' ? 'status_quarter' : 'status_free'));
}

function checkMatch() {
    if (solved || !StarCube.isMatched(state)) {
        update();
        return;
    }
    solved = true;
    // Snap exactly onto the target
    animateTo(state.target, 300, () => {
        const perfect = state.par !== null && state.moves <= state.par;
        setStatus(perfect ? 'status_perfect' : 'status_solved');
        Progress.markSolved(currentLevelIdx);
        update();
        const id = currentLevelIdx;
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2000);
    });
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Dragging (free mode) ---------- */

let drag = null;

viewCanvas.addEventListener('pointerdown', (e) => {
    if (!state || state.mode !== 'free' || anim || solved) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, from: state.orientation };
    viewCanvas.setPointerCapture(e.pointerId);
});

viewCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!dx && !dy) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.moved) {
        drag.moved = true;
        history.push(drag.from);
        state.moves++;
    }
    // Dragging moves the front of the cube with the pointer; shift-drag rolls it
    let q;
    if (e.shiftKey) q = StarMath.axisAngle([0, 0, 1], -dx * DRAG_SPEED);
    else q = StarMath.mul(StarMath.axisAngle([0, 1, 0], dx * DRAG_SPEED), StarMath.axisAngle([1, 0, 0], dy * DRAG_SPEED));
    state.orientation = StarMath.normalize(StarMath.mul(q, state.orientation));
    update();
});

const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) checkMatch();
};
viewCanvas.addEventListener('pointerup', endDrag);
viewCanvas.addEventListener('pointercancel', endDrag);

/* ---------- Buttons and keys ---------- */

document.querySelectorAll('[data-turn]').forEach(btn => {
    const [axis, dir] = btn.dataset.turn.split(':');
    btn.addEventListener('click', () => turn(axis, Number(dir)));
});
document.getElementById('undoBtn').onclick = () => undo();
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const keys = {
        arrowup: ['x', -1], w: ['x', -1], arrowdown: ['x', 1], s: ['x', 1],
        arrowleft: ['y', -1], a: ['y', -1], arrowright: ['y', 1], d: ['y', 1],
        q: ['z', 1], e: ['z', -1]
    };
    const key = event.key.toLowerCase();
    if (keys[key]) turn(...keys[key]);
    else if (key === 'z' || key === 'backspace') undo();
    else return;
    event.preventDefault();
});

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { n: state ? state.moves : 0 });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

window.addEventListener('resize', () => {
    if (!state) return;
    resize();
    update();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    update();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
