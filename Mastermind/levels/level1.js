// A random code is drawn each game; the level sets the code length, the number
// of colors (max 8), whether a color may repeat, and the number of guesses.
registerLevel({
    id: 1,
    name: "Warm-up",
    length: 3,
    colors: 4,
    duplicates: false,
    attempts: 8
});
