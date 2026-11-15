// Dominoes (Draw and Block): a tile fits where one of its halves matches the open end
DominoMatchGame.init({
    joins: (tile, end) => {
        const outers = [];
        if (tile[0] === end) outers.push(tile[1]);
        if (tile[1] === end) outers.push(tile[0]);
        return outers;
    }
});
