registerLevel({
    id: 1,
    name: "Little Cages",
    // solution: the solved grid (one string per row). cages: one character per cell; cells with the
    // same character form a cage, whose sum is computed from the solution. Size 6 uses 2x3 boxes,
    // size 9 uses 3x3 boxes. Generated and checked: exactly one solution, solvable by logic alone.
    solution: [
        "564312",
        "123465",
        "635241",
        "241536",
        "312654",
        "456123"
    ],
    cages: [
        "abbccd",
        "aefffd",
        "eegggd",
        "hhiijd",
        "kllijm",
        "knnooo"
    ]
});
