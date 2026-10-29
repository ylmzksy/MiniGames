const HEX = 30;                       // hexagon radius in SVG units
const HEX_W = Math.sqrt(3) * HEX;     // width of a pointy-top hexagon
const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let board = null;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';
let lastMove = null;

const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    board = HexEngine.create(level.size);
    isAiTurn = false;
    isOver = false;
    lastMove = null;
    buildBoard();
    updateBoard();
    updateLevelInfo();
    setStatus('status_your_turn');
}

// Center of cell (r, c) in SVG units; each row is shifted half a hexagon to the right
function center(r, c) {
    return [HEX_W * (c + r / 2) + HEX_W / 2, HEX * 1.5 * r + HEX];
}

// Vertex k of the hexagon at (x, y): 0 upper right, 1 lower right, 2 bottom, 3 lower left, 4 upper left, 5 top
function vertex(x, y, k) {
    const angle = (Math.PI / 180) * (60 * k - 30);
    return [x + HEX * Math.cos(angle), y + HEX * Math.sin(angle)];
}

function buildBoard() {
    const n = board.size;
    const cells = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const [x, y] = center(r, c);
            const points = [0, 1, 2, 3, 4, 5].map(k => vertex(x, y, k).map(v => v.toFixed(1)).join(',')).join(' ');
            cells.push(`<polygon class="hex" data-r="${r}" data-c="${c}" points="${points}" onclick="handleClick(${r}, ${c})"></polygon>`);
        }
    }

    // Colored borders: red along the top and bottom rows, blue along the left and right columns
    const edgePath = (cellsOfEdge, vertices) => cellsOfEdge
        .flatMap(([r, c]) => { const [x, y] = center(r, c); return vertices.map(k => vertex(x, y, k)); })
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const idx = Array.from({ length: n }, (_, i) => i);
    const borders = [
        ['red', edgePath(idx.map(c => [0, c]), [4, 5, 0])],
        ['red', edgePath(idx.map(c => [n - 1, c]), [3, 2, 1])],
        ['blue', edgePath(idx.map(r => [r, 0]), [4, 3, 2])],
        ['blue', edgePath(idx.map(r => [r, n - 1]), [5, 0, 1])]
    ].map(([color, d]) => `<path class="border ${color}" d="${d}"></path>`).join('');

    const width = HEX_W * (n + (n - 1) / 2) + HEX;
    const height = HEX * 1.5 * (n - 1) + 2 * HEX + HEX / 2;
    const pad = 6;
    boardEl.innerHTML = `
        <svg viewBox="${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}" role="img">
            ${cells}
            ${borders}
        </svg>
    `;
}

function updateBoard(winningPath = []) {
    const onPath = new Set(winningPath.map(([r, c]) => `${r},${c}`));
    boardEl.querySelectorAll('.hex').forEach(el => {
        const r = Number(el.dataset.r);
        const c = Number(el.dataset.c);
        const stone = board.cells[r][c];
        el.classList.toggle('red', stone === 'red');
        el.classList.toggle('blue', stone === 'blue');
        el.classList.toggle('last', !!lastMove && lastMove[0] === r && lastMove[1] === c);
        el.classList.toggle('path', onPath.has(`${r},${c}`));
        el.classList.toggle('free', !stone && !isOver && !isAiTurn);
    });
}

window.handleClick = (r, c) => {
    if (isAiTurn || isOver || board.cells[r][c]) return;

    board.cells[r][c] = PLAYER;
    lastMove = [r, c];
    if (checkEnd()) return;

    isAiTurn = true;
    updateBoard();
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 400);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? HexEngine.getMasterMove(board) : HexEngine.getNoviceMove(board);
    board.cells[move[0]][move[1]] = AI;
    lastMove = move;
    isAiTurn = false;

    if (checkEnd()) return;
    updateBoard();
    setStatus('status_your_turn');
}

function checkEnd() {
    const winner = HexEngine.winner(board);
    if (!winner) return false;

    isOver = true;
    isAiTurn = false;
    updateBoard(HexEngine.distance(board, winner).path);
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
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} (${level.size}×${level.size})`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
