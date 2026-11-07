registerLevel({
    id: 1,
    name: "One Cat",
    // '#' wall, 'B' pushable block, '.' floor, 'M' you, 'C' cat; seed drives the cats' random wandering
    seed: 1,
    map: [
        "###########",
        "#B..B....B#",
        "#B...B..B.#",
        "#.BB...B.B#",
        "#B...M..BB#",
        "#......BB.#",
        "#.....B...#",
        "#..BB.BB.C#",
        "###########"
    ]
});
