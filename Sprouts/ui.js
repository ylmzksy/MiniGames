const PLAYER = 'blue';
const AI = 'red';
const SAMPLE = 5; // px between recorded points while drawing

let currentLevelIdx = 0;
let state = null;
let drawing = null;   // { from, points, valid } while the player draws
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let moves = 0;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = SproutsEngine.create(level);
    drawing = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    const S = SproutsEngine.SIZE;
    const curves = state.curves.map(c => `<polyline class="curve ${c.owner}" points="${c.points.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"></polyline>`).join('');
    const live = drawing ? `<polyline class="curve drawing ${drawing.valid ? '' : 'invalid'}" points="${drawing.points.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"></polyline>` : '';
    const spots = state.spots.map((s, i) => {
        const free = SproutsEngine.free(state, i);
        const pips = Array.from({ length: free }, (_, k) => {
            const angle = -Math.PI / 2 + k * (Math.PI * 2 / 3);
            return `<circle class="pip" cx="${(s.x + Math.cos(angle) * 15).toFixed(1)}" cy="${(s.y + Math.sin(angle) * 15).toFixed(1)}" r="2.2"></circle>`;
        }).join('');
        return `<g class="spot ${free ? 'live' : 'dead'}" data-idx="${i}"><circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${SproutsEngine.SPOT_RADIUS}"></circle>${pips}</g>`;
    }).join('');
    boardEl.innerHTML = `<svg viewBox="0 0 ${S} ${S}" role="img"><rect class="paper" x="0" y="0" width="${S}" height="${S}"></rect>${curves}${live}${spots}</svg>`;
    countersEl.innerText = `${i18n.t('moves')}: ${moves} · ${i18n.t('live_spots')}: ${state.spots.filter((_, i) => SproutsEngine.free(state, i) > 0).length}`;
}

// Pointer position in board units
function boardPoint(event) {
    const rect = boardEl.querySelector('svg').getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * SproutsEngine.SIZE, ((event.clientY - rect.top) / rect.height) * SproutsEngine.SIZE];
}

function spotAt(p) {
    let best = -1;
    state.spots.forEach((s, i) => {
        if (SproutsEngine.dist(p, [s.x, s.y]) <= SproutsEngine.SPOT_RADIUS * 2.2 && (best < 0 || SproutsEngine.dist(p, [s.x, s.y]) < SproutsEngine.dist(p, [state.spots[best].x, state.spots[best].y]))) best = i;
    });
    return best;
}

boardEl.addEventListener('pointerdown', (event) => {
    if (isAiTurn || isOver) return;
    const p = boardPoint(event);
    const from = spotAt(p);
    if (from < 0 || SproutsEngine.free(state, from) < 1) return;
    event.preventDefault();
    drawing = { from, points: [[state.spots[from].x, state.spots[from].y]], valid: true };
    boardEl.setPointerCapture(event.pointerId);
    render();
});

boardEl.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const p = boardPoint(event);
    const last = drawing.points[drawing.points.length - 1];
    if (SproutsEngine.dist(p, last) < SAMPLE) return;
    drawing.points.push(p);
    // Live check against curves and foreign spots only; endpoint rules are checked on release
    const probe = { ...state, spots: state.spots.map((s, i) => i === drawing.from ? s : { ...s }) };
    const reason = SproutsEngine.invalidReason(probe, drawing.points, drawing.from, drawing.from);
    drawing.valid = !reason || reason === 'short' || reason === 'full';
    render();
});

function finishDrawing(event) {
    if (!drawing) return;
    const p = boardPoint(event);
    const to = spotAt(p);
    const { from, points } = drawing;
    drawing = null;
    if (to < 0) { setStatus('status_end_on_spot'); render(); return; }
    const full = [...points, [state.spots[to].x, state.spots[to].y]];
    const reason = SproutsEngine.invalidReason(state, full, from, to);
    if (reason) { setStatus('status_' + reason); render(); return; }
    playMove(full, from, to);
}
boardEl.addEventListener('pointerup', finishDrawing);
boardEl.addEventListener('pointercancel', () => { drawing = null; render(); });

function playMove(points, a, b) {
    state = SproutsEngine.apply(state, points, a, b, PLAYER);
    moves++;
    render();
    if (checkEnd(AI)) return;

    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? SproutsEngine.getMasterMove(state, AI) : SproutsEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { endGame(PLAYER); return; }
    state = SproutsEngine.apply(state, move.points, move.a, move.b, AI);
    moves++;
    render();
    if (checkEnd(PLAYER)) return;
    setStatus('status_your_turn');
}

// The side that has to move next and cannot, loses
function checkEnd(nextPlayer) {
    if (SproutsEngine.hasMove(state)) return false;
    endGame(nextPlayer === AI ? PLAYER : AI);
    return true;
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
    render();
    if (winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus('lose');
    }
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
