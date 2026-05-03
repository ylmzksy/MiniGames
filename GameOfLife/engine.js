class LifeEngine {
    constructor(born = [3], survive = [2, 3]) {
        this.born = born;
        this.survive = survive;
    }

    // The core transition function (The "Pure" logic)
    willLive(isCurrentlyAlive, neighborCount) {
        if (isCurrentlyAlive) {
            return this.survive.includes(neighborCount);
        }
        return this.born.includes(neighborCount);
    }

    getNextGen(grid) {
        const rows = grid.length;
        const cols = grid[0].length;
        
        // Create new grid (Spatial allocation)
        return grid.map((row, r) => row.map((cell, c) => {
            const neighbors = this.countNeighbors(grid, r, c);
            return this.willLive(cell, neighbors);
        }));
    }

    countNeighbors(grid, r, c) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const nr = r + i, nc = c + j;
                if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
                    if (grid[nr][nc]) count++;
                }
            }
        }
        return count;
    }
}

// Level Registry (Plugin Architecture)
const LevelRegistry = [];
const registerLevel = (config) => LevelRegistry.push(config);