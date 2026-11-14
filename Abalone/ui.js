const PLAYER = 'blue';
const AI = 'red';
const HEX = 22; // SVG radius of a cell

let currentLevelIdx = 0;
let state = null;
let selection = [];   // ordered [q, r] cells of own marbles in a line
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let lastMove = null;

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
    state = AbaloneEngine.create(level);
    selection = [];
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function center([q, r]) {
    return [HEX * Math.sqrt(3) * (q + r / 2), HEX * 1.5 * r];
}

// Legal moves of the current selection, keyed by the cell that picks them
function targetMap() {
    const map = new Map();
    if (!selection.length || isOver || isAiTurn) return map;
    for (const d of AbaloneEngine.dirs) {
        const move = AbaloneEngine.moveFor(state, selection, d);
        if (!move || (selection.length === 1 && move.type === 'side')) continue;
        AbaloneEngine.targets(state, move).forEach(([q, r]) => map.set(AbaloneEngine.key(q, r), move));
    }
    return map;
}

function render() {
    const targets = targetMap();
    const sel = new Set(selection.map(([q, r]) => AbaloneEngine.key(q, r)));
    const last = new Set(lastMove ? [...lastMove.group.map(([q, r]) => AbaloneEngine.key(q + lastMove.d[0], r + lastMove.d[1]))] : []);
    const cells = AbaloneEngine.cells().map(([q, r]) => {
        const [x, y] = center([q, r]);
        const v = AbaloneEngine.at(state, q, r);
        const key = AbaloneEngine.key(q, r);
        const t = targets.get(key);
        const classes = ['cell', v ? v : 'empty', sel.has(key) ? 'selected' : '', t ? `target ${t.type}` : '', last.has(key) ? 'last' : '',
            v === PLAYER && !isOver && !isAiTurn ? 'mine' : ''].join(' ');
        return `<g class="${classes}" onclick="handleCell(${q}, ${r})"><circle class="hole" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${HEX * 0.92}"></circle>${v ? `<circle class="marble" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${HEX * 0.72}"></circle>` : ''}${t ? `<circle class="hint" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${HEX * 0.3}"></circle>` : ''}</g>`;
    }).join('');
    const w = HEX * Math.sqrt(3) * 9 + HEX * 2, h = HEX * 1.5 * 8 + HEX * 2.4;
    boardEl.innerHTML = `<svg viewBox="${-w / 2} ${-h / 2} ${w} ${h}" role="img"><rect class="felt" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="18"></rect>${cells}</svg>`;
    countersEl.innerText = `${i18n.t('pushed_off')}: ${state.off.red} / ${state.target} · ${i18n.t('lost')}: ${state.off.blue} / ${state.target} · ${i18n.t('moves')}: ${state.plies}`;
}

function inLineWithSelection(q, r) {
    if (selection.length === 0) return true;
    if (selection.length >= 3) return false;
    const ends = [selection[0], selection[selection.length - 1]];
    for (const [dq, dr] of AbaloneEngine.dirs) {
        const extendsFront = selection.length === 1
            || (dq === selection[1][0] - selection[0][0] && dr === selection[1][1] - selection[0][1])
            || (dq === selection[0][0] - selection[1][0] && dr === selection[0][1] - selection[1][1]);
        if (!extendsFront) continue;
        for (const e of ends) if (e[0] + dq === q && e[1] + dr === r) return [dq, dr];
    }
    return false;
}

window.handleCell = (q, r) => {
    if (isAiTurn || isOver) return;
    const v = AbaloneEngine.at(state, q, r);
    const key = AbaloneEngine.key(q, r);
    if (v === PLAYER) {
        if (selection.some(([sq, sr]) => sq === q && sr === r)) { selection = []; render(); return; }
        const dir = inLineWithSelection(q, r);
        if (dir && selection.length) {
            // keep the selection ordered along its axis
            const last = selection[selection.length - 1];
            if (last[0] + dir[0] === q && last[1] + dir[1] === r) selection.push([q, r]); else selection.unshift([q, r]);
        } else {
            selection = [[q, r]];
        }
        render();
        return;
    }
    const move = targetMap().get(key);
    if (!move) return;
    playMove(move);
};

function playMove(move) {
    state = AbaloneEngine.apply(state, move);
    lastMove = move;
    selection = [];
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const depth = LevelRegistry[currentLevelIdx].depth;
    const move = difficulty === 'master' ? AbaloneEngine.getMasterMove(state, depth) : AbaloneEngine.getNoviceMove(state);
    state = AbaloneEngine.apply(state, move);
    lastMove = move;
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    if (!state.winner) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (state.winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else if (state.winner === 'draw') setStatus('draw');
    else setStatus('lose');
    return true;
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) { statusKey = key; statusEl.innerText = i18n.t(key); }

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);
window.addEventListener('langChanged', () => { setStatus(statusKey); updateLevelInfo(); render(); });
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
