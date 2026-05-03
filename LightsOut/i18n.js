const i18n = {
    currentLang: 'en',

    locales: {
        en: {
            title: "Lights Out",
            level: "Level",
            solved: "Level Complete!",
            reset_level: "Reset Level",
            info_title: "How to Play Lights Out",
            info_description: "Lights Out is a puzzle game where you need to turn off all the lights on the grid.",
            rules_title: "Rules:",
            rule_1: "Click on a light to toggle it and its adjacent lights (up, down, left, right)",
            rule_2: "The goal is to turn off all lights (make them all dark)",
            rule_3: "Each level has a different starting configuration",
            rule_4: "Complete all levels to win the game!",
            tips_title: "Tips:",
            tip_1: "Think carefully about each move - it affects multiple lights",
            tip_2: "Some levels may require you to think several moves ahead",
            tip_3: "Use the Reset button if you get stuck",
            close: "Close",
            all_levels_cleared: "All levels cleared!",
            language_button: "Language"
        },
        de: {
            title: "Lichter Aus",
            level: "Level",
            solved: "Level geschafft!",
            reset_level: "Level zurücksetzen",
            info_title: "Wie man Lights Out spielt",
            info_description: "Lights Out ist ein Rätselspiel, bei dem du alle Lichter auf dem Gitter ausschalten musst.",
            rules_title: "Regeln:",
            rule_1: "Klicke auf ein Licht, um es und seine benachbarten Lichter zu schalten (oben, unten, links, rechts)",
            rule_2: "Das Ziel ist, alle Lichter auszuschalten (sie dunkel zu machen)",
            rule_3: "Jedes Level hat eine andere Startkonfiguration",
            rule_4: "Schließe alle Level ab, um zu gewinnen!",
            tips_title: "Tipps:",
            tip_1: "Denke sorgfältig über jeden Zug nach - er beeinflusst mehrere Lichter",
            tip_2: "Einige Level erfordern es, mehrere Züge voraus zu denken",
            tip_3: "Verwende die Zurücksetzen-Taste, wenn du feststeckst",
            close: "Schließen",
            all_levels_cleared: "Alle Level geschafft!",
            language_button: "Sprache"
        },
        tr: {
            title: "Işıklar Kapalı",
            level: "Seviye",
            solved: "Seviye Tamamlandı!",
            reset_level: "Seviyeyi Sıfırla",
            info_title: "Lights Out Nasıl Oynanır",
            info_description: "Lights Out, ızgaradaki tüm ışıkları kapatmanız gereken bir bulmaca oyunudur.",
            rules_title: "Kurallar:",
            rule_1: "Bir ışığa tıklayarak onu ve bitişik ışıkları değiştirin (yukarı, aşağı, sol, sağ)",
            rule_2: "Hedef tüm ışıkları kapatmaktır (hepsini karanlık yapmak)",
            rule_3: "Her seviyenin farklı bir başlangıç konfigürasyonu vardır",
            rule_4: "Tüm seviyeleri tamamlayarak kazanabilirsiniz!",
            tips_title: "İpuçları:",
            tip_1: "Her hamleyi dikkatlice düşün - birden fazla ışığı etkiler",
            tip_2: "Bazı seviyeler birkaç hamle ötesini düşünmenizi gerektirebilir",
            tip_3: "Takılırsan Sıfırla düğmesini kullan",
            close: "Kapat",
            all_levels_cleared: "Tüm seviyeler tamamlandı!",
            language_button: "Dil"
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
