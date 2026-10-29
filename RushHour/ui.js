// Rush Hour: vehicles only move along their length; the red car must reach the right edge
SlidingGame.init({
    axisLocked: true,
    isWon: (puzzle, pieces) => {
        const main = pieces[puzzle.main];
        return main.c + main.w === puzzle.width;
    },
    exitHtml: (puzzle) => {
        const main = puzzle.pieces[puzzle.main];
        const top = (main.r / puzzle.height) * 100;
        const height = (main.h / puzzle.height) * 100;
        return `<div class="exit right" style="top:${top}%;height:${height}%"></div>`;
    }
});
