/**
 * Shared engine for the solitaire games (Klondike, FreeCell, Golf).
 * The state is { piles: { id: [cards] }, moves, ...extra }. A game passes its
 * rules to SolitaireGame.init():
 *   cols                              columns of the table grid
 *   layout(rules)                     rows of pile specs { id, kind, mark, span } or null for a gap;
 *                                     kind is 'stack' (top card only), 'fan' (downward) or 'spread' (sideways, last 3)
 *   deal(rules, rand)                 the starting state (without moves)
 *   canPick(rules, state, id, idx)    whether the cards from idx to the top of pile id can be picked up
 *   canDrop(rules, state, cards, from, to)  whether those cards can go on pile to
 *   stock(rules, state)               a tap on the stock pile; mutates the state, returns false if nothing happened
 *   result(rules, state)              null while playing, else { won, key, params }
 *   info(rules, state)                extra counters, as [text]
 *   foundations                       ids of the foundation piles (enables the Auto button)
 *   flip                              ids of piles whose top card turns face up when uncovered
 *   seeded                            levels carry a `seed`, so every attempt gets the same deal
 * A level may set any rule fields; they are merged into `rules`. The engine itself reads
 * `goal` (shown with the 'goal' string at the start) and `undo: false` (hides Undo).
 */
const Solitaire = {
    // Max face-down / face-up step in a fan, in card widths
    STEP_DOWN: 0.22,
    STEP_UP: 0.42,
    MAX_FAN: 7,

    clone(state) {
        return JSON.parse(JSON.stringify(state));
    },

    top(pile) {
        return pile[pile.length - 1];
    },

    // Alternating colours, each one rank lower: the usual tableau run
    isRun(cards) {
        for (let i = 1; i < cards.length; i++) {
            const a = cards[i - 1];
            const b = cards[i];
            if (!a.up || !b.up || Cards.isRed(a) === Cards.isRed(b) || b.r !== a.r - 1) return false;
        }
        return cards.length > 0 && cards[0].up;
    },

    // Foundations build up by suit from the ace
    fitsFoundation(pile, cards) {
        if (cards.length !== 1) return false;
        const card = cards[0];
        const top = this.top(pile);
        return top ? top.s === card.s && card.r === top.r + 1 : card.r === 1;
    },

    // Tableau builds down in alternating colours; an empty column takes `emptyRank` (any if null)
    fitsTableau(pile, cards, emptyRank = null) {
        const top = this.top(pile);
        if (!top) return emptyRank === null || cards[0].r === emptyRank;
        return top.up && Cards.isRed(top) !== Cards.isRed(cards[0]) && cards[0].r === top.r - 1;
    }
};

/**
 * Page controller. Expects these elements: #status, #level-info, #counters,
 * #table, #undoBtn, #autoBtn, #newDealBtn, #restartBtn.
 */
