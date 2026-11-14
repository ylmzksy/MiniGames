let currentLevelIdx = 0;
let level = null;
let state = null;
let history = [];
let selected = null;   // jug chosen as a pour source
let isSolved = false;
let statusKey = 'status_play';
let statusParams = {};

const jugsEl = document.getElementById('jugs');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const goalEl = document.getElementById('goal');
const countersEl = document.getElementById('counters');
const undoBtn = document.getElementById('undoBtn');
const hintBtn = document.getElementById('hintBtn');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    state = JugEngine.create(level);
    history = [];
    selected = null;
    isSolved = false;
    setStatus('status_play', { target: level.target });
    updateLevelInfo();
    render();
}

function render() {
    const maxCap = Math.max(...state.capacities);
    jugsEl.innerHTML = state.capacities.map((cap, i) => {
        const amount = state.amounts[i];
        const heightPct = (cap / maxCap) * 100;
        const fillPct = (amount / cap) * 100;
        const classes = ['jug', i === selected ? 'selected' : '', amount === state.target ? 'hit' : '', isSolved ? 'solved' : ''].join(' ');
        return `
            <div class="${classes}">
                <div class="glass" style="height:${heightPct}%" onclick="pickJug(${i})" title="${i18n.t('pour_hint')}">
                    <div class="water" style="height:${fillPct}%"></div>
                    <div class="amount">${amount}</div>
                    <div class="cap">${cap} L</div>
                </div>
                ${state.noTap ? '' : `<div class="jug-actions">
                    <button onclick="doMove({ type: 'fill', from: ${i} })" ${amount === cap || isSolved ? 'disabled' : ''}>${i18n.t('fill')}</button>
                    <button onclick="doMove({ type: 'empty', from: ${i} })" ${amount === 0 || isSolved ? 'disabled' : ''}>${i18n.t('empty')}</button>
                </div>`}
            </div>`;
    }).join('');
    countersEl.innerText = `${i18n.t('moves')}: ${history.length} · ${i18n.t('par')}: ${level.par}`;
    undoBtn.disabled = history.length === 0 || isSolved;
    hintBtn.disabled = isSolved;
}

// Tap a jug to choose it as the source, then tap another jug to pour into it
window.pickJug = (i) => {
    if (isSolved) return;
    if (selected === null) {
        if (state.amounts[i] === 0) { setStatus('status_empty_source'); return; }
        selected = i;
        setStatus('status_pick_target');
        render();
        return;
    }
    if (selected === i) { selected = null; setStatus('status_play', { target: level.target }); render(); return; }
    const move = { type: 'pour', from: selected, to: i };
    selected = null;
    if (state.amounts[i] >= state.capacities[i]) { setStatus('status_full_target'); render(); return; }
    doMove(move);
};

window.doMove = (move) => {
    if (isSolved) return;
    const legal = JugEngine.moves(state).some(m => m.type === move.type && m.from === move.from && m.to === move.to);
    if (!legal) return;
    history.push(state);
    state = JugEngine.apply(state, move);
    selected = null;
    setStatus('status_play', { target: level.target });
    render();
    checkSolved();
};

window.undo = () => {
    if (!history.length || isSolved) return;
    state = history.pop();
    selected = null;
    setStatus('status_play', { target: level.target });
    render();
};

window.showHint = () => {
    if (isSolved) return;
    const path = JugEngine.solve(state);
    if (!path || !path.length) return;
    const m = path[0];
    const text = m.type === 'pour'
        ? i18n.t('hint_pour', { from: state.capacities[m.from], to: state.capacities[m.to] })
        : i18n.t(m.type === 'fill' ? 'hint_fill' : 'hint_empty', { jug: state.capacities[m.from] });
    statusKey = 'hint';
    statusEl.innerText = text;
};

function checkSolved() {
    if (!JugEngine.isSolved(state)) return;
    isSolved = true;
    setStatus(history.length <= level.par ? 'status_solved_par' : 'status_solved', { n: history.length });
    Progress.markSolved(currentLevelIdx);
    render();
    const solvedLevelIdx = currentLevelIdx;
    setTimeout(() => {
        if (solvedLevelIdx === currentLevelIdx) nextLevel();
    }, 2200);
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        setStatus('all_levels_cleared');
    }
}

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
    goalEl.innerText = i18n.t('goal', { target: level.target });
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') undo();
    else if (event.key.toLowerCase() === 'h') showHint();
    else if (event.key.toLowerCase() === 'r') loadLevel(currentLevelIdx);
    else return;
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    if (statusKey !== 'hint') setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
