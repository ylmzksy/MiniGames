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
        alert(i18n.t('all_levels_cleared'));
    }
}

function updateStatus() {
    const level = LevelRegistry[currentLevelIdx];
    document.getElementById('status').innerText = `${i18n.t('level')} ${level.id}: ${level.name}`;
}

window.showInfo = () => {
    updateInfoModal();
    document.getElementById('infoModal').classList.add('active');
};

window.hideInfo = () => {
    document.getElementById('infoModal').classList.remove('active');
};

function updateInfoModal() {
    document.getElementById('info-title').innerText = i18n.t('info_title');
    document.getElementById('info-description').innerText = i18n.t('info_description');
    document.getElementById('rules-title').innerText = i18n.t('rules_title');
    document.getElementById('rule-1').innerText = i18n.t('rule_1');
    document.getElementById('rule-2').innerText = i18n.t('rule_2');
    document.getElementById('rule-3').innerText = i18n.t('rule_3');
    document.getElementById('rule-4').innerText = i18n.t('rule_4');
    document.getElementById('tips-title').innerText = i18n.t('tips_title');
    document.getElementById('tip-1').innerText = i18n.t('tip_1');
    document.getElementById('tip-2').innerText = i18n.t('tip_2');
    document.getElementById('tip-3').innerText = i18n.t('tip_3');
    document.getElementById('closeBtn').innerText = i18n.t('close');
}

function refreshText() {
    document.documentElement.lang = i18n.currentLang;
    document.getElementById('title').innerText = i18n.t('title');
    document.title = i18n.t('title');
    document.getElementById('resetBtn').innerText = i18n.t('reset_level');
    document.getElementById('langBtn').innerText = i18n.t('language_button');
    updateStatus();
    if (document.getElementById('infoModal').classList.contains('active')) {
        updateInfoModal();
    }
}

window.toggleLangMenu = () => {
    document.getElementById('langMenu').classList.toggle('active');
};

window.selectLanguage = (lang) => {
    i18n.setLanguage(lang);
    document.getElementById('langMenu').classList.remove('active');
};

window.addEventListener('click', (event) => {
    const menu = document.getElementById('langMenu');
    const button = document.getElementById('langBtn');
    if (!menu || !button) return;
    if (!menu.contains(event.target) && event.target !== button) {
        menu.classList.remove('active');
    }
});

// Initialize text on load
window.addEventListener('load', refreshText);
window.addEventListener('langChanged', refreshText);

// Initial Load
window.onload = () => {
    if (LevelRegistry.length > 0) loadLevel(0);
};