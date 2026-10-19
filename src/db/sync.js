/**
 * DCSS Incremental Synchronization Engine
 * Cross-platform (macOS & Linux) directory auto-discovery with manual override.
 * Strictly read-only access to DCSS game files with boundary validation.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseXlogLine } = require('./logfileParser');
const { parseActiveDump, extractRunesFromMorgue, isFinishedMorgue, parseTimeDistribution } = require('./morgueParser');
const { parseDcssVersion } = require('./constants');
const logger = require('../logger');

/**
 * Reads configured dcss_dir from config.json if present
 */
function getConfigDcssDir() {
  try {
    const configPath = path.resolve(__dirname, '../../config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.dcss_dir && String(cfg.dcss_dir).trim()) {
        let rawDir = String(cfg.dcss_dir).trim();
        if (rawDir.startsWith('~/') || rawDir === '~') {
          rawDir = path.join(os.homedir(), rawDir.slice(1));
        }
        return path.resolve(rawDir);
      }
    }
  } catch (e) {
    // ignore parse error
  }
  return null;
}

/**
 * Checks if child is a descendant directory of parent
 */
function isSubdirectory(parent, child) {
  const rel = path.relative(parent, child);
  return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Returns candidate DCSS installation directories across macOS, Linux, and user overrides.
 */
function getDefaultDcssDirs() {
  const dirs = [];

  // 1. Permanent override configured in config.json
  const configDir = getConfigDcssDir();
  if (configDir) {
    dirs.push(configDir);
  }

  // 2. Explicit user override via environment variable
  if (process.env.DCSS_DIR) {
    dirs.push(path.resolve(process.env.DCSS_DIR));
  }
  if (process.env.DCSS_DIRS) {
    process.env.DCSS_DIRS.split(/[:;,]/).filter(Boolean).forEach(d => dirs.push(path.resolve(d.trim())));
  }

  // 3. macOS standard application support directory (default DCSS writes directly here)
  dirs.push(
    path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup'),
    path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup/Stable'),
    path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup/Trunk')
  );

  // 4. Linux standard, XDG, and package manager directories
  dirs.push(
    path.join(os.homedir(), '.crawl'),
    path.join(os.homedir(), '.local/share/crawl'),
    path.join(os.homedir(), '.local/share/dcss'),
    path.join(os.homedir(), '.var/app/org.develz.Crawl/data/crawl'),
    path.join(os.homedir(), '.var/app/org.develz.Crawl/.crawl'),
    '/var/games/crawl',
    '/usr/share/games/crawl'
  );

  return dirs;
}

/**
 * Discovers and validates existing DCSS installation directories.
 * Ensures parent directories are NOT scanned when child directories (e.g. Stable/ or Trunk/) exist.
 * Silently skips permission errors (EACCES) or non-existent paths.
 */
function getDcssDirs(customDirs) {
  const candidateDirs = customDirs && customDirs.length > 0 ? customDirs : getDefaultDcssDirs();
  const expandedCandidates = [];

  for (const d of candidateDirs) {
    if (!d) continue;
    expandedCandidates.push(d);
    // If directory contains child DCSS installations (e.g. Stable or Trunk), also include children
    try {
      if (fs.existsSync(d)) {
        const stableSub = path.join(d, 'Stable');
        if (fs.existsSync(stableSub)) expandedCandidates.push(stableSub);
        const trunkSub = path.join(d, 'Trunk');
        if (fs.existsSync(trunkSub)) expandedCandidates.push(trunkSub);
      }
    } catch (e) {
      // ignore
    }
  }

  const valid = [];
  const seen = new Set();

  for (const d of expandedCandidates) {
    try {
      if (fs.existsSync(d)) {
        const real = fs.realpathSync(d);
        if (!seen.has(real)) {
          seen.add(real);
          valid.push(real);
        }
      } else {
        logger.debug('Discovery', `Skipping non-existent candidate path: ${d}`);
      }
    } catch (e) {
      logger.debug('Discovery', `Skipping candidate path (${e.message}): ${d}`);
    }
  }

  // Filter out any parent directory if one of its subdirectories is also being scanned
  // This guarantees we NEVER scan both a parent (e.g. ".../Dungeon Crawl Stone Soup")
  // and its children (e.g. ".../Stable" or ".../Trunk").
  const filtered = valid.filter(d => !valid.some(other => isSubdirectory(d, other)));

  for (const dir of filtered) {
    logger.debug('Discovery', `Verified DCSS directory: ${dir}`);
  }

  return filtered;
}

/**
 * Resolves saves and morgue locations within a DCSS directory.
 * Supports both hierarchical (dcssDir/saves, dcssDir/morgue)
 * and flat layouts (where files reside directly in dcssDir).
 */
function locateArtifactDirs(dcssDir) {
  let savesDir = path.join(dcssDir, 'saves');
  if (!fs.existsSync(savesDir)) {
    savesDir = dcssDir;
  }

  let morgueDir = path.join(dcssDir, 'morgue');
  if (!fs.existsSync(morgueDir)) {
    morgueDir = dcssDir;
  }

  return { savesDir, morgueDir };
}

/**
 * Resolves morgue filename from a game entry.
 * DCSS names morgue files on disk using local system time.
 * Falls back to UTC getters if local name is not found in morgueFiles (e.g. remote WebTiles logs).
 */
function getExpectedMorgueFilename(game, morgueFiles = null) {
  if (!game.end_time || !game.name) return null;
  const d = new Date(game.end_time);
  if (isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  const localName = `morgue-${game.name}-${y}${m}${day}-${hh}${mm}${ss}.txt`;

  if (morgueFiles) {
    const hasFile = (fn) => (typeof morgueFiles.has === 'function' ? morgueFiles.has(fn) : Boolean(morgueFiles[fn]));
    if (hasFile(localName)) {
      return localName;
    }

    const utcY = d.getUTCFullYear();
    const utcM = String(d.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(d.getUTCDate()).padStart(2, '0');
    const utcHH = String(d.getUTCHours()).padStart(2, '0');
    const utcMM = String(d.getUTCMinutes()).padStart(2, '0');
    const utcSS = String(d.getUTCSeconds()).padStart(2, '0');
    const utcName = `morgue-${game.name}-${utcY}${utcM}${utcDay}-${utcHH}${utcMM}${utcSS}.txt`;

    if (hasFile(utcName)) {
      return utcName;
    }
  }

  return localName;
}

/**
 * Extracts the death timestamp (in milliseconds) from a DCSS morgue filename:
 * e.g. morgue-<name>-YYYYMMDD-HHMMSS.txt
 */
function parseMorgueFilenameTimestamp(filename) {
  const match = filename.match(/-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.txt$/);
  if (!match) return null;
  const [_, y, m, d, hr, min, sec] = match;
  // DCSS formats death timestamp in local time
  const date = new Date(
    parseInt(y, 10),
    parseInt(m, 10) - 1,
    parseInt(d, 10),
    parseInt(hr, 10),
    parseInt(min, 10),
    parseInt(sec, 10)
  );
  return isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * Runs the fast incremental synchronization
 */
function sync(db, options = {}) {
  const startTime = Date.now();
  const dcssDirs = getDcssDirs(options.dcssDirs);
  const force = Boolean(options.force);

  let newGamesCount = 0;
  let updatedGamesCount = 0;

  // Prepared SQL statements
  const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
  const setMeta = db.prepare(`
    INSERT INTO meta (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const upsertGame = db.prepare(`
    INSERT INTO games (
      id, name, species, species_abbr, background, background_abbr, combo, char_name,
      god, score, turns, aut, duration_seconds, start_time, end_time, place, branch,
      level, xl, hp, max_hp, mp, max_mp, killer, ktyp, dam, outcome, is_win,
      runes_count, runes_list, turn_speed, source_file, morgue_file, version,
      version_major, version_minor, version_patch,
      tactical_pct, explore_pct, inter_travel_pct, resting_pct, time_distribution,
      seed, game_type, is_active, raw_data
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      species = excluded.species,
      species_abbr = excluded.species_abbr,
      background = excluded.background,
      background_abbr = excluded.background_abbr,
      combo = excluded.combo,
      char_name = excluded.char_name,
      god = excluded.god,
      score = excluded.score,
      turns = excluded.turns,
      aut = excluded.aut,
      duration_seconds = excluded.duration_seconds,
      end_time = excluded.end_time,
      place = excluded.place,
      branch = excluded.branch,
      level = excluded.level,
      xl = excluded.xl,
      hp = excluded.hp,
      max_hp = excluded.max_hp,
      mp = excluded.mp,
      max_mp = excluded.max_mp,
      killer = excluded.killer,
      ktyp = excluded.ktyp,
      dam = excluded.dam,
      outcome = excluded.outcome,
      is_win = excluded.is_win,
      runes_count = excluded.runes_count,
      runes_list = COALESCE(excluded.runes_list, games.runes_list),
      turn_speed = excluded.turn_speed,
      source_file = excluded.source_file,
      morgue_file = COALESCE(excluded.morgue_file, games.morgue_file),
      version = excluded.version,
      version_major = excluded.version_major,
      version_minor = excluded.version_minor,
      version_patch = excluded.version_patch,
      tactical_pct = COALESCE(excluded.tactical_pct, games.tactical_pct),
      explore_pct = COALESCE(excluded.explore_pct, games.explore_pct),
      inter_travel_pct = COALESCE(excluded.inter_travel_pct, games.inter_travel_pct),
      resting_pct = COALESCE(excluded.resting_pct, games.resting_pct),
      time_distribution = COALESCE(excluded.time_distribution, games.time_distribution),
      seed = excluded.seed,
      game_type = excluded.game_type,
      is_active = excluded.is_active,
      raw_data = excluded.raw_data
  `);

  const allActiveSaves = [];

  logger.debug('Sync', `Beginning sync across ${dcssDirs.length} DCSS root directory/directories (force: ${force})`);

  db.exec('BEGIN TRANSACTION');

  try {
    for (const dcssDir of dcssDirs) {
      const { savesDir, morgueDir } = locateArtifactDirs(dcssDir);
      logger.debug('Sync:Dir', `Scanning ${dcssDir} -> saves: ${savesDir}, morgue: ${morgueDir}`);

      // Map existing morgue files for fast lookup
      const morgueFiles = new Map();
      try {
        if (fs.existsSync(morgueDir)) {
          const files = fs.readdirSync(morgueDir);
          for (const f of files) {
            if (f.endsWith('.txt')) {
              morgueFiles.set(f, path.join(morgueDir, f));
            }
          }
        }
      } catch (e) {
        // EACCES on morgue directory, ignore
      }

      // 1. Process logfiles
      const logfileNames = ['logfile', 'logfile-sprint', 'logfile-hints'];
      for (const logName of logfileNames) {
        const logPath = path.join(savesDir, logName);
        let stat = null;
        try {
          if (!fs.existsSync(logPath)) continue;
          stat = fs.statSync(logPath);
        } catch (e) {
          continue;
        }

        const metaKey = `logfile:${logPath}`;
        const lastMtime = getMeta.get(`mtime:${metaKey}`)?.value;
        const lastSize = parseInt(getMeta.get(`size:${metaKey}`)?.value || '0', 10);

        if (!force && lastMtime === stat.mtimeMs.toString() && lastSize === stat.size) {
          continue;
        }

        let content = '';
        try {
          // Strictly read-only reading
          content = fs.readFileSync(logPath, 'utf8');
        } catch (e) {
          continue;
        }

        // Record boundary validation: if file was being actively written and didn't end with \n, discard incomplete line
        const endsWithNewline = content.endsWith('\n');
        const rawLines = content.split(/\r?\n/).filter(Boolean);
        const lines = endsWithNewline ? rawLines : rawLines.slice(0, -1);

        for (const line of lines) {
          const game = parseXlogLine(line, path.relative(path.dirname(dcssDir), logPath));
          if (!game) continue;

          // Extract semantic version components
          const vInfo = parseDcssVersion(game.version || (game.source_file?.includes('Trunk') ? 'trunk' : 'stable'));
          game.version_major = vInfo.major;
          game.version_minor = vInfo.minor;
          game.version_patch = vInfo.patch;

          // Initialize decaaut metrics
          game.time_distribution = null;
          game.tactical_pct = null;
          game.explore_pct = null;
          game.inter_travel_pct = null;
          game.resting_pct = null;

          // Attempt morgue enrichment
          const expectedMorgue = getExpectedMorgueFilename(game, morgueFiles);
          if (expectedMorgue && morgueFiles.has(expectedMorgue)) {
            const fullMorguePath = morgueFiles.get(expectedMorgue);
            game.morgue_file = path.relative(path.dirname(dcssDir), fullMorguePath);

            try {
              const morgueContent = fs.readFileSync(fullMorguePath, 'utf8');

              // Runes list enrichment
              if (game.runes_count > 0 || game.is_win) {
                const runesData = extractRunesFromMorgue(morgueContent);
                if (runesData.list.length > 0) {
                  game.runes_list = JSON.stringify(runesData.list);
                  if (runesData.count > 0) {
                    game.runes_count = runesData.count;
                  }
                }
              }

              // Decaaut time distribution enrichment
              const timeDist = parseTimeDistribution(morgueContent);
              if (timeDist) {
                game.time_distribution = JSON.stringify(timeDist);
                game.tactical_pct = timeDist.tactical_pct;
                game.explore_pct = timeDist.explore_pct;
                game.inter_travel_pct = timeDist.inter_travel_pct;
                game.resting_pct = timeDist.resting_pct;
              }
            } catch (e) {
              // Ignore read errors
            }
          }

          upsertGame.run(
            game.id,
            game.name,
            game.species,
            game.species_abbr,
            game.background,
            game.background_abbr,
            game.combo,
            game.char_name,
            game.god,
            game.score,
            game.turns,
            game.aut,
            game.duration_seconds,
            game.start_time,
            game.end_time,
            game.place,
            game.branch,
            game.level,
            game.xl,
            game.hp,
            game.max_hp,
            game.mp,
            game.max_mp,
            game.killer,
            game.ktyp,
            game.dam,
            game.outcome,
            game.is_win,
            game.runes_count,
            game.runes_list,
            game.turn_speed,
            game.source_file,
            game.morgue_file,
            game.version,
            game.version_major || 0,
            game.version_minor || 0,
            game.version_patch || 0,
            game.tactical_pct ?? null,
            game.explore_pct ?? null,
            game.inter_travel_pct ?? null,
            game.resting_pct ?? null,
            game.time_distribution || null,
            game.seed,
            game.game_type,
            0, // completed games are not active
            game.raw_data
          );

          newGamesCount++;
        }

        // Record file sync state
        setMeta.run(`mtime:${metaKey}`, stat.mtimeMs.toString());
        setMeta.run(`size:${metaKey}`, stat.size.toString());
      }

      // 2. Discover active ongoing games SOLELY from character dump files in morgue/
      // NEVER touch, open, stat, or scan .cs save files under any circumstances.
      try {
        if (fs.existsSync(morgueDir)) {
          const files = fs.readdirSync(morgueDir);
          for (const f of files) {
            // Active dump files in morgue/ are <CharacterName>.txt (not morgue-*.txt, not crash-*.txt)
            if (f.endsWith('.txt') && !f.startsWith('morgue-') && !f.startsWith('crash-')) {
              const fullDumpPath = path.join(morgueDir, f);
              try {
                const stat = fs.statSync(fullDumpPath);
                const content = fs.readFileSync(fullDumpPath, 'utf8');
                // parseActiveDump validates that the file does not contain death/win statements
                const activeData = parseActiveDump(content, path.relative(path.dirname(dcssDir), fullDumpPath));
                if (activeData) {
                  // Verify that this dump file is not an old leftover from a run that has already concluded.
                  // We compare morgue metadata/timestamps without touching .cs files or relying solely on seeds
                  // (since players can play preset/custom seeds repeatedly with the same character name).
                  let isStale = false;
                  for (const mf of files) {
                    if (mf.startsWith(`morgue-${activeData.name}-`) && mf.endsWith('.txt')) {
                      try {
                        let morgueTime = parseMorgueFilenameTimestamp(mf);
                        if (!morgueTime) {
                          morgueTime = fs.statSync(path.join(morgueDir, mf)).mtimeMs;
                        }

                        // If a finished morgue was generated at or after this dump file was last written,
                        // this dump belongs to that completed/dead run.
                        if (morgueTime >= (stat.mtimeMs - 2000)) {
                          isStale = true;
                          break;
                        }
                      } catch (e) {
                        // ignore stat error
                      }
                    }
                  }

                  if (!isStale) {
                    allActiveSaves.push({
                      dcssDir,
                      morgueDir,
                      filename: f,
                      path: fullDumpPath,
                      mtimeMs: stat.mtimeMs,
                      stat,
                      activeData,
                    });
                  } else {
                    logger.debug('Sync:Active', `Ignored stale character dump: ${f} (superseded by finished morgue or logged game)`);
                  }
                }
              } catch (e) {
                // Ignore read or parse error on single dump file
              }
            }
          }
        }
      } catch (e) {
        // EACCES on morgueDir, ignore
      }
    }

    // Process all discovered active runs globally
    allActiveSaves.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const discoveredActiveIds = new Set();

    for (let i = 0; i < allActiveSaves.length; i++) {
      const { dcssDir, path: dumpPath, mtimeMs, activeData } = allActiveSaves[i];

      // Safe, path-agnostic active ID
      const sanitizedDir = path.basename(dcssDir).replace(/[^a-zA-Z0-9]/g, '_');
      const activeId = `active_${sanitizedDir}_${activeData.name}`;
      discoveredActiveIds.add(activeId);
      const nowIso = new Date(mtimeMs).toISOString();

      // Semantic version components for active run
      const vInfo = parseDcssVersion(activeData.version || (dumpPath.includes('Trunk') ? 'trunk' : 'stable'));
      activeData.version_major = vInfo.major;
      activeData.version_minor = vInfo.minor;
      activeData.version_patch = vInfo.patch;

      upsertGame.run(
        activeId,
        activeData.name,
        activeData.species,
        activeData.species_abbr,
        activeData.background,
        activeData.background_abbr,
        activeData.combo,
        activeData.char_name,
        activeData.god,
        0, // active games have no final score
        activeData.turns,
        0,
        activeData.duration_seconds,
        new Date(mtimeMs - (activeData.duration_seconds * 1000)).toISOString(),
        nowIso,
        activeData.place,
        activeData.place ? activeData.place.split(':')[0] : 'D',
        activeData.place ? parseInt(activeData.place.split(':')[1], 10) || 1 : 1,
        activeData.xl,
        activeData.hp,
        activeData.max_hp,
        activeData.mp,
        activeData.max_mp,
        null, // no killer
        'active',
        0,
        `Exploring ${activeData.place_description || activeData.place || 'the Dungeon'}`,
        0,
        activeData.runes_count || 0,
        JSON.stringify(activeData.runes_list || []),
        activeData.turn_speed || 0.0,
        path.relative(path.dirname(dcssDir), dumpPath),
        activeData.morgue_file,
        activeData.version,
        activeData.version_major || 0,
        activeData.version_minor || 0,
        activeData.version_patch || 0,
        activeData.tactical_pct ?? null,
        activeData.explore_pct ?? null,
        activeData.inter_travel_pct ?? null,
        activeData.resting_pct ?? null,
        activeData.time_distribution || null,
        activeData.seed,
        'normal',
        1, // IS ACTIVE
        JSON.stringify(activeData)
      );

      logger.debug('Sync:Active', `Ingested active character: ${activeData.name} (${activeData.combo}) on ${activeData.place} (XL ${activeData.xl})`);
      updatedGamesCount++;
    }

    // Clean up any stale active runs in DB whose character dump is gone or finished
    const existingActive = db.prepare("SELECT id FROM games WHERE is_active = 1 OR ktyp = 'active' OR id LIKE 'active_%'").all();
    const deleteActive = db.prepare('DELETE FROM games WHERE id = ?');
    for (const row of existingActive) {
      if (!discoveredActiveIds.has(row.id)) {
        deleteActive.run(row.id);
        logger.debug('Sync:Active', `Removed stale active run: ${row.id}`);
      }
    }

    db.exec('COMMIT');

    // Update global sync meta
    setMeta.run('last_sync_timestamp', new Date().toISOString());
    setMeta.run('last_sync_duration_ms', (Date.now() - startTime).toString());

    logger.debug('Sync', `Sync cycle completed in ${Date.now() - startTime}ms: ${newGamesCount} new, ${updatedGamesCount} updated.`);

  } catch (err) {
    db.exec('ROLLBACK');
    logger.error('Sync', `Sync failed: ${err.message}`);
    throw err;
  }

  const totalGames = db.prepare('SELECT COUNT(*) as count FROM games WHERE is_active = 0').get().count;

  return {
    success: true,
    newGamesCount,
    updatedGamesCount,
    totalGames,
    syncDurationMs: Date.now() - startTime,
  };
}

module.exports = {
  sync,
  getDcssDirs,
  getDefaultDcssDirs,
  getConfigDcssDir,
  locateArtifactDirs,
  getExpectedMorgueFilename,
};
