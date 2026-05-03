const NimEngine = {
    calculateXorSum(piles) {
        return piles.reduce((a, b) => a ^ b, 0);
    },

    getMasterMove(piles) {
        const xorSum = this.calculateXorSum(piles);
        if (xorSum === 0) return this.getNoviceMove(piles);

        for (let i = 0; i < piles.length; i++) {
            const target = piles[i] ^ xorSum;
            if (target < piles[i]) {
                return { pileIndex: i, count: piles[i] - target };
            }
        }
        return this.getNoviceMove(piles);
    },

    getNoviceMove(piles) {
        const activePiles = piles.map((n, i) => n > 0 ? i : -1).filter(i => i !== -1);
        const pileIndex = activePiles[Math.floor(Math.random() * activePiles.length)];
        const count = Math.floor(Math.random() * piles[pileIndex]) + 1;
        return { pileIndex, count };
    }
};