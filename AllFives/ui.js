// All Fives: tiles match like in Dominoes, and a play scores when the open ends add up to a multiple of five
const matchJoins = (tile, end) => {
    const outers = [];
    if (tile[0] === end) outers.push(tile[1]);
    if (tile[1] === end) outers.push(tile[0]);
    return outers;
};

// Sum of the open ends; a double at an end counts both halves
function endCount(line) {
    const tiles = line.tiles;
    if (tiles.length === 1) return Dominoes.pips(tiles[0]);
    const first = tiles[0];
    const last = tiles[tiles.length - 1];
    return (Dominoes.isDouble(first) ? 2 * first[0] : first[0]) + (Dominoes.isDouble(last) ? 2 * last[1] : last[1]);
}

DominoMatchGame.init({
    joins: matchJoins,
    scorePlay: (line) => {
        const count = endCount(line);
        return count > 0 && count % 5 === 0 ? count : 0;
    },
    roundTo: 5
});
