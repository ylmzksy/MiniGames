const PLAYER = 0;
const AI = 1;
const DIRECT = false;      // true: tap the final destination of a chain at once
const BOARD = 'points';      // 'grid' or 'points'

let currentLevelIdx = 0;
let state = null;
let selected = null;   // [r, c] of the piece being moved
let partial = null;    // { path, kinds, display } while a multi-step move is chosen
let choice = null;     // pending approach/withdrawal choice: { cell, options }
let isAiTurn = false;
let isOver = false;
let gameId = 0;
let statusKey = '';
let moves = 0;
let lastMove = null;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const choiceEl = document.getElementById('choice');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = FanoronaEngine.create(level);
    selected = null;
    partial = null;
    choice = null;
    isAiTurn = false;
    isOver = false;
    moves = 0;
    lastMove = null;
    updateLevelInfo();
    setStatus(state.phase === 'remove' ? 'status_remove' : 'status_your_turn');
    render();
}

function sameCell(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}

// Moves of the selected piece that continue the current partial path
function candidates() {
    const all = FanoronaEngine.moves(state, PLAYER);
    if (!selected) return all;
    const prefix = partial ? partial.path : [selected];
    const kinds = partial ? partial.kinds : [];
    return all.filter(m => sameCell(m.from, selected)
        && prefix.every((cell, i) => sameCell(m.path[i], cell))
        && kinds.every((k, i) => !m.kinds || m.kinds[i] === k));
}

function displayBoard() {
    return partial ? partial.display : state.board;
}

function targetCells() {
    const targets = new Set();
    if (isAiTurn || isOver || !selected || choice) return targets;
    const step = partial ? partial.path.length : 1;
    candidates().forEach(m => {
        const cell = DIRECT ? m.path[m.path.length - 1] : m.path[step];
        if (cell) targets.add(cell.join(','));
    });
    // a piece mid-move can be tapped to stop here when a shorter move exists
    if (partial && candidates().some(m => m.path.length === partial.path.length)) targets.add(partial.path[partial.path.length - 1].join(','));
    return targets;
}

function movableCells() {
    if (isAiTurn || isOver || partial) return new Set();
    return new Set(FanoronaEngine.moves(state, PLAYER).map(m => m.from.join(',')));
}

function render() {
    if (BOARD === 'grid') renderGrid(); else renderPoints();
    choiceEl.hidden = !choice;
    if (choice) {
        choiceEl.innerHTML = choice.options.map(kind => `<button class="primary" onclick="pickKind('${kind}')">${i18n.t('kind_' + kind)}</button>`).join('');
    }
    const count = side => state.board.flat().filter(v => v === side).length;
    countersEl.innerText = `${i18n.t('you')}: ${count(PLAYER)} · ${i18n.t('ai')}: ${count(AI)} · ${i18n.t('moves')}: ${moves}`;
}

function cellClasses(r, c, extra) {
    const key = `${r},${c}`;
    return ['cell', extra,
        sameCell(selected, [r, c]) ? 'selected' : '',
        targetCells().has(key) ? 'target' : '',
        movableCells().has(key) ? 'movable' : '',
        lastMove && lastMove.path.some(([pr, pc]) => pr === r && pc === c) ? 'last' : '',
        lastMove && lastMove.captures.some(([pr, pc]) => pr === r && pc === c) ? 'taken' : ''].join(' ');
}

