/**
 * Shared i18n core. Each game's i18n.js calls i18n.register({...}) with its own
 * strings; those are merged over the shared strings below.
 * Elements with a data-i18n="key" attribute are translated automatically.
 */
const i18n = {
    currentLang: 'en',
    gameLangs: [],
    storageKey: 'minigames.lang',

    languageNames: { en: 'English', de: 'Deutsch', tr: 'Türkçe' },

    locales: {
        en: {
            all_games: "All games",
            close: "Close",
            how_to_play: "How to play",
            language: "Language",
            level: "Level",
            levels_button: "Levels",
            levels_title: "Choose a level",
            reset_progress: "Reset progress",
            reset_progress_confirm: "Delete your progress in this game?",
            rules_title: "Rules:",
            tips_title: "Tips:"
        },
        de: {
            all_games: "Alle Spiele",
            close: "Schließen",
            how_to_play: "Spielanleitung",
            language: "Sprache",
            level: "Level",
            levels_button: "Levelauswahl",
            levels_title: "Wähle ein Level",
            reset_progress: "Fortschritt zurücksetzen",
            reset_progress_confirm: "Deinen Fortschritt in diesem Spiel löschen?",
            rules_title: "Regeln:",
            tips_title: "Tipps:"
        },
        tr: {
            all_games: "Tüm oyunlar",
            close: "Kapat",
            how_to_play: "Nasıl oynanır",
            language: "Dil",
            level: "Seviye",
            levels_button: "Seviyeler",
            levels_title: "Bir seviye seçin",
            reset_progress: "İlerlemeyi sıfırla",
            reset_progress_confirm: "Bu oyundaki ilerlemeniz silinsin mi?",
            rules_title: "Kurallar:",
            tips_title: "İpuçları:"
        }
    },

    // Merges a game's strings over the shared ones and picks the start language
    register(gameLocales, defaultLang = 'en') {
        this.gameLangs = Object.keys(gameLocales);
        this.gameLangs.forEach(lang => {
            this.locales[lang] = { ...this.locales[lang], ...gameLocales[lang] };
        });
        const saved = this.loadSaved();
        this.currentLang = this.gameLangs.includes(saved) ? saved : defaultLang;
        document.documentElement.lang = this.currentLang;
    },

    has(key) {
        return key in (this.locales[this.currentLang] || {});
    },

    // t('goal_survive', { n: 50 }) fills "{n}" placeholders in the string
    t(key, params = {}) {
        const text = this.locales[this.currentLang]?.[key] ?? key;
        return text.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    },

    apply(root = document) {
        root.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = this.t(el.dataset.i18n);
        });
    },

    setLanguage(lang) {
        if (!this.gameLangs.includes(lang)) return;
        this.currentLang = lang;
        document.documentElement.lang = lang;
        try { localStorage.setItem(this.storageKey, lang); } catch (e) { /* storage unavailable */ }
        this.apply();
        window.dispatchEvent(new CustomEvent('langChanged'));
    },

    loadSaved() {
        try { return localStorage.getItem(this.storageKey); } catch (e) { return null; }
    }
};
