const PLAYER = 0;
const AI = 1;

let currentLevelIdx = 0;
let world = null;
let isAiTurn = false;
let isOver = false;
let isFlying = false;
let gameId = 0;
let statusKey = '';
let shotsFired = 0;
let flight = null;    // { path, index } while a shell flies
let lastPath = null;  // the previous shell's path, drawn faintly as a guide
let aims = [45, 45];  // last angle used by each tank, for drawing the barrel
let flash = null;     // { x, y, ttl } explosion flash

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const windEl = document.getElementById('wind');
const angleEl = document.getElementById('angle');
const powerEl = document.getElementById('power');
const fireBtn = document.getElementById('fireBtn');
const hpEls = [document.getElementById('hp-you'), document.getElementById('hp-ai')];

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    gameId++;
    world = TankEngine.create(level);
    isAiTurn = false;
    isOver = false;
    isFlying = false;
    flight = null;
    lastPath = null;
    flash = null;
    shotsFired = 0;
    aims = [45, 45];
    updateLevelInfo();
    setStatus('status_your_turn');
    updateControls();
    draw();
}

function updateControls() {
    const busy = isAiTurn || isOver || isFlying;
    fireBtn.disabled = busy;
    angleEl.disabled = busy;
    powerEl.disabled = busy;
    const w = world.wind;
    windEl.innerText = `${i18n.t('wind')}: ${w === 0 ? '—' : (w > 0 ? '→' : '←').repeat(Math.min(5, Math.ceil(Math.abs(w) / 4)))} ${Math.abs(w)}`;
    countersEl.innerText = `${i18n.t('shots')}: ${shotsFired}`;
    world.tanks.forEach((t, i) => {
        hpEls[i].style.width = `${t.hp}%`;
        hpEls[i].parentElement.title = `${t.hp} HP`;
        hpEls[i].parentElement.nextElementSibling.innerText = `${t.hp}`;
    });
}

function draw() {
    const { WIDTH, HEIGHT } = TankEngine;
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#79b7e8');
    sky.addColorStop(1, '#dbeeff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // terrain
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    world.ground.forEach((y, x) => ctx.lineTo(x, y));
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fillStyle = '#7a5a3a';
    ctx.fill();
    ctx.beginPath();
    world.ground.forEach((y, x) => x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.strokeStyle = '#4f9d3f';
    ctx.lineWidth = 5;
    ctx.stroke();

    if (lastPath) {
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        lastPath.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    world.tanks.forEach((t, i) => drawTank(t, i));

    if (flight) {
        const [x, y] = flight.path[flight.index];
        ctx.fillStyle = '#1b2333';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (flash) {
        ctx.fillStyle = `rgba(255, 170, 40, ${Math.min(1, flash.ttl / 6)})`;
        ctx.beginPath(); ctx.arc(flash.x, flash.y, TankEngine.CRATER + 6 - flash.ttl, 0, Math.PI * 2); ctx.fill();
    }
}

function drawTank(t, i) {
    const dir = i === PLAYER ? 1 : -1;
    const color = i === PLAYER ? '#3b6fe0' : '#d64545';
    const rad = (aims[i] * Math.PI) / 180;
    ctx.save();
    ctx.translate(t.x, t.y);
    // barrel
    ctx.strokeStyle = '#2b3140';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(dir * Math.cos(rad) * 18, -8 - Math.sin(rad) * 18); ctx.stroke();
    // body and turret
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-14, -8, 28, 8, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -8, 6, Math.PI, 0); ctx.fill();
    // tracks
    ctx.fillStyle = '#2b3140';
    ctx.beginPath(); ctx.roundRect(-16, -3, 32, 5, 2); ctx.fill();
    if (t.hp <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(-16, -14, 32, 16, 3); ctx.fill();
    }
    ctx.restore();
}

window.fire = () => {
    if (isAiTurn || isOver || isFlying) return;
    const angle = Number(angleEl.value);
    const power = Number(powerEl.value);
    if (!(angle >= 0 && angle <= 90) || !(power >= 1 && power <= 100)) { setStatus('status_bad_input'); return; }
    setStatus('status_flying');
    launch(PLAYER, angle, power);
};

function launch(shooter, angle, power) {
    aims[shooter] = angle;
    const sim = TankEngine.simulate(world, shooter, angle, power);
    flight = { path: sim.path, index: 0 };
    isFlying = true;
    shotsFired++;
    updateControls();
    const flightGameId = gameId;
    const animate = () => {
        if (flightGameId !== gameId) return;
        flight.index = Math.min(flight.index + 3, flight.path.length - 1);
        draw();
        if (flight.index < flight.path.length - 1) { setTimeout(animate, 16); return; }
        land(sim, shooter);
    };
    setTimeout(animate, 16);
}

function land(sim, shooter) {
    flight = null;
    lastPath = sim.path;
    let damage = [0, 0];
    if (sim.result !== 'miss') {
        damage = TankEngine.impact(world, sim.x, sim.y);
        flash = { x: sim.x, y: sim.y, ttl: 12 };
        const flashGameId = gameId;
        const fade = () => { if (flashGameId !== gameId || !flash) return; flash.ttl--; draw(); if (flash.ttl > 0) setTimeout(fade, 30); else { flash = null; draw(); } };
        setTimeout(fade, 30);
    }
    isFlying = false;
    updateControls();
    draw();

    const dead = world.tanks.findIndex(t => t.hp <= 0);
    if (dead >= 0) { endGame(dead === AI ? PLAYER : AI); return; }

    if (shooter === PLAYER) {
        isAiTurn = true;
        setStatus(damage[AI] > 0 ? 'status_damaged_ai' : sim.result === 'miss' ? 'status_missed' : 'status_hit_ground');
        updateControls();
        const moveGameId = gameId;
        setTimeout(() => processAiTurn(moveGameId), 1000);
    } else {
        isAiTurn = false;
        setStatus(damage[PLAYER] > 0 ? 'status_damaged_you' : 'status_your_turn');
        updateControls();
    }
}

function processAiTurn(moveGameId) {
    if (moveGameId !== gameId || isOver) return;
    setStatus('status_ai');
    const difficulty = document.getElementById('difficulty').value;
    const shot = TankEngine.getAiShot(world, AI, difficulty);
    launch(AI, shot.angle, shot.power);
}

function endGame(winner) {
    isOver = true;
    isAiTurn = false;
    updateControls();
    draw();
    if (winner === PLAYER) {
        setStatus('win');
        Progress.markSolved(currentLevelIdx);
        const winGameId = gameId;
        setTimeout(() => {
            if (winGameId === gameId) nextLevel();
        }, 2600);
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !document.querySelector('.modal.active')) { fire(); event.preventDefault(); }
});

angleEl.addEventListener('input', () => { aims[PLAYER] = Number(angleEl.value) || 0; draw(); });
document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    updateControls();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
