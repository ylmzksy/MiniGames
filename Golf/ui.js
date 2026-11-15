/**
 * Golf: seven columns of five face-up cards. The bottom card of a column can
 * go onto the waste if it is one rank higher or lower than the waste card;
 * suits don't matter. With `wrap`, kings and aces connect. A tap on the stock
 * turns a new waste card. The game ends when the columns are empty or no card
 * fits and the stock is used up; the level is won with at most `goal` cards left.
 */
const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

const cardsLeft = state => TABLEAU.reduce((n, id) => n + state.piles[id].length, 0);

function fitsWaste(rules, state, card) {
    const top = Solitaire.top(state.piles.waste);
    const diff = Math.abs(card.r - top.r);
    return diff === 1 || (rules.wrap && diff === 12);
}

const canPlayAny = (rules, state) => TABLEAU.some(id => {
    const card = Solitaire.top(state.piles[id]);
    return card && fitsWaste(rules, state, card);
});

SolitaireGame.init({
    cols: 7,

    layout() {
        return [
            TABLEAU.map(id => ({ id, kind: 'fan' })),
            [{ id: 'stock', kind: 'stack' }, { id: 'waste', kind: 'stack' }, null, null, null, null, null]
        ];
    },

    deal(rules, rand) {
        const deck = Cards.shuffle(Cards.deck(), rand);
        const piles = {};
        TABLEAU.forEach(id => {
            piles[id] = deck.splice(0, 5);
            piles[id].forEach(c => { c.up = true; });
        });
        const first = deck.pop();
        first.up = true;
        piles.waste = [first];
        piles.stock = deck;
        return { piles };
    },

    canPick(rules, state, id, idx) {
        return TABLEAU.includes(id) && idx === state.piles[id].length - 1;
    },

    canDrop(rules, state, cards, from, to) {
        return to === 'waste' && cards.length === 1 && fitsWaste(rules, state, cards[0]);
    },

    stock(rules, state) {
        const card = state.piles.stock.pop();
        if (!card) return false;
        card.up = true;
        state.piles.waste.push(card);
        return true;
    },

    result(rules, state) {
        const left = cardsLeft(state);
        if (!left) return { won: true, key: 'status_cleared' };
        if (state.piles.stock.length || canPlayAny(rules, state)) return null;
        if (left <= rules.goal) return { won: true, key: 'status_golf_won', params: { n: left } };
        return { won: false, key: 'status_golf_lost', params: { n: left, goal: rules.goal } };
    },

    info(rules, state) {
        return [
            `${i18n.t('left')}: ${cardsLeft(state)}`,
            `${i18n.t('goal_short')}: ≤ ${rules.goal}`,
            `${i18n.t('stock')}: ${state.piles.stock.length}`
        ];
    }
});
