registerLevel({
    id: 1,
    name: "Just Walk",
    // '#' earth (diggable), 'X' steel, '.' air, 'D' door, 'E' exit. Save at least `required` of `lemmings`.
    lemmings: 8,
    required: 6,
    skills: { blocker: 0, digger: 0, builder: 0, basher: 0, bomber: 0 },
    map: [
        "####################",
        "#D.................#",
        "#..................#",
        "#.................E#",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################"
    ]
});
