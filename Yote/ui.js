let currentLevelIdx = 0;
let state = null;
let selected = null;     // [r, c] of a selected own piece
let pendingJump = null;  // a jump waiting for its bonus removal
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
    state = YoteEngine.create(level);
    selected = null;
    pendingJump = null;
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_your_turn');
    render();
}

function render() {
    boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    boardEl.style.maxWidth = `${state.cols * 58}px`;
    const active = !isAiTurn && !isOver;
    const myMoves = active ? YoteEngine.moves(state, 'you') : [];
    const targets = new Set(selected ? myMoves.filter(m => m.from && m.from[0] === selected[0] && m.from[1] === selected[1]).map(m => m.to.join(',')) : []);
    const placeable = active && !selected && !pendingJump && state.hand.you > 0;
    const bonus = pendingJump ? new Set(YoteEngine.bonusOptions(state, pendingJump, 'you').map(p => p.join(','))) : new Set();
    const cells = [];
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const key = `${r},${c}`;
            const v = state.board[r][c];
            const captured = pendingJump && pendingJump.captured[0] === r && pendingJump.captured[1] === c;
            const classes = ['cell', v ? '' : 'empty', selected && selected[0] === r && selected[1] === c ? 'selected' : '',
                targets.has(key) ? 'target' : '', placeable && !v ? 'placeable' : '', bonus.has(key) ? 'bonus' : '',
                lastMove && lastMove.to && lastMove.to[0] === r && lastMove.to[1] === c ? `last ${lastMove.owner}` : '',
                captured ? 'captured' : ''].join(' ');
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${v && !captured ? `<span class="piece ${v}"></span>` : ''}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');
    countersEl.innerText = `${i18n.t('you')}: ${YoteEngine.count(state, 'you')} ${i18n.t('on_board')} + ${state.hand.you} ${i18n.t('in_hand')} · ${i18n.t('ai')}: ${YoteEngine.count(state, 'ai')} + ${state.hand.ai}`;
}

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    const v = state.board[r][c];
    if (pendingJump) {
        const ok = YoteEngine.bonusOptions(state, pendingJump, 'you').some(p => p[0] === r && p[1] === c);
        if (!ok) return;
        const move = { ...pendingJump, bonus: [r, c] };
        pendingJump = null;
        playMove(move);
        return;
    }
    if (v === 'you') {
        selected = selected && selected[0] === r && selected[1] === c ? null : [r, c];
        setStatus(selected ? 'status_pick_target' : 'status_your_turn');
        render();
        return;
    }
    const moves = YoteEngine.moves(state, 'you');
    if (selected) {
        const move = moves.find(m => m.from && m.from[0] === selected[0] && m.from[1] === selected[1] && m.to[0] === r && m.to[1] === c);
        if (!move) { selected = null; setStatus('status_your_turn'); render(); return; }
        selected = null;
        if (move.type === 'jump' && YoteEngine.bonusOptions(state, move, 'you').length) {
            // show the jump, then ask for the bonus removal
            state.board[move.from[0]][move.from[1]] = null;
            state.board[move.to[0]][move.to[1]] = 'you';
            pendingJump = move;
            pendingJumpRestore = move;
            setStatus('status_bonus');
            render();
            return;
        }
        playMove(move.type === 'jump' ? { ...move, bonus: null } : move);
        return;
    }
    if (!v && state.hand.you > 0) playMove({ type: 'place', to: [r, c] });
};

let pendingJumpRestore = null;
function playMove(move) {
    if (move.type === 'jump' && pendingJumpRestore) {
        // undo the preview so apply() starts from the real position
        state.board[move.to[0]][move.to[1]] = null;
        state.board[move.from[0]][move.from[1]] = 'you';
        pendingJumpRestore = null;
    }
    state = YoteEngine.apply(state, move);
    lastMove = { ...move, owner: 'you' };
    render();
    if (checkEnd()) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 450);
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    const difficulty = document.getElementById('difficulty').value;
    const level = LevelRegistry[currentLevelIdx];
    const move = difficulty === 'master' ? YoteEngine.getMasterMove(state, level.depth) : YoteEngine.getNoviceMove(state);
    if (!move) { endGame('you'); return; }
    state = YoteEngine.apply(state, move);
    lastMove = { ...move, owner: 'ai' };
    isAiTurn = false;
    render();
    if (checkEnd()) return;
    setStatus('status_your_turn');
}

function checkEnd() {
    if (state.winner) { endGame(state.winner); return true; }
    if (!YoteEngine.moves(state, state.turn).length) { endGame(state.turn === 'ai' ? 'you' : 'ai'); return true; }
    return false;
}

function endGame(result) {
    isOver = true;
    isAiTurn = false;
    render();
    if (result === 'you') {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => { if (winGameId === gameId) nextLevel(); }, 2200);
    } else if (result === 'draw') {
        setStatus('draw');
    } else {
        setStatus('lose');
    }
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key);
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.rows}×${level.cols}, ${level.pieces})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
