registerLevel({
    id: 1,
    name: "First Turn",
    // mode: 'quarter' (90° turns, target par turns away) or 'free' (drag, solved within tolerance degrees)
    // seed fixes the stars and the target; colored: tell stars apart by colour; lines: join them into a constellation
    mode: "quarter",
    seed: 7930,
    stars: 4,
    colored: true,
    lines: false,
    par: 1
});
