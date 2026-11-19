registerLevel({
    id: 10,
    name: "Mosaic",
    cols: 4,
    rows: 3,
    rule: "near",
    face: "picture",
    picture: "boat",
    par: 16,
    goal: [
         1,  2,  3,  4,
         5,  6,  7,  8,
         9, 10, 11, 12
    ],
    start: [
         4,  2,  1,  6,
        12,  9,  8, 11,
         3,  5,  7, 10
    ]
});
