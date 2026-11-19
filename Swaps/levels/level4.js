registerLevel({
    id: 4,
    name: "Suits",
    cols: 4,
    rows: 4,
    rule: "any",
    face: "suit",
    par: 12,
    goal: [
         1,  5,  9, 13,
         2,  6, 10, 14,
         3,  7, 11, 15,
         4,  8, 12, 16
    ],
    start: [
        16,  9,  2,  8,
         5, 14, 11, 10,
        13,  4,  3, 15,
        12,  1,  7,  6
    ]
});
