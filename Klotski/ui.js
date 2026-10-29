// Klotski: pieces slide in any direction; the big block must reach the goal cell above the exit
SlidingGame.init({
    axisLocked: false,
    isWon: (puzzle, pieces, level) => {
        const main = pieces[puzzle.main];
        return main.r === level.goal[0] && main.c === level.goal[1];
    },
    exitHtml: (puzzle, level) => {
        const main = puzzle.pieces[puzzle.main];
        const left = (level.goal[1] / puzzle.width) * 100;
        const width = (main.w / puzzle.width) * 100;
        return `<div class="exit bottom" style="left:${left}%;width:${width}%"></div>`;
    }
});
