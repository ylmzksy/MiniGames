registerLevel({
    id: 1,
    name: "Swap Meet",
    // layout: a ring arrangement from RingsEngine.LAYOUTS. target / start: one token per bead, in the
    // engine's bead order (ring by ring, slot by slot clockwise from the right, shared beads counted
    // once): a colour letter (R G B Y P O) or a bead number. The start is the target scrambled by
    // random ring turns; par is the fewest turns, found by an exhaustive (bidirectional) search.
    layout: "twin8",
    par: 2,
    target: "R Y R R R R R Y B B B B B B",
    start: "B R R R R R B R B B Y Y B B"
});
