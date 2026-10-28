/**
 * Black Box rules. Atoms hide in a size x size grid; rays are fired from ports
 * on the edges and come back as one of:
 *   hit      the ray ran straight into an atom
 *   reflect  the ray came back out of the port it entered
 *   exit     the ray left through another port
 * A ray turns 90° away from an atom that lies diagonally ahead of it, and is
 * reversed when atoms lie on both diagonals. A turn right at the entry counts
 * as a reflection.
 */
const BlackBoxEngine = {
    sides: ['top', 'right', 'bottom', 'left'],

    portKey(port) {
        return `${port.side}:${port.index}`;
    },

    // Starting position (just outside the grid) and travel direction of a port's ray
    portStart(size, port) {
        switch (port.side) {
            case 'top': return { pos: [-1, port.index], dir: [1, 0] };
            case 'bottom': return { pos: [size, port.index], dir: [-1, 0] };
            case 'left': return { pos: [port.index, -1], dir: [0, 1] };
            case 'right': return { pos: [port.index, size], dir: [0, -1] };
        }
    },

    // The port at a position just outside the grid, or null if the position is inside
    portAt(size, [r, c]) {
        if (r === -1) return { side: 'top', index: c };
        if (r === size) return { side: 'bottom', index: c };
        if (c === -1) return { side: 'left', index: r };
        if (c === size) return { side: 'right', index: r };
        return null;
    },

    atomSet(atoms) {
        return new Set(atoms.map(([r, c]) => `${r},${c}`));
    },

    traceRay(size, atomSet, port) {
        const has = (r, c) => atomSet.has(`${r},${c}`);
        const start = this.portStart(size, port);
        let [r, c] = start.pos;
        let [dr, dc] = start.dir;
        let entered = false;

        for (let steps = 0; steps < size * size * 4; steps++) {
            const ar = r + dr;
            const ac = c + dc;
            if (has(ar, ac)) return { type: 'hit' };

            // Cells diagonally ahead, on both sides of the next cell
            const left = has(ar + dc, ac + dr);
            const right = has(ar - dc, ac - dr);
            if (left || right) {
                if (!entered) return { type: 'reflect' };
                if (left && right) {
                    [dr, dc] = [-dr, -dc];
                } else {
                    // Turn away from the atom and look again from the same cell
                    [dr, dc] = left ? [-dc, -dr] : [dc, dr];
                    continue;
                }
            }

            r += dr;
            c += dc;
            const exitPort = this.portAt(size, [r, c]);
            if (exitPort) {
                const sameAsEntry = exitPort.side === port.side && exitPort.index === port.index;
                return sameAsEntry ? { type: 'reflect' } : { type: 'exit', port: exitPort };
            }
            entered = true;
        }
        return { type: 'reflect' };
    },

    allPorts(size) {
        return this.sides.flatMap(side =>
            Array.from({ length: size }, (_, index) => ({ side, index }))
        );
    },

    // How many guesses are on atoms
    correctGuesses(atomSet, guesses) {
        return [...guesses].filter(key => atomSet.has(key)).length;
    }
};
