/**
 * Crazy Eights rules and AI. Players are 0 (you) and 1 (AI).
 * Play a card of the current suit or the same rank as the top discard. Eights
 * are wild: play one any time and name the next suit. If nothing fits you
 * draw one card at a time; with an empty stock you pass. Going out scores
 * the cards left in the other hand (eights 50, faces 10, ace 1, others face
 * value); if both players pass in a row, the smaller hand scores the
 * difference. With `actions`, a 2 makes the opponent draw two and a queen
 * skips them; either way you play again.
 * A level sets: handSize, target (points to win the match), actions.
 */
const CrazyEights = {
    makeRules(level) {
        return { handSize: level.handSize ?? 7, target: level.target, actions: !!level.actions };
    },

    value(card) {
        if (card.r === 8) return 50;
        return card.r >= 11 ? 10 : card.r;
    },

    handValue(hand) {
        return hand.reduce((sum, c) => sum + this.value(c), 0);
    },

    sortHand(hand) {
        hand.sort((a, b) => (a.r === 8) - (b.r === 8) || a.s - b.s || a.r - b.r);
    },

    newRound(rules, scores, starter) {
        const deck = Cards.shuffle(Cards.deck()).map(c => ({ ...c, up: true }));
        const hands = [deck.splice(0, rules.handSize), deck.splice(0, rules.handSize)];
        hands.forEach(h => this.sortHand(h));
        // The first discard is never an eight, so the opening suit is clear
        const idx = deck.findIndex(c => c.r !== 8);
        const first = deck.splice(idx, 1)[0];
        return {
            hands,
            stock: deck,
            discard: [first],
            suit: first.s,
            scores: [...scores],
            turn: starter,
            passes: 0,
            result: null
        };
    },

    top(state) {
        return state.discard[state.discard.length - 1];
    },

    fits(state, card) {
        return card.r === 8 || card.s === state.suit || card.r === this.top(state).r;
    },

    legal(state, player) {
        return state.hands[player].map((c, i) => i).filter(i => this.fits(state, state.hands[player][i]));
    },

    // Cards left to draw: the stock, or the discards under the top that get reshuffled into it
    canRefill(state) {
        return state.stock.length > 0 || state.discard.length > 1;
    },

    canDraw(state, player) {
        return !this.legal(state, player).length && this.canRefill(state);
    },

    mustPass(state, player) {
        return !this.legal(state, player).length && !this.canRefill(state);
    },

    // Plays card idx (suit: the suit named for an eight). Returns 'draw2' | 'skip' | null for the action shown
    play(rules, state, player, idx, suit) {
        const card = state.hands[player].splice(idx, 1)[0];
        state.discard.push(card);
        state.suit = card.r === 8 ? suit : card.s;
        state.passes = 0;
        if (!state.hands[player].length) {
            this.endRound(rules, state, player);
            return null;
        }
        let action = null;
        if (rules.actions && card.r === 2) {
            const opp = state.hands[1 - player];
            for (let k = 0; k < 2; k++) {
                const c = this.drawCard(state);
                if (c) opp.push(c);
            }
            this.sortHand(opp);
            action = 'draw2';
        } else if (rules.actions && card.r === 12) {
            action = 'skip';
        }
        if (!action) state.turn = 1 - player;
        return action;
    },

    // Takes the top of the stock; when it runs out, the discards (except the top) are reshuffled
    drawCard(state) {
        if (!state.stock.length && state.discard.length > 1) {
            const top = state.discard.pop();
            state.stock = Cards.shuffle(state.discard);
            state.discard = [top];
        }
        return state.stock.pop() || null;
    },

    draw(state, player) {
        const card = this.drawCard(state);
        if (card) {
            state.hands[player].push(card);
            this.sortHand(state.hands[player]);
        }
        return card;
    },

    pass(rules, state, player) {
        state.passes++;
        if (state.passes >= 2) this.endRound(rules, state, null);
        else state.turn = 1 - player;
    },

    endRound(rules, state, outPlayer) {
        const values = state.hands.map(h => this.handValue(h));
        let winner;
        let points;
        let kind;
        if (outPlayer !== null) {
            winner = outPlayer;
            points = values[1 - outPlayer];
            kind = 'out';
        } else if (values[0] === values[1]) {
            state.result = { kind: 'tie', winner: null, points: 0 };
            return;
        } else {
            winner = values[0] < values[1] ? 0 : 1;
            points = Math.abs(values[0] - values[1]);
            kind = 'blocked';
        }
        state.scores[winner] += points;
        state.result = { kind: state.scores[winner] >= rules.target ? 'target' : kind, winner, points };
    },

    /* ---------- AI ---------- */

    // Suit the player holds most of (eights don't count)
    bestSuit(hand) {
        const counts = [0, 0, 0, 0];
        hand.forEach(c => { if (c.r !== 8) counts[c.s] += 1 + this.value(c) / 100; });
        return counts.indexOf(Math.max(...counts));
    },

    // Returns { type: 'play', idx, suit } | { type: 'draw' } | { type: 'pass' }
    aiAction(rules, state, player, difficulty) {
        const hand = state.hands[player];
        const legal = this.legal(state, player);
        if (!legal.length) return this.canRefill(state) ? { type: 'draw' } : { type: 'pass' };
        if (difficulty !== 'master') {
            const idx = legal[Math.floor(Math.random() * legal.length)];
            return { type: 'play', idx, suit: this.bestSuit(hand.filter((_, i) => i !== idx)) };
        }
        const scored = legal.map(idx => ({ idx, value: this.evaluate(rules, state, player, idx) }));
        scored.sort((a, b) => b.value - a.value);
        const idx = scored[0].idx;
        return { type: 'play', idx, suit: this.bestSuit(hand.filter((_, i) => i !== idx)) };
    },

    /**
     * Master heuristic: keep eights for emergencies, shed high cards, switch
     * to suits it can keep following, and use action cards to chain plays.
     */
    evaluate(rules, state, player, idx) {
        const hand = state.hands[player];
        const card = hand[idx];
        const rest = hand.filter((_, i) => i !== idx);
        if (!rest.length) return 1000;
        const oppCount = state.hands[1 - player].length;
        let value = this.value(card) * 0.1;

        if (card.r === 8) {
            // An eight is worth holding unless the opponent is about to go out
            value -= oppCount <= 2 ? 0 : 8;
            return value + rest.filter(c => c.s === this.bestSuit(rest)).length;
        }
        // Follow-ups: cards I could play next on this card
        value += rest.filter(c => c.r !== 8 && (c.s === card.s || c.r === card.r)).length * 1.5;
        // Switching to my long suit is good
        value += rest.filter(c => c.s === card.s).length * 0.8;
        if (rules.actions && (card.r === 2 || card.r === 12)) {
            const followUps = rest.filter(c => this.fits({ suit: card.s, discard: [card] }, c)).length;
            value += followUps ? 4 : 1;
            if (card.r === 2) value += oppCount <= 3 ? 3 : 1;
        }
        return value;
    }
};
