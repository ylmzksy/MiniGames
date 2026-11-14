const MAX_STROKES = 10;
const MAX_DRAG = 150;          // drag length in course pixels for a full-power putt
const SINK_TIME = 0.3;         // seconds the ball takes to drop into the cup

let currentLevelIdx = 0;
let level = null;
let state = null;
let gameId = 0;
let statusKey = '';
let statusParams = {};
let aim = { angle: -Math.PI / 2, power: 0.5 };
let drag = null;               // { x, y } where the pointer went down
let lastFrame = 0;
let accumulator = 0;
let sinkTimer = 0;
let isOver = false;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = GolfEngine.create(level);
    const { tee, hole } = GolfEngine.course(level);
    aim = { angle: Math.atan2(hole.y - tee.y, hole.x - tee.x), power: 0.5 };
    drag = null;
    isOver = false;
    sinkTimer = 0;
    accumulator = 0;
    updateLevelInfo();
    setStatus('status_aim');
    updateCounters();
}

function canAim() {
    return state && !state.moving && !state.sunk && !isOver;
}

function putt() {
    if (!canAim() || aim.power < 0.03) return;
    GolfEngine.shoot(state, aim.angle, aim.power);
    setStatus('status_rolling');
    updateCounters();
}

// Fixed physics steps, driven by animation frames
function frame(time) {
    const elapsed = Math.min(0.1, (time - (lastFrame || time)) / 1000);
    lastFrame = time;
    if (state && state.moving) {
        accumulator += elapsed;
        while (accumulator >= GolfEngine.DT && state.moving) {
            accumulator -= GolfEngine.DT;
            handleEvent(GolfEngine.step(state, level));
        }
    } else {
        accumulator = 0;
    }
    if (state && state.sunk && sinkTimer < SINK_TIME) {
        sinkTimer += elapsed;
        state.ballScale = Math.max(0, 1 - sinkTimer / SINK_TIME);
    }
    if (state) draw();
    requestAnimationFrame(frame);
}

function handleEvent(event) {
    if (!event) return;
    updateCounters();
    if (event === 'sunk') {
        finishHole();
    } else if (event === 'water') {
        if (!checkOutOfStrokes()) setStatus('status_water');
    } else if (event === 'rest') {
        if (!checkOutOfStrokes()) setStatus('status_aim');
    }
}

function checkOutOfStrokes() {
    if (state.strokes < MAX_STROKES) return false;
    isOver = true;
    setStatus('status_out_of_strokes', { n: MAX_STROKES });
    return true;
}

// Names the score relative to par: hole in one, eagle, birdie, par, bogey...
function scoreKey(strokes, par) {
    if (strokes === 1) return 'score_ace';
    const diff = strokes - par;
    if (diff <= -3) return 'score_albatross';
    return { '-2': 'score_eagle', '-1': 'score_birdie', '0': 'score_par', '1': 'score_bogey', '2': 'score_double' }[diff] || 'score_over';
}

function finishHole() {
    isOver = true;
    Progress.markSolved(currentLevelIdx);
    saveBest(state.strokes);
    updateCounters();
    const strokes = state.strokes;
    setStatus('status_sunk', { score: i18n.t(scoreKey(strokes, level.par), { n: strokes - level.par }), n: strokes });
    const winGameId = gameId;
    setTimeout(() => {
        if (winGameId === gameId) nextLevel();
    }, 2600);
}

function bestScores() {
    return Progress.load().best || {};
}

function saveBest(strokes) {
    const data = Progress.load();
    const best = data.best || {};
    if (!best[currentLevelIdx] || strokes < best[currentLevelIdx]) best[currentLevelIdx] = strokes;
    Progress.store({ ...data, best });
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        const best = bestScores();
        const total = LevelRegistry.reduce((sum, l, i) => sum + (best[i] || 0), 0);
        const par = LevelRegistry.reduce((sum, l) => sum + l.par, 0);
        setStatus('all_levels_cleared', { total, par });
    }
}

/* ---------- Drawing ---------- */

function tracePolygon(poly) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
}

function draw() {
    const { WIDTH, HEIGHT } = GolfEngine;
    const c = GolfEngine.course(level);
    const [outline, ...blocks] = level.walls;

    ctx.fillStyle = '#25532f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Green with mowing stripes
    ctx.save();
    tracePolygon(outline);
    ctx.clip();
    for (let y = 0; y < HEIGHT; y += 40) {
        ctx.fillStyle = (y / 40) % 2 ? '#56ad52' : '#5fb85a';
        ctx.fillRect(0, y, WIDTH, 40);
    }
    c.slopes.forEach(drawSlope);
    c.sand.forEach(drawSand);
    c.water.forEach(drawWater);
    ctx.restore();

    drawTee(c.tee);
    drawHole(c.hole);

    // Walls
    ctx.lineJoin = 'round';
    ctx.lineWidth = GolfEngine.WALL_HALF * 2;
    ctx.strokeStyle = '#6b4226';
    blocks.forEach(poly => {
        tracePolygon(poly);
        ctx.fillStyle = '#8a5a3b';
        ctx.fill();
        ctx.stroke();
    });
    tracePolygon(outline);
    ctx.stroke();

    c.bumpers.forEach(drawBumper);

    if (canAim()) drawAim();
    drawBall();
    drawFlag(c.hole);
}

