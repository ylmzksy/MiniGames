/**
 * Memory Match page. Phases: preview (all cards shown for a few seconds), ready (the
 * clock starts with the first card), play, won, lost. A wrong pair turns back after a
 * moment, or at once when the next card is tapped.
 */
const MISMATCH_MS = 800;

let currentLevelIdx = 0;
let level = null;
let deck = [];
let open = [];          // indexes of the face-up cards that are not matched yet (0-2)
let matched = new Set();
let moves = 0;
let phase = 'ready';
let statusKey = '';
let statusParams = {};
let pending = null;     // timeout: end of the preview, or closing a wrong pair
let cardEls = [];

const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const levelInfoEl = document.getElementById('level-info');
const countersEl = document.getElementById('counters');
const timer = new Countdown(document.getElementById('timer'));

function loadLevel(idx) {
    level = LevelRegistry[idx];
    if (!level) return;
    currentLevelIdx = idx;
    Progress.setCurrent(idx);
    clearTimeout(pending);
    timer.reset(level.time);
    deck = MatchEngine.deal(level.cols * level.rows / 2);
    open = [];
    matched = new Set();
    moves = 0;
    buildBoard();
    updateLevelInfo();
    if (level.preview) {
        phase = 'preview';
        setStatus('status_preview');
        pending = setTimeout(() => {
            phase = 'ready';
            setStatus('status_ready');
            render();
        }, level.preview * 1000);
    } else {
        phase = 'ready';
        setStatus('status_ready');
    }
    render();
}

function buildBoard() {
    board.style.setProperty('--cols', level.cols);
    board.innerHTML = deck.map((picture, i) => `
        <button class="card" onclick="flip(${i})" aria-label="${i + 1}">
            <span class="card-inner">
                <span class="card-back"></span>
                <span class="card-front">${picture}</span>
            </span>
        </button>
    `).join('');
    cardEls = [...board.querySelectorAll('.card')];
}

window.flip = (i) => {
    if ((phase !== 'ready' && phase !== 'play') || matched.has(i) || open.includes(i)) return;
    if (phase === 'ready') {
        phase = 'play';
        timer.start(level.time, timeUp);
        setStatus('status_play');
    }
    // A wrong pair still showing closes as soon as the next card is tapped
    if (open.length === 2) {
        clearTimeout(pending);
        open = [];
    }
    open.push(i);
    if (open.length === 2) {
        moves++;
        const [a, b] = open;
        if (deck[a] === deck[b]) {
            matched.add(a);
            matched.add(b);
            open = [];
            if (matched.size === deck.length) win();
        } else {
            pending = setTimeout(() => {
                open = [];
                render();
            }, MISMATCH_MS);
        }
    }
    render();
};

function win() {
    phase = 'won';
    const left = timer.stop();
    setStatus('status_won', { time: left.toFixed(1) });
    Progress.markSolved(currentLevelIdx);
    const id = currentLevelIdx;
    setTimeout(() => { if (id === currentLevelIdx && phase === 'won') nextLevel(); }, 2200);
}

function timeUp() {
    phase = 'lost';
    clearTimeout(pending);
    open = [];
    setStatus('status_lost');
    render();
}

function nextLevel() {
    if (currentLevelIdx + 1 < LevelRegistry.length) loadLevel(currentLevelIdx + 1);
    else setStatus('all_levels_cleared');
}

function render() {
    cardEls.forEach((card, i) => {
        const isMatched = matched.has(i);
        const shown = phase === 'preview' || phase === 'lost' || isMatched || open.includes(i);
        card.classList.toggle('up', shown);
        card.classList.toggle('matched', isMatched);
        card.classList.toggle('wrong', open.length === 2 && open.includes(i));
        card.classList.toggle('missed', phase === 'lost' && !isMatched);
        card.disabled = phase === 'won' || phase === 'lost' || phase === 'preview';
    });
    countersEl.innerText = `${i18n.t('pairs')}: ${matched.size / 2} / ${deck.length / 2} · ${i18n.t('moves')}: ${moves}`;
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
