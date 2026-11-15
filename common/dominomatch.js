/**
 * Shared two-player domino match against the AI (Dominoes, All Fives, Matador).
 * A game passes its rules to DominoMatchGame.init():
 *   joins(tile, endValue, rules)  outer halves the tile can show when added at an end with that value
 *   isSpecial(tile, rules)        tiles the AI prefers to keep (Matador's matadors)
 *   scorePlay(line, rules)        points scored by the play that made this line (All Fives)
 *   roundTo                       round-end points are rounded to this (5 in All Fives)
 *   optionalDraw                  a player whose only plays are special tiles may draw instead
 * A level sets: maxPip, handSize, target (points to win the match), draw (false: block game).
 * Players are 0 (you) and 1 (AI).
 */
const DominoMatch = {
    makeRules(config, level) {
        return {
            ...config,
            maxPip: level.maxPip ?? 6,
            handSize: level.handSize ?? 7,
            target: level.target,
            draw: level.draw !== false
        };
    },

    // The highest double, or else the heaviest tile, opens the first round
    findLead(hands) {
        let best = null;
        hands.forEach((hand, player) => hand.forEach(t => {
            const rank = (Dominoes.isDouble(t) ? 100 : 0) + Dominoes.pips(t);
            if (!best || rank > best.rank) best = { player, tile: t, rank };
        }));
        return best;
    },

    newRound(rules, scores, leader) {
        const tiles = Dominoes.shuffle(Dominoes.set(rules.maxPip));
        const hands = [tiles.slice(0, rules.handSize), tiles.slice(rules.handSize, rules.handSize * 2)];
        const state = {
            line: Dominoes.emptyLine(),
            hands,
            boneyard: tiles.slice(rules.handSize * 2),
            scores: [...scores],
            turn: leader,
            lead: null,
            passes: 0,
            result: null
        };
        if (leader === null) {
            const lead = this.findLead(hands);
            state.turn = lead.player;
            state.lead = lead.tile;
        }
        return state;
    },

    // Every way to add `tile` to the line: [{ end, outer }]
    placements(rules, line, tile) {
        const ends = Dominoes.ends(line);
        if (!ends) return [{ end: 'right', outer: tile[1] }];
        const out = [];
        const sides = line.tiles.length === 1 && ends.left === ends.right ? ['right'] : ['left', 'right'];
        sides.forEach(end => {
            [...new Set(rules.joins(tile, ends[end], rules))].forEach(outer => out.push({ end, outer }));
        });
        return out;
    },

    legalMoves(rules, state, player) {
        const moves = [];
        state.hands[player].forEach((tile, idx) => {
            if (state.lead && !Dominoes.same(tile, state.lead)) return;
            this.placements(rules, state.line, tile).forEach(p => moves.push({ idx, ...p }));
        });
        return moves;
    },

    canDraw(rules, state, player) {
        if (!rules.draw || !state.boneyard.length) return false;
        const moves = this.legalMoves(rules, state, player);
        if (!moves.length) return true;
        return !!rules.optionalDraw && moves.every(m => rules.isSpecial(state.hands[player][m.idx], rules));
    },

    mustPass(rules, state, player) {
        return !this.legalMoves(rules, state, player).length && !this.canDraw(rules, state, player);
    },

    // Plays a move; returns the points it scored
    play(rules, state, player, move) {
        const tile = state.hands[player][move.idx];
        state.hands[player] = state.hands[player].filter((_, i) => i !== move.idx);
        state.line = Dominoes.place(state.line, tile, move.end, move.outer);
        state.line.lastIdx = move.end === 'left' ? 0 : state.line.tiles.length - 1;
        state.lead = null;
        state.passes = 0;
        const points = rules.scorePlay ? rules.scorePlay(state.line, rules) : 0;
        state.scores[player] += points;
        if (state.scores[player] >= rules.target) {
            state.result = { kind: 'target', winner: player, points: 0 };
        } else if (!state.hands[player].length) {
            this.endRound(rules, state, player);
        } else {
            state.turn = 1 - player;
        }
        return points;
    },

    draw(state, player) {
        const tile = state.boneyard.pop();
        state.hands[player].push(tile);
        return tile;
    },

    pass(rules, state, player) {
        state.passes++;
        if (state.passes >= 2) this.endRound(rules, state, null);
        else state.turn = 1 - player;
    },

    round(rules, points) {
        const step = rules.roundTo || 1;
        return Math.round(points / step) * step;
    },

    // Out of tiles: the winner scores the opponent's pips. Blocked: the lighter hand scores the difference
    endRound(rules, state, outPlayer) {
        const pips = state.hands.map(h => Dominoes.handPips(h));
        let winner;
        let points;
        let kind;
        if (outPlayer !== null) {
            winner = outPlayer;
            points = this.round(rules, pips[1 - outPlayer]);
            kind = 'domino';
        } else if (pips[0] === pips[1]) {
            state.result = { kind: 'tie', winner: null, points: 0 };
            return;
        } else {
            winner = pips[0] < pips[1] ? 0 : 1;
            points = this.round(rules, Math.abs(pips[0] - pips[1]));
            kind = 'blocked';
        }
        state.scores[winner] += points;
        const reached = state.scores[winner] >= rules.target;
        state.result = { kind: reached ? 'target' : kind, winner, points };
    },

    /* ---------- AI ---------- */

    // Returns { type: 'play', move } | { type: 'draw' } | { type: 'pass' }
    aiAction(rules, state, player, difficulty) {
        const moves = this.legalMoves(rules, state, player);
        const canDraw = this.canDraw(rules, state, player);
        if (!moves.length) return canDraw ? { type: 'draw' } : { type: 'pass' };
        if (difficulty !== 'master') {
            return { type: 'play', move: moves[Math.floor(Math.random() * moves.length)] };
        }
        // Master always plays when it can: drawing to save a special tile adds pips,
        // which costs more in blocked rounds than the tile is worth (tested in self-play)
        const scored = moves.map(move => ({ move, value: this.evaluate(rules, state, player, move) }));
        scored.sort((a, b) => b.value - a.value);
        return { type: 'play', move: scored[0].move };
    },

    /**
     * Master heuristic: points now, minus what the opponent could score next,
     * plus shedding heavy tiles, keeping own follow-up plays and leaving ends
     * the opponent is unlikely to match. Unknown tiles are those not in the
     * AI's hand or on the line (the opponent's hand and the boneyard).
     */
    evaluate(rules, state, player, move) {
        const hand = state.hands[player];
        const tile = hand[move.idx];
        const rest = hand.filter((_, i) => i !== move.idx);
        if (!rest.length) return 1000;
        const line = Dominoes.place(state.line, tile, move.end, move.outer);
        const points = rules.scorePlay ? rules.scorePlay(line, rules) : 0;
        if (state.scores[player] + points >= rules.target) return 1000;

        const unknown = Dominoes.without(Dominoes.set(rules.maxPip), hand, state.line.tiles);
        const oppSize = state.hands[1 - player].length;
        let fitting = 0;
        let bestOpp = 0;
        let sumOpp = 0;
        unknown.forEach(t => {
            const options = this.placements(rules, line, t);
            if (!options.length) return;
            fitting++;
            if (rules.scorePlay) {
                const best = Math.max(...options.map(o => rules.scorePlay(Dominoes.place(line, t, o.end, o.outer), rules)));
                bestOpp = Math.max(bestOpp, best);
                sumOpp += best;
            }
        });
        const share = unknown.length ? fitting / unknown.length : 0;
        const oppCanPlay = 1 - Math.pow(1 - share, oppSize);
        const oppThreat = unknown.length ? Math.min(bestOpp, (sumOpp / unknown.length) * oppSize) : 0;
        const followUps = rest.filter(t => this.placements(rules, line, t).length).length;
        const special = rules.isSpecial && rules.isSpecial(tile, rules) ? 6 : 0;

        return points * 1.2
            - oppThreat * 0.6
            + Dominoes.pips(tile) * 0.25
            + followUps * 1.0
            - oppCanPlay * 4
            + (Dominoes.isDouble(tile) ? 1.5 : 0)
            - special;
    }
};