function drawSlope(s) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    const angle = Math.atan2(s.ay, s.ax);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let y = s.y + 20; y < s.y + s.h; y += 40) {
        for (let x = s.x + 20; x < s.x + s.w; x += 40) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
            ctx.moveTo(3, -5); ctx.lineTo(8, 0); ctx.lineTo(3, 5);
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawSand(s) {
    ctx.fillStyle = '#e4cf8a';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 120, 60, 0.35)';
    for (let y = s.y + 5; y < s.y + s.h; y += 9) {
        for (let x = s.x + 5 + ((y / 9) % 2) * 4; x < s.x + s.w; x += 9) ctx.fillRect(x, y, 1.5, 1.5);
    }
}

function drawWater(w) {
    ctx.fillStyle = '#3a86cf';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    for (let y = w.y + 12; y < w.y + w.h; y += 16) {
        ctx.beginPath();
        for (let x = w.x; x <= w.x + w.w; x += 4) {
            const wy = y + Math.sin(x / 7 + y) * 2;
            x === w.x ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
        }
        ctx.stroke();
    }
}

function drawTee(t) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(t.x - 16, t.y - 10, 32, 20);
}

function drawHole(h) {
    ctx.fillStyle = '#16301b';
    ctx.beginPath();
    ctx.arc(h.x, h.y, GolfEngine.HOLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// The flag leans up and to the right so it never hides the cup
function drawFlag(h) {
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + 8, h.y - 34);
    ctx.stroke();
    ctx.fillStyle = '#e04848';
    ctx.beginPath();
    ctx.moveTo(h.x + 8, h.y - 34);
    ctx.lineTo(h.x + 26, h.y - 28);
    ctx.lineTo(h.x + 6.5, h.y - 22);
    ctx.closePath();
    ctx.fill();
}

function drawBumper(b) {
    ctx.fillStyle = '#d64545';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
}

function drawBall() {
    const { x, y } = state.ball;
    const r = GolfEngine.BALL_R * state.ballScale;
    if (r <= 0) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// A dotted line in the putting direction; longer and redder with more power
function drawAim() {
    const { x, y } = state.ball;
    const dx = Math.cos(aim.angle);
    const dy = Math.sin(aim.angle);
    const length = 20 + aim.power * 130;
    const hue = 120 - aim.power * 120;
    ctx.strokeStyle = `hsl(${hue}, 85%, 55%)`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(x + dx * 10, y + dy * 10);
    ctx.lineTo(x + dx * length, y + dy * length);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(x + dx * length, y + dy * length);
    ctx.rotate(aim.angle);
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Power meter in the corner
    const { HEIGHT } = GolfEngine;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(10, HEIGHT - 22, 104, 12);
    ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
    ctx.fillRect(12, HEIGHT - 20, aim.power * 100, 8);
}

/* ---------- Input ---------- */

function toCourse(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * GolfEngine.WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * GolfEngine.HEIGHT
    };
}

// Pull back like a slingshot: the ball goes the opposite way of the drag
canvas.addEventListener('pointerdown', (event) => {
    if (!canAim()) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drag = toCourse(event);
});

canvas.addEventListener('pointermove', (event) => {
    if (!drag || !canAim()) return;
    const p = toCourse(event);
    const dx = drag.x - p.x;
    const dy = drag.y - p.y;
    const length = Math.hypot(dx, dy);
    if (length < 4) return;
    aim.angle = Math.atan2(dy, dx);
    aim.power = Math.min(1, length / MAX_DRAG);
});

canvas.addEventListener('pointerup', (event) => {
    if (!drag) return;
    const p = toCourse(event);
    const pulled = Math.hypot(drag.x - p.x, drag.y - p.y) >= 4;
    drag = null;
    if (pulled) putt();
});

canvas.addEventListener('pointercancel', () => { drag = null; });

document.addEventListener('keydown', (event) => {
    if (document.querySelector('.modal.active') || event.target.tagName === 'SELECT') return;
    const turn = (event.shiftKey ? 1 : 4) * Math.PI / 180;
    const handled = {
        ArrowLeft: () => { aim.angle -= turn; },
        ArrowRight: () => { aim.angle += turn; },
        ArrowUp: () => { aim.power = Math.min(1, aim.power + (event.shiftKey ? 0.01 : 0.05)); },
        ArrowDown: () => { aim.power = Math.max(0.05, aim.power - (event.shiftKey ? 0.01 : 0.05)); },
        ' ': putt,
        Enter: putt
    }[event.key];
    if (!handled) return;
    event.preventDefault();
    if (event.key === ' ' || event.key === 'Enter' || canAim()) handled();
});

/* ---------- Text ---------- */

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

function updateCounters() {
    const best = bestScores()[currentLevelIdx];
    countersEl.innerText = [
        `${i18n.t('par')}: ${level.par}`,
        `${i18n.t('strokes')}: ${state.strokes}`,
        `${i18n.t('best')}: ${best || '—'}`
    ].join('  ·  ');
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    if (statusKey === 'status_sunk') {
        setStatus(statusKey, { ...statusParams, score: i18n.t(scoreKey(state.strokes, level.par), { n: state.strokes - level.par }) });
    } else {
        setStatus(statusKey, statusParams);
    }
    updateLevelInfo();
    updateCounters();
});

// Initial Load
if (LevelRegistry.length > 0) {
    loadLevel(Progress.startLevel());
    requestAnimationFrame(frame);
}