const SolitaireGame = {
    AUTO_DELAY: 3000,

    init(config) {
        this.config = config;
        this.el = id => document.getElementById(id);
        this.gameId = 0;
        this.statusKey = '';
        this.statusParams = {};

        this.el('undoBtn').onclick = () => this.undo();
        this.el('autoBtn').onclick = () => this.autoFinish();
        this.el('autoBtn').hidden = !config.foundations;
        this.el('newDealBtn').onclick = () => this.startDeal(Cards.randomSeed());
        this.el('newDealBtn').hidden = !!config.seeded;
        this.el('restartBtn').onclick = () => this.startDeal(this.seed);

        const table = this.el('table');
        table.style.setProperty('--cols', config.cols);
        table.addEventListener('click', (event) => this.onClick(event));
        table.addEventListener('dblclick', (event) => this.onDoubleClick(event));

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
        this.rules = { ...level };
        this.layout = this.config.layout(this.rules);
        this.el('undoBtn').hidden = this.rules.undo === false;
        this.updateLevelInfo();
        this.startDeal(this.config.seeded ? level.seed : Cards.randomSeed());
    },

    // Restart replays the same seed; New deal picks a fresh one
    startDeal(seed) {
        this.gameId++;
        this.seed = seed;
        this.state = { ...this.config.deal(this.rules, Cards.rng(seed)), moves: 0 };
        this.history = [];
        this.selected = null;
        this.over = false;
        this.setStatus(this.rules.goal !== undefined ? 'goal' : 'status_play', { n: this.rules.goal });
        this.render();
    },

    /* ---------- Moves ---------- */

    pileIds() {
        return this.layout.flat().filter(Boolean).map(p => p.id);
    },

    targets(from, idx) {
        const cards = this.state.piles[from].slice(idx);
        return this.pileIds().filter(to => to !== from && this.config.canDrop(this.rules, this.state, cards, from, to));
    },

    save() {
        this.history.push(Solitaire.clone(this.state));
    },

    move(from, idx, to) {
        const piles = this.state.piles;
        const cards = piles[from].splice(idx);
        piles[to].push(...cards);
        this.state.moves++;
    },

    // Uncovered cards turn face up
    flipTops() {
        (this.config.flip || []).forEach(id => {
            const top = Solitaire.top(this.state.piles[id]);
            if (top && !top.up) top.up = true;
        });
    },

    afterAction() {
        this.selected = null;
        this.flipTops();
        const result = this.config.result(this.rules, this.state);
        if (result) {
            this.finish(result);
        } else {
            this.setStatus('status_play');
        }
        this.render();
    },

    /* ---------- Input ---------- */

    onClick(event) {
        if (this.over) return;
        const pileEl = event.target.closest('[data-pile]');
        if (!pileEl) {
            this.selected = null;
            this.render();
            return;
        }
        const id = pileEl.dataset.pile;
        const cardEl = event.target.closest('[data-idx]');
        const idx = cardEl ? Number(cardEl.dataset.idx) : null;

        if (id === 'stock' && this.config.stock) {
            this.save();
            if (!this.config.stock(this.rules, this.state)) {
                this.history.pop();
                return;
            }
            this.state.moves++;
            this.afterAction();
            return;
        }

        // A tap on a highlighted pile moves the selected cards there
        if (this.selected) {
            const { from, idx: selIdx } = this.selected;
            if (id === from && idx === selIdx) {
                this.selected = null;
                this.setStatus('status_play');
                this.render();
                return;
            }
            if (this.targets(from, selIdx).includes(id)) {
                this.save();
                this.move(from, selIdx, id);
                this.afterAction();
                return;
            }
        }

        if (idx === null || !this.config.canPick(this.rules, this.state, id, idx)) {
            this.selected = null;
            this.setStatus(idx === null ? 'status_play' : 'status_cant_move');
            this.render();
            return;
        }

        // One place to go: move at once. Several: let the player choose
        const targets = this.targets(id, idx);
        if (targets.length === 1) {
            this.save();
            this.move(id, idx, targets[0]);
            this.afterAction();
        } else if (!targets.length) {
            this.selected = null;
            this.setStatus('status_no_target');
            this.render();
        } else {
            this.selected = { from: id, idx };
            this.setStatus('status_pick_target');
            this.render();
        }
    },

    // Double tap sends a card to a foundation if it fits
    onDoubleClick(event) {
        if (this.over || !this.config.foundations) return;
        const cardEl = event.target.closest('[data-idx]');
        const pileEl = event.target.closest('[data-pile]');
        if (!cardEl || !pileEl) return;
        const from = pileEl.dataset.pile;
        const idx = Number(cardEl.dataset.idx);
        if (idx !== this.state.piles[from].length - 1) return;
        const to = this.targets(from, idx).find(t => this.config.foundations.includes(t));
        if (!to) return;
        this.save();
        this.move(from, idx, to);
        this.afterAction();
    },

    undo() {
        if (this.over || !this.history.length) return;
        this.state = this.history.pop();
        this.selected = null;
        this.setStatus('status_play');
        this.render();
    },

    /**
     * Moves cards up to the foundations while it is safe: a card goes up when
     * the cards that could still be built on it are already up too (aces and
     * twos always). Once every card is face up and the stock is empty, all go.
     */
    autoFinish() {
        if (this.over) return;
        const founds = this.config.foundations;
        const piles = this.state.piles;
        const level = s => founds.map(f => piles[f]).find(p => p.length && p[0].s === s)?.length || 0;
        const allOpen = () => this.pileIds().every(id =>
            founds.includes(id) || piles[id].every(c => c.up)) &&
            !(piles.stock && piles.stock.length) && !(piles.waste && piles.waste.length > 1);
        const safe = card => card.r <= 2 || [0, 1, 2, 3]
            .filter(s => Cards.isRed({ s }) !== Cards.isRed(card))
            .every(s => level(s) >= card.r - 1);

        const before = Solitaire.clone(this.state);
        let moved = true;
        let count = 0;
        while (moved) {
            moved = false;
            const finishing = allOpen();
            for (const id of this.pileIds()) {
                if (founds.includes(id) || id === 'stock') continue;
                const pile = piles[id];
                const card = Solitaire.top(pile);
                if (!card || !card.up || (!finishing && !safe(card))) continue;
                const to = founds.find(f => this.config.canDrop(this.rules, this.state, [card], id, f));
                if (!to) continue;
                this.move(id, pile.length - 1, to);
                this.flipTops();
                moved = true;
                count++;
            }
        }
        if (!count) {
            this.setStatus('status_no_auto');
            return;
        }
        this.history.push(before);
        this.afterAction();
    },

    /* ---------- End ---------- */

    finish(result) {
        this.over = true;
        this.setStatus(result.key, result.params || {});
        if (!result.won) return;
        Progress.markSolved(this.levelIdx);
        const id = this.gameId;
        setTimeout(() => { if (id === this.gameId) this.nextLevel(); }, this.AUTO_DELAY);
    },

    nextLevel() {
        if (this.levelIdx + 1 < LevelRegistry.length) {
            this.loadLevel(this.levelIdx + 1);
        } else {
            this.setStatus('all_levels_cleared');
        }
    },

    /* ---------- Rendering ---------- */

    render() {
        const state = this.state;
        const sel = this.selected;
        const targets = sel ? new Set(this.targets(sel.from, sel.idx)) : new Set();

        const rows = this.layout.map(row => {
            let html = '';
            row.forEach(spec => {
                if (!spec) { html += '<div></div>'; return; }
                html += this.renderPile(spec, state.piles[spec.id], sel, targets.has(spec.id));
            });
            return `<div class="sol-row">${html}</div>`;
        });
        this.el('table').innerHTML = rows.join('');

        this.el('undoBtn').disabled = this.over || !this.history.length;
        this.el('autoBtn').disabled = this.over;
        const info = this.config.info ? this.config.info(this.rules, state) : [];
        this.el('counters').innerHTML = [`${i18n.t('moves')}: ${state.moves}`, ...info]
            .map(text => `<span>${text}</span>`).join('');
    },

    renderPile(spec, pile, sel, isTarget) {
        const span = spec.span ? `; grid-column: span ${spec.span}` : '';
        const cls = isTarget ? 'target' : '';
        const selectedFrom = sel && sel.from === spec.id ? sel.idx : Infinity;
        const cardCls = i => [i >= selectedFrom ? 'selected' : '', i === pile.length - 1 ? cls : ''].join(' ');

        let body;
        let height = 1.4;
        if (!pile.length) {
            body = CardView.slot({ cls, mark: spec.mark || '' });
        } else if (spec.kind === 'fan') {
            const steps = pile.slice(0, -1).map(c => (c.up ? Solitaire.STEP_UP : Solitaire.STEP_DOWN));
            const total = steps.reduce((a, b) => a + b, 0);
            const scale = total > Solitaire.MAX_FAN ? Solitaire.MAX_FAN / total : 1;
            let y = 0;
            body = pile.map((card, i) => {
                const html = CardView.card(card, {
                    cls: cardCls(i),
                    attrs: `data-idx="${i}"`,
                    style: `top: calc(var(--cw) * ${y.toFixed(3)})`
                });
                if (i < steps.length) y += steps[i] * scale;
                return html;
            }).join('');
            height = y + 1.4;
        } else if (spec.kind === 'spread') {
            const shown = Math.min(3, pile.length);
            const first = pile.length - shown;
            body = pile.slice(first).map((card, k) => CardView.card(card, {
                cls: cardCls(first + k),
                attrs: `data-idx="${first + k}"`,
                style: `left: calc(var(--cw) * ${(k * 0.3).toFixed(2)})`
            })).join('');
        } else {
            const i = pile.length - 1;
            body = CardView.card(pile[i], { cls: cardCls(i), attrs: `data-idx="${i}"` });
        }
        return `<div class="pile ${spec.kind}" data-pile="${spec.id}" style="height: calc(var(--cw) * ${height.toFixed(3)})${span}">${body}</div>`;
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
