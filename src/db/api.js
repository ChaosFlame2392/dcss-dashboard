/**
 * DCSS SQLite Query API & Metrics Engine
 * Provides getStats, getComboMatrix, getGames, getActiveRun, and getSuggestions.
 */

const {
  SPECIES,
  BACKGROUNDS,
  GODS,
  UNAVAILABLE_COMBOS,
  RECOMMENDED_COMBOS,
  isGodRestricted,
  rollRecommendedCombo,
  formatDuration,
  isValidCombo,
  parseDcssVersion,
  compareVersions,
  matchesVersionFilter,
  CATEGORY_BACKGROUND_MAP,
} = require('./constants');

/**
 * Parses date string (YYYY-MM-DD or ISO) into local start-of-day ISO string
 */
function parseLocalDateStart(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return dateStr;
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return `${dateStr}T00:00:00.000Z`;
}

/**
 * Parses date string (YYYY-MM-DD or ISO) into local end-of-day ISO string
 */
function parseLocalDateEnd(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return dateStr;
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const dt = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return `${dateStr}T23:59:59.999Z`;
}

/**
 * Builds SQL WHERE clause and parameters from filter options
 */
function buildWhereClause(filter = {}) {
  const conditions = ['is_active = 0'];
  const params = [];

  // Date range filter
  if (filter.dateRange) {
    const range = String(filter.dateRange).toLowerCase();
    const now = new Date();

    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      conditions.push('end_time >= ?');
      params.push(todayStart);
    } else if (range === 'yesterday') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      conditions.push('end_time >= ? AND end_time < ?');
      params.push(yesterdayStart, todayStart);
    } else if (range === '7d' || range === 'last_7_days' || range === 'week') {
      const d7 = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
      conditions.push('end_time >= ?');
      params.push(d7);
    } else if (range === '30d' || range === 'last_30_days' || range === 'month') {
      const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
      conditions.push('end_time >= ?');
      params.push(d30);
    }
  }

  // Custom date bounds (from / to)
  if (filter.from) {
    const fromIso = parseLocalDateStart(filter.from);
    conditions.push('end_time >= ?');
    params.push(fromIso);
  }
  if (filter.to) {
    const toIso = parseLocalDateEnd(filter.to);
    conditions.push('end_time <= ?');
    params.push(toIso);
  }

  // Name
  if (filter.name) {
    conditions.push('LOWER(name) = LOWER(?)');
    params.push(filter.name);
  }

  // Species
  if (filter.species) {
    if (filter.species.length === 2 && filter.species === filter.species.toUpperCase()) {
      conditions.push('species_abbr = ?');
      params.push(filter.species);
    } else {
      conditions.push('(species_abbr = ? OR LOWER(species) = LOWER(?))');
      params.push(filter.species, filter.species);
    }
  }

  // Background
  if (filter.background) {
    if (filter.background.length === 2) {
      conditions.push('background_abbr = ?');
      params.push(filter.background);
    } else {
      conditions.push('(background_abbr = ? OR LOWER(background) = LOWER(?))');
      params.push(filter.background, filter.background);
    }
  }

  // Combo
  if (filter.combo) {
    conditions.push('combo = ?');
    params.push(filter.combo);
  }

  // God
  if (filter.god) {
    if (filter.god.toLowerCase() === 'none' || filter.god.toLowerCase() === 'atheist') {
      conditions.push('(god IS NULL OR god = "")');
    } else {
      conditions.push('LOWER(god) = LOWER(?)');
      params.push(filter.god);
    }
  }

  // Is Win
  if (filter.is_win !== undefined && filter.is_win !== null && filter.is_win !== '') {
    conditions.push('is_win = ?');
    params.push(filter.is_win ? 1 : 0);
  }

  // Min XL
  if (filter.min_xl !== undefined && filter.min_xl !== null && filter.min_xl !== '') {
    conditions.push('xl >= ?');
    params.push(parseInt(filter.min_xl, 10));
  }

  // Max XL
  if (filter.max_xl !== undefined && filter.max_xl !== null && filter.max_xl !== '') {
    conditions.push('xl <= ?');
    params.push(parseInt(filter.max_xl, 10));
  }

  // Min Runes
  if (filter.min_runes !== undefined && filter.min_runes !== null && filter.min_runes !== '') {
    conditions.push('runes_count >= ?');
    params.push(parseInt(filter.min_runes, 10));
  }

  // Place / Branch
  if (filter.place) {
    conditions.push('LOWER(place) LIKE ?');
    params.push(`%${filter.place.toLowerCase()}%`);
  }

  // Game Type (normal, sprint, hints)
  if (filter.game_type) {
    conditions.push('game_type = ?');
    params.push(filter.game_type);
  }

  // Version filter (e.g. '>= 0.35', '<= 0.34', '0.34', '0.35-a0', 'stable', 'trunk')
  if (filter.version && filter.version !== 'all') {
    const trimmedVersion = String(filter.version).trim();
    const opMatch = trimmedVersion.match(/^([><]=?|==?|!=)\s*(.*)$/);
    if (opMatch) {
      const op = opMatch[1];
      const target = opMatch[2].trim();
      const f = parseDcssVersion(target);
      const hasPatch = /^\d+\.\d+\.\d+/.test(target);

      if (!hasPatch && !f.prerelease) {
        if (op === '>=') {
          conditions.push('(version_major > ? OR (version_major = ? AND version_minor >= ?))');
          params.push(f.major, f.major, f.minor);
        } else if (op === '>') {
          conditions.push('(version_major > ? OR (version_major = ? AND version_minor > ?))');
          params.push(f.major, f.major, f.minor);
        } else if (op === '<=') {
          conditions.push('(version_major < ? OR (version_major = ? AND version_minor <= ?))');
          params.push(f.major, f.major, f.minor);
        } else if (op === '<') {
          conditions.push('(version_major < ? OR (version_major = ? AND version_minor < ?))');
          params.push(f.major, f.major, f.minor);
        } else if (op === '==' || op === '=') {
          conditions.push('(version_major = ? AND version_minor = ?)');
          params.push(f.major, f.minor);
        } else if (op === '!=') {
          conditions.push('(version_major != ? OR version_minor != ?)');
          params.push(f.major, f.minor);
        }
      } else {
        if (op === '>=') {
          conditions.push('(version_major > ? OR (version_major = ? AND (version_minor > ? OR (version_minor = ? AND version_patch >= ?))))');
          params.push(f.major, f.major, f.minor, f.minor, f.patch);
        } else if (op === '>') {
          conditions.push('(version_major > ? OR (version_major = ? AND (version_minor > ? OR (version_minor = ? AND version_patch > ?))))');
          params.push(f.major, f.major, f.minor, f.minor, f.patch);
        } else if (op === '<=') {
          conditions.push('(version_major < ? OR (version_major = ? AND (version_minor < ? OR (version_minor = ? AND version_patch <= ?))))');
          params.push(f.major, f.major, f.minor, f.minor, f.patch);
        } else if (op === '<') {
          conditions.push('(version_major < ? OR (version_major = ? AND (version_minor < ? OR (version_minor = ? AND version_patch < ?))))');
          params.push(f.major, f.major, f.minor, f.minor, f.patch);
        } else if (op === '==' || op === '=') {
          conditions.push('(version_major = ? AND version_minor = ? AND version_patch = ?)');
          params.push(f.major, f.minor, f.patch);
        } else if (op === '!=') {
          conditions.push('(version_major != ? OR version_minor != ? OR version_patch != ?)');
          params.push(f.major, f.minor, f.patch);
        }
      }
    } else {
      const lower = trimmedVersion.toLowerCase();
      if (lower === 'stable') {
        conditions.push('(version_major = 0 AND version_minor = 34)');
      } else if (lower === 'trunk') {
        conditions.push('(version_major = 0 AND version_minor = 35)');
      } else {
        const minorMatch = trimmedVersion.match(/^(\d+)\.(\d+)$/);
        if (minorMatch) {
          conditions.push('(version_major = ? AND version_minor = ?)');
          params.push(parseInt(minorMatch[1], 10), parseInt(minorMatch[2], 10));
        } else {
          const f = parseDcssVersion(trimmedVersion);
          if (f.major > 0 || f.minor > 0) {
            conditions.push('(version = ? OR (version_major = ? AND version_minor = ? AND version_patch = ?))');
            params.push(trimmedVersion, f.major, f.minor, f.patch);
          } else {
            conditions.push('(version LIKE ? OR source_file LIKE ?)');
            params.push(`%${trimmedVersion}%`, `%${trimmedVersion}%`);
          }
        }
      }
    }
  }

  // Search keyword (matches combo, name, killer, place, outcome, char_name, god, seed, and background categories)
  // Supports multi-term OR search separated by ' or ' (case-insensitive), '|', or ','
  const searchQuery = filter.q || filter.search;
  if (searchQuery && String(searchQuery).trim()) {
    const normalizedQuery = String(searchQuery)
      .replace(/\bwarrior\s+mage(s)?\b/gi, 'warrior-mage$1');
    const rawTerms = normalizedQuery
      .split(/\s+or\s+|[|,]/i)
      .map(t => t.trim())
      .filter(Boolean);

    if (rawTerms.length > 0) {
      const termClauses = [];
      for (const t of rawTerms) {
        const cleanTerm = t.toLowerCase();
        const catBgs = CATEGORY_BACKGROUND_MAP[cleanTerm];
        if (catBgs && catBgs.length > 0) {
          const placeholders = catBgs.map(() => '?').join(',');
          termClauses.push(`background_abbr IN (${placeholders})`);
          for (const bg of catBgs) {
            params.push(bg);
          }
        } else {
          const term = `%${cleanTerm}%`;
          termClauses.push(`(
            LOWER(combo) LIKE ? OR
            LOWER(name) LIKE ? OR
            LOWER(killer) LIKE ? OR
            LOWER(place) LIKE ? OR
            LOWER(outcome) LIKE ? OR
            LOWER(char_name) LIKE ? OR
            LOWER(god) LIKE ? OR
            LOWER(species) LIKE ? OR
            LOWER(background) LIKE ? OR
            seed LIKE ?
          )`);
          for (let i = 0; i < 10; i++) {
            params.push(term);
          }
        }
      }
      conditions.push(`(${termClauses.join(' OR ')})`);
    }
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/**
 * Checks if an active run matches current filter criteria
 */
function activeRunMatchesFilter(ar, filter = {}) {
  // 1. Date Range
  if (filter.dateRange) {
    const range = String(filter.dateRange).toLowerCase();
    const now = new Date();
    const arTime = new Date(ar.end_time || ar.start_time || Date.now()).getTime();

    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (arTime < todayStart) return false;
    } else if (range === 'yesterday') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      if (arTime < yesterdayStart || arTime >= todayStart) return false;
    } else if (range === '7d' || range === 'last_7_days' || range === 'week') {
      if (arTime < (now.getTime() - 7 * 86400 * 1000)) return false;
    } else if (range === '30d' || range === 'last_30_days' || range === 'month') {
      if (arTime < (now.getTime() - 30 * 86400 * 1000)) return false;
    }
  }

  // 2. Custom date bounds
  if (filter.from) {
    const fromTime = new Date(parseLocalDateStart(filter.from)).getTime();
    const arTime = new Date(ar.end_time || ar.start_time || Date.now()).getTime();
    if (arTime < fromTime) return false;
  }
  if (filter.to) {
    const toTime = new Date(parseLocalDateEnd(filter.to)).getTime();
    const arTime = new Date(ar.end_time || ar.start_time || Date.now()).getTime();
    if (arTime > toTime) return false;
  }

  // 3. Name
  if (filter.name && ar.name && ar.name.toLowerCase() !== filter.name.toLowerCase()) {
    return false;
  }

  // 4. Species
  if (filter.species) {
    const s = filter.species.toLowerCase();
    const spAbbr = (ar.species_abbr || '').toLowerCase();
    const spName = (ar.species || '').toLowerCase();
    if (spAbbr !== s && spName !== s) return false;
  }

  // 5. Background
  if (filter.background) {
    const b = filter.background.toLowerCase();
    const bgAbbr = (ar.background_abbr || '').toLowerCase();
    const bgName = (ar.background || '').toLowerCase();
    if (bgAbbr !== b && bgName !== b) return false;
  }

  // 6. Combo
  if (filter.combo && (ar.combo || '').toLowerCase() !== filter.combo.toLowerCase()) {
    return false;
  }

  // 7. God
  if (filter.god) {
    const g = filter.god.toLowerCase();
    const arGod = (ar.god || '').toLowerCase();
    if (g === 'none' || g === 'atheist') {
      if (arGod && arGod !== 'none' && arGod !== 'atheist') return false;
    } else if (arGod !== g) {
      return false;
    }
  }

  // 8. Version
  if (filter.version && filter.version !== 'all') {
    const versionToCheck = ar.version || (ar.source_file?.includes('Trunk') ? '0.35-a0' : (ar.source_file?.includes('Stable') ? '0.34.1' : ''));
    if (!matchesVersionFilter(versionToCheck, filter.version)) return false;
  }

  return true;
}

