registerLevel({
    id: 1,
    name: "First Flip",
    // 'S' source (beam goes right), 'T' target, '#' wall, 'B' bomb, '/' and '\\' mirrors; fixed lists mirrors that cannot be flipped
    map: [
        "..B..#",
        "../.\\#",
        "S....\\",
        ".#T..\\",
        "......",
        "...\\.."
    ],
    fixed: []
});
