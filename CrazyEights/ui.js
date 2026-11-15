/**
 * Page controller for Crazy Eights: your hand, the stock and discard pile,
 * the AI's hand, and the suit picker shown when you play an eight.
 */
const Game = {
    AI_DELAY: 750,

    init() {
        this.el = id => document.getElementById(id);
        this.gameId = 0;
        this.statusKey = '';
        this.statusParams = {};

        this.el('restartBtn').onclick = () => this.loadLevel(this.levelIdx);
        this.el('drawBtn').onclick = () => this.humanDraw();
        this.el('passBtn').onclick = () => this.humanPass();
        this.el('nextRoundBtn').onclick = () => this.startRound();
        this.el('player-hand').addEventListener('click', (event) => {
            const card = event.target.closest('[data-idx]');
            if (card) this.selectCard(Number(card.dataset.idx));
        });
        this.el('pile-area').addEventListener('click', (event) => {
            if (event.target.closest('[data-stock]')) this.humanDraw();
        });
        this.el('suit-picker').addEventListener('click', (event) => {
            const btn = event.target.closest('[data-suit]');
            if (btn) this.pickSuit(Number(btn.dataset.suit));
        });

        window.addEventListener('langChanged', () => {
            this.setStatus(this.statusKey, this.statusParams);
            this.updateLevelInfo();
            this.render();
        });

        if (LevelRegistry.length > 0) this.loadLevel(Progress.startLevel());
    },

    loadLevel(idx) {
        const level = LevelRegistry[idx];
        if (!level) return;
        this.levelIdx = idx;
        Progress.setCurrent(idx);
        this.rules = CrazyEights.makeRules(level);
        this.scores = [0, 0];
        this.starter = 0;
        this.matchOver = false;
        this.updateLevelInfo();
        this.startRound();
    },

    // Players take turns to start the rounds
    startRound() {
        this.gameId++;
        this.state = CrazyEights.newRound(this.rules, this.scores, this.starter);
        this.starter = 1 - this.starter;
        this.pendingEight = null;
        if (this.state.turn === 0) this.setHumanTurnStatus('status_your_turn');
        else this.setStatus('status_ai_turn');
        this.render();
        if (this.state.turn === 1) this.scheduleAi();
    },

    isHumanTurn() {
        return this.state && !this.state.result && this.state.turn === 0;
    },

    /* ---------- Human ---------- */

    selectCard(idx) {
        if (!this.isHumanTurn()) return;
        const card = this.state.hands[0][idx];
        if (!CrazyEights.fits(this.state, card)) {
            this.setStatus('status_no_fit');
            return;
        }
        if (card.r === 8) {
            this.pendingEight = idx;
            this.setStatus('status_pick_suit');
            this.render();
            return;
        }
        this.humanPlay(idx, card.s);
    },

    pickSuit(suit) {
        if (this.pendingEight === null || !this.isHumanTurn()) return;
        const idx = this.pendingEight;
        this.pendingEight = null;
        this.humanPlay(idx, suit);
    },

    humanPlay(idx, suit) {
        this.pendingEight = null;
        const action = CrazyEights.play(this.rules, this.state, 0, idx, suit);
        if (this.state.result) { this.finishRound(); return; }
        if (action) {
            this.setHumanTurnStatus(action === 'draw2' ? 'status_you_draw2' : 'status_you_skip');
            this.render();
            return;
        }
        this.setStatus('status_ai_turn');
        this.render();
        this.scheduleAi();
    },

    humanDraw() {
        if (!this.isHumanTurn() || !CrazyEights.canDraw(this.state, 0)) return;
        this.pendingEight = null;
        CrazyEights.draw(this.state, 0);
        this.setHumanTurnStatus('status_drew_play');
        this.render();
    },

    humanPass() {
        if (!this.isHumanTurn() || !CrazyEights.mustPass(this.state, 0)) return;
        CrazyEights.pass(this.rules, this.state, 0);
        if (this.state.result) { this.finishRound(); return; }
        this.setStatus('status_you_passed');
        this.render();
        this.scheduleAi();
    },

    // When nothing fits, say whether to draw or pass
    setHumanTurnStatus(key, params = {}) {
        if (!CrazyEights.legal(this.state, 0).length) {
            key = CrazyEights.canDraw(this.state, 0) ? 'status_must_draw' : 'status_must_pass';
        }
        this.setStatus(key, params);
    },

    /* ---------- AI ---------- */

    scheduleAi(delay = this.AI_DELAY) {
        const id = this.gameId;
        setTimeout(() => this.aiStep(id), delay);
    },

    // One AI action per step, so draws show one card at a time
    aiStep(id) {
        if (id !== this.gameId || !this.state || this.state.result || this.state.turn !== 1) return;
        const action = CrazyEights.aiAction(this.rules, this.state, 1, this.el('difficulty').value);
        if (action.type === 'draw') {
            CrazyEights.draw(this.state, 1);
            this.setStatus('status_ai_draws');
            this.render();
            this.scheduleAi(this.AI_DELAY / 2);
            return;
        }
        if (action.type === 'pass') {
            CrazyEights.pass(this.rules, this.state, 1);
            if (this.state.result) { this.finishRound(); return; }
            this.setHumanTurnStatus('status_ai_passed');
            this.render();
            return;
        }
        const card = this.state.hands[1][action.idx];
        const result = CrazyEights.play(this.rules, this.state, 1, action.idx, action.suit);
        if (this.state.result) { this.finishRound(); return; }
        if (result) {
            this.setStatus(result === 'draw2' ? 'status_ai_draw2' : 'status_ai_skip');
            this.render();
            this.scheduleAi();
            return;
        }
        if (card.r === 8) this.setHumanTurnStatus('status_ai_eight', { suit: Cards.SUITS[action.suit] });
        else this.setHumanTurnStatus('status_your_turn');
        this.render();
    },

    /* ---------- Round and match end ---------- */

    finishRound() {
        const result = this.state.result;
        this.scores = [...this.state.scores];
        this.pendingEight = null;
        if (result.kind === 'target') {
            this.matchOver = true;
            if (result.winner === 0) {
                this.setStatus('match_won', { you: this.scores[0], ai: this.scores[1] });
                Progress.markSolved(this.levelIdx);
                const id = this.gameId;
                setTimeout(() => { if (id === this.gameId) this.nextLevel(); }, 3000);
            } else {
                this.setStatus('match_lost', { you: this.scores[0], ai: this.scores[1] });
            }
        } else if (result.kind === 'tie') {
            this.setStatus('round_tie');
        } else {
            const who = result.winner === 0 ? 'you' : 'ai';
            this.setStatus(`round_${result.kind}_${who}`, { n: result.points });
        }
        this.render();
    },

    nextLevel() {
        if (this.levelIdx + 1 < LevelRegistry.length) this.loadLevel(this.levelIdx + 1);
        else this.setStatus('all_levels_cleared');
    },

    /* ---------- Rendering ---------- */

    render() {
        const state = this.state;
        const roundOver = !!state.result;
        const humanTurn = this.isHumanTurn();
        const legal = new Set(humanTurn ? CrazyEights.legal(state, 0) : []);

        // The AI's hand: backs during play, faces once the round is over
        this.el('ai-hand').innerHTML = state.hands[1]
            .map(c => CardView.card({ ...c, up: roundOver }))
            .join('');

        // Stock, discard and the suit to follow
        const canDraw = humanTurn && CrazyEights.canDraw(state, 0);
        const stockHtml = CrazyEights.canRefill(state)
            ? CardView.card({ up: false }, { cls: canDraw ? 'target' : '', attrs: 'data-stock="1"' })
            : CardView.slot();
        const top = CrazyEights.top(state);
        const suitRed = state.suit === 1 || state.suit === 2;
        this.el('pile-area').innerHTML = `
            <div class="pile-col">${stockHtml}<span>${i18n.t('stock')}: ${state.stock.length}</span></div>
            <div class="pile-col">${CardView.card(top)}<span>${i18n.t('discard')}</span></div>
            <div class="pile-col suit-now ${suitRed ? 'red' : 'black'}">
                <b>${Cards.SUITS[state.suit]}</b><span>${i18n.t('suit')}</span>
            </div>
        `;

        // Your hand; cards overlap more as it grows
        const hand = state.hands[0];
        const overlap = hand.length > 7 ? Math.min(0.8, 0.45 + (hand.length - 7) * 0.04) : 0.3;
        this.el('player-hand').style.setProperty('--overlap', `calc(var(--cw) * -${overlap})`);
        this.el('player-hand').innerHTML = hand.map((c, idx) => {
            const cls = [legal.has(idx) ? 'playable' : (humanTurn ? 'dim' : ''), this.pendingEight === idx ? 'selected' : ''];
            return CardView.card(c, { cls: cls.join(' '), attrs: `data-idx="${idx}"` });
        }).join('');

        this.el('suit-picker').hidden = this.pendingEight === null;
        this.el('suit-picker').innerHTML = Cards.SUITS.map((s, i) =>
            `<button data-suit="${i}" class="${i === 1 || i === 2 ? 'red' : 'black'}">${s}</button>`).join('');

        this.el('drawBtn').disabled = !canDraw;
        this.el('passBtn').disabled = !humanTurn || !CrazyEights.mustPass(state, 0);
        this.el('nextRoundBtn').hidden = !roundOver || this.matchOver;

        this.el('scoreboard').innerHTML = `
            <span><strong>${i18n.t('you')}</strong> ${state.scores[0]}</span>
            <span><strong>${i18n.t('ai')}</strong> ${state.scores[1]}</span>
            <span>${i18n.t('target')}: ${this.rules.target}</span>
        `;
    },

    setStatus(key, params = {}) {
        this.statusKey = key;
        this.statusParams = params;
        this.el('status').innerText = i18n.t(key, params);
    },

    updateLevelInfo() {
        const level = LevelRegistry[this.levelIdx];
        this.el('level-info').innerText = `${i18n.t('level')} ${this.levelIdx + 1}/${LevelRegistry.length}: ${level.name}`;
    }
};

Game.init();
