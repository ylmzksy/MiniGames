/**
 * Shared sliding-block logic for Klotski and Rush Hour.
 * A level map uses one letter per piece ('X' is the piece that must escape)
 * and '.' for empty cells; every piece must be a solid rectangle.
 * With axisLocked, pieces only slide along their long side (Rush Hour).
 */
const SlidingEngine = {
    parse(level, axisLocked) {
        const rows = level.map;
        const height = rows.length;
        const width = rows[0].length;
        const bounds = {};
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.') return;
            const b = bounds[ch] || (bounds[ch] = { id: ch, r0: r, c0: c, r1: r, c1: c });
            b.r1 = Math.max(b.r1, r);
            b.c1 = Math.max(b.c1, c);
        }));
        const pieces = Object.values(bounds).map(b => {
            const w = b.c1 - b.c0 + 1;
            const h = b.r1 - b.r0 + 1;
            return { id: b.id, r: b.r0, c: b.c0, w, h, axis: axisLocked ? (w >= h ? 'h' : 'v') : null };
        });
        return { width, height, pieces, main: pieces.findIndex(p => p.id === 'X') };
    },

    cells(piece) {
        const out = [];
        for (let r = piece.r; r < piece.r + piece.h; r++) {
            for (let c = piece.c; c < piece.c + piece.w; c++) out.push(`${r},${c}`);
        }
        return out;
    },

    canMove(puzzle, pieces, idx, dr, dc) {
        const piece = pieces[idx];
        if (piece.axis === 'h' && dr !== 0) return false;
        if (piece.axis === 'v' && dc !== 0) return false;
        const moved = { ...piece, r: piece.r + dr, c: piece.c + dc };
        if (moved.r < 0 || moved.c < 0 || moved.r + moved.h > puzzle.height || moved.c + moved.w > puzzle.width) return false;
        const occupied = new Set(pieces.flatMap((p, i) => i === idx ? [] : this.cells(p)));
        return this.cells(moved).every(key => !occupied.has(key));
    },

    // Returns a new pieces array with piece idx shifted
    move(pieces, idx, dr, dc) {
        return pieces.map((p, i) => i === idx ? { ...p, r: p.r + dr, c: p.c + dc } : p);
    }
};

/**
 * Drag controller for a board of absolutely positioned .piece elements
 * (each with data-idx). Dragging slides the piece cell by cell as far as the
 * pointer goes and the board allows. A tap without movement selects the piece.
 *   tryStep(idx, dr, dc) -> true if the step was applied (and rendered)
 *   onStart(idx), onSelect(idx), onEnd(idx, moved)
 */
const SlidingDrag = {
    attach(board, { columns, pieceAxis, tryStep, onStart, onSelect, onEnd }) {
        let drag = null;

        board.addEventListener('pointerdown', (event) => {
            const el = event.target.closest('.piece');
            if (!el) return;
            event.preventDefault();
            const idx = Number(el.dataset.idx);
            drag = { idx, x: event.clientX, y: event.clientY, dr: 0, dc: 0, axis: pieceAxis(idx), moved: false };
            onStart(idx);
            board.setPointerCapture(event.pointerId);
        });

        board.addEventListener('pointermove', (event) => {
            if (!drag) return;
            const cell = board.clientWidth / columns();
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (!drag.axis) {
                // Free pieces lock to the first direction the finger clearly takes
                if (Math.max(Math.abs(dx), Math.abs(dy)) < cell / 3) return;
                drag.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            }
            const target = drag.axis === 'h' ? Math.round(dx / cell) : Math.round(dy / cell);
            let applied = drag.axis === 'h' ? drag.dc : drag.dr;
            while (applied !== target) {
                const step = target > applied ? 1 : -1;
                const ok = drag.axis === 'h' ? tryStep(drag.idx, 0, step) : tryStep(drag.idx, step, 0);
                if (!ok) break;
                applied += step;
                drag.moved = true;
            }
            if (drag.axis === 'h') drag.dc = applied; else drag.dr = applied;
        });

        const finish = () => {
            if (!drag) return;
            const { idx, moved } = drag;
            drag = null;
            if (!moved) onSelect(idx);
            onEnd(idx, moved);
        };
        board.addEventListener('pointerup', finish);
        board.addEventListener('pointercancel', finish);
    }
};

/**
 * A complete sliding-block game on top of the shared shell: level loading,
 * rendering, drag and keyboard input, move counting (a move is one piece
 * sliding, however far), undo, and the solved flow.
 *   config.axisLocked  pieces only slide along their long side
 *   config.isWon(puzzle, pieces, level) -> true when the X piece has escaped
 *   config.exitHtml(puzzle, level) -> markup for the exit marker on the frame
 */
