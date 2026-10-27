const LightsEngine = {
    // Toggles a cell and its neighbors in a 2D grid
    toggle(grid, r, c) {
        const rows = grid.length;
        const cols = grid[0].length;
        const coords = [[0,0], [0,1], [0,-1], [1,0], [-1,0]];
        
        coords.forEach(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                grid[nr][nc] = !grid[nr][nc];
            }
        });
        return grid;
    },

    isSolved(grid) {
        return grid.every(row => row.every(cell => !cell));
    }
};
