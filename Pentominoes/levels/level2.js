registerLevel({
    id: 2,
    name: "Four Pieces",
    region: ["#####", "#####", "#####", "#####"],
    pieces: ["L", "P", "V", "Z"],
    solution: [
        { piece: "V", cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
        { piece: "L", cells: [[0, 3], [0, 4], [1, 4], [2, 4], [3, 4]] },
        { piece: "Z", cells: [[1, 1], [1, 2], [2, 1], [3, 0], [3, 1]] },
        { piece: "P", cells: [[1, 3], [2, 2], [2, 3], [3, 2], [3, 3]] }
    ]
});
