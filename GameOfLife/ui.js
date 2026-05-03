let currentLevel = null;
let grid = [];
let isPlaying = false;
let interval = null;
let initialAlive = 0;
let generation = 0;
let engine = new LifeEngine(); // Default B3/S23

const gridEl = document.getElementById('game-grid');
const statusEl = document.getElementById('status');
const goalEl = document.getElementById('goal');

function initUI() {
    // Standard level loading logic
    if (LevelRegistry.length > 0) loadLevel(0);
    updateTexts();
    // Set up event listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('active');
        updateSettingsOptionStates();
    });
    const bornSelect = document.getElementById('bornRules');
    const surviveSelect = document.getElementById('surviveRules');
    bornSelect.addEventListener('change', () => updateSettingsOptionStates());
    surviveSelect.addEventListener('change', () => updateSettingsOptionStates());
}

function checkGoal() {
    const alive = grid.flat().filter(Boolean).length;
    if (currentLevel.id === 1) { // challenge1
        return generation >= 50 && alive > 0;
    } else if (currentLevel.name === "The Glider Challenge") {
        return grid[10][10];
    }
    return false;
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
    currentLevel = LevelRegistry[idx];
    initialAlive = currentLevel.initial.length;
    generation = 0;
    // Create empty grid
    grid = Array(currentLevel.size).fill().map(() => Array(currentLevel.size).fill(false));
    // Load initial seeds
    currentLevel.initial.forEach(cell => {
        if (cell.r !== undefined) {
            grid[cell.r][cell.c] = cell.state;
        } else {
            grid[cell[0]][cell[1]] = true;
        }
    });
    render();
    const currentAlive = grid.flat().filter(Boolean).length;
    const placed = currentAlive - initialAlive;
    const remaining = Math.max(0, currentLevel.budget - placed);
    statusEl.innerText = `${i18n.t('budget')}: ${remaining}`;
    let goalText = '';
    if (typeof currentLevel.goal === 'string') {
        goalText = currentLevel.goal;
    } else if (currentLevel.goal.type === 'occupy') {
        goalText = `${i18n.t('occupy')} (${currentLevel.goal.r}, ${currentLevel.goal.c})`;
    }
    goalEl.innerText = `${i18n.t('goal')}: ${goalText}`;
}

function render() {
    gridEl.style.gridTemplateColumns = `repeat(${grid.length}, 1fr)`;
    gridEl.innerHTML = grid.flatMap((row, r) => 
        row.map((isAlive, c) => `
            <div class="cell ${isAlive ? 'alive' : 'dead'}" 
                 onclick="handleCellClick(${r}, ${c})">
            </div>
        `)
    ).join('');
}

window.handleCellClick = (r, c) => {
    if (isPlaying) return;
    const currentAlive = grid.flat().filter(Boolean).length;
    const placed = currentAlive - initialAlive;
    const remaining = Math.max(0, currentLevel.budget - placed);
    if (!grid[r][c] && remaining <= 0) return; // can't place more
    grid[r][c] = !grid[r][c];
    render();
    const newAlive = grid.flat().filter(Boolean).length;
    const newPlaced = newAlive - initialAlive;
    const newRemaining = Math.max(0, currentLevel.budget - newPlaced);
    statusEl.innerText = `${i18n.t('budget')}: ${newRemaining}`;
};

window.updateRules = () => {
    const born = document.getElementById('bornRules').value.split(',').map(Number);
    const survive = document.getElementById('surviveRules').value.split(',').map(Number);
    engine = new LifeEngine(born, survive);
    document.getElementById('settingsModal').classList.remove('active');
};

document.getElementById('playBtn').onclick = () => {
    isPlaying = !isPlaying;
    document.getElementById('playBtn').innerText = isPlaying ? i18n.t('pause') : i18n.t('play');
    if (isPlaying) {
        interval = setInterval(() => {
            grid = engine.getNextGen(grid);
            render();
            generation++;
            const alive = grid.flat().filter(Boolean).length;
            statusEl.innerText = `${i18n.t('generation')}: ${generation}, ${i18n.t('alive')}: ${alive}`;
            if (alive === 0) {
                isPlaying = false;
                clearInterval(interval);
                document.getElementById('playBtn').innerText = i18n.t('play');
                statusEl.innerText = i18n.t('game_over');
                return;
            }
            if (checkGoal()) {
                isPlaying = false;
                clearInterval(interval);
                document.getElementById('playBtn').innerText = i18n.t('play');
                statusEl.innerText = i18n.t('win');
            }
        }, 200);
    } else {
        clearInterval(interval);
        const alive = grid.flat().filter(Boolean).length;
        statusEl.innerText = `${i18n.t('generation')}: ${generation}, ${i18n.t('alive')}: ${alive}`;
    }
};

document.getElementById('resetBtn').onclick = () => {
    isPlaying = false;
    document.getElementById('playBtn').innerText = i18n.t('play');
    clearInterval(interval);
    loadLevel(0); // Reload current level
};

function updateStaticText() {
    updateTexts();
}

function updateTexts() {
    document.getElementById('title').innerText = i18n.t('title');
    document.getElementById('playBtn').innerText = isPlaying ? i18n.t('pause') : i18n.t('play');
    document.getElementById('resetBtn').innerText = i18n.t('reset');
    document.getElementById('settingsBtn').innerText = i18n.t('settings');
    document.getElementById('rulesTitle').innerText = i18n.t('rules');
    document.getElementById('bornLabel').innerText = `${i18n.t('born')}:`;
    document.getElementById('surviveLabel').innerText = `${i18n.t('survive')}:`;
    document.querySelector('#settingsModal button').innerText = i18n.t('apply');
    // update goal
    let goalText = '';
    if (typeof currentLevel.goal === 'string') {
        goalText = currentLevel.goal;
    } else if (currentLevel.goal.type === 'occupy') {
        goalText = `${i18n.t('occupy')} (${currentLevel.goal.r}, ${currentLevel.goal.c})`;
    }
    goalEl.innerText = `${i18n.t('goal')}: ${goalText}`;
    // update status if not playing
    if (!isPlaying) {
        const currentAlive = grid.flat().filter(Boolean).length;
        const placed = currentAlive - initialAlive;
        const remaining = Math.max(0, currentLevel.budget - placed);
        statusEl.innerText = `${i18n.t('budget')}: ${remaining}`;
    }
}

window.addEventListener('langChanged', updateTexts);

document.getElementById('langSelect').addEventListener('change', (e) => {
    i18n.setLanguage(e.target.value);
});

initUI();