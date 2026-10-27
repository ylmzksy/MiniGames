// Global level registry: each levels/*.js file calls registerLevel({...})
const LevelRegistry = [];
function registerLevel(config) {
    LevelRegistry.push(config);
}
