/**
 * Klondike: build four foundations up by suit from ace to king. The seven
 * tableau columns build down in alternating colours, and only a king (or a
 * run starting with one) fills an empty column. A tap on the stock turns over
 * `draw` cards; an empty stock can be refilled from the waste `redeals` times
 * (-1: no limit).
 */
const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

const passesLeft = (rules, state) => (rules.redeals < 0 ? Infinity : rules.redeals - state.redealsUsed);

SolitaireGame.init({
    cols: 7,
    foundations: FOUNDATIONS,
    flip: TABLEAU,

    layout(rules) {
        const waste = rules.draw > 1 ? [{ id: 'waste', kind: 'spread', span: 2 }] : [{ id: 'waste', kind: 'stack' }, null];
        return [
            [{ id: 'stock', kind: 'stack', mark: '↺' }, ...waste, ...FOUNDATIONS.map(id => ({ id, kind: 'stack', mark: 'A' }))],
            TABLEAU.map(id => ({ id, kind: 'fan', mark: 'K' }))
        ];
    },

    deal(rules, rand) {
        const deck = Cards.shuffle(Cards.deck(), rand);
        const piles = { stock: [], waste: [] };
        FOUNDATIONS.forEach(id => { piles[id] = []; });
        TABLEAU.forEach((id, col) => {
            piles[id] = deck.splice(0, col + 1);
            piles[id][col].up = true;
        });
        piles.stock = deck;
        return { piles, redealsUsed: 0 };
    },

    canPick(rules, state, id, idx) {
        const pile = state.piles[id];
        if (id === 'waste' || FOUNDATIONS.includes(id)) return idx === pile.length - 1;
        return TABLEAU.includes(id) && Solitaire.isRun(pile.slice(idx));
    },

    canDrop(rules, state, cards, from, to) {
        const pile = state.piles[to];
        if (FOUNDATIONS.includes(to)) return Solitaire.fitsFoundation(pile, cards);
        if (TABLEAU.includes(to)) return Solitaire.fitsTableau(pile, cards, 13);
        return false;
    },

    stock(rules, state) {
        const { stock, waste } = state.piles;
        if (stock.length) {
            const n = Math.min(rules.draw, stock.length);
            stock.splice(-n).reverse().forEach(c => { c.up = true; waste.push(c); });
            return true;
        }
        if (!waste.length || passesLeft(rules, state) <= 0) return false;
        state.piles.stock = waste.reverse().map(c => ({ ...c, up: false }));
        state.piles.waste = [];
        state.redealsUsed++;
        return true;
    },

    result(rules, state) {
        const up = FOUNDATIONS.reduce((n, id) => n + state.piles[id].length, 0);
        return up === 52 ? { won: true, key: 'status_won', params: { n: state.moves } } : null;
    },

    info(rules, state) {
        const left = passesLeft(rules, state);
        return [
            `${i18n.t('stock')}: ${state.piles.stock.length}`,
            `${i18n.t('redeals')}: ${left === Infinity ? '∞' : left}`
        ];
    }
});