/**
 * Page controller for the match games. Expects these elements: #status,
 * #level-info, #scoreboard, #ai-hand, #game-board, #player-hand,
 * #drawBtn, #passBtn, #flipBtn, #nextRoundBtn, #restartBtn, #difficulty.
 */
const DominoMatchGame = {
    AI_DELAY: 700,

    init(config) {
        this.config = config;
        this.el = id => document.getElementById(id);
        this.gameId = 0;
        this.statusKey = '';
        this.statusParams = {};

        this.el('restartBtn').onclick = () => this.loadLevel(this.levelIdx);
        this.el('drawBtn').onclick = () => this.humanDraw();
        this.el('passBtn').onclick = () => this.humanPass();
        this.el('flipBtn').onclick = () => { this.flip++; this.render(); };
        this.el('nextRoundBtn').onclick = () => this.startRound();

        this.el('player-hand').addEventListener('click', (event) => {
            const tile = event.target.closest('.domino');
            if (tile) this.selectTile(Number(tile.dataset.idx));
        });
        this.el('game-board').addEventListener('click', (event) => {
            const ghost = event.target.closest('[data-end]');
            if (ghost) this.playSelected(ghost.dataset.end);
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
        this.rules = DominoMatch.makeRules(this.config, level);
        this.scores = [0, 0];
        this.leader = null;
        this.matchOver = false;
        this.updateLevelInfo();
        this.startRound();
    },

    startRound() {
        this.gameId++;
        this.state = DominoMatch.newRound(this.rules, this.scores, this.leader);
        this.selected = null;
        this.flip = 0;
        if (this.state.turn === 0) {
            this.setHumanTurnStatus(this.state.lead ? 'status_you_lead' : 'status_your_turn');
        } else {
            this.setStatus('status_ai_turn');
        }
        this.render();
        if (this.state.turn === 1) this.scheduleAi();
    },

    isHumanTurn() {
        return this.state && !this.state.result && this.state.turn === 0;
    },

    /* ---------- Human ---------- */

    selectTile(idx) {
        if (!this.isHumanTurn()) return;
        const moves = DominoMatch.legalMoves(this.rules, this.state, 0).filter(m => m.idx === idx);
        if (!moves.length) {
            this.selected = null;
            this.setStatus(this.state.lead ? 'status_must_lead' : 'status_no_fit');
            this.render();
            return;
        }
        if (moves.length === 1) {
            this.humanPlay(moves[0]);
            return;
        }
        this.selected = this.selected === idx ? null : idx;
        this.flip = 0;
        this.setStatus(this.selected === null ? 'status_your_turn' : 'status_pick_end');
        this.render();
    },

    // Outer halves the selected tile can show at an end, in flip order
    outersAt(end) {
        return DominoMatch.legalMoves(this.rules, this.state, 0)
            .filter(m => m.idx === this.selected && m.end === end)
            .map(m => m.outer);
    },

    playSelected(end) {
        if (!this.isHumanTurn() || this.selected === null) return;
        const outers = this.outersAt(end);
        if (!outers.length) return;
        this.humanPlay({ idx: this.selected, end, outer: outers[this.flip % outers.length] });
    },

    humanPlay(move) {
        const points = DominoMatch.play(this.rules, this.state, 0, move);
        this.selected = null;
        this.afterPlay(0, points);
    },

    humanDraw() {
        if (!this.isHumanTurn() || !DominoMatch.canDraw(this.rules, this.state, 0)) return;
        DominoMatch.draw(this.state, 0);
        this.selected = null;
        const canPlay = DominoMatch.legalMoves(this.rules, this.state, 0).length > 0;
        if (canPlay) this.setStatus('status_drew_play');
        else this.setHumanTurnStatus('status_drew_again');
        this.render();
    },

    humanPass() {
        if (!this.isHumanTurn() || !DominoMatch.mustPass(this.rules, this.state, 0)) return;
        DominoMatch.pass(this.rules, this.state, 0);
        this.selected = null;
        if (this.state.result) { this.finishRound(); return; }
        this.setStatus('status_you_passed');
        this.render();
        this.scheduleAi();
    },

    /* ---------- AI ---------- */

    scheduleAi() {
        const id = this.gameId;
        setTimeout(() => this.aiStep(id), this.AI_DELAY);
    },

    // One AI action per step, so draws are visible one tile at a time
    aiStep(id) {
        if (id !== this.gameId || !this.state || this.state.result || this.state.turn !== 1) return;
        const difficulty = this.el('difficulty').value;
        const action = DominoMatch.aiAction(this.rules, this.state, 1, difficulty);
        if (action.type === 'draw') {
            DominoMatch.draw(this.state, 1);
            this.setStatus('status_ai_draws');
            this.render();
            setTimeout(() => this.aiStep(id), this.AI_DELAY / 2);
            return;
        }
        if (action.type === 'pass') {
            DominoMatch.pass(this.rules, this.state, 1);
            if (this.state.result) { this.finishRound(); return; }
            this.setHumanTurnStatus('status_ai_passed');
            this.render();
            return;
        }
        const points = DominoMatch.play(this.rules, this.state, 1, action.move);
        this.afterPlay(1, points);
    },

    afterPlay(player, points) {
        if (this.state.result) { this.finishRound(); return; }
        if (player === 0) {
            this.setStatus(points ? 'status_you_scored' : 'status_ai_turn', { n: points });
            this.render();
            this.scheduleAi();
        } else {
            this.setHumanTurnStatus(points ? 'status_ai_scored' : 'status_your_turn', { n: points });
            this.render();
        }
    },

    // When nothing in your hand fits, say whether to draw or pass
    setHumanTurnStatus(key, params = {}) {
        if (!DominoMatch.legalMoves(this.rules, this.state, 0).length) {
            key = DominoMatch.canDraw(this.rules, this.state, 0) ? 'status_must_draw' : 'status_must_pass';
        }
        this.setStatus(key, params);
    },

    /* ---------- Round and match end ---------- */

    finishRound() {
        const result = this.state.result;
        this.scores = [...this.state.scores];
        if (result.winner !== null) this.leader = result.winner;
        const params = { n: result.points };
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
            this.setStatus(`round_${result.kind}_${who}`, params);
        }
        this.render();
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
        const roundOver = !!state.result;
        const humanTurn = this.isHumanTurn();
        const legal = humanTurn ? DominoMatch.legalMoves(this.rules, state, 0) : [];

        // Opponent's hand: backs during play, faces once the round is over
        this.el('ai-hand').innerHTML = state.hands[1]
            .map(t => DominoView.tile(t, { back: !roundOver }))
            .join('');

        // Line of play with targets for the selected tile
        const ghosts = {};
        if (humanTurn && this.selected !== null) {
            const tile = state.hands[0][this.selected];
            ['left', 'right'].forEach(end => {
                const outers = this.outersAt(end);
                if (!outers.length) return;
                const outer = outers[this.flip % outers.length];
                const inner = outer === tile[0] ? tile[1] : tile[0];
                const shown = end === 'left' ? [outer, inner] : [inner, outer];
                ghosts[end] = state.line.tiles.length
                    ? DominoView.tile(shown, { horizontal: !Dominoes.isDouble(tile), cls: 'ghost', attrs: `data-end="${end}"` })
                    : `<span class="ghost-empty" data-end="${end}">${i18n.t('place_here')}</span>`;
            });
        }
        this.el('game-board').innerHTML = DominoView.line(state.line, ghosts);

        // Your hand
        const playable = new Set(legal.map(m => m.idx));
        this.el('player-hand').innerHTML = state.hands[0].map((t, idx) => {
            const classes = [playable.has(idx) ? 'playable' : (humanTurn ? 'dim' : ''), this.selected === idx ? 'selected' : ''];
            return DominoView.tile(t, { cls: classes.join(' '), attrs: `data-idx="${idx}"` });
        }).join('');

        // Buttons
        const selectedOuters = this.selected === null ? [] : ['left', 'right'].map(end => this.outersAt(end).length);
        this.el('drawBtn').hidden = !this.rules.draw;
        this.el('drawBtn').disabled = !humanTurn || !DominoMatch.canDraw(this.rules, state, 0);
        this.el('passBtn').disabled = !humanTurn || !DominoMatch.mustPass(this.rules, state, 0);
        this.el('flipBtn').hidden = !selectedOuters.some(n => n > 1);
        this.el('nextRoundBtn').hidden = !roundOver || this.matchOver;

        this.el('scoreboard').innerHTML = `
            <span><strong>${i18n.t('you')}</strong> ${state.scores[0]}</span>
            <span><strong>${i18n.t('ai')}</strong> ${state.scores[1]}</span>
            <span>${i18n.t('target')}: ${this.rules.target}</span>
            ${this.rules.draw ? `<span>${i18n.t('boneyard')}: ${state.boneyard.length}</span>` : ''}
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
