const TICK_MS = 140;
const SKILLS = ['blocker', 'digger', 'builder', 'basher', 'bomber'];
const SKILL_ICON = { blocker: '🛑', digger: '⛏', builder: '🧱', basher: '👊', bomber: '💣' };

let currentLevelIdx = 0;
let state = null;
let ticker = null;
let selectedSkill = null;
let pendingAction = null;
let paused = false;
let statusKey = 'status_play';

const board = document.getElementById('game-board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const skillsEl = document.getElementById('skills');
const pauseBtn = document.getElementById('pauseBtn');

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = LemmingsEngine.parse(level);
    selectedSkill = SKILLS.find(s => state.skills[s] > 0) || null;
    pendingAction = null;
    paused = false;
    setStatus('status_play');
    updateLevelInfo();
    renderSkills();
    render();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, TICK_MS);
}

function tick() {
    if (!state || state.finished) return;
    if (paused && !pendingAction) return;
    const action = pendingAction;
    pendingAction = null;
    LemmingsEngine.step(state, action);
    render();
    if (action) renderSkills();
    if (state.finished) {
        if (state.won) {
            setStatus('status_solved');
            Progress.markSolved(currentLevelIdx);
            const solvedLevelIdx = currentLevelIdx;
            setTimeout(() => {
                if (solvedLevelIdx === currentLevelIdx) nextLevel();
            }, 2000);
        } else {
            setStatus('status_failed');
        }
    }
}

function render() {
    board.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    board.style.maxWidth = `${state.width * 28}px`;
    const cells = [];
    for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
            const ch = state.cells[y][x];
            const cls = ch === '#' ? 'earth' : ch === 'X' ? 'steel' : ch === 'E' ? 'exit' : 'air';
            const door = state.door.x === x && state.door.y === y ? 'door' : '';
            cells.push(`<div class="cell ${cls} ${door}" data-x="${x}" data-y="${y}"></div>`);
        }
    }
    const lems = state.lemmings.filter(l => l.alive).map(l => {
        const left = ((l.x + 0.5) / state.width) * 100;
        const top = ((l.y + 0.5) / state.height) * 100;
        return `<div class="lem ${l.state} ${l.dir > 0 ? 'right' : 'left'}" style="left:${left}%;top:${top}%" title="${l.state}"></div>`;
    }).join('');
    board.innerHTML = cells.join('') + lems;
    countersEl.innerText = `${i18n.t('out')}: ${state.total - state.toSpawn}/${state.total} · ${i18n.t('saved')}: ${state.saved}/${state.required} · ${i18n.t('lost')}: ${state.dead}`;
}

function renderSkills() {
    skillsEl.innerHTML = SKILLS.map(s => `
        <button class="skill ${selectedSkill === s ? 'primary' : ''}" onclick="pickSkill('${s}')" ${state.skills[s] > 0 ? '' : 'disabled'}>
            <span class="icon">${SKILL_ICON[s]}</span>
            <span>${i18n.t('skill_' + s)}</span>
            <span class="count">${state.skills[s]}</span>
        </button>
    `).join('');
    pauseBtn.innerText = i18n.t(paused ? 'resume' : 'pause');
}

window.pickSkill = (skill) => {
    if (!state.skills[skill]) return;
    selectedSkill = skill;
    renderSkills();
};

window.togglePause = () => {
    paused = !paused;
    renderSkills();
};

// Tapping a lemming's cell gives it the selected skill (applied on the next tick)
board.addEventListener('pointerdown', (event) => {
    if (!state || state.finished || !selectedSkill) return;
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
    if (!el) return;
    event.preventDefault();
    const x = Number(el.dataset.x);
    const y = Number(el.dataset.y);
    const here = state.lemmings.find(l => l.alive && l.x === x && l.y === y) || state.lemmings.find(l => l.alive && Math.abs(l.x - x) <= 1 && Math.abs(l.y - y) <= 1);
    if (!here) return;
    pendingAction = { x: here.x, y: here.y, skill: selectedSkill };
});

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key) {
    statusKey = key;
    statusEl.innerText = i18n.t(key, { saved: state.saved, required: state.required });
}

function updateLevelInfo() {
    const level = LevelRegistry[currentLevelIdx];
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    const idx = Number(event.key) - 1;
    if (idx >= 0 && idx < SKILLS.length) { pickSkill(SKILLS[idx]); }
    else if (event.key === ' ' || event.key.toLowerCase() === 'p') { togglePause(); }
    else if (event.key.toLowerCase() === 'r') { loadLevel(currentLevelIdx); }
    else return;
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    updateLevelInfo();
    renderSkills();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