/**
 * 1. getStats(filter)
 * Returns player summary metrics: total games, wins, win rate, total playtime,
 * average duration, score metrics (best, avg, median), average turn speed, runes extracted.
 * Automatically incorporates active ongoing runs into today and total playtime.
 */
function getStats(db, filter = {}) {
  const { whereClause, params } = buildWhereClause(filter);

  // Aggregate metrics from completed games
  const aggQuery = `
    SELECT
      COUNT(*) as total_games,
      SUM(is_win) as wins,
      SUM(duration_seconds) as total_duration,
      AVG(duration_seconds) as avg_duration,
      SUM(turns) as total_turns,
      AVG(turn_speed) as avg_turn_speed,
      SUM(runes_count) as total_runes,
      MAX(runes_count) as max_runes_single_game,
      MAX(score) as best_score,
      AVG(score) as avg_score,
      SUM(score) as total_score,
      AVG(tactical_pct) as avg_tactical_pct,
      AVG(explore_pct) as avg_explore_pct,
      AVG(inter_travel_pct) as avg_inter_travel_pct,
      AVG(resting_pct) as avg_resting_pct,
      COUNT(CASE WHEN tactical_pct IS NOT NULL THEN 1 END) as games_with_time_dist
    FROM games
    ${whereClause}
  `;
  const agg = db.prepare(aggQuery).get(...params) || {};

  const totalGames = agg.total_games || 0;
  const wins = agg.wins || 0;
  const winRate = totalGames > 0 ? Number((wins / totalGames).toFixed(4)) : 0;
  const winRatePercent = totalGames > 0 ? Number(((wins / totalGames) * 100).toFixed(2)) : 0;
  const totalPlaytimeSeconds = agg.total_duration || 0;
  const avgDurationSeconds = Math.round(agg.avg_duration || 0);

  // Factor in active run(s) when appropriate (e.g. today or all-time)
  let activePlaytimeSeconds = 0;
  let activeTurns = 0;
  let activeGamesCount = 0;

  if (filter.is_win !== 1 && filter.is_win !== '1' && filter.is_win !== true) {
    try {
      const activeRows = db.prepare("SELECT * FROM games WHERE is_active = 1").all();
      for (const ar of activeRows) {
        if (activeRunMatchesFilter(ar, filter)) {
          activePlaytimeSeconds += (ar.duration_seconds || 0);
          activeTurns += (ar.turns || 0);
          activeGamesCount++;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const combinedPlaytimeSeconds = totalPlaytimeSeconds + activePlaytimeSeconds;
  const combinedTurns = (agg.total_turns || 0) + activeTurns;

  // Median score computation directly via SQLite LIMIT/OFFSET (O(1) memory)
  let medianScore = 0;
  const gamesCount = agg.total_games || 0;
  if (gamesCount > 0) {
    if (gamesCount % 2 === 1) {
      const mid = Math.floor(gamesCount / 2);
      const row = db.prepare(`SELECT score FROM games ${whereClause} ORDER BY score ASC LIMIT 1 OFFSET ${mid}`).get(...params);
      medianScore = row ? (row.score || 0) : 0;
    } else {
      const offset = (gamesCount / 2) - 1;
      const midRows = db.prepare(`SELECT score FROM games ${whereClause} ORDER BY score ASC LIMIT 2 OFFSET ${offset}`).all(...params);
      if (midRows.length === 2) {
        medianScore = Math.round(((midRows[0].score || 0) + (midRows[1].score || 0)) / 2);
      } else if (midRows.length === 1) {
        medianScore = midRows[0].score || 0;
      }
    }
  }

  // Runes breakdown
  const runesListQuery = `
    SELECT runes_list
    FROM games
    ${whereClause} AND runes_list IS NOT NULL AND runes_list != ''
  `;
  const runeRows = db.prepare(runesListQuery).all(...params);
  const runesBreakdown = {};
  for (const row of runeRows) {
    try {
      const list = JSON.parse(row.runes_list);
      if (Array.isArray(list)) {
        for (const r of list) {
          runesBreakdown[r] = (runesBreakdown[r] || 0) + 1;
        }
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // Fastest Win by duration
  const fastestWinQuery = `
    SELECT id, combo, char_name, name, turns, duration_seconds, end_time, score, runes_count,
           version, version_major, version_minor, tactical_pct, explore_pct, inter_travel_pct, resting_pct, time_distribution
    FROM games
    ${whereClause} AND is_win = 1
    ORDER BY duration_seconds ASC
    LIMIT 1
  `;
  const fastestWinRow = db.prepare(fastestWinQuery).get(...params) || null;
  const fastestWin = fastestWinRow ? {
    ...fastestWinRow,
    duration_formatted: formatDuration(fastestWinRow.duration_seconds),
    time_distribution: fastestWinRow.time_distribution ? (typeof fastestWinRow.time_distribution === 'string' ? JSON.parse(fastestWinRow.time_distribution) : fastestWinRow.time_distribution) : null,
  } : null;

  // Shortest Win by turns
  const shortestWinQuery = `
    SELECT id, combo, char_name, name, turns, duration_seconds, end_time, score, runes_count,
           version, version_major, version_minor, tactical_pct, explore_pct, inter_travel_pct, resting_pct, time_distribution
    FROM games
    ${whereClause} AND is_win = 1
    ORDER BY turns ASC
    LIMIT 1
  `;
  const shortestWinRow = db.prepare(shortestWinQuery).get(...params) || null;
  const shortestWinByTurns = shortestWinRow ? {
    ...shortestWinRow,
    duration_formatted: formatDuration(shortestWinRow.duration_seconds),
    time_distribution: shortestWinRow.time_distribution ? (typeof shortestWinRow.time_distribution === 'string' ? JSON.parse(shortestWinRow.time_distribution) : shortestWinRow.time_distribution) : null,
  } : null;

  return {
    totalGames,
    wins,
    winRate,
    winRatePercent,
    fastestWin,
    shortestWinByTurns,
    totalPlaytime: {
      seconds: combinedPlaytimeSeconds,
      formatted: formatDuration(combinedPlaytimeSeconds),
      completedSeconds: totalPlaytimeSeconds,
      activeSeconds: activePlaytimeSeconds,
      activeFormatted: formatDuration(activePlaytimeSeconds),
    },
    avgDuration: {
      seconds: avgDurationSeconds,
      formatted: formatDuration(avgDurationSeconds),
    },
    scoreMetrics: {
      best: agg.best_score || 0,
      avg: Math.round(agg.avg_score || 0),
      median: medianScore,
      total: agg.total_score || 0,
    },
    turnSpeedMetrics: {
      avg: Number((agg.avg_turn_speed || 0).toFixed(2)),
      totalTurns: combinedTurns,
      completedTurns: agg.total_turns || 0,
      activeTurns,
    },
    timeDistributionMetrics: {
      avgTacticalPct: agg.avg_tactical_pct != null ? Number(Number(agg.avg_tactical_pct).toFixed(2)) : null,
      avgExplorePct: agg.avg_explore_pct != null ? Number(Number(agg.avg_explore_pct).toFixed(2)) : null,
      avgInterTravelPct: agg.avg_inter_travel_pct != null ? Number(Number(agg.avg_inter_travel_pct).toFixed(2)) : null,
      avgRestingPct: agg.avg_resting_pct != null ? Number(Number(agg.avg_resting_pct).toFixed(2)) : null,
      gamesCount: agg.games_with_time_dist || 0,
    },
    activeRunsCount: activeGamesCount,
    activePlaytime: {
      seconds: activePlaytimeSeconds,
      formatted: formatDuration(activePlaytimeSeconds),
    },
    runes: {
      totalExtracted: agg.total_runes || 0,
      maxInSingleGame: agg.max_runes_single_game || 0,
      breakdown: runesBreakdown,
    },
  };
}

/**
 * 2. getComboMatrix(filter)
 * Returns count of games and wins for each Species x Background combo,
 * plus god breakdown for each combo.
 */
function getComboMatrix(db, filter = {}) {
  const { whereClause, params } = buildWhereClause(filter);

  const query = `
    SELECT
      combo,
      species_abbr,
      species,
      background_abbr,
      background,
      god,
      COUNT(*) as games,
      SUM(is_win) as wins,
      MAX(score) as max_score,
      MAX(xl) as max_xl,
      MAX(runes_count) as max_runes
    FROM games
    ${whereClause}
    GROUP BY combo, god
  `;

  const rows = db.prepare(query).all(...params);

  // Group by combo
  const matrix = {};
  const speciesSummary = {};
  const backgroundSummary = {};
  const godSummary = {};

  let totalGames = 0;
  let totalWins = 0;

  for (const row of rows) {
    const combo = row.combo;
    const godName = row.god || 'Atheist';

    totalGames += row.games;
    totalWins += row.wins;

    if (!matrix[combo]) {
      const isForbidden = UNAVAILABLE_COMBOS.has(combo);
      const isRecommended = RECOMMENDED_COMBOS.has(combo);
      matrix[combo] = {
        combo,
        species: row.species_abbr,
        speciesName: row.species,
        background: row.background_abbr,
        backgroundName: row.background,
        games: 0,
        wins: 0,
        winRate: 0,
        maxScore: 0,
        maxXl: 0,
        maxRunes: 0,
        gods: {},
        status: isForbidden ? 'unavailable' : 'unplayed',
        isValid: isValidCombo(combo),
        isRecommended,
        restrictedGods: GODS.filter(g => isGodRestricted(row.species_abbr, g)),
      };
    }

    const c = matrix[combo];
    c.games += row.games;
    c.wins += row.wins;
    c.maxScore = Math.max(c.maxScore, row.max_score || 0);
    c.maxXl = Math.max(c.maxXl, row.max_xl || 0);
    c.maxRunes = Math.max(c.maxRunes, row.max_runes || 0);
    c.winRate = c.games > 0 ? Number((c.wins / c.games).toFixed(4)) : 0;
    c.status = c.wins > 0 ? 'won' : (c.games > 0 ? 'played' : c.status);

    c.gods[godName] = {
      games: row.games,
      wins: row.wins,
      winRate: row.games > 0 ? Number((row.wins / row.games).toFixed(4)) : 0,
    };

    // Species summary
    if (!speciesSummary[row.species_abbr]) {
      speciesSummary[row.species_abbr] = {
        abbr: row.species_abbr,
        name: row.species,
        games: 0,
        wins: 0,
        winRate: 0,
        combosPlayed: new Set(),
        combosWon: new Set(),
      };
    }
    const spSum = speciesSummary[row.species_abbr];
    spSum.games += row.games;
    spSum.wins += row.wins;
    spSum.combosPlayed.add(combo);
    if (row.wins > 0) spSum.combosWon.add(combo);

    // Background summary
    if (!backgroundSummary[row.background_abbr]) {
      backgroundSummary[row.background_abbr] = {
        abbr: row.background_abbr,
        name: row.background,
        games: 0,
        wins: 0,
        winRate: 0,
        combosPlayed: new Set(),
        combosWon: new Set(),
      };
    }
    const bgSum = backgroundSummary[row.background_abbr];
    bgSum.games += row.games;
    bgSum.wins += row.wins;
    bgSum.combosPlayed.add(combo);
    if (row.wins > 0) bgSum.combosWon.add(combo);

    // God summary
    if (!godSummary[godName]) {
      godSummary[godName] = {
        name: godName,
        games: 0,
        wins: 0,
        winRate: 0,
      };
    }
    godSummary[godName].games += row.games;
    godSummary[godName].wins += row.wins;
  }

  // Finalize winrates for summaries
  for (const s of Object.values(speciesSummary)) {
    s.winRate = s.games > 0 ? Number((s.wins / s.games).toFixed(4)) : 0;
    s.combosPlayedCount = s.combosPlayed.size;
    s.combosWonCount = s.combosWon.size;
    delete s.combosPlayed;
    delete s.combosWon;
  }
  for (const b of Object.values(backgroundSummary)) {
    b.winRate = b.games > 0 ? Number((b.wins / b.games).toFixed(4)) : 0;
    b.combosPlayedCount = b.combosPlayed.size;
    b.combosWonCount = b.combosWon.size;
    delete b.combosPlayed;
    delete b.combosWon;
  }
  for (const g of Object.values(godSummary)) {
    g.winRate = g.games > 0 ? Number((g.wins / g.games).toFixed(4)) : 0;
  }

  // Ensure all valid trunk species and backgrounds are present in reference lists
  const trunkSpecies = SPECIES.filter(s => s.trunk);
  const trunkBackgrounds = BACKGROUNDS.filter(b => b.trunk);

  const columnTotals = {
    all: {
      games: totalGames,
      wins: totalWins,
      winRate: totalGames > 0 ? Number((totalWins / totalGames).toFixed(4)) : 0,
    },
    ...backgroundSummary,
  };

  const rowTotals = {
    all: {
      games: totalGames,
      wins: totalWins,
      winRate: totalGames > 0 ? Number((totalWins / totalGames).toFixed(4)) : 0,
    },
    ...speciesSummary,
  };

  return {
    matrix,
    species: trunkSpecies.map(s => ({
      ...s,
      restrictedGods: GODS.filter(g => isGodRestricted(s.abbr, g)),
      stats: speciesSummary[s.abbr] || { abbr: s.abbr, name: s.name, games: 0, wins: 0, winRate: 0, combosPlayedCount: 0, combosWonCount: 0 },
    })),
    backgrounds: trunkBackgrounds.map(b => ({
      ...b,
      stats: backgroundSummary[b.abbr] || { abbr: b.abbr, name: b.name, category: b.category, games: 0, wins: 0, winRate: 0, combosPlayedCount: 0, combosWonCount: 0 },
    })),
    columnTotals,
    rowTotals,
    gods: Object.values(godSummary),
    summary: {
      totalGames,
      totalWins,
      winRate: totalGames > 0 ? Number((totalWins / totalGames).toFixed(4)) : 0,
      combosPlayed: Object.keys(matrix).length,
      combosWon: Object.values(matrix).filter(c => c.wins > 0).length,
    },
  };
}

/**
 * 3. getGames(filter, limit, offset, sort)
 * Paginated or full list of runs for explorer table and client caching.
 * Supports limit = null / 'all' to fetch complete run history without artificial caps.
 */
function getGames(db, filter = {}, limit = null, offset = 0, sort = {}) {
  const { whereClause, params } = buildWhereClause(filter);

  // Sorting
  const ALLOWED_SORT_FIELDS = new Set([
    'end_time',
    'start_time',
    'score',
    'turns',
    'duration_seconds',
    'xl',
    'turn_speed',
    'runes_count',
  ]);
  const sortField = ALLOWED_SORT_FIELDS.has(sort.field) ? sort.field : 'end_time';
  const sortDir = (sort.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total matching games
  const countQuery = `SELECT COUNT(*) as count FROM games ${whereClause}`;
  const total = db.prepare(countQuery).get(...params).count;

  // Retrieve records (unlimited if limit is null/all/<=0, or paginated if limit > 0)
  const isLimited = limit !== null && limit !== undefined && limit !== 'all' && Number(limit) > 0;
  const numLimit = isLimited ? Number(limit) : null;
  const numOffset = isLimited ? Math.max(0, Number(offset) || 0) : 0;

  const query = `
    SELECT
      id, name, species, species_abbr, background, background_abbr, combo, char_name,
      god, score, turns, duration_seconds, start_time, end_time, place, branch,
      level, xl, hp, max_hp, mp, max_mp, killer, ktyp, dam, outcome, is_win,
      runes_count, runes_list, turn_speed, source_file, morgue_file, version,
      version_major, version_minor,
      tactical_pct, explore_pct, inter_travel_pct, resting_pct, time_distribution,
      seed, game_type, is_active
    FROM games
    ${whereClause}
    ORDER BY ${sortField} ${sortDir}
    ${isLimited ? 'LIMIT ? OFFSET ?' : ''}
  `;

  const queryParams = isLimited ? [...params, numLimit, numOffset] : [...params];
  const rows = db.prepare(query).all(...queryParams);

  const games = rows.map(r => ({
    ...r,
    duration_formatted: formatDuration(r.duration_seconds),
    runes_list: r.runes_list ? (typeof r.runes_list === 'string' ? JSON.parse(r.runes_list) : r.runes_list) : [],
    time_distribution: r.time_distribution ? (typeof r.time_distribution === 'string' ? JSON.parse(r.time_distribution) : r.time_distribution) : null,
  }));

  return {
    games,
    total,
    limit: numLimit,
    offset: numOffset,
    page: isLimited ? Math.floor(numOffset / numLimit) + 1 : 1,
    totalPages: isLimited ? Math.ceil(total / numLimit) || 1 : 1,
  };
}

/**
 * 4. getActiveRuns() & getActiveRun()
 * Discovers and parses all ongoing games (is_active = 1), ordered by most recent first.
 */
function getActiveRuns(db) {
  const query = `
    SELECT
      id, name, species, species_abbr, background, background_abbr, combo, char_name,
      god, score, turns, duration_seconds, start_time, end_time, place, branch,
      level, xl, hp, max_hp, mp, max_mp, killer, ktyp, dam, outcome, is_win,
      runes_count, runes_list, turn_speed, source_file, morgue_file, version,
      version_major, version_minor,
      tactical_pct, explore_pct, inter_travel_pct, resting_pct, time_distribution,
      seed, game_type, is_active, raw_data
    FROM games
    WHERE is_active = 1
    ORDER BY end_time DESC
  `;
  const rows = db.prepare(query).all();

  return rows.map(row => {
    let extraData = {};
    if (row.raw_data) {
      try {
        extraData = JSON.parse(row.raw_data);
      } catch (e) {
        // ignore
      }
    }

    return {
      ...extraData,
      ...row,
      id: row.id,
      duration_formatted: formatDuration(row.duration_seconds),
      runes_list: row.runes_list ? (typeof row.runes_list === 'string' ? JSON.parse(row.runes_list) : row.runes_list) : (extraData.runes_list || []),
      time_distribution: row.time_distribution ? (typeof row.time_distribution === 'string' ? JSON.parse(row.time_distribution) : row.time_distribution) : (extraData.time_distribution ? (typeof extraData.time_distribution === 'string' ? JSON.parse(extraData.time_distribution) : extraData.time_distribution) : null),
      tactical_pct: row.tactical_pct ?? extraData.tactical_pct ?? null,
      explore_pct: row.explore_pct ?? extraData.explore_pct ?? null,
      inter_travel_pct: row.inter_travel_pct ?? extraData.inter_travel_pct ?? null,
      resting_pct: row.resting_pct ?? extraData.resting_pct ?? null,
      is_active: 1,
    };
  });
}

function getActiveRun(db) {
  const runs = getActiveRuns(db);
  return runs[0] || null;
}

/**
 * 5. getSuggestions(filter)
 * Recommends unwon combos and unplayed combos based on player history
 * and valid DCSS combinations. Optionally filtered by version.
 */
function getSuggestions(db, filter = {}) {
  const normFilter = typeof filter === 'string' ? { version: filter } : (filter || {});
  const versionFilter = (normFilter.version && normFilter.version !== 'all') ? { version: normFilter.version } : {};
  const { whereClause: versionWhere, params: versionParams } = buildWhereClause(versionFilter);

  const trunkSpecies = SPECIES.filter(s => s.trunk);
  const trunkBackgrounds = BACKGROUNDS.filter(b => b.trunk);

  // Get player stats for all combos (optionally filtered by version)
  const matrixQuery = `
    SELECT
      combo,
      species_abbr,
      species,
      background_abbr,
      background,
      COUNT(*) as games,
      SUM(is_win) as wins,
      MAX(score) as max_score,
      MAX(xl) as max_xl,
      MAX(runes_count) as max_runes
    FROM games
    ${versionWhere}
    GROUP BY combo
  `;
  const rows = db.prepare(matrixQuery).all(...versionParams);
  const playerCombos = new Map(rows.map(r => [r.combo, r]));

  // Won species and backgrounds
  const wonSpecies = new Set();
  const wonBackgrounds = new Set();
  const wonCombos = new Set();

  for (const r of rows) {
    if (r.wins > 0) {
      wonSpecies.add(r.species_abbr);
      wonBackgrounds.add(r.background_abbr);
      wonCombos.add(r.combo);
    }
  }

  // Gods won
  const wonGodsWhere = versionWhere
    ? `${versionWhere} AND is_win = 1 AND god IS NOT NULL AND god != ''`
    : `WHERE is_active = 0 AND is_win = 1 AND god IS NOT NULL AND god != ''`;
  const wonGodsRows = db.prepare(`
    SELECT DISTINCT god
    FROM games
    ${wonGodsWhere}
  `).all(...versionParams);
  const wonGods = new Set(wonGodsRows.map(r => r.god));

  // 1. Unwon combos (played at least once, but zero wins)
  const unwonCombos = [];
  for (const r of rows) {
    if (r.wins === 0 && isValidCombo(r.combo)) {
      let priorityScore = (r.max_xl || 1) * 10 + (r.games || 1);
      let reason = `Played ${r.games} game${r.games > 1 ? 's' : ''} · Max XL ${r.max_xl} · Best score: ${r.max_score.toLocaleString()}`;

      unwonCombos.push({
        combo: r.combo,
        species: r.species,
        speciesAbbr: r.species_abbr,
        background: r.background,
        backgroundAbbr: r.background_abbr,
        games: r.games,
        maxXl: r.max_xl,
        maxScore: r.max_score,
        maxRunes: r.max_runes,
        priorityScore,
        reason,
      });
    }
  }
  unwonCombos.sort((a, b) => b.priorityScore - a.priorityScore);

  // 2. Unplayed combos (valid trunk combos never played)
  const unplayedCombos = [];
  for (const sp of trunkSpecies) {
    for (const bg of trunkBackgrounds) {
      const combo = `${sp.abbr}${bg.abbr}`;
      if (!isValidCombo(combo)) continue;

      if (!playerCombos.has(combo)) {
        let tag = 'Standard';
        let recommendationReason = 'Unplayed combination';

        if (RECOMMENDED_COMBOS.has(combo)) {
          tag = 'Recommended Synergy';
          recommendationReason = 'Official DCSS recommended combo';
        } else if (wonSpecies.has(sp.abbr)) {
          tag = 'Species Mastered';
          recommendationReason = `Species mastered (${sp.name})`;
        } else if (wonBackgrounds.has(bg.abbr)) {
          tag = 'Class Mastered';
          recommendationReason = `Background mastered (${bg.name})`;
        }

        unplayedCombos.push({
          combo,
          species: sp.name,
          speciesAbbr: sp.abbr,
          background: bg.name,
          backgroundAbbr: bg.abbr,
          category: bg.category,
          tag,
          reason: recommendationReason,
        });
      }
    }
  }

  // Sort unplayed: top tier first, then mastered synergy, then standard
  unplayedCombos.sort((a, b) => {
    const tierOrder = { 'Top Tier / High Synergy': 0, 'Mastered Species Synergy': 1, 'Mastered Background Synergy': 2, 'Standard': 3 };
    return (tierOrder[a.tag] ?? 4) - (tierOrder[b.tag] ?? 4);
  });

  // 3. Top Recommendations (curated top 5 for the player's next game)
  const topRecommendations = [];

  // Top 3 closest unwon combos
  for (let i = 0; i < Math.min(3, unwonCombos.length); i++) {
    topRecommendations.push({
      type: 'Unwon Mastery',
      combo: unwonCombos[i].combo,
      name: `${unwonCombos[i].species} ${unwonCombos[i].background}`,
      reason: unwonCombos[i].reason,
      badge: 'Unwon Finish',
    });
  }

  // Top 2 unplayed strong synergies
  for (let i = 0; i < Math.min(2, unplayedCombos.length); i++) {
    topRecommendations.push({
      type: 'New Combination',
      combo: unplayedCombos[i].combo,
      name: `${unplayedCombos[i].species} ${unplayedCombos[i].background}`,
      reason: unplayedCombos[i].reason,
      badge: unplayedCombos[i].tag,
    });
  }

  // 4. Great / Greater Player Progress
  const totalCombosCount = trunkSpecies.length * trunkBackgrounds.length - Array.from(UNAVAILABLE_COMBOS).filter(c => isValidCombo(c) || (SPECIES.some(s => s.trunk && s.abbr === c.slice(0, 2)) && BACKGROUNDS.some(b => b.trunk && b.abbr === c.slice(2, 4)))).length;

  const greatSpecies = trunkSpecies.filter(sp => {
    return trunkBackgrounds.every(bg => {
      const combo = `${sp.abbr}${bg.abbr}`;
      return UNAVAILABLE_COMBOS.has(combo) || wonCombos.has(combo);
    });
  }).map(s => s.name);

  const greatClasses = trunkBackgrounds.filter(bg => {
    return trunkSpecies.every(sp => {
      const combo = `${sp.abbr}${bg.abbr}`;
      return UNAVAILABLE_COMBOS.has(combo) || wonCombos.has(combo);
    });
  }).map(b => b.name);

  return {
    topRecommendations,
    recommendedCombos: Array.from(RECOMMENDED_COMBOS),
    unwonCombos: unwonCombos.slice(0, 25),
    unplayedCombos: unplayedCombos.slice(0, 50),
    progress: {
      speciesWon: wonSpecies.size,
      speciesTotal: trunkSpecies.length,
      speciesRemaining: trunkSpecies.filter(s => !wonSpecies.has(s.abbr)).map(s => s.name),
      backgroundsWon: wonBackgrounds.size,
      backgroundsTotal: trunkBackgrounds.length,
      backgroundsRemaining: trunkBackgrounds.filter(b => !wonBackgrounds.has(b.abbr)).map(b => b.name),
      combosWon: wonCombos.size,
      combosTotal: totalCombosCount,
      combosPercentage: Number(((wonCombos.size / totalCombosCount) * 100).toFixed(2)),
      greatSpecies,
      greatClasses,
      isGreatPlayer: wonSpecies.size === trunkSpecies.length,
      isGreaterPlayer: wonCombos.size === totalCombosCount,
      godsWon: Array.from(wonGods),
      godsRemaining: GODS.filter(g => !wonGods.has(g)),
    },
  };
}

/**
 * 6. getVersions(db)
 * Returns distinct versions and detected game sources available in the database.
 */
function getVersions(db) {
  const versionRows = db.prepare(`
    SELECT DISTINCT version
    FROM games
    WHERE version IS NOT NULL AND version != '' AND is_active = 0
  `).all();

  const sourceRows = db.prepare(`
    SELECT DISTINCT source_file
    FROM games
    WHERE source_file IS NOT NULL AND is_active = 0 AND (ktyp IS NULL OR ktyp != 'active')
    ORDER BY source_file ASC
  `).all();

  const versions = Array.from(new Set(versionRows.map(r => r.version).filter(Boolean)));
  versions.sort((a, b) => compareVersions(b, a) || b.localeCompare(a));

  const sources = Array.from(new Set(sourceRows.map(r => r.source_file).filter(Boolean)));

  return {
    versions,
    sources,
  };
}

module.exports = {
  getStats,
  getComboMatrix,
  getGames,
  getActiveRuns,
  getActiveRun,
  getSuggestions,
  getVersions,
  buildWhereClause,
};

