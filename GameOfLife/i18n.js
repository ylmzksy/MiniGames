const i18n = {
    currentLang: 'en',
    locales: {
        en: {
            title: "Evolution Architect",
            play: "▶ Play",
            pause: "⏸ Pause",
            reset: "🔄 Reset",
            settings: "⚙️ Rules",
            apply: "Apply Evolution Rules",
            rules: "Evolution Rules",
            born: "Born (Neighbors)",
            survive: "Survive (Neighbors)",
            budget: "Placement Budget",
            goal: "Goal",
            generation: "Generation",
            alive: "Alive",
            game_over: "No living cells remain",
            occupy: "Occupy the cell at",
            status_setup: "Place your seeds...",
            status_running: "Evolution in progress...",
            win: "Objective Met!"
        },
        de: {
            title: "Evolutionsarchitekt",
            play: "▶ Start",
            pause: "⏸ Pause",
            reset: "🔄 Zurücksetzen",
            settings: "⚙️ Regeln",
            apply: "Regeln anwenden",
            rules: "Evolutionsregeln",
            born: "Geburt (Nachbarn)",
            survive: "Überleben (Nachbarn)",
            budget: "Platzierungsbudget",
            goal: "Ziel",
            generation: "Generation",
            alive: "Lebendig",
            game_over: "Keine lebenden Zellen mehr",
            occupy: "Besetze die Zelle bei",
            status_setup: "Samen setzen...",
            status_running: "Evolution läuft...",
            win: "Ziel erreicht!"
        },
        tr: {
            title: "Evrim Mimarı",
            play: "▶ Başlat",
            pause: "⏸ Duraklat",
            reset: "🔄 Sıfırla",
            settings: "⚙️ Kurallar",
            apply: "Kuralları Uygula",
            rules: "Evrim Kuralları",
            born: "Doğum (Komşular)",
            survive: "Yaşam (Komşular)",
            budget: "Yerleştirme Bütçesi",
            goal: "Hedef",
            generation: "Nesil",
            alive: "Yaşayan",
            game_over: "Yaşayan hücre kalmadı",
            occupy: "Hücreyi işgal et",
            status_setup: "Tohumları yerleştirin...",
            status_running: "Evrim sürüyor...",
            win: "Hedef Tamamlandı!"
        }
    },
    t(key) { return this.locales[this.currentLang][key] || key; },
    setLanguage(lang) {
        this.currentLang = lang;
        window.dispatchEvent(new CustomEvent('langChanged'));
    }
};