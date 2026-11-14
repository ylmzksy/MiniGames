registerLevel({
    id: 1,
    name: "Random Opponent",
    // strength of the Master AI: random, one, two (plies of lookahead) or perfect;
    // mistake = chance of a random move; drawSolves = a draw clears the level
    strength: "random",
    mistake: 0,
    drawSolves: false
});
