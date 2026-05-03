let currentPiles = [];
let selectedIdx = null;
let isGameActive = false;
let isSettingUp = true;

const setupModal = document.getElementById('setupModal');
const board = document.getElementById('game-board');

/**
 * Step 1: Choose Number of Piles
 */
function setPileCount(count) {
    currentPiles = Array(count).fill(1); // Default 1 stick per pile
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    renderSetupPreview();
}

/**
 * Step 2: Visual Preview for Setting Sticks
 */
function renderSetupPreview() {
    const preview = document.getElementById('setup-preview');
    preview.style.width = '100%';
    preview.style.display = 'flex';
    preview.style.justifyContent = 'center';
    preview.style.alignItems = 'flex-end';
    preview.style.flexWrap = 'wrap';
    preview.style.gap = '20px';
    preview.style.padding = '20px 10px';
    preview.style.minHeight = '180px';

    preview.innerHTML = currentPiles.map((count, i) => `
        <div class="pile-container ${selectedIdx === i ? 'selected' : ''}" onclick="selectForConfig(${i})" style="cursor: pointer; text-align: center; transition: transform 0.2s;">
            <div class="pile-visual">
                ${Array.from({length: count}, () => '<div class="stick"></div>').join('')}
            </div>
            <strong style="display: block; margin-top: 8px; font-size: 0.9rem;">${count}</strong>
        </div>
    `).join('');
}

function selectForConfig(idx) {
    selectedIdx = idx;
    renderSetupPreview();
    
    // Show choices 1-10 for stick height in step3
    const step3Buttons = document.getElementById('step3-buttons');
    step3Buttons.innerHTML = Array.from({length: 10}, (_, i) => i + 1)
        .map(num => `<button onclick="setHeight(${num})">${num}</button>`)
        .join('');
    
    document.getElementById('step3-prompt').innerText = "Set sticks for pile " + (idx + 1);
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
}

window.setHeight = (h) => {
    if (isSettingUp) {
        currentPiles[selectedIdx] = h;
        document.getElementById('step3').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        renderSetupPreview();
    } else {
        handleMove(h);
    }
};

function backToStep2() {
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
}

function refreshText() {
    document.getElementById('title').innerText = i18n.t('title');
    document.getElementById('status').innerText = isGameActive ? i18n.t('status_start') : '';
    if (document.getElementById('infoModal') && document.getElementById('infoModal').classList.contains('active')) {
        updateInfoModal();
    }
}

window.backToStep2 = backToStep2;

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

/**
 * Step 3: Finalize
 */
function finalizeGame() {
    isSettingUp = false;
    setupModal.style.display = 'none';
    isGameActive = true;
    selectedIdx = null;
    refreshText();
    render();
}

/**
 * Standard In-Game Render
 */
function render() {
    board.innerHTML = currentPiles.map((count, i) => `
        <div class="pile-container ${selectedIdx === i ? 'selected' : ''}" onclick="onPileSelect(${i})">
            <div class="pile-visual">
                ${Array.from({length: count}, () => '<div class="stick"></div>').join('')}
            </div>
            <div class="pile-count">${count}</div>
        </div>
    `).join('');
}

// Reuse the previous onPileSelect and handleMove logic, 
// but ensure they check if (!isSettingUp)

window.onPileSelect = function(i) {
    if (isSettingUp || !isGameActive || currentPiles[i] === 0) return;
    selectedIdx = i;
    render();
    
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = Array.from({length: currentPiles[i]}, (_, n) => n + 1)
        .map(n => `<button class="num-btn" onclick="handleMove(${n})">${n}</button>`)
        .join('');
    
    document.getElementById('remove-prompt').innerText = i18n.t('remove_prompt');
    document.getElementById('actionMenu').classList.add('active');
};

window.handleMove = function(count) {
    currentPiles[selectedIdx] -= count;
    document.getElementById('actionMenu').classList.remove('active');
    selectedIdx = null;
    render();
    if (checkEndState(true)) return;
    setTimeout(processAiTurn, 800);
};

function processAiTurn() {
    if (!isGameActive) return;
    document.getElementById('status').innerText = i18n.t('status_ai');
    
    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? NimEngine.getMasterMove(currentPiles) : NimEngine.getNoviceMove(currentPiles);
    
    currentPiles[move.pileIndex] -= move.count;
    render();
    
    if (checkEndState(false)) return;
    
    document.getElementById('status').innerText = i18n.t('status_your_turn');
}

function checkEndState(isHuman) {
    if (currentPiles.every(p => p === 0)) {
        isGameActive = false;
        document.getElementById('status').innerText = isHuman ? i18n.t('win_human') : i18n.t('win_ai');
        return true;
    }
    return false;
}

document.getElementById('cancelBtn').onclick = () => {
    selectedIdx = null;
    document.getElementById('actionMenu').classList.remove('active');
    render();
};

window.addEventListener('langChanged', refreshText);

document.getElementById('setupBtn').onclick = () => {
    isSettingUp = true;
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    setupModal.style.display = 'flex';
};

// Trigger setup on load
window.onload = () => { document.getElementById('setupBtn').click(); };