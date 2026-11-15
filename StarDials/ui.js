/**
 * Star Dials page: one knob per dial. Drag a knob round (or use its − / +
 * buttons, the mouse wheel or the keyboard) to turn the cube about that
 * dial's rod by any angle.
 */
const FINE = 1;
const COARSE = 10;
const SNAP_MS = 300;

let currentLevelIdx = 0;
let state = null;
let solved = false;
let activeDial = 0;
let statusKey = 'status_play';

const viewCanvas = document.getElementById('view');
const targetCanvas = document.getElementById('target');
const dialsEl = document.getElementById('dials');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const meterEl = document.getElementById('meter');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = StarDials.setup(level);
    solved = false;
    activeDial = 0;
    setStatus('status_play');
    updateLevelInfo();
    buildDials();
    StarScene.resize(viewCanvas);
    StarScene.resize(targetCanvas);
    update();
}

/* ---------- Knobs ---------- */

function buildDials() {
    dialsEl.innerHTML = state.dials.map((dial, i) => {
        const ticks = Array.from({ length: 12 }, (_, k) => {
            const a = (k * 30 * Math.PI) / 180;
            const r1 = k % 3 ? 40 : 37;
            return `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}"/>`;
        }).join('');
        return `
            <div class="dial" data-dial="${i}" style="--tone:${dial.color}">
                <svg class="knob" viewBox="0 0 100 100" data-knob="${i}">
                    <circle class="rim" cx="50" cy="50" r="46"/>
                    <g class="ticks">${ticks}</g>
                    <circle class="face" cx="50" cy="50" r="33"/>
                    <line class="pointer" x1="50" y1="50" x2="50" y2="20"/>
                    <text x="50" y="56" class="value"></text>
                </svg>
                <div class="nudge">
                    <button data-nudge="${i}:-1" aria-label="−1°">−</button>
                    <button data-nudge="${i}:1" aria-label="+1°">+</button>
                </div>
            </div>`;
    }).join('');
}

function setAngle(i, angle) {
    if (solved) return;
    state.angles[i] = StarDials.wrap(Math.round(angle * 10) / 10);
    activeDial = i;
    update();
}

function nudge(i, step) {
    setAngle(i, state.angles[i] + step);
    scheduleCheck();
}

// Checks the match a moment after the last nudge, so holding a key doesn't snap mid-way
let checkTimer = null;
function scheduleCheck() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkMatch, 250);
}

let knobDrag = null;

dialsEl.addEventListener('pointerdown', (e) => {
    const knob = e.target.closest('[data-knob]');
    if (!knob || solved) return;
    const i = Number(knob.dataset.knob);
    const rect = knob.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    knobDrag = { i, cx, cy, last: pointerAngle(e, cx, cy) };
    knob.setPointerCapture(e.pointerId);
    activeDial = i;
    update();
});

dialsEl.addEventListener('pointermove', (e) => {
    if (!knobDrag) return;
    const now = pointerAngle(e, knobDrag.cx, knobDrag.cy);
    // Relative turning, so grabbing the knob anywhere doesn't make it jump
    const delta = StarDials.diff(knobDrag.last, now);
    knobDrag.last = now;
    setAngle(knobDrag.i, state.angles[knobDrag.i] + delta);
});

const endKnobDrag = () => {
    if (!knobDrag) return;
    knobDrag = null;
    checkMatch();
};
dialsEl.addEventListener('pointerup', endKnobDrag);
dialsEl.addEventListener('pointercancel', endKnobDrag);

// 0° at the top, growing clockwise
function pointerAngle(e, cx, cy) {
    return (Math.atan2(e.clientX - cx, cy - e.clientY) * 180) / Math.PI;
}

dialsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nudge]');
    if (!btn) return;
    const [i, dir] = btn.dataset.nudge.split(':').map(Number);
    nudge(i, dir * FINE);
});

dialsEl.addEventListener('wheel', (e) => {
    const dial = e.target.closest('[data-dial]');
    if (!dial) return;
    e.preventDefault();
    nudge(Number(dial.dataset.dial), (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? COARSE : FINE));
}, { passive: false });

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active') || !state) return;
    const key = event.key;
    const n = state.dials.length;
    if (key >= '1' && key <= String(n)) {
        activeDial = Number(key) - 1;
        update();
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        activeDial = (activeDial + (key === 'ArrowUp' ? n - 1 : 1)) % n;
        update();
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        nudge(activeDial, (key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? COARSE : FINE));
    } else {
        return;
    }
    event.preventDefault();
});

/* ---------- Matching ---------- */

function checkMatch() {
    if (solved || !StarDials.isMatched(state)) return;
    solved = true;
    // Glide the dials onto the exact target angles when they are the ones being matched
    const from = [...state.angles];
    const close = state.targetAngles.every((t, i) => Math.abs(StarDials.diff(from[i], t)) <= state.tolerance * 2);
    const start = performance.now();
    const id = currentLevelIdx;
    const step = (now) => {
        if (id !== currentLevelIdx) return;
        const t = close ? Math.min(1, (now - start) / SNAP_MS) : 1;
        state.angles = from.map((a, i) => StarDials.wrap(a + StarDials.diff(a, state.targetAngles[i]) * t));
        if (!close) state.angles = from;
        update();
        if (t < 1) { requestAnimationFrame(step); return; }
        setStatus('status_solved');
        Progress.markSolved(currentLevelIdx);
        update();
        setTimeout(() => { if (id === currentLevelIdx) nextLevel(); }, 2200);
    };
    requestAnimationFrame(step);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

/* ---------- Drawing ---------- */

function update() {
    const orientation = StarDials.orientation(state.dials, state.angles);
    StarScene.draw(viewCanvas, state, orientation, StarDials.rods(state.dials, state.angles));
    StarScene.draw(targetCanvas, state, state.target,
        state.targetRods ? StarDials.rods(state.dials, state.targetAngles) : []);

    state.dials.forEach((_, i) => {
        const dialEl = dialsEl.querySelector(`[data-dial="${i}"]`);
        dialEl.classList.toggle('active', i === activeDial);
        dialEl.classList.toggle('done', solved);
        dialEl.querySelector('.pointer').setAttribute('transform', `rotate(${state.angles[i]} 50 50)`);
        dialEl.querySelector('.value').textContent = `${Math.round(state.angles[i])}°`;
    });

    const off = StarDials.offBy(state);
    meterEl.hidden = !state.meter;
    meterEl.firstElementChild.style.width = `${Math.max(0, 100 - off / 1.8)}%`;
    document.getElementById('offBy').innerText = state.meter ? `${i18n.t('off_by')}: ${Math.round(off)}°` : '';
}

/* ---------- Status ---------- */

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('resize', () => {
    if (!state) return;
    StarScene.resize(viewCanvas);
    StarScene.resize(targetCanvas);
    update();
});

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    update();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