function renderGrid() {
    const n = state.n;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.style.maxWidth = `${n * 56}px`;
    const display = displayBoard();
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const v = display[r][c];
            const camp = typeof HalmaEngine !== 'undefined' && state.camp
                ? (HalmaEngine.inTarget(state, 0, r, c) ? 'camp-ai' : HalmaEngine.inTarget(state, 1, r, c) ? 'camp-you' : '') : '';
            const piece = v === null ? '' : `<span class="piece ${v === PLAYER ? 'you' : 'ai'}"></span>`;
            cells.push(`<div class="${cellClasses(r, c, ((r + c) % 2 ? 'dark' : 'light') + ' ' + camp)}" onclick="handleCell(${r}, ${c})">${piece}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
}

function renderPoints() {
    const rows = state.rows ?? state.n;
    const cols = state.cols ?? state.n;
    const unit = 60;
    const pad = 36;
    const W = pad * 2 + (cols - 1) * unit;
    const H = pad * 2 + (rows - 1) * unit;
    const x = c => pad + c * unit;
    const y = r => pad + r * unit;
    const lines = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const dirs = (r + c) % 2 === 0 ? [[0, 1], [1, 0], [1, 1], [1, -1]] : [[0, 1], [1, 0]];
            dirs.forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < rows && nc >= 0 && nc < cols) lines.push(`<line x1="${x(c)}" y1="${y(r)}" x2="${x(nc)}" y2="${y(nr)}"></line>`);
            });
        }
    }
    const display = displayBoard();
    const points = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const v = display[r][c];
            const cls = cellClasses(r, c, v === null ? 'empty' : v === PLAYER ? 'you' : 'ai');
            points.push(`<g class="${cls}" onclick="handleCell(${r}, ${c})"><circle class="hit" cx="${x(c)}" cy="${y(r)}" r="26"></circle><circle class="mark" cx="${x(c)}" cy="${y(r)}" r="22"></circle><circle class="stone" cx="${x(c)}" cy="${y(r)}" r="19"></circle></g>`);
        }
    }
    boardEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img"><g class="lines">${lines.join('')}</g>${points.join('')}</svg>`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver || choice) return;
    const piece = state.board[r][c];
    if (!partial && piece === PLAYER) {
        if (state.phase === 'remove') {
            const removal = FanoronaEngine.moves(state, PLAYER).find(m => m.remove && sameCell(m.from, [r, c]));
            if (removal) playMove(removal);
            return;
        }
        selected = sameCell(selected, [r, c]) ? null : [r, c];
        setStatus(selected ? (candidates().length ? 'status_pick_target' : 'status_no_moves_piece') : 'status_your_turn');
        render();
        return;
    }
    if (!selected) return;
    const step = partial ? partial.path.length : 1;
    if (partial && sameCell(partial.path[step - 1], [r, c])) {
        const done = candidates().find(m => m.path.length === step);
        if (done) playMove(done);
        return;
    }
    const options = candidates().filter(m => DIRECT ? sameCell(m.path[m.path.length - 1], [r, c]) : sameCell(m.path[step], [r, c]));
    if (!options.length) return;
    if (DIRECT) { playMove(options[0]); return; }
    const kinds = [...new Set(options.map(m => m.kinds ? m.kinds[step - 1] : 'step'))];
    if (kinds.length > 1) {
        choice = { cell: [r, c], options: kinds };
        setStatus('status_choose_kind');
        render();
        return;
    }
    continueWith(options, [r, c], step);
};

// Applies one step of a multi-step move: finishes it or shows the piece at its new place for the next step
function continueWith(options, cell, step) {
    const done = options.find(m => m.path.length === step + 1);
    const longer = options.filter(m => m.path.length > step + 1);
    if (done && !longer.length) { playMove(done); return; }
    const sample = options[0];
    const display = displayBoard().map(row => [...row]);
    const [pr, pc] = sample.path[step - 1];
    display[cell[0]][cell[1]] = display[pr][pc];
    display[pr][pc] = null;
    (sample.stepCaptures[step - 1] || []).forEach(([cr, cc]) => { display[cr][cc] = null; });
    partial = { path: sample.path.slice(0, step + 1), kinds: sample.kinds ? sample.kinds.slice(0, step) : [], display };
    setStatus(done ? 'status_continue_or_stop' : 'status_keep_going');
    render();
}

window.pickKind = (kind) => {
    if (!choice) return;
    const step = partial ? partial.path.length : 1;
    const options = candidates().filter(m => sameCell(m.path[step], choice.cell) && m.kinds[step - 1] === kind);
    const cell = choice.cell;
    choice = null;
    continueWith(options, cell, step);
};

function playMove(move) {
    state = FanoronaEngine.apply(state, move);
    lastMove = move;
    selected = null;
    partial = null;
    choice = null;
    moves++;
    render();
    if (checkEnd()) return;

    isAiTurn = true;
    setStatus('status_ai');
    render();
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 500);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const depth = LevelRegistry[currentLevelIdx].depth;
    const move = difficulty === 'master' ? FanoronaEngine.getMasterMove(state, depth) : FanoronaEngine.getNoviceMove(state);
    isAiTurn = false;
    if (!move) { checkEnd(); return; }
    state = FanoronaEngine.apply(state, move);
    lastMove = move;
    moves++;
    render();
    if (checkEnd()) return;
    setStatus(state.phase === 'remove' ? 'status_remove' : 'status_your_turn');
}

function checkEnd() {
    const res = FanoronaEngine.result(state);
    if (!res) return false;
    isOver = true;
    isAiTurn = false;
    render();
    if (res.winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else if (res.winner === AI) {
        setStatus('lose');
    } else {
        setStatus('draw');
    }
    return true;
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
    const size = level.size ? ` (${level.size}×${level.size})` : '';
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}${size}`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
