registerLevel({
    id: 1,
    name: "Four Colors",
    // seed fixes the board; `moves` is the limit, set to a greedy solver's count plus three
    seed: 11,
    size: 8,
    colors: 4,
    moves: 14
});
