let currentPiles = [];
let selectedIdx = null;
let isGameActive = false;
let isSettingUp = true;
let isAiTurn = false;
let gameId = 0; // Bumped on every new game so a pending AI move from an old game is dropped
let statusKey = '';

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
    preview.innerHTML = currentPiles.map((count, i) => `
        <div class="pile-container ${selectedIdx === i ? 'selected' : ''}" onclick="selectForConfig(${i})">
            <div class="pile-visual">
                ${Array.from({length: count}, () => '<div class="stick"></div>').join('')}
            </div>
            <div class="pile-count">${count}</div>
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
    
    document.getElementById('step3-prompt').innerText = `${i18n.t('setup_pile_prompt')} ${idx + 1}`;
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

function setStatus(key) {
    statusKey = key;
    document.getElementById('status').innerText = key ? i18n.t(key) : '';
}

function refreshText() {
    setStatus(statusKey);
    if (selectedIdx !== null && isSettingUp) {
        document.getElementById('step3-prompt').innerText = `${i18n.t('setup_pile_prompt')} ${selectedIdx + 1}`;
    }
}

window.backToStep2 = backToStep2;

/**
 * Step 3: Finalize
 */
function finalizeGame() {
    isSettingUp = false;
    Shell.closeModal('setupModal');
    isGameActive = true;
    isAiTurn = false;
    gameId++;
    selectedIdx = null;
    setStatus('status_start');
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
    if (isSettingUp || !isGameActive || isAiTurn || currentPiles[i] === 0) return;
    selectedIdx = i;
    render();
    
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = Array.from({length: currentPiles[i]}, (_, n) => n + 1)
        .map(n => `<button class="num-btn" onclick="handleMove(${n})">${n}</button>`)
        .join('');

    document.getElementById('actionMenu').classList.add('active');
};

window.handleMove = function(count) {
    currentPiles[selectedIdx] -= count;
    document.getElementById('actionMenu').classList.remove('active');
    selectedIdx = null;
    render();
    if (checkEndState(true)) return;
    isAiTurn = true;
    setStatus('status_ai');
    const moveGameId = gameId;
    setTimeout(() => processAiTurn(moveGameId), 800);
};

function processAiTurn(moveGameId) {
    if (!isGameActive || moveGameId !== gameId) return;
    isAiTurn = false;

    const difficulty = document.getElementById('difficulty').value;
    const move = difficulty === 'master' ? NimEngine.getMasterMove(currentPiles) : NimEngine.getNoviceMove(currentPiles);
    
    currentPiles[move.pileIndex] -= move.count;
    render();
    
    if (checkEndState(false)) return;

    setStatus('status_your_turn');
}

function checkEndState(isHuman) {
    if (currentPiles.every(p => p === 0)) {
        isGameActive = false;
        setStatus(isHuman ? 'win_human' : 'win_ai');
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
    document.getElementById('step3').style.display = 'none';
    Shell.openModal('setupModal');
};

// Trigger setup on load
window.onload = () => { document.getElementById('setupBtn').click(); };