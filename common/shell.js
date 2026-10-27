/**
 * Shared game shell: builds the header (title, language picker, info button)
 * and the "How to play" modal, and handles generic modal behavior.
 *
 * The info modal is built from the game's strings:
 *   info_title, info_description, rule_1..rule_N, tip_1..tip_N
 * Modals close on backdrop click / Escape unless they have a data-static attribute.
 * A "back" link to the games list is shown when <body data-home="..."> is set.
 */
const Shell = {
    init() {
        this.renderHeader();
        this.renderInfoModal();
        this.refresh();

        window.addEventListener('langChanged', () => {
            this.renderInfoModal();
            this.refresh();
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('modal') && !target.hasAttribute('data-static')) {
                this.closeModal(target.id);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            document.querySelectorAll('.modal.active:not([data-static])')
                .forEach(modal => this.closeModal(modal.id));
        });
    },

    renderHeader() {
        const header = document.createElement('header');
        header.className = 'game-header';
        const home = document.body.dataset.home;
        header.innerHTML = `
            <div class="title-group">
                ${home ? `<a id="homeLink" class="icon-btn" href="${home}">←</a>` : ''}
                <h1 data-i18n="title"></h1>
            </div>
            <div class="toolbar">
                <select id="langSelect">
                    ${i18n.gameLangs.map(lang =>
                        `<option value="${lang}">${i18n.languageNames[lang] || lang}</option>`
                    ).join('')}
                </select>
                <button id="infoBtn" class="icon-btn" onclick="Shell.openModal('infoModal')">?</button>
            </div>
        `;
        document.getElementById('app').prepend(header);

        const langSelect = document.getElementById('langSelect');
        langSelect.value = i18n.currentLang;
        langSelect.addEventListener('change', () => i18n.setLanguage(langSelect.value));
    },

    renderInfoModal() {
        let modal = document.getElementById('infoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'infoModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const rules = this.listItems('rule');
        const tips = this.listItems('tip');
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${i18n.t('info_title')}</h2>
                ${i18n.has('info_description') ? `<p>${i18n.t('info_description')}</p>` : ''}
                ${rules ? `<h3>${i18n.t('rules_title')}</h3><ul>${rules}</ul>` : ''}
                ${tips ? `<h3>${i18n.t('tips_title')}</h3><ul>${tips}</ul>` : ''}
                <div class="modal-actions">
                    <button class="primary" onclick="Shell.closeModal('infoModal')">${i18n.t('close')}</button>
                </div>
            </div>
        `;
        document.getElementById('infoBtn').hidden = !i18n.has('info_title');
    },

    listItems(prefix) {
        const items = [];
        for (let n = 1; i18n.has(`${prefix}_${n}`); n++) {
            items.push(`<li>${i18n.t(`${prefix}_${n}`)}</li>`);
        }
        return items.join('');
    },

    refresh() {
        i18n.apply();
        document.title = i18n.t('title');
        document.getElementById('langSelect').title = i18n.t('language');
        document.getElementById('infoBtn').title = i18n.t('how_to_play');
        const homeLink = document.getElementById('homeLink');
        if (homeLink) homeLink.title = i18n.t('all_games');
    },

    openModal(id) {
        document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
};

Shell.init();
