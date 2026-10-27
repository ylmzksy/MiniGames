/**
 * WordGrid Logic Engine
 */
const WordEngine = {
    // Dictionary mapping: will be populated by your Turkish JSON later
    dictionary: new Set(), 

    // Catalog of reusable rule matching functions
    ruleRegistry: {
        '6_LETTERS_OR_FEWER': (word) => word.length <= 6,
        'DOES_NOT_CONTAIN': (word, letters) => !letters.some(l => word.includes(WordEngine.normalize(l))),
        'CONTAINS': (word, sub) => word.includes(WordEngine.normalize(sub)),
        'ENDS_WITH': (word, sub) => word.endsWith(WordEngine.normalize(sub)),
        'STARTS_WITH': (word, sub) => word.startsWith(WordEngine.normalize(sub))
    },

    /**
     * Trims and lowercases with Turkish rules (I -> ı, İ -> i)
     */
    normalize(word) {
        return word.trim().toLocaleLowerCase('tr');
    },

    /**
     * Loads the external JSON dictionary
     */
    setDictionary(wordList) {
        this.dictionary = new Set(wordList.map(w => this.normalize(w)));
    },

    /**
     * Validates a candidate word against a combined row/column rule intersection
     */
    validateWord(word, rowRule, colRule) {
        const cleanWord = this.normalize(word);

        // 1. Check if word exists within the dictionary
        if (!this.dictionary.has(cleanWord)) {
            return { valid: false, error: 'NOT_IN_DICTIONARY' };
        }

        // 2. Validate Row Rule
        const rowPass = this.evaluateRule(cleanWord, rowRule);
        if (!rowPass) return { valid: false, error: 'ROW_RULE_VIOLATION' };

        // 3. Validate Column Rule
        const colPass = this.evaluateRule(cleanWord, colRule);
        if (!colPass) return { valid: false, error: 'COL_RULE_VIOLATION' };

        return { valid: true };
    },

    evaluateRule(word, ruleConfig) {
        const fn = this.ruleRegistry[ruleConfig.type];
        if (!fn) return true; // Fallback for no rule
        return fn(word, ruleConfig.params);
    }
};
