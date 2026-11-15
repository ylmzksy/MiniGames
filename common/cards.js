/**
 * Shared playing-card code: the deck, seeded shuffling and how cards are drawn.
 * A card is { s, r, up }: suit 0-3 (spades, hearts, diamonds, clubs), rank 1-13
 * (ace to king) and whether it lies face up.
 */
const Cards = {
    SUITS: ['♠', '♥', '♦', '♣'],
    RANKS: ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],

    deck() {
        const cards = [];
        for (let s = 0; s < 4; s++) {
            for (let r = 1; r <= 13; r++) cards.push({ s, r, up: false });
        }
        return cards;
    },

    // A repeatable random number generator (mulberry32), so a seed always gives the same deal
    rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    randomSeed() {
        return Math.floor(Math.random() * 2 ** 31);
    },

    shuffle(list, rand = Math.random) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    },

    isRed(card) {
        return card.s === 1 || card.s === 2;
    },

    label(card) {
        return this.RANKS[card.r] + this.SUITS[card.s];
    },

    same(a, b) {
        return a.s === b.s && a.r === b.r;
    }
};

/**
 * Drawing cards as HTML. The size comes from the --cw custom property of the
 * surrounding element, so each game can set how large its cards are.
 */
const CardView = {
    // options: { cls, attrs, style }
    card(card, options = {}) {
        const classes = ['card', options.cls || ''];
        const attrs = `${options.attrs || ''} ${options.style ? `style="${options.style}"` : ''}`;
        if (!card.up) return `<div class="${classes.join(' ')} back" ${attrs}></div>`;
        classes.push(Cards.isRed(card) ? 'red' : 'black');
        const rank = Cards.RANKS[card.r];
        const suit = Cards.SUITS[card.s];
        return `<div class="${classes.join(' ')}" ${attrs}>
            <span class="corner"><b>${rank}</b><i>${suit}</i></span>
            <span class="center">${suit}</span>
        </div>`;
    },

    // An empty place where cards can go; `mark` is a faint hint like "A" or "K"
    slot(options = {}) {
        return `<div class="card slot ${options.cls || ''}" ${options.attrs || ''}>${options.mark || ''}</div>`;
    }
};
