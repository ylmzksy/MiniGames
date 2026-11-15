// One echo can open both doors, one after the other, if you wait for it
registerLevel({
    id: 2,
    name: "Wait for It",
    echoes: 1,
    map: [
        "###########",
        "#X B  A  @#",
        "######## ##",
        "#a      b #",
        "###########"
    ]
});
