const PLAYER = 0;
const AI = 1;

let currentLevelIdx = 0;
let world = null;
let isAiTurn = false;
let isOver = false;
let isFlying = false;
let gameId = 0;
let statusKey = '';
let throwsMade = 0;
let flight = null;   // { path, index, thrower } while a banana flies

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const windEl = document.getElementById('wind');
const angleEl = document.getElementById('angle');
const speedEl = document.getElementById('speed');
const throwBtn = document.getElementById('throwBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    world = GorillasEngine.create(level);
    isAiTurn = false;
    isOver = false;
    isFlying = false;
    flight = null;
    throwsMade = 0;
    updateLevelInfo();
    setStatus('status_your_turn');
    updateControls();
    draw();
}

function updateControls() {
    const busy = isAiTurn || isOver || isFlying;
    throwBtn.disabled = busy;
    angleEl.disabled = busy;
    speedEl.disabled = busy;
    const w = world.wind;
    windEl.innerText = `${i18n.t('wind')}: ${w === 0 ? '—' : (w > 0 ? '→' : '←').repeat(Math.min(5, Math.ceil(Math.abs(w) / 4)))} ${Math.abs(w)}`;
    countersEl.innerText = `${i18n.t('throws')}: ${throwsMade}`;
}

function draw() {
    const { WIDTH, HEIGHT } = GorillasEngine;
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#0b1a3a');
    sky.addColorStop(1, '#27497a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // sun
    ctx.fillStyle = '#f5d76e';
    ctx.beginPath(); ctx.arc(WIDTH / 2, 36, 18, 0, Math.PI * 2); ctx.fill();

    world.buildings.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, HEIGHT - b.height, b.width, b.height);
        ctx.fillStyle = 'rgba(255, 240, 160, 0.75)';
        for (let y = HEIGHT - b.height + 8; y < HEIGHT - 10; y += 16) {
            for (let x = b.x + 6; x < b.x + b.width - 8; x += 14) {
                if (((x * 7 + y * 13) % 5) !== 0) ctx.fillRect(x, y, 6, 9);
            }
        }
    });
    // craters are cut out of the buildings
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    world.craters.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    // sky behind craters
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();

    world.gorillas.forEach((g, i) => drawGorilla(g, i));

    if (flight) {
        const [x, y] = flight.path[flight.index];
        drawBanana(x, y, flight.index);
    }
}

// A spinning yellow crescent, drawn with shapes so it does not depend on an emoji font
function drawBanana(x, y, step) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(step * 0.12);
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -3, 9, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
}

function drawGorilla(g, i) {
    const { h } = GorillasEngine.GORILLA;
    ctx.fillStyle = i === PLAYER ? '#3b6fe0' : '#d64545';
    ctx.fillRect(g.x - 3, g.y - h - 6, 6, 6); // a colored hat marks whose gorilla it is
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦍', g.x, g.y - 2);
}

window.throwBanana = () => {
    if (isAiTurn || isOver || isFlying) return;
    const angle = Number(angleEl.value);
    const speed = Number(speedEl.value);
    if (!(angle >= 0 && angle <= 90) || !(speed >= 1 && speed <= 120)) { setStatus('status_bad_input'); return; }
    setStatus('status_flying');
    launch(PLAYER, angle, speed);
};

function launch(thrower, angle, speed) {
    const sim = GorillasEngine.simulate(world, thrower, angle, speed);
    flight = { path: sim.path, index: 0, thrower, sim };
    isFlying = true;
    throwsMade++;
    updateControls();
    const flightGameId = gameId;
    const stepsPerFrame = 3;
    const animate = () => {
        if (flightGameId !== gameId) return;
        flight.index = Math.min(flight.index + stepsPerFrame, flight.path.length - 1);
        draw();
        if (flight.index < flight.path.length - 1) { setTimeout(animate, 16); return; }
        land(sim, thrower);
    };
    setTimeout(animate, 16);
}

function land(sim, thrower) {
    flight = null;
    isFlying = false;
    if (sim.result === 'building') GorillasEngine.blast(world, sim.x, sim.y);
    draw();
    if (sim.result === 'gorilla') {
        endGame(sim.target === AI ? PLAYER : AI, sim.target === thrower);
        return;
    }
    if (thrower === PLAYER) {
        isAiTurn = true;
        setStatus(sim.result === 'building' ? 'status_hit_building' : 'status_missed');
        updateControls();
        const moveGameId = gameId;
        setTimeout(() => processAiTurn(moveGameId), 900);
    } else {
        isAiTurn = false;
        setStatus('status_your_turn');
        updateControls();
    }
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    setStatus('status_ai');
    const difficulty = document.getElementById('difficulty').value;
    const shot = GorillasEngine.getAiThrow(world, AI, difficulty);
    launch(AI, shot.angle, shot.speed);
}

function endGame(winner, selfHit) {
    isOver = true;
    isAiTurn = false;
    updateControls();
    if (winner === PLAYER) {
        setStatus(selfHit ? 'win_self' : 'win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2400);
    } else {
        setStatus(selfHit ? 'lose_self' : 'lose');
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !document.querySelector('.modal.active')) { throwBanana(); event.preventDefault(); }
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    updateControls();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
