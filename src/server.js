/**
 * DCSS Stats Dashboard — Express Web Server
 * Serves the modern interactive dashboard UI and REST APIs.
 */

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const dcssDb = require('./db');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3333;

const HOST = process.env.HOST || '127.0.0.1';

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  next();
});

// Middleware
app.use(express.json());

// CSRF & Cross-Origin validation for mutating requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host && originUrl.hostname !== 'localhost' && originUrl.hostname !== '127.0.0.1') {
          return res.status(403).json({ success: false, error: 'Cross-origin request rejected.' });
        }
      } catch (e) {
        return res.status(403).json({ success: false, error: 'Invalid Origin header.' });
      }
    }
  }
  next();
});

// Verbose HTTP Debug Tracer (Active only when debug: true in config.json)
app.use((req, res, next) => {
  if (logger.isDebugEnabled()) {
    const start = performance.now();
    res.on('finish', () => {
      const dur = (performance.now() - start).toFixed(1);
      logger.debug('HTTP', `${req.method} ${req.originalUrl} -> ${res.statusCode} (${dur}ms)`);
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

// Initialize database & run initial sync
const { getConfigDcssDir } = require('./db/sync');
const configuredDir = getConfigDcssDir();
if (configuredDir) {
  logger.info('Config', `Permanent dcss_dir loaded from config.json: ${configuredDir}`);
}

const client = dcssDb.getDefaultClient();
const initialSync = client.sync();
logger.info('DB', `Initial sync complete: ${initialSync.totalGames} total games (${initialSync.newGamesCount} new) in ${initialSync.syncDurationMs}ms`);

// Concurrency mutex and rate limiter for sync operations
let isSyncing = false;
let lastSyncTimestamp = 0;
const MIN_SYNC_INTERVAL_MS = 3000;

// Automatic background sync every 15 seconds to track active games and new morgues
const syncInterval = setInterval(() => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = client.sync();
    if (res.newGamesCount > 0) {
      logger.info('DB', `Background sync ingested ${res.newGamesCount} new games.`);
    }
  } catch (err) {
    logger.error('DB', `Background sync error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}, 15000);
syncInterval.unref();

// Helper to sanitize query filters
function extractFilter(req) {
  const filter = {};
  if (req.query.dateRange) filter.dateRange = req.query.dateRange;
  if (req.query.from) filter.from = req.query.from;
  if (req.query.to) filter.to = req.query.to;
  if (req.query.species) filter.species = req.query.species;
  if (req.query.background) filter.background = req.query.background;
  if (req.query.combo) filter.combo = req.query.combo;
  if (req.query.god) filter.god = req.query.god;
  if (req.query.is_win !== undefined && req.query.is_win !== '') {
    filter.is_win = Number(req.query.is_win);
  }
  if (req.query.version) filter.version = req.query.version;
  if (req.query.q) filter.q = req.query.q;
  if (req.query.search) filter.search = req.query.search;
  return filter;
}

// ======================== API ROUTES ========================

// 1. Overall & Filtered Stats
app.get('/api/stats', (req, res) => {
  try {
    const filter = extractFilter(req);
    const stats = client.getStats(filter);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Species x Background Matrix
app.get('/api/matrix', (req, res) => {
  try {
    const filter = extractFilter(req);
    if (req.query.trunkOnly !== undefined) {
      filter.trunkOnly = req.query.trunkOnly === 'true' || req.query.trunkOnly === '1';
    }
    const matrix = client.getComboMatrix(filter);
    res.json({ success: true, matrix });
  } catch (err) {
    console.error('Error fetching matrix:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Runs Explorer API (Unlimited support when limit=all or omitted)
app.get('/api/games', (req, res) => {
  try {
    const filter = extractFilter(req);
    let limit = null;
    if (req.query.limit && req.query.limit !== 'all') {
      const parsed = parseInt(req.query.limit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
    }
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const sort = {
      field: req.query.sort || 'end_time',
      direction: (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    };

    const result = client.getGames(filter, limit, offset, sort);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Active / Ongoing Run Status
app.get('/api/active', (req, res) => {
  try {
    const activeRuns = client.getActiveRuns ? client.getActiveRuns() : [];
    const activeRun = activeRuns[0] || (client.getActiveRun ? client.getActiveRun() : null);
    res.json({
      success: true,
      activeRun,
      activeRuns: activeRuns.length > 0 ? activeRuns : (activeRun ? [activeRun] : [])
    });
  } catch (err) {
    console.error('Error fetching active run:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Run Recommendations ("Suggest" engine)
app.get('/api/suggest', (req, res) => {
  try {
    const suggestions = client.getSuggestions();
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error('Error generating suggestions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Roll Character Combo (Sequell oracle !roll)
app.get('/api/roll', (req, res) => {
  try {
    const mode = String(req.query.mode || 'recommended').toLowerCase();
    let picked = null;

    if (mode === 'recommended') {
      picked = client.rollRecommendedCombo ? client.rollRecommendedCombo() : dcssDb.constants.rollRecommendedCombo();
    } else {
      const suggestions = client.getSuggestions();
      let pool = [];
      if (mode === 'unwon') {
        pool = suggestions.unwonCombos;
      } else if (mode === 'unplayed') {
        pool = suggestions.unplayedCombos;
      } else {
        pool = [...suggestions.topRecommendations, ...suggestions.unwonCombos, ...suggestions.unplayedCombos];
      }
      if (pool.length > 0) {
        const item = pool[Math.floor(Math.random() * pool.length)];
        const spAbbr = item.speciesAbbr || item.combo?.slice(0, 2);
        const bgAbbr = item.backgroundAbbr || item.combo?.slice(2, 4);
        const sp = dcssDb.constants.resolveSpecies(item.species, spAbbr);
        const bg = dcssDb.constants.resolveBackground(item.background, bgAbbr);
        picked = {
          combo: item.combo,
          species: sp.name,
          speciesAbbr: sp.abbr,
          background: bg.name,
          backgroundAbbr: bg.abbr,
          name: `${sp.name} ${bg.name}`,
          reason: item.reason || 'Oracle recommended path to Crawl mastery',
        };
      } else {
        picked = dcssDb.constants.rollRecommendedCombo();
      }
    }
    res.json({ success: true, ...picked });
  } catch (err) {
    console.error('Error rolling combo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Available Versions in Logs / Database
app.get('/api/versions', (req, res) => {
  try {
    const info = client.getVersions();
    res.json({ success: true, ...info });
  } catch (err) {
    console.error('Error fetching versions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Detected System Configuration & Morgue Directories (Sanitized paths)
app.get('/api/config', (req, res) => {
  try {
    const home = os.homedir();
    const sanitizePath = (p) => (p ? p.replace(home, '~') : p);
    const detectedDirs = client.getDcssDirs().map(sanitizePath);
    const configDcssDir = sanitizePath(getConfigDcssDir());
    res.json({
      success: true,
      detectedDirs,
      configDcssDir,
      dcssDirEnv: process.env.DCSS_DIR ? sanitizePath(process.env.DCSS_DIR) : null,
      platform: os.platform(),
      arch: os.arch(),
    });
  } catch (err) {
    console.error('Error fetching config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. View Raw Morgue File Content (Strict path validation & memory protection)
const SAFE_MORGUE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+\.txt$/;
const MAX_MORGUE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB cap

app.get('/api/morgue/:filename', (req, res) => {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename || !SAFE_MORGUE_FILENAME_REGEX.test(rawFilename) || rawFilename.includes('..') || !rawFilename.endsWith('.txt')) {
      return res.status(400).json({ success: false, error: 'Invalid morgue filename. Only .txt morgue dumps are permitted.' });
    }

    const safeFilename = path.basename(rawFilename);
    const dcssDirs = client.getDcssDirs();

    let foundPath = null;
    for (const dir of dcssDirs) {
      const resolvedDir = path.resolve(dir);
      const candidate1 = path.resolve(dir, 'morgue', safeFilename);
      const candidate2 = path.resolve(dir, safeFilename);

      if (candidate1.startsWith(resolvedDir + path.sep) && fs.existsSync(candidate1)) {
        foundPath = candidate1;
        break;
      }
      if (candidate2.startsWith(resolvedDir + path.sep) && fs.existsSync(candidate2)) {
        foundPath = candidate2;
        break;
      }
    }

    if (!foundPath) {
      return res.status(404).json({ success: false, error: `Morgue file '${safeFilename}' not found on disk.` });
    }

    const stat = fs.statSync(foundPath);
    if (stat.size > MAX_MORGUE_FILE_SIZE_BYTES) {
      return res.status(413).json({ success: false, error: 'Morgue file exceeds size limit (10MB).' });
    }

    const content = fs.readFileSync(foundPath, 'utf8');
    res.json({ success: true, filename: safeFilename, content });
  } catch (err) {
    console.error('Error reading morgue:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Manual Sync Trigger with Concurrency Lock and Debounce Protection
app.post('/api/sync', (req, res) => {
  if (isSyncing) {
    return res.status(429).json({ success: false, error: 'Sync already in progress. Please wait.' });
  }

  const now = Date.now();
  const isForce = Boolean(req.body && req.body.force);
  if (!isForce && (now - lastSyncTimestamp < MIN_SYNC_INTERVAL_MS)) {
    return res.status(429).json({ success: false, error: 'Sync requested too quickly. Please wait a few seconds.' });
  }

  isSyncing = true;
  try {
    const syncRes = client.sync({ force: isForce });
    lastSyncTimestamp = Date.now();
    res.json({ success: true, ...syncRes });
  } catch (err) {
    console.error('Error during manual sync:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    isSyncing = false;
  }
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server & Handle Signals
let server = null;
if (require.main === module) {
  server = app.listen(PORT, HOST, () => {
    console.log(`\n════════════════════════════════════════════════════════════════`);
    console.log(` 🗡️  DCSS Dashboard Server running at http://${HOST}:${PORT}`);
    console.log(`════════════════════════════════════════════════════════════════\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n[DCSS Server] Received ${signal}, shutting down gracefully...`);
    if (server) {
      server.close(() => {
        client.close();
        process.exit(0);
      });
    } else {
      client.close();
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
