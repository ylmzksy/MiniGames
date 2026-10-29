const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let state = null;
let selectedCard = null;   // card name chosen for the next move
let selectedPiece = null;  // [r, c] of the piece to move
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let lastMove = null;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const playerCardsEl = document.getElementById('player-cards');
const aiCardsEl = document.getElementById('ai-cards');
const middleCardEl = document.getElementById('middle-card');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    state = OnitamaEngine.create(level);
    selectedCard = null;
    selectedPiece = null;
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    updateLevelInfo();
    setStatus('status_pick');
    render();
}

function render() {
    const targets = new Set(legalTargets().map(([r, c]) => `${r},${c}`));
    const cells = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const piece = state.board[r][c];
            const isTemple = (r === 0 || r === 4) && c === 2;
            const classes = ['cell', isTemple ? `temple ${r === 0 ? 'red' : 'blue'}` : '',
                selectedPiece && selectedPiece[0] === r && selectedPiece[1] === c ? 'selected' : '',
                targets.has(`${r},${c}`) ? 'target' : '',
                lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c)) ? 'last' : '',
                piece && piece.owner === PLAYER && !isOver && !isAiTurn ? 'mine' : ''].join(' ');
            const pieceHtml = piece ? `<span class="piece ${piece.owner} ${piece.type}">${piece.type === 'master' ? '♛' : '●'}</span>` : '';
            cells.push(`<div class="${classes}" onclick="handleCell(${r}, ${c})">${pieceHtml}</div>`);
        }
    }
    boardEl.innerHTML = cells.join('');

    playerCardsEl.innerHTML = state.cards.blue.map(card => renderCard(card, PLAYER, card === selectedCard, !isOver && !isAiTurn)).join('');
    aiCardsEl.innerHTML = state.cards.red.map(card => renderCard(card, AI, false, false)).join('');
    middleCardEl.innerHTML = renderCard(state.cards.middle, PLAYER, false, false);
}

// A card as a 5x5 pattern; red's cards are shown the way red uses them (moving down)
function renderCard(card, owner, selected, clickable) {
    const marks = new Set(OnitamaEngine.cards[card].map(step => {
        const [dr, dc] = OnitamaEngine.offset(owner, step);
        return `${2 + dr},${2 + dc}`;
    }));
    const grid = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            grid.push(`<i class="${r === 2 && c === 2 ? 'origin' : marks.has(`${r},${c}`) ? `move ${owner}` : ''}"></i>`);
        }
    }
    return `
        <div class="card ${owner} ${selected ? 'selected' : ''} ${clickable ? 'clickable' : ''}" ${clickable ? `onclick="pickCard('${card}')"` : ''}>
            <div class="pattern">${grid.join('')}</div>
            <div class="name">${i18n.t('card_' + card)}</div>
        </div>
    `;
}

function legalTargets() {
    if (!selectedCard || !selectedPiece || isAiTurn || isOver) return [];
    return OnitamaEngine.moves(state, PLAYER)
        .filter(m => !m.pass && m.card === selectedCard && m.from[0] === selectedPiece[0] && m.from[1] === selectedPiece[1])
        .map(m => m.to);
}

window.pickCard = (card) => {
    if (isAiTurn || isOver || !state.cards.blue.includes(card)) return;
    selectedCard = selectedCard === card ? null : card;
    // With no legal move at all, choosing a card passes it to the middle
    const moves = OnitamaEngine.moves(state, PLAYER);
    if (selectedCard && moves[0].pass) {
        playMove({ card: selectedCard, pass: true });
        return;
    }
    updatePrompt();
    render();
};

window.handleCell = (r, c) => {
    if (isAiTurn || isOver) return;
    const piece = state.board[r][c];
    if (piece?.owner === PLAYER) {
        selectedPiece = selectedPiece && selectedPiece[0] === r && selectedPiece[1] === c ? null : [r, c];
        updatePrompt();
        render();
        return;
    }
    const target = legalTargets().find(([tr, tc]) => tr === r && tc === c);
    if (!target) return;
    playMove({ card: selectedCard, from: selectedPiece, to: [r, c] });
};

function updatePrompt() {
    if (!selectedCard) setStatus('status_pick');
    else if (!selectedPiece) setStatus('status_piece');
    else setStatus(legalTargets().length ? 'status_target' : 'status_no_target');
}

function playMove(move) {
    state = OnitamaEngine.apply(state, move);
    lastMove = move.pass ? null : move;
    selectedCard = null;
    selectedPiece = null;
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
    const move = difficulty === 'master' ? OnitamaEngine.getMasterMove(state) : OnitamaEngine.getNoviceMove(state);
    state = OnitamaEngine.apply(state, move);
    lastMove = move.pass ? null : move;
    isAiTurn = false;

    if (checkEnd()) return;
    setStatus('status_pick');
    render();
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
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2200);
    } else {
        setStatus('lose');
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
