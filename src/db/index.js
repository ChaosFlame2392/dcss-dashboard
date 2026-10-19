/**
 * DCSS Local Database & Query Engine
 * Unified entry point providing high-level functions and instantiable DB clients.
 */

const { initDatabase, DEFAULT_DB_PATH } = require('./schema');
const { sync, getDcssDirs } = require('./sync');
const {
  getStats,
  getComboMatrix,
  getGames,
  getActiveRun,
  getActiveRuns,
  getSuggestions,
  getVersions,
} = require('./api');
const constants = require('./constants');

/**
 * Creates a configured DCSS Database client instance
 */
function createDcssDb(dbPath = DEFAULT_DB_PATH, options = {}) {
  const db = initDatabase(dbPath);

  return {
    rawDb: db,
    sync: (syncOpts = {}) => sync(db, { ...options, ...syncOpts }),
    getStats: (filter = {}) => getStats(db, typeof filter === 'string' ? { dateRange: filter } : filter),
    getComboMatrix: (filter = {}) => getComboMatrix(db, typeof filter === 'string' ? { dateRange: filter } : filter),
    getGames: (filter = {}, limit = 50, offset = 0, sort = {}) => getGames(db, filter, limit, offset, sort),
    getActiveRun: () => getActiveRun(db),
    getActiveRuns: () => getActiveRuns(db),
    getSuggestions: (filter = {}) => getSuggestions(db, filter),
    getVersions: () => getVersions(db),
    getDcssDirs: () => getDcssDirs(),
    rollRecommendedCombo: () => constants.rollRecommendedCombo(),
    isGodRestricted: (speciesAbbr, godName) => constants.isGodRestricted(speciesAbbr, godName),
    close: () => {
      try {
        db.close();
      } catch (e) {
        // ignore
      }
    },
  };
}

// Default singleton instance using persistent local DB
let defaultClient = null;
function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = createDcssDb(DEFAULT_DB_PATH);
  }
  return defaultClient;
}

module.exports = {
  createDcssDb,
  getDefaultClient,
  initDatabase,
  DEFAULT_DB_PATH,
  sync: (opts) => getDefaultClient().sync(opts),
  getStats: (filter) => getDefaultClient().getStats(filter),
  getComboMatrix: (filter) => getDefaultClient().getComboMatrix(filter),
  getGames: (filter, limit, offset, sort) => getDefaultClient().getGames(filter, limit, offset, sort),
  getActiveRun: () => getDefaultClient().getActiveRun(),
  getActiveRuns: () => getDefaultClient().getActiveRuns(),
  getSuggestions: (filter) => getDefaultClient().getSuggestions(filter),
  getVersions: () => getDefaultClient().getVersions(),
  rollRecommendedCombo: () => constants.rollRecommendedCombo(),
  isGodRestricted: (sp, god) => constants.isGodRestricted(sp, god),
  RECOMMENDED_COMBOS: constants.RECOMMENDED_COMBOS,
  constants,
  getDcssDirs,
};
