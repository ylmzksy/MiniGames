registerLevel({
    id: 8,
    name: "Neighbours",
    cols: 3,
    rows: 3,
    rule: "near",
    face: "number",
    par: 12,
    goal: [
         1,  2,  3,
         4,  5,  6,
         7,  8,  9
    ],
    start: [
         8,  5,  2,
         9,  1,  7,
         6,  3,  4
    ]
});
