registerLevel({
    id: 1,
    name: "First Links",
    // grid: one string per row, cells separated by spaces: a number is given, "." is empty,
    // "#" is a hole that is not part of the board. diagonal: true lets the chain step
    // diagonally too (8 neighbours), false only up/down/left/right. Generated and checked:
    // exactly one solution.
    diagonal: false,
    grid: [
        " .  .  .  6  7",
        " .  1  .  .  .",
        " .  . 13 10  9",
        " .  . 20 21  .",
        "17  . 25  . 23"
    ]
});
