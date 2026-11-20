/**
 * Number Trail page. Each round: get ready, the numbers are shown for level.show seconds
 * (tapping 1 hides them at once), then the clock runs while the player taps the hidden
 * tiles in order. A wrong tile or the end of the time costs a life and replays the round
 * with new places.
 */
const LIVES = 3;
const READY_MS = 900;
const RESULT_MS = 1600;

let currentLevelIdx = 0;
let level = null;
let round = 0;
let lives = LIVES;
let places = [];        // places[k] = cell of number k + 1
let next = 1;           // the number to tap next
let wrongCell = -1;
let phase = 'ready';    // ready, show, recall, result, won, lost
let reveal = false;     // after a mistake all numbers are shown again
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
    board.style.setProperty('--cols', level.cols);
    board.innerHTML = [...Array(level.cols * level.rows).keys()]
        .map(i => `<button class="cell" onclick="tapCell(${i})"></button>`).join('');
    cellEls = [...board.querySelectorAll('.cell')];
}

function later(fn, ms) {
    clearTimeout(pending);
    pending = setTimeout(fn, ms);
}

function startRound() {
    timer.reset(level.time);
    places = TrailEngine.place(level.cols * level.rows, level.rounds[round]);
    next = 1;
    wrongCell = -1;
    reveal = false;
    phase = 'ready';
    setStatus('status_get_ready');
    render();
    later(() => {
        phase = 'show';
        setStatus('status_watch');
        render();
        later(hideNumbers, level.show * 1000);
    }, READY_MS);
}

function hideNumbers() {
    clearTimeout(pending);
    phase = 'recall';
    setStatus('status_recall', { n: next });
    render();
    timer.start(level.time, () => fail('status_timeout'));
}

window.tapCell = (i) => {
    // While the numbers are shown, tapping 1 hides the others and counts as the first tap
    if (phase === 'show' && i === places[0]) hideNumbers();
    if (phase !== 'recall') return;
    const number = places.indexOf(i) + 1;
    if (!number || number < next) return;   // empty cell, or a tile already done
    if (number === next) {
        next++;
        if (next > places.length) roundWon();
        else setStatus('status_recall', { n: next });
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
        const number = places.indexOf(i) + 1;
        const done = number > 0 && number < next;
        const visible = number > 0 && (phase === 'show' || done || reveal);
        cell.textContent = visible ? number : '';
        cell.classList.toggle('number', number > 0 && phase !== 'ready');
        cell.classList.toggle('tile', number > 0 && !visible && phase !== 'ready');
        cell.classList.toggle('done', done);
        cell.classList.toggle('missed', reveal && number > 0 && !done);
        cell.classList.toggle('wrong', i === wrongCell);
    });
    board.classList.toggle('active', phase === 'recall' || phase === 'show');
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
