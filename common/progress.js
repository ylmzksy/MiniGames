/**
 * Shared level progress, saved in the browser (localStorage), plus the level picker.
 * The game is identified by <body data-game="...">. A level is unlocked when every
 * level before it is solved, so players can always continue with the next one.
 */
const Progress = {
    storagePrefix: 'minigames.progress.',

    key() {
        return this.storagePrefix + document.body.dataset.game;
    },

    load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.key()));
            return { current: 0, solved: [], ...saved };
        } catch (e) {
            return { current: 0, solved: [] };
        }
    },

    store(data) {
        try { localStorage.setItem(this.key(), JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
    },

    isSolved(idx) {
        return this.load().solved.includes(idx);
    },

    isUnlocked(idx) {
        const { solved } = this.load();
        for (let i = 0; i < idx; i++) {
            if (!solved.includes(i)) return false;
        }
        return true;
    },

    markSolved(idx) {
        const data = this.load();
        if (!data.solved.includes(idx)) data.solved.push(idx);
        this.store(data);
    },

    setCurrent(idx) {
        this.store({ ...this.load(), current: idx });
    },

    // The level to open on start: the last one played, if it still exists and is unlocked
    startLevel() {
        const { current } = this.load();
        return current < LevelRegistry.length && this.isUnlocked(current) ? current : 0;
    },

    reset() {
        try { localStorage.removeItem(this.key()); } catch (e) { /* storage unavailable */ }
    }
};

const LevelSelect = {
    onPick: null,

    // onPick(idx) loads the chosen level
    open(onPick) {
        this.onPick = onPick;
        this.render();
        Shell.openModal('levelModal');
    },

    render() {
        let modal = document.getElementById('levelModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'levelModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const current = Progress.load().current;
        const buttons = LevelRegistry.map((level, idx) => {
            const unlocked = Progress.isUnlocked(idx);
            const classes = ['level-btn', idx === current ? 'current' : ''].join(' ');
            return `
                <button class="${classes}" onclick="LevelSelect.pick(${idx})" ${unlocked ? '' : 'disabled'}>
                    <span>${i18n.t('level')} ${idx + 1}: ${level.name}</span>
                    <span class="level-mark">${Progress.isSolved(idx) ? '✓' : ''}</span>
                </button>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content">
                <h2>${i18n.t('levels_title')}</h2>
                <div class="level-list">${buttons}</div>
                <div class="modal-actions">
                    <button onclick="LevelSelect.resetProgress()">${i18n.t('reset_progress')}</button>
                    <button class="primary" onclick="Shell.closeModal('levelModal')">${i18n.t('close')}</button>
                </div>
            </div>
        `;
    },

    pick(idx) {
        if (!Progress.isUnlocked(idx)) return;
        Shell.closeModal('levelModal');
        this.onPick(idx);
    },

    resetProgress() {
        if (!confirm(i18n.t('reset_progress_confirm'))) return;
        Progress.reset();
        Shell.closeModal('levelModal');
        this.onPick(0);
    }
};

window.addEventListener('langChanged', () => {
    if (document.getElementById('levelModal')?.classList.contains('active')) LevelSelect.render();
});
