/**
 * DCSS Stats Dashboard — Centralized Logging Module
 * Optional verbose debugging is OFF by default.
 * Turned ON only via text edit in config.json ("debug": true) or DEBUG env var.
 * Not exposed as an option in the web UI.
 */

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');

function isDebugEnabled() {
  if (process.env.DEBUG === 'true' || process.env.DEBUG === '1' || process.env.DEBUG === 'dcss*') {
    return true;
  }

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const cfg = JSON.parse(raw);
      return Boolean(cfg.debug);
    }
  } catch (err) {
    // If config has JSON syntax error or is inaccessible, stay quiet
  }
  return false;
}

function timestamp() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
  isDebugEnabled,

  debug(category, ...args) {
    if (isDebugEnabled()) {
      console.log(`\x1b[35m[${timestamp()}] [DEBUG] [${category}]\x1b[0m`, ...args);
    }
  },

  info(category, ...args) {
    console.log(`\x1b[36m[${timestamp()}] [INFO]  [${category}]\x1b[0m`, ...args);
  },

  warn(category, ...args) {
    console.warn(`\x1b[33m[${timestamp()}] [WARN]  [${category}]\x1b[0m`, ...args);
  },

  error(category, ...args) {
    console.error(`\x1b[31m[${timestamp()}] [ERROR] [${category}]\x1b[0m`, ...args);
  },
};

module.exports = logger;
