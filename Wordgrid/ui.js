let currentLevel = null;
let selectedCell = null;

// Multi-value state tracking: stores array of valid words entered per cell
let cellData = Array(9).fill(null).map(() => ({
    history: [],
    selectedIndex: -1
}));

const gridContainer = document.getElementById('grid-container');
const wordInput = document.getElementById('wordInput');
const statusMessage = document.getElementById('statusMessage');

function initGame() {
    currentLevel = LevelRegistry[0]; // Load first level layout
    
    // Fallback Mock Dictionary until you provide your Turkish JSON file
    WordEngine.setDictionary(["talep", "kamp", "karpuz", "mektup", "kus", "fanus", "burs"]); 
    
    window.dispatchEvent(new CustomEvent('langChanged'));
    renderMatrix();
}

function renderMatrix() {
    gridContainer.innerHTML = '';
    
    // Top-Left Header Cell
    gridContainer.appendChild(createCell('meta-cell', 'Rarity<br>0.00'));
    
    // Build Column Header Cells
    currentLevel.columns.forEach(col => {
        gridContainer.appendChild(createCell('header-cell', i18n.t(col.labelKey)));
    });

    // Build Row Blocks combining data structures
    for (let r = 0; r < 3; r++) {
        // Row Rule Label
        gridContainer.appendChild(createCell('header-cell', i18n.t(currentLevel.rows[r].labelKey)));
        
        // Active Data Input Cells
        for (let c = 0; c < 3; c++) {
            const cellIndex = (r * 3) + c;
            const cellState = cellData[cellIndex];
            const displayWord = cellState.selectedIndex !== -1 ? cellState.history[cellState.selectedIndex] : '';
            
            const cellEl = createCell('data-cell', displayWord);
            if (selectedCell === cellIndex) cellEl.classList.add('selected');
            
            cellEl.onclick = () => selectCell(cellIndex);
            gridContainer.appendChild(cellEl);
        }
    }
}

function createCell(className, innerHTML) {
    const div = document.createElement('div');
    div.className = `cell ${className}`;
    div.innerHTML = innerHTML;
    return div;
}

function selectCell(index) {
    selectedCell = index;
    wordInput.disabled = false;
    wordInput.value = '';
    wordInput.focus();
    statusMessage.innerText = `${i18n.t('placeholder')}`;
    renderMatrix();
}

// Automatic text detection listener
wordInput.oninput = function() {
    const word = this.value.trim().toLowerCase();
    if (word.length < 2) return; 

    const r = Math.floor(selectedCell / 3);
    const c = selectedCell % 3;
    
    const rowRule = currentLevel.rows[r];
    const colRule = currentLevel.columns[c];

    const validation = WordEngine.validateWord(word, rowRule, colRule);

    if (validation.valid) {
        // Rule 9 verification: verify uniqueness across selections
        const isDuplicate = cellData.some((cell, idx) => 
            cell.selectedIndex !== -1 && cell.history[cell.selectedIndex] === word
        );

        if (isDuplicate) {
            statusMessage.innerText = i18n.t('err_duplicate');
            return;
        }

        // Add history and configure active selection indices
        const state = cellData[selectedCell];
        if (!state.history.includes(word)) state.history.push(word);
        state.selectedIndex = state.history.indexOf(word);
        
        statusMessage.innerText = i18n.t('status_valid');
        this.value = ''; 
        renderMatrix();
    } else {
        statusMessage.innerText = validation.error === 'NOT_IN_DICTIONARY' 
            ? i18n.t('err_dict') 
            : i18n.t('err_rule');
    }
};

window.addEventListener('langChanged', () => {
    document.getElementById('game-title').innerText = i18n.t('title');
    statusMessage.innerText = i18n.t('status_select');
    renderMatrix();
});

initGame();