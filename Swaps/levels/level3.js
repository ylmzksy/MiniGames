registerLevel({
    id: 3,
    name: "Snake",
    cols: 4,
    rows: 3,
    rule: "any",
    face: "number",
    par: 9,
    goal: [
         1,  2,  3,  4,
         8,  7,  6,  5,
         9, 10, 11, 12
    ],
    start: [
         5,  1,  4,  9,
        12, 10,  7,  2,
         6,  8, 11,  3
    ]
});
