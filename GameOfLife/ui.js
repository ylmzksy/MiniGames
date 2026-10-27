let currentLevelIdx = 0;
let currentLevel = null;
let grid = [];
let seeds = new Set(); // "r,c" keys of the cells the player placed
let isPlaying = false;
let interval = null;
let generation = 0;
let statusKey = 'budget'; // budget | running | game_over | win | all_levels_cleared
let engine = new LifeEngine(); // Default B3/S23

const gridEl = document.getElementById('game-grid');
const statusEl = document.getElementById('status');
const goalEl = document.getElementById('goal');

// Goal types used by levels: check() runs after every generation, text() describes the goal
const Goals = {
    survive: {
        check: (goal, alive) => generation >= goal.generations && alive > 0,
        text: goal => i18n.t('goal_survive', { n: goal.generations })
    },
    occupy: {
        check: goal => grid[goal.r][goal.c],
        text: () => i18n.t('goal_occupy')
    }
};

function initUI() {
    if (LevelRegistry.length > 0) loadLevel(0);
    // Set up event listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
        Shell.openModal('settingsModal');
        updateSettingsOptionStates();
    });
    const bornSelect = document.getElementById('bornRules');
    const surviveSelect = document.getElementById('surviveRules');
    bornSelect.addEventListener('change', () => updateSettingsOptionStates());
    surviveSelect.addEventListener('change', () => updateSettingsOptionStates());
}

function checkGoal(alive) {
    const goal = currentLevel.goal;
    return Goals[goal.type].check(goal, alive);
}

function parseRuleString(value) {
    return value.split(',').map(item => Number(item.trim())).filter(Number.isFinite);
}

function hasIntersection(a, b) {
    return a.some(value => b.includes(value));
}

function findValidRulePair(bornSelect, surviveSelect) {
    const bornOptions = Array.from(bornSelect.options);
    const surviveOptions = Array.from(surviveSelect.options);

    for (const bornOption of bornOptions) {
        const bornSet = parseRuleString(bornOption.value);
        for (const surviveOption of surviveOptions) {
            const surviveSet = parseRuleString(surviveOption.value);
            if (!hasIntersection(bornSet, surviveSet)) {
                return { born: bornOption.value, survive: surviveOption.value };
            }
        }
    }
    return null;
}

function updateSettingsOptionStates() {
    const bornSelect = document.getElementById('bornRules');
    const surviveSelect = document.getElementById('surviveRules');
    const bornSet = parseRuleString(bornSelect.value);
    const surviveSet = parseRuleString(surviveSelect.value);

    Array.from(surviveSelect.options).forEach(option => {
        const ruleSet = parseRuleString(option.value);
        option.disabled = hasIntersection(bornSet, ruleSet);
    });
    Array.from(bornSelect.options).forEach(option => {
        const ruleSet = parseRuleString(option.value);
        option.disabled = hasIntersection(surviveSet, ruleSet);
    });

    if (bornSelect.selectedOptions[0]?.disabled || surviveSelect.selectedOptions[0]?.disabled) {
        const validPair = findValidRulePair(bornSelect, surviveSelect);
        if (validPair) {
            bornSelect.value = validPair.born;
            surviveSelect.value = validPair.survive;
            const updatedBornSet = parseRuleString(bornSelect.value);
            const updatedSurviveSet = parseRuleString(surviveSelect.value);
            Array.from(surviveSelect.options).forEach(option => {
                const ruleSet = parseRuleString(option.value);
                option.disabled = hasIntersection(updatedBornSet, ruleSet);
            });
            Array.from(bornSelect.options).forEach(option => {
                const ruleSet = parseRuleString(option.value);
                option.disabled = hasIntersection(updatedSurviveSet, ruleSet);
            });
        }
    }
}

function loadLevel(idx) {
    stopPlaying();
    currentLevelIdx = idx;
    currentLevel = LevelRegistry[idx];
    generation = 0;
    seeds = new Set();
    statusKey = 'budget';
    // Create empty grid and add the pre-placed cells
    grid = Array(currentLevel.size).fill().map(() => Array(currentLevel.size).fill(false));
    currentLevel.initial.forEach(([r, c]) => { grid[r][c] = true; });
    render();
    updateTexts();
}

function render() {
    const goal = currentLevel.goal;
    const isTarget = (r, c) => goal.type === 'occupy' && goal.r === r && goal.c === c;
    gridEl.style.gridTemplateColumns = `repeat(${grid.length}, 1fr)`;
    gridEl.innerHTML = grid.flatMap((row, r) => 
        row.map((isAlive, c) => `
            <div class="cell ${isAlive ? 'alive' : 'dead'} ${isTarget(r, c) ? 'target' : ''}" 
                 onclick="handleCellClick(${r}, ${c})">
            </div>
        `)
    ).join('');
}

// Seeds can only be placed or removed before the evolution starts;
// pre-placed cells are part of the level and stay locked.
window.handleCellClick = (r, c) => {
    if (isPlaying || generation > 0) return;
    const key = `${r},${c}`;
    if (seeds.has(key)) {
        seeds.delete(key);
        grid[r][c] = false;
    } else if (!grid[r][c] && seeds.size < currentLevel.budget) {
        seeds.add(key);
        grid[r][c] = true;
    } else {
        return;
    }
    render();
    renderStatus();
};

window.updateRules = () => {
    const born = document.getElementById('bornRules').value.split(',').map(Number);
    const survive = document.getElementById('surviveRules').value.split(',').map(Number);
    engine = new LifeEngine(born, survive);
    Shell.closeModal('settingsModal');
};

function stopPlaying() {
    isPlaying = false;
    clearInterval(interval);
    document.getElementById('playBtn').innerText = i18n.t('play');
}

function step() {
    grid = engine.getNextGen(grid);
    render();
    generation++;
    const alive = grid.flat().filter(Boolean).length;
    if (alive === 0) {
        stopPlaying();
        statusKey = 'game_over';
    } else if (checkGoal(alive)) {
        stopPlaying();
        statusKey = 'win';
        setTimeout(nextLevel, 1500);
    }
    renderStatus();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        statusKey = 'all_levels_cleared';
        renderStatus();
    }
}

document.getElementById('playBtn').onclick = () => {
    if (statusKey === 'win' || statusKey === 'all_levels_cleared') return;
    if (isPlaying) {
        stopPlaying();
        return;
    }
    isPlaying = true;
    statusKey = 'running';
    document.getElementById('playBtn').innerText = i18n.t('pause');
    renderStatus();
    interval = setInterval(step, 200);
};

document.getElementById('resetBtn').onclick = () => loadLevel(currentLevelIdx);

function renderStatus() {
    if (statusKey === 'budget') {
        statusEl.innerText = `${i18n.t('budget')}: ${currentLevel.budget - seeds.size}`;
    } else if (statusKey === 'running') {
        const alive = grid.flat().filter(Boolean).length;
        statusEl.innerText = `${i18n.t('generation')}: ${generation}, ${i18n.t('alive')}: ${alive}`;
    } else {
        statusEl.innerText = i18n.t(statusKey);
    }
}

function updateTexts() {
    document.getElementById('playBtn').innerText = isPlaying ? i18n.t('pause') : i18n.t('play');
    const goalText = Goals[currentLevel.goal.type].text(currentLevel.goal);
    goalEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}: ${currentLevel.name} · ${i18n.t('goal')}: ${goalText}`;
    renderStatus();
}

window.addEventListener('langChanged', updateTexts);

initUI();
