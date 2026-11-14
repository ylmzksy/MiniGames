registerLevel({
    id: 4,
    name: "Three Jugs",
    jugs: [3, 5, 8],
    // The 8 L jug starts full and there is no tap: split the water by pouring only
    start: [0, 0, 8],
    noTap: true,
    target: 4,
    par: 6
});
