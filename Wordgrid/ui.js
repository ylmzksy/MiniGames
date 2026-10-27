let currentLevel = null;
let selectedCell = null;
let dictionaryReady = false;
let statusKey = 'status_select';

// Multi-value state tracking: stores array of valid words entered per cell
let cellData = [];

const gridContainer = document.getElementById('grid-container');
const wordInput = document.getElementById('wordInput');
const statusMessage = document.getElementById('statusMessage');

async function initGame() {
    currentLevel = LevelRegistry[0]; // Load first level layout
    const cellCount = currentLevel.rows.length * currentLevel.columns.length;
    cellData = Array.from({ length: cellCount }, () => ({
        history: [],
        selectedIndex: -1
    }));
    renderMatrix();
    setStatus('status_loading');

    try {
        const response = await fetch('tdk_kelimeler.txt');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        const words = text.split('\n')
            .map(w => w.trim())
            .filter(w => w.length > 0);
        WordEngine.setDictionary(words);
        dictionaryReady = true;
        setStatus('status_select');
    } catch (err) {
        // Usually means the page was opened as a file instead of through a web server
        console.error('Dictionary file could not be loaded:', err);
        setStatus('err_dict_load');
    }
}

function setStatus(key) {
    statusKey = key;
    statusMessage.innerText = i18n.t(key);
}

function renderMatrix() {
    const cols = currentLevel.columns.length;
    gridContainer.style.gridTemplateColumns = `minmax(80px, 110px) repeat(${cols}, 1fr)`;
    gridContainer.innerHTML = '';

    // Top-Left Corner Cell
    gridContainer.appendChild(createCell('meta-cell', ''));

    // Build Column Header Cells
    currentLevel.columns.forEach(col => {
        gridContainer.appendChild(createCell('header-cell', i18n.t(col.labelKey)));
    });

    // Build Row Blocks combining data structures
    currentLevel.rows.forEach((row, r) => {
        // Row Rule Label
        gridContainer.appendChild(createCell('header-cell', i18n.t(row.labelKey)));

        // Active Data Input Cells
        for (let c = 0; c < cols; c++) {
            const cellIndex = (r * cols) + c;
            const cellState = cellData[cellIndex];
            const displayWord = cellState.selectedIndex !== -1 ? cellState.history[cellState.selectedIndex] : '';

            const cellEl = createCell('data-cell', displayWord);
            if (selectedCell === cellIndex) cellEl.classList.add('selected');

            cellEl.onclick = () => selectCell(cellIndex);
            gridContainer.appendChild(cellEl);
        }
    });
}

function createCell(className, text) {
    const div = document.createElement('div');
    div.className = `cell ${className}`;
    div.textContent = text;
    return div;
}

function selectCell(index) {
    if (!dictionaryReady) return;
    const state = cellData[index];

    // If clicking the already selected cell and it has multiple words, cycle through them.
    if (selectedCell === index && state.history.length > 1) {
        state.selectedIndex = (state.selectedIndex + 1) % state.history.length;
        renderMatrix();
        return; // Skip re-enabling input
    }

    selectedCell = index;
    wordInput.disabled = false;
    wordInput.value = '';
    wordInput.focus();
    setStatus('placeholder');
    // Reset the selected word index for the new cell to show the latest one
    if (state.history.length > 0) state.selectedIndex = state.history.length - 1;
    renderMatrix();
}

// Handle Enter key to submit a word
wordInput.onkeydown = function(event) {
    if (event.key !== 'Enter') return;

    const word = WordEngine.normalize(this.value);
    if (word.length < 2) return;

    const cols = currentLevel.columns.length;
    const r = Math.floor(selectedCell / cols);
    const c = selectedCell % cols;

    const rowRule = currentLevel.rows[r];
    const colRule = currentLevel.columns[c];

    const validation = WordEngine.validateWord(word, rowRule, colRule);

    if (validation.valid) {
        // Rule 9 verification: a word may be active in only one cell
        const isDuplicate = cellData.some((cell, idx) =>
            idx !== selectedCell && cell.selectedIndex !== -1 && cell.history[cell.selectedIndex] === word
        );

        if (isDuplicate) {
            setStatus('err_duplicate');
            return;
        }

        // Add history and configure active selection indices
        const state = cellData[selectedCell];
        if (!state.history.includes(word)) state.history.push(word);
        state.selectedIndex = state.history.indexOf(word);

        setStatus('status_valid');
        this.value = '';
        renderMatrix();
    } else {
        setStatus(validation.error === 'NOT_IN_DICTIONARY' ? 'err_dict' : 'err_rule');
    }
};

window.addEventListener('langChanged', () => {
    setStatus(statusKey);
    renderMatrix();
});

initGame();
