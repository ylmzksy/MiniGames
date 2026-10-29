/**
 * Countdown numbers round. Combine the given numbers with + − × ÷ to reach
 * the target. Each number may be used once; every intermediate result must be
 * a positive whole number. A result can be used again like a number.
 */
const CountdownEngine = {
    operators: ['+', '-', '×', '÷'],

    // Result of a op b, or null when the operation is not allowed
    apply(a, op, b) {
        let result;
        switch (op) {
            case '+': result = a + b; break;
            case '-': result = a - b; break;
            case '×': result = a * b; break;
            case '÷': result = b !== 0 && a % b === 0 ? a / b : null; break;
            default: return null;
        }
        return result !== null && Number.isInteger(result) && result > 0 ? result : null;
    },

    // Distance of the closest available value to the target
    closest(values, target) {
        return Math.min(...values.map(v => Math.abs(v - target)));
    }
};
