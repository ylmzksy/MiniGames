/**
 * Flash Grid page. Each round: get ready, the pattern lights up for level.show seconds,
 * then the clock runs while the player taps the cells from memory. A wrong cell or the
 * end of the time costs a life and replays the round with a new pattern.
 */
const LIVES = 3;
const READY_MS = 900;
const RESULT_MS = 1400;

let currentLevelIdx = 0;
let level = null;
let round = 0;
let lives = LIVES;
let pattern = new Set();
let found = new Set();
let wrongCell = -1;
let phase = 'ready';    // ready, show, recall, result, won, lost
let reveal = false;     // after a mistake the cells that were missed are shown
let statusKey = '';
let statusParams = {};
let pending = null;
let cellEls = [];

const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const roundInfoEl = document.getElementById('round-info');
const timer = new Countdown(document.getElementById('timer'));

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    round = 0;
    lives = LIVES;
    buildBoard();
    updateLevelInfo();
    startRound();
}

function buildBoard() {
    board.style.setProperty('--cols', level.size);
    board.innerHTML = [...Array(level.size * level.size).keys()]
        .map(i => `<button class="cell" onclick="tapCell(${i})" aria-label="${i + 1}"></button>`).join('');
    cellEls = [...board.querySelectorAll('.cell')];
}

function later(fn, ms) {
    clearTimeout(pending);
    pending = setTimeout(fn, ms);
}

function startRound() {
    timer.reset(level.time);
    pattern = FlashEngine.pattern(level.size * level.size, level.rounds[round]);
    found = new Set();
    wrongCell = -1;
    reveal = false;
    phase = 'ready';
    setStatus('status_get_ready');
    render();
    later(() => {
        phase = 'show';
        setStatus('status_watch');
        render();
        later(startRecall, level.show * 1000);
    }, READY_MS);
}

function startRecall() {
    phase = 'recall';
    setStatus('status_recall', { n: pattern.size });
    render();
    timer.start(level.time, () => fail('status_timeout'));
}

window.tapCell = (i) => {
    if (phase !== 'recall' || found.has(i)) return;
    if (pattern.has(i)) {
        found.add(i);
        if (found.size === pattern.size) roundWon();
    } else {
        wrongCell = i;
        fail('status_wrong');
    }
    render();
};

function roundWon() {
    timer.stop();
    if (round + 1 < level.rounds.length) {
        phase = 'result';
        setStatus('status_round_ok');
        later(() => {
            round++;
            startRound();
        }, RESULT_MS);
    } else {
        phase = 'won';
        setStatus('status_won');
        Progress.markSolved(currentLevelIdx);
        later(nextLevel, 2000);
    }
    render();
}

function fail(key) {
    timer.stop();
    lives--;
    reveal = true;
    phase = 'result';
    setStatus(key);
    render();
    if (lives > 0) {
        later(startRound, RESULT_MS + 400);
    } else {
        later(() => {
            phase = 'lost';
            setStatus('status_lost');
            render();
        }, RESULT_MS);
    }
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function render() {
    cellEls.forEach((cell, i) => {
        const inPattern = pattern.has(i);
        cell.classList.toggle('lit', phase === 'show' && inPattern);
        cell.classList.toggle('found', found.has(i));
        cell.classList.toggle('missed', reveal && inPattern && !found.has(i));
        cell.classList.toggle('wrong', i === wrongCell);
    });
    board.classList.toggle('active', phase === 'recall');
    const hearts = '♥'.repeat(lives) + '♡'.repeat(LIVES - lives);
    roundInfoEl.innerHTML = `${i18n.t('round')} ${round + 1} / ${level.rounds.length} · <span class="lives" title="${i18n.t('lives')}">${hearts}</span>`;
}

document.getElementById('restartBtn').onclick = () => loadLevel(currentLevelIdx);

function setStatus(key, params = {}) {
    statusKey = key;
    statusParams = params;
    statusEl.innerText = i18n.t(key, params);
}

function updateLevelInfo() {
    levelInfoEl.innerText = `${i18n.t('level')} ${currentLevelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
}

window.addEventListener('langChanged', () => {
    setStatus(statusKey, statusParams);
    updateLevelInfo();
    render();
});

if (LevelRegistry.length > 0) loadLevel(Progress.startLevel());
