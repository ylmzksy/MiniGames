/**
 * Memory Match rules: a deck is a shuffled list of picture names, each twice.
 */
const MatchEngine = {
    PICTURES: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍉', '🥕', '🌽',
        '🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐙', '🦋', '🌻', '⭐'],

    deal(pairs, random = Math.random) {
        const pictures = this.shuffle(this.PICTURES.slice(), random).slice(0, pairs);
        return this.shuffle(pictures.flatMap(p => [p, p]), random);
    },

    shuffle(list, random = Math.random) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }
};
