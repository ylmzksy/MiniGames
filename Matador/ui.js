/**
 * Matador: a tile joins an end when the touching halves add up to seven
 * (one more than the highest face, so ten in a double-nine set). A blank
 * end can't be made up to seven, so only a matador closes it. The matadors
 * are the tiles whose halves add up to seven, plus the double blank; they
 * can be played on any end, either way round.
 */
const isMatador = (tile, rules) => Dominoes.pips(tile) === rules.maxPip + 1 || (tile[0] === 0 && tile[1] === 0);

DominoMatchGame.init({
    joins: (tile, end, rules) => {
        if (isMatador(tile, rules)) return [tile[0], tile[1]];
        const sum = rules.maxPip + 1;
        const outers = [];
        if (tile[0] + end === sum) outers.push(tile[1]);
        if (tile[1] + end === sum) outers.push(tile[0]);
        return outers;
    },
    isSpecial: isMatador,
    optionalDraw: true
});
