const UNIT = 60; // SVG units per level coordinate
const PLAYER = 'blue';
const AI = 'red';

let currentLevelIdx = 0;
let game = null;
let mask = 0;
let isAiTurn = false;
let isOver = false;
let gameId = 0; // Bumped on every level load so a pending AI move from an old game is dropped
let statusKey = '';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    game = HackenbushEngine.create(level);
    mask = HackenbushEngine.startMask(game);
    isAiTurn = false;
    isOver = false;
    buildBoard(level);
    updateBoard();
    updateLevelInfo();
    setStatus('status_your_turn');
}

/**
 * Builds the SVG once per level; later moves only toggle classes
 * so cut and falling edges can fade out.
 */
function buildBoard(level) {
    const shapes = game.edges.map(edge => edgeGeometry(level, edge));
    const points = Object.values(level.nodes).concat(...shapes.map(shape => shape.extents));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    // At least 10 x 5 units, so small levels are drawn at the same scale as big ones
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const halfWidth = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 + 1, 5);
    const minX = centerX - halfWidth;
    const maxX = centerX + halfWidth;
    const maxY = Math.max(...ys, 5);
    const pad = UNIT / 2;
    const toSvg = id => {
        const [x, y] = level.nodes[id];
        return [x * UNIT, -y * UNIT];
    };

    const edges = game.edges.map((edge, i) => {
        const d = shapes[i].d;
        return `
            <g class="edge ${edge.color}" data-index="${i}" onclick="handleCut(${i})">
                <path class="stroke" d="${d}"></path>
                <path class="hit" d="${d}"></path>
            </g>
        `;
    }).join('');

    const nodes = Object.keys(level.nodes)
        .filter(id => !game.ground.has(id))
        .map(id => {
            const [x, y] = toSvg(id);
            return `<circle class="node" data-node="${id}" cx="${x}" cy="${y}" r="6"></circle>`;
        }).join('');

    const viewBox = [minX * UNIT, -maxY * UNIT - pad, (maxX - minX) * UNIT, maxY * UNIT + pad * 2].join(' ');
    board.innerHTML = `
        <svg viewBox="${viewBox}" role="img">
            <line class="ground" x1="${minX * UNIT + pad}" y1="0" x2="${maxX * UNIT - pad}" y2="0"></line>
            ${edges}
            ${nodes}
        </svg>
    `;
}

/**
 * SVG path for an edge plus the level points its curve reaches (for sizing the board).
 *   straight: no shape
 *   arc:      { bend } - bulge as a fraction of half the edge length; positive bulges to
 *             the left of from -> to, 1 is a half circle
 *   loop:     from === to, { size, angle } - circle of radius `size` hanging off the
 *             point in direction `angle` (degrees, 90 = up)
 */
function edgeGeometry(level, edge) {
    const svg = ([x, y]) => `${x * UNIT} ${-y * UNIT}`;
    const [x1, y1] = level.nodes[edge.from];
    const [x2, y2] = level.nodes[edge.to];
    const shape = edge.shape || {};

    if (edge.from === edge.to) {
        const r = shape.size ?? 0.6;
        const angle = (shape.angle ?? 90) * Math.PI / 180;
        const [cx, cy] = [x1 + r * Math.cos(angle), y1 + r * Math.sin(angle)];
        const opposite = [x1 + 2 * r * Math.cos(angle), y1 + 2 * r * Math.sin(angle)];
        const radius = r * UNIT;
        return {
            d: `M ${svg([x1, y1])} A ${radius} ${radius} 0 1 1 ${svg(opposite)} A ${radius} ${radius} 0 1 1 ${svg([x1, y1])}`,
            extents: [[cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]]
        };
    }

    if (!shape.bend) {
        return { d: `M ${svg([x1, y1])} L ${svg([x2, y2])}`, extents: [] };
    }

    // Circular arc through both points whose middle sits `sagitta` away from the chord
    const chord = Math.hypot(x2 - x1, y2 - y1);
    const [nx, ny] = [-(y2 - y1) / chord, (x2 - x1) / chord]; // left normal
    const sagitta = shape.bend * chord / 2;
    const r = (chord * chord / 4 + sagitta * sagitta) / (2 * Math.abs(sagitta));
    const apex = [(x1 + x2) / 2 + nx * sagitta, (y1 + y2) / 2 + ny * sagitta];
    const side = Math.sign(sagitta);
    const [cx, cy] = [apex[0] - nx * side * r, apex[1] - ny * side * r];
    const largeArc = Math.abs(sagitta) > chord / 2 ? 1 : 0;
    const sweep = sagitta > 0 ? 1 : 0;
    const radius = r * UNIT;
    return {
        d: `M ${svg([x1, y1])} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${svg([x2, y2])}`,
        extents: largeArc
            ? [apex, [cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]]
            : [apex]
    };
}

function updateBoard() {
    const playerCanMove = !isAiTurn && !isOver;
    const liveNodes = new Set();

    game.edges.forEach((edge, i) => {
        const alive = HackenbushEngine.isAlive(mask, i);
        const el = board.querySelector(`[data-index="${i}"]`);
        el.classList.toggle('gone', !alive);
        el.classList.toggle('cuttable', alive && playerCanMove && HackenbushEngine.canCut(edge, PLAYER));
        if (alive) {
            liveNodes.add(edge.from);
            liveNodes.add(edge.to);
        }
    });

    board.querySelectorAll('.node').forEach(node => {
        node.classList.toggle('gone', !liveNodes.has(node.dataset.node));
    });
}

window.handleCut = (i) => {
    if (isAiTurn || isOver) return;
    if (!HackenbushEngine.isAlive(mask, i) || !HackenbushEngine.canCut(game.edges[i], PLAYER)) return;

    mask = HackenbushEngine.cut(game, mask, i);
    if (checkEnd(AI)) return;

    isAiTurn = true;
    updateBoard();
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 700);
};

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master'
        ? HackenbushEngine.getMasterMove(game, mask, AI)
        : HackenbushEngine.getNoviceMove(game, mask, AI);
    mask = HackenbushEngine.cut(game, mask, move);
    isAiTurn = false;

    if (checkEnd(PLAYER)) return;
    updateBoard();
    setStatus('status_your_turn');
}

// The player who has to move next and cannot, loses
function checkEnd(nextPlayer) {
    if (HackenbushEngine.moves(game, mask, nextPlayer).length > 0) return false;

    isOver = true;
    isAiTurn = false;
    updateBoard();
    if (nextPlayer === AI) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 1800);
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
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
