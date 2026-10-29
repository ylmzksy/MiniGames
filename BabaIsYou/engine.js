/**
 * Baba Is You rules. The board holds objects (baba, wall, rock, ...) and text
 * blocks. Text that reads NOUN IS PROPERTY, across or down, gives that property
 * to every object of that noun; NOUN IS NOUN turns the first into the second.
 * Text blocks can always be pushed. Properties:
 *   YOU     moves when you press a direction
 *   WIN     touching it with a YOU object wins
 *   STOP    cannot be walked through
 *   PUSH    is shoved along in front of you
 *   SINK    destroys itself and anything that enters its cell
 *   DEFEAT  destroys YOU objects that enter its cell
 * Map tokens (space separated): '.' empty, lowercase = object, UPPERCASE = text.
 */
const BabaEngine = {
    nouns: ['baba', 'wall', 'rock', 'flag', 'water', 'skull', 'key', 'door', 'keke'],
    properties: ['YOU', 'WIN', 'STOP', 'PUSH', 'SINK', 'DEFEAT'],
    directions: { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] },

    parse(level) {
        const rows = level.map.map(row => row.trim().split(/\s+/));
        const height = rows.length;
        const width = Math.max(...rows.map(row => row.length));
        const objects = [];
        rows.forEach((row, r) => row.forEach((token, c) => {
            if (token === '.') return;
            if (token === token.toUpperCase()) objects.push({ text: token, r, c });
            else objects.push({ name: token, r, c });
        }));
        return { width, height, state: { objects } };
    },

    clone(state) {
        return { objects: state.objects.map(o => ({ ...o })) };
    },

    isNounText(text) {
        return this.nouns.includes(text.toLowerCase());
    },

    // Reads all NOUN IS X sentences on the board
    rules(state) {
        const textAt = new Map();
        state.objects.forEach(o => { if (o.text) textAt.set(`${o.r},${o.c}`, o.text); });
        const sentences = [];
        state.objects.forEach(o => {
            if (!o.text || !this.isNounText(o.text)) return;
            [[0, 1], [1, 0]].forEach(([dr, dc]) => {
                const verb = textAt.get(`${o.r + dr},${o.c + dc}`);
                const object = textAt.get(`${o.r + 2 * dr},${o.c + 2 * dc}`);
                if (verb !== 'IS' || !object) return;
                if (this.properties.includes(object) || this.isNounText(object)) {
                    sentences.push([o.text, 'IS', object]);
                }
            });
        });
        return sentences;
    },

    // Properties per noun, from the current sentences
    propertyMap(sentences) {
        const map = {};
        sentences.forEach(([noun, , what]) => {
            if (!this.properties.includes(what)) return;
            const key = noun.toLowerCase();
            (map[key] ||= new Set()).add(what);
        });
        return map;
    },

    has(obj, prop, props) {
        if (obj.text) return prop === 'PUSH';
        return props[obj.name]?.has(prop) ?? false;
    },

    at(state, r, c) {
        return state.objects.filter(o => o.r === r && o.c === c);
    },

    // Moves every YOU object; returns the new state and what happened, or null if nothing moved
    move(puzzle, state, dir) {
        const [dr, dc] = this.directions[dir];
        const next = this.clone(state);
        let props = this.propertyMap(this.rules(next));
        const movers = next.objects.filter(o => this.has(o, 'YOU', props));
        if (!movers.length) return null;

        let moved = false;
        movers.forEach(obj => {
            if (this.push(puzzle, next, obj, dr, dc, props)) moved = true;
        });
        if (!moved) return null;

        this.transform(next);
        props = this.propertyMap(this.rules(next));
        this.interact(next, props);
        return { state: next, won: this.isWon(next, props) };
    },

    // Shoves obj one step, pushing whatever is pushable in front of it; false if blocked
    push(puzzle, state, obj, dr, dc, props) {
        const chain = [obj];
        let r = obj.r + dr;
        let c = obj.c + dc;
        while (true) {
            if (r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width) return false;
            const here = this.at(state, r, c);
            const pushables = here.filter(o => this.has(o, 'PUSH', props));
            if (here.some(o => this.has(o, 'STOP', props) && !this.has(o, 'PUSH', props))) return false;
            if (!pushables.length) break;
            chain.push(...pushables);
            r += dr;
            c += dc;
        }
        chain.forEach(o => { o.r += dr; o.c += dc; });
        return true;
    },

    // NOUN IS NOUN turns objects; NOUN IS NOUN with the same noun protects them
    transform(state) {
        const sentences = this.rules(state);
        const protectedNouns = new Set(sentences.filter(([a, , b]) => a === b).map(([a]) => a.toLowerCase()));
        const changes = sentences.filter(([a, , b]) => this.isNounText(b) && a !== b && !protectedNouns.has(a.toLowerCase()));
        if (!changes.length) return;
        state.objects.forEach(o => {
            if (!o.name) return;
            const rule = changes.find(([a]) => a.toLowerCase() === o.name);
            if (rule) o.name = rule[2].toLowerCase();
        });
    },

    interact(state, props) {
        const removed = new Set();
        const cells = new Map();
        state.objects.forEach(o => {
            const key = `${o.r},${o.c}`;
            (cells.get(key) || cells.set(key, []).get(key)).push(o);
        });
        cells.forEach(group => {
            if (group.length > 1 && group.some(o => this.has(o, 'SINK', props))) {
                group.forEach(o => removed.add(o));
                return;
            }
            if (group.some(o => this.has(o, 'DEFEAT', props))) {
                group.forEach(o => { if (this.has(o, 'YOU', props)) removed.add(o); });
            }
        });
        state.objects = state.objects.filter(o => !removed.has(o));
    },

    isWon(state, props) {
        return state.objects.some(o => this.has(o, 'YOU', props)
            && this.at(state, o.r, o.c).some(w => this.has(w, 'WIN', props)));
    },

    hasYou(state) {
        const props = this.propertyMap(this.rules(state));
        return state.objects.some(o => this.has(o, 'YOU', props));
    }
};
