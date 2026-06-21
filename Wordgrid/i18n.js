const i18n = {
    currentLang: 'tr', // Defaulting to Turkish
    locales: {
        tr: {
            title: "Kelime Matrisi",
            placeholder: "Seçili hücre için kelime girin...",
            status_select: "Hamle yapmak için bir hücre seçin.",
            status_valid: "Harika! Kelime kaydedildi.",
            err_dict: "Kelime sözlükte bulunamadı!",
            err_rule: "Kelime hücre kurallarına uymuyor!",
            err_duplicate: "Bu kelime zaten başka bir hücrede seçilmiş!",
            col_6_letters: "6 harf veya daha az",
            col_no_cgi: "c, g, ı içermez",
            col_no_ir: "i, r içermez",
            row_contains_ep: "ep içerir",
            row_ends_p: "p ile biter",
            row_ends_us: "us ile biter"
        },
        en: {
            title: "Word Grid",
            placeholder: "Enter word for chosen cell...",
            status_select: "Select a grid cell to place a word.",
            status_valid: "Perfect! Word accepted.",
            err_dict: "Word not in dictionary!",
            err_rule: "Word breaks cell constraints!",
            err_duplicate: "Word is already active in another cell!",
            col_6_letters: "6 letters or fewer",
            col_no_cgi: "Does not contain c, g, i",
            col_no_ir: "Does not contain i, r",
            row_contains_ep: "Contains ep",
            row_ends_p: "Ends with p",
            row_ends_us: "Ends with us"
        }
    },
    t(key) {
        return this.locales[this.currentLang][key] || key;
    },
    setLanguage(lang) {
        if (this.locales[lang]) {
            this.currentLang = lang;
            window.dispatchEvent(new CustomEvent('langChanged'));
        }
    }
};