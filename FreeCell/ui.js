/**
 * FreeCell: every card is dealt face up into eight columns. Each free cell
 * holds one card; the columns build down in alternating colours and any card
 * can fill an empty column. A run moves as a whole only if it could be moved
 * one card at a time through the free cells and empty columns. Each level has
 * a fixed deal (seed) that has been checked to be solvable with its cells.
 */
const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
const cellIds = rules => Array.from({ length: rules.cells }, (_, i) => `c${i}`);

// Longest run that can move: (free cells + 1) doubled for each empty column not used as the target
function maxRun(rules, state, to) {
    const freeCells = cellIds(rules).filter(id => !state.piles[id].length).length;
    const emptyCols = TABLEAU.filter(id => id !== to && !state.piles[id].length).length;
    return (freeCells + 1) * 2 ** emptyCols;
}

SolitaireGame.init({
    cols: 8,
    seeded: true,
    foundations: FOUNDATIONS,

    layout(rules) {
        const cells = cellIds(rules).map(id => ({ id, kind: 'stack' }));
        const gaps = Array(4 - rules.cells).fill(null);
        return [
            [...cells, ...gaps, ...FOUNDATIONS.map(id => ({ id, kind: 'stack', mark: 'A' }))],
            TABLEAU.map(id => ({ id, kind: 'fan' }))
        ];
    },

    deal(rules, rand) {
        const deck = Cards.shuffle(Cards.deck(), rand);
        const piles = {};
        [...cellIds(rules), ...FOUNDATIONS, ...TABLEAU].forEach(id => { piles[id] = []; });
        deck.forEach((card, i) => {
            card.up = true;
            piles[TABLEAU[i % 8]].push(card);
        });
        return { piles };
    },

    canPick(rules, state, id, idx) {
        const pile = state.piles[id];
        if (id.startsWith('c')) return idx === pile.length - 1;
        return TABLEAU.includes(id) && Solitaire.isRun(pile.slice(idx));
    },

    canDrop(rules, state, cards, from, to) {
        const pile = state.piles[to];
        if (to.startsWith('c')) return cards.length === 1 && !pile.length;
        if (FOUNDATIONS.includes(to)) return Solitaire.fitsFoundation(pile, cards);
        if (TABLEAU.includes(to)) return cards.length <= maxRun(rules, state, to) && Solitaire.fitsTableau(pile, cards);
        return false;
    },

    result(rules, state) {
        const up = FOUNDATIONS.reduce((n, id) => n + state.piles[id].length, 0);
        return up === 52 ? { won: true, key: 'status_won', params: { n: state.moves } } : null;
    },

    info(rules, state) {
        return [`${i18n.t('cells')}: ${rules.cells}`];
    }
});
