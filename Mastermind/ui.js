// Up to 8 peg colors; levels use the first `colors` of them
const PALETTE = ['#e03b3b', '#3b6fe0', '#f5b301', '#1f9d55', '#ff8c1a', '#9b4ddb', '#17b8c8', '#f06ab0'];

let currentLevelIdx = 0;
let level = null;
let secret = [];
let guesses = [];      // [{ code: [...], black, white }]
let current = [];      // the row being composed: color index or null per slot
let selectedSlot = 0;
let finished = false;  // true once won or lost
let statusKey = 'status_play';
let statusParams = {};

const rowsEl = document.getElementById('rows');
const paletteEl = document.getElementById('palette');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const checkBtn = document.getElementById('checkBtn');

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;

    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    secret = MastermindEngine.generateCode(level.length, level.colors, level.duplicates);
    guesses = [];
    current = Array(level.length).fill(null);
    selectedSlot = 0;
    finished = false;
    setStatus('status_play', { attempts: level.attempts });
    updateLevelInfo();
    renderPalette();
    render();
}

function renderPalette() {
    paletteEl.innerHTML = PALETTE.slice(0, level.colors).map((color, i) => `
        <button class="peg-btn" style="--peg: ${color}" onclick="pickColor(${i})" title="${i + 1}">
            <span class="peg"></span>
        </button>
    `).join('');
}

function render() {
    const rows = [];
    // Past guesses, oldest at the top
    guesses.forEach((guess, i) => rows.push(renderRow(guess.code, i + 1, feedbackPegs(guess), false)));
    // The row being composed, then the remaining empty rows
    if (!finished) rows.push(renderRow(current, guesses.length + 1, '', true));
    for (let i = rows.length; i < level.attempts; i++) {
        rows.push(renderRow(Array(level.length).fill(null), i + 1, '', false));
    }
    // The secret is shown at the end of a game
    if (finished) rows.push(renderRow(secret, '?', '', false, 'secret'));
    rowsEl.innerHTML = rows.join('');

    checkBtn.disabled = finished || !MastermindEngine.isComplete(current);
    rowsEl.querySelector('.row.active')?.scrollIntoView({ block: 'nearest' });
}

function renderRow(code, label, feedback, active, extra = '') {
    const pegs = code.map((color, i) => {
        const classes = ['peg', color === null ? 'empty' : '', active && i === selectedSlot ? 'selected' : ''].join(' ');
        const style = color === null ? '' : `style="--peg: ${PALETTE[color]}"`;
        const click = active ? `onclick="selectSlot(${i})"` : '';
        return `<span class="${classes}" ${style} ${click}></span>`;
    }).join('');
    return `
        <div class="row ${active ? 'active' : ''} ${extra}">
            <span class="row-label">${label}</span>
            <div class="pegs">${pegs}</div>
            <div class="feedback" style="grid-template-columns: repeat(${Math.ceil(level.length / 2)}, 1fr)">${feedback}</div>
        </div>
    `;
}

function feedbackPegs({ black, white }) {
    return '<span class="fb black"></span>'.repeat(black)
        + '<span class="fb white"></span>'.repeat(white);
}

window.selectSlot = (i) => {
    if (finished) return;
    if (selectedSlot === i && current[i] !== null) {
        current[i] = null; // tapping the selected peg again clears it
    }
    selectedSlot = i;
    render();
};

window.pickColor = (color) => {
    if (finished) return;
    if (!level.duplicates && current.includes(color) && current[selectedSlot] !== color) {
        setStatus('status_no_duplicates');
        return;
    }
    current[selectedSlot] = color;
    // Move on to the next empty slot, if there is one
    const next = current.findIndex((c, i) => c === null && i > selectedSlot);
    selectedSlot = next >= 0 ? next : Math.max(current.indexOf(null), selectedSlot);
    if (selectedSlot < 0) selectedSlot = level.length - 1;
    if (statusKey === 'status_no_duplicates') setStatus('status_play', { attempts: level.attempts });
    render();
};

window.clearSlot = () => {
    if (finished) return;
    // Clears the selected slot, or the last filled one if the selected slot is empty
    if (current[selectedSlot] === null) {
        const last = current.map((c, i) => c === null ? -1 : i).filter(i => i >= 0).pop();
        if (last === undefined) return;
        selectedSlot = last;
    }
    current[selectedSlot] = null;
    render();
};

window.submitGuess = () => {
    if (finished || !MastermindEngine.isComplete(current)) return;
    const result = MastermindEngine.score(secret, current);
    guesses.push({ code: [...current], ...result });
    current = Array(level.length).fill(null);
    selectedSlot = 0;

    if (result.black === level.length) {
        finished = true;
        setStatus('status_solved', { n: guesses.length });
        Progress.markSolved(currentLevelIdx);
        render();
        const solvedLevelIdx = currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === currentLevelIdx) nextLevel();
        }, 2500);
        return;
    }

    if (guesses.length >= level.attempts) {
        finished = true;
        setStatus('status_lost');
    } else {
        setStatus('status_left', { n: level.attempts - guesses.length });
    }
    render();
};

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
    const dupes = i18n.t(level.duplicates ? 'duplicates_yes' : 'duplicates_no');
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name} · `
        + i18n.t('level_rules', { length: level.length, colors: level.colors }) + ` · ${dupes}`;
}

document.addEventListener('keydown', (event) => {
    const inFormControl = event.target instanceof Element && event.target.closest('select, input');
    if (inFormControl || document.querySelector('.modal.active')) return;
    if (/^[1-8]$/.test(event.key) && Number(event.key) <= level.colors) {
        pickColor(Number(event.key) - 1);
    } else if (['Backspace', 'Delete'].includes(event.key)) {
        clearSlot();
    } else if (event.key === 'Enter') {
        submitGuess();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (finished) return;
        selectedSlot = (selectedSlot + (event.key === 'ArrowLeft' ? -1 : 1) + level.length) % level.length;
        render();
    } else {
        return;
    }
    event.preventDefault();
});

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
});

// Initial Load
if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