const SlidingGame = {
    palette: ['#5b8cff', '#34c77b', '#f5b301', '#9b4ddb', '#17b8c8', '#ff8c1a', '#8a94a6', '#c9a27e', '#f06ab0', '#7fd36b', '#6fb4ff', '#b08968'],

    init(config) {
        this.config = config;
        this.board = document.getElementById('game-board');
        this.statusEl = document.getElementById('status');
        this.levelInfoEl = document.getElementById('level-info');
        this.countersEl = document.getElementById('counters');
        this.undoBtn = document.getElementById('undoBtn');
        this.statusKey = 'status_play';

        SlidingDrag.attach(this.board, {
            columns: () => this.puzzle.width,
            pieceAxis: idx => this.pieces[idx].axis,
            tryStep: (idx, dr, dc) => this.tryStep(idx, dr, dc),
            onStart: idx => this.beginMove(idx),
            onSelect: idx => { this.selected = idx; this.render(); },
            onEnd: (idx, moved) => this.endMove(idx, moved)
        });

        document.addEventListener('keydown', (event) => {
            const inFormControl = event.target instanceof Element && event.target.closest('select, input');
            if (inFormControl || document.querySelector('.modal.active')) return;
            const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            if (dirs[event.key] && this.selected !== null) {
                const idx = this.selected; // solving the level clears the selection mid-move
                this.beginMove(idx);
                const moved = this.tryStep(idx, ...dirs[event.key]);
                this.endMove(idx, moved);
            } else if (event.key === 'Tab') {
                this.selected = this.selected === null ? 0 : (this.selected + 1) % this.pieces.length;
                this.render();
            } else if (event.key.toLowerCase() === 'z' || event.key === 'Backspace') {
                this.undo();
            } else if (event.key.toLowerCase() === 'r') {
                this.loadLevel(this.currentLevelIdx);
            } else {
                return;
            }
            event.preventDefault();
        });

        document.getElementById('restartBtn').onclick = () => this.loadLevel(this.currentLevelIdx);
        this.undoBtn.onclick = () => this.undo();
        window.addEventListener('langChanged', () => {
            this.setStatus(this.statusKey);
            this.updateLevelInfo();
            this.render();
        });

        if (LevelRegistry.length > 0) this.loadLevel(Progress.startLevel());
    },

    loadLevel(idx) {
        this.level = LevelRegistry[idx];
        if (!this.level) return;
        this.currentLevelIdx = idx;
        Progress.setCurrent(idx);
        this.puzzle = SlidingEngine.parse(this.level, this.config.axisLocked);
        this.pieces = this.puzzle.pieces;
        this.history = [];
        this.moves = 0;
        this.lastMoved = null;
        this.selected = null;
        this.isSolved = false;
        this.setStatus('status_play');
        this.updateLevelInfo();
        this.render();
    },

    render() {
        const { width, height } = this.puzzle;
        this.board.style.aspectRatio = `${width} / ${height}`;
        this.board.style.maxWidth = `${width * 72}px`;
        const pct = (n, total) => `${(n / total) * 100}%`;
        const pieces = this.pieces.map((p, i) => {
            const color = i === this.puzzle.main ? 'var(--danger)' : this.palette[(p.id.charCodeAt(0) - 65) % this.palette.length];
            const classes = ['piece', i === this.puzzle.main ? 'main' : '', i === this.selected ? 'selected' : '',
                this.isSolved && i === this.puzzle.main ? 'solved' : '', p.axis ? `axis-${p.axis}` : ''].join(' ');
            return `<div class="${classes}" data-idx="${i}" style="left:${pct(p.c, width)};top:${pct(p.r, height)};width:${pct(p.w, width)};height:${pct(p.h, height)};--piece:${color}"></div>`;
        }).join('');
        this.board.innerHTML = this.config.exitHtml(this.puzzle, this.level) + pieces;

        this.countersEl.innerText = `${i18n.t('moves')}: ${this.moves}`;
        this.undoBtn.disabled = this.history.length === 0 || this.isSolved;
    },

    tryStep(idx, dr, dc) {
        if (this.isSolved || !SlidingEngine.canMove(this.puzzle, this.pieces, idx, dr, dc)) return false;
        this.pieces = SlidingEngine.move(this.pieces, idx, dr, dc);
        this.selected = idx;
        this.render();
        this.checkSolved();
        return true;
    },

    beginMove(idx) {
        this.pending = { pieces: this.pieces, moves: this.moves, lastMoved: this.lastMoved };
    },

    // A drag or key press that moved a piece counts as one move, unless the same piece just moved
    endMove(idx, moved) {
        if (!moved || !this.pending) { this.pending = null; return; }
        this.history.push(this.pending);
        this.pending = null;
        if (this.lastMoved !== idx) this.moves++;
        this.lastMoved = idx;
        if (this.isSolved) this.setStatus('status_solved', { moves: this.moves });
        this.render();
    },

    undo() {
        if (!this.history.length || this.isSolved) return;
        const prev = this.history.pop();
        this.pieces = prev.pieces;
        this.moves = prev.moves;
        this.lastMoved = prev.lastMoved;
        this.render();
    },

    checkSolved() {
        if (this.isSolved || !this.config.isWon(this.puzzle, this.pieces, this.level)) return;
        this.isSolved = true;
        this.selected = null;
        Progress.markSolved(this.currentLevelIdx);
        const solvedLevelIdx = this.currentLevelIdx;
        setTimeout(() => {
            if (solvedLevelIdx === this.currentLevelIdx) this.nextLevel();
        }, 2000);
    },

    nextLevel() {
        if (this.currentLevelIdx + 1 < LevelRegistry.length) {
            this.loadLevel(this.currentLevelIdx + 1);
        } else {
            this.setStatus('all_levels_cleared');
        }
    },

    setStatus(key, params = {}) {
        this.statusKey = key;
        this.statusEl.innerText = i18n.t(key, { moves: this.moves, ...params });
    },

    updateLevelInfo() {
        this.levelInfoEl.innerText = `${i18n.t('level')} ${this.currentLevelIdx + 1}/${LevelRegistry.length}: ${this.level.name}`;
    }
};
