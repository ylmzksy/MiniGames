// levels/level1.js
registerLevel({
    id: 1,
    name: "The Cross",
    size: 3, // 3x3 grid
    // Initial state: true = On, false = Off
    initial: [
        [false, true, false],
        [true,  true, true],
        [false, true, false]
    ]
});