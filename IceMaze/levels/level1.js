registerLevel({
    id: 1,
    name: "First Slide",
    // '#' wall, '.' ice, ':' rough ground (stops you), '*' gem, 'S' start, 'X' exit; par = shortest solution found by BFS
    par: 4,
    map: [
        "#....#",
        ".:.X:#",
        "..:...",
        ".#...#",
        "......",
        ":S...."
    ]
});
