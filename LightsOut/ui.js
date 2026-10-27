let currentLevelIdx = 0;
let grid = [];

function loadLevel(idx) {
    const level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    // Deep copy the initial state
    grid = level.initial.map(row => [...row]);
    render();
    updateStatus();
}

function render() {
    const container = document.getElementById('game-board');
    const level = LevelRegistry[currentLevelIdx];
    container.style.gridTemplateColumns = `repeat(${level.size}, 1fr)`;

    container.innerHTML = grid.flatMap((row, r) =>
        row.map((isOn, c) => `
            <div class="light ${isOn ? 'on' : 'off'}"
                 onclick="handleTap(${r}, ${c})">
            </div>
        `)
    ).join('');
}

window.handleTap = (r, c) => {
    grid = LightsEngine.toggle(grid, r, c);
    render();
    if (LightsEngine.isSolved(grid)) {
        document.getElementById('status').innerText = i18n.t('solved');
        setTimeout(nextLevel, 1500);
    }
};

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) {
        loadLevel(currentLevelIdx + 1);
    } else {
        document.getElementById('status').innerText = i18n.t('all_levels_cleared');
    }
}

function updateStatus() {
    const level = LevelRegistry[currentLevelIdx];
    document.getElementById('status').innerText = `${i18n.t('level')} ${level.id}: ${level.name}`;
}

window.addEventListener('langChanged', updateStatus);

// Initial Load
if (LevelRegistry.length > 0) loadLevel(0);
