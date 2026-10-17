/**
 * DCSS xlogfile Parser
 * Parses colon-delimited key=value entries according to DCSS xlogfile specifications.
 * Handles `::` colon escaping, month 0-indexing, turn speeds, and outcomes.
 */

const crypto = require('node:crypto');
const {
  resolveSpecies,
  resolveBackground,
  parseRawDate,
} = require('./constants');

/**
 * Splits an xlogfile line respecting escaped colons ("::").
 */
function parseXlogLine(rawLine, sourceFile = '') {
  const line = rawLine.trim();
  if (!line) return null;

  // Replace escaped colons "::" with a placeholder
  const ESCAPE_PLACEHOLDER = '\x00';
  const escapedLine = line.replace(/::/g, ESCAPE_PLACEHOLDER);

  const parts = escapedLine.split(':');
  const rawData = {};

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).replace(new RegExp(ESCAPE_PLACEHOLDER, 'g'), ':').trim();
      rawData[key] = val;
    }
  }

  if (!rawData.name && !rawData.char) {
    return null;
  }

  // Derive stable unique ID based purely on immutable fields in the xlog line itself (path-invariant)
  const hash = crypto.createHash('sha1');
  const uniqueKey = `${rawData.name || 'player'}:${rawData.start || ''}:${rawData.end || ''}:${rawData.turn || '0'}:${rawData.sc || '0'}:${rawData.ktyp || ''}:${rawData.killer || ''}:${rawData.char || ''}`;
  hash.update(uniqueKey);
  const id = hash.digest('hex');

  // Dates
  const startTime = parseRawDate(rawData.start);
  const endTime = parseRawDate(rawData.end);

  // Character & Combo
  const charAbbr = rawData.char || '';
  const raceRaw = rawData.race || '';
  const clsRaw = rawData.cls || '';

  const sp = resolveSpecies(raceRaw, charAbbr);
  const bg = resolveBackground(clsRaw, charAbbr);

  const combo = charAbbr || `${sp.abbr}${bg.abbr}`;
  const charName = `${sp.name} ${bg.name}`;

  // Turns and Duration
  const turns = parseInt(rawData.turn, 10) || 0;
  const aut = parseInt(rawData.aut, 10) || 0;
  const durationSeconds = parseInt(rawData.dur, 10) || 0;
  const turnSpeed = durationSeconds > 0 ? Number((turns / durationSeconds).toFixed(2)) : 0.0;

  // Score & Level
  const score = parseInt(rawData.sc, 10) || 0;
  const xl = parseInt(rawData.xl, 10) || 1;
  const hp = rawData.hp !== undefined ? parseInt(rawData.hp, 10) : null;
  const maxHp = rawData.mhp !== undefined ? parseInt(rawData.mhp, 10) : null;
  const mp = rawData.mp !== undefined ? parseInt(rawData.mp, 10) : null;
  const maxMp = rawData.mmp !== undefined ? parseInt(rawData.mmp, 10) : null;
  const dam = parseInt(rawData.dam, 10) || 0;

  // Runes
  const runesCount = parseInt(rawData.urune || rawData.nrune, 10) || 0;

  // Place
  const place = rawData.place ? rawData.place.replace(new RegExp(ESCAPE_PLACEHOLDER, 'g'), ':') : (rawData.br || '');
  const branch = rawData.br || (place.includes(':') ? place.split(':')[0] : place);
  const level = rawData.lvl !== undefined ? parseInt(rawData.lvl, 10) : null;

  // Outcome & Win
  const ktyp = rawData.ktyp || '';
  const isWin = ktyp === 'winning' ? 1 : 0;
  const killer = rawData.killer || '';
  const kaux = rawData.kaux || '';

  let outcome = 'Unknown';
  if (isWin) {
    outcome = runesCount > 0 ? `Escaped with the Orb (${runesCount} runes)` : 'Escaped with the Orb';
  } else if (ktyp === 'quitting') {
    outcome = 'Quit the game';
  } else if (ktyp === 'leaving') {
    outcome = 'Left the dungeon';
  } else if (ktyp === 'wizmode') {
    outcome = 'Wizard mode';
  } else if (killer) {
    outcome = kaux ? `Killed by ${killer} (${kaux})` : `Killed by ${killer}`;
  } else if (ktyp) {
    outcome = `Died (${ktyp})`;
  }

  // Determine game mode/type (e.g. normal, sprint, hints)
  let gameType = 'normal';
  if (rawData.lv?.includes('sprint') || sourceFile.includes('sprint') || rawData.map?.includes('sprint')) {
    gameType = 'sprint';
  } else if (rawData.lv?.includes('hint') || sourceFile.includes('hint')) {
    gameType = 'hints';
  }

  return {
    id,
    name: rawData.name || 'Unknown',
    species: sp.name,
    species_abbr: sp.abbr,
    background: bg.name,
    background_abbr: bg.abbr,
    combo,
    char_name: charName,
    god: rawData.god || null,
    score,
    turns,
    aut,
    duration_seconds: durationSeconds,
    start_time: startTime,
    end_time: endTime,
    place,
    branch,
    level,
    xl,
    hp,
    max_hp: maxHp,
    mp,
    max_mp: maxMp,
    killer: killer || null,
    ktyp: ktyp || null,
    dam,
    outcome,
    is_win: isWin,
    runes_count: runesCount,
    runes_list: null, // Can be populated if linked to morgue
    turn_speed: turnSpeed,
    source_file: sourceFile,
    morgue_file: null, // Populated during morgue matching
    version: rawData.v || null,
    seed: rawData.seed || null,
    game_type: gameType,
    is_active: 0,
    raw_data: JSON.stringify(rawData),
  };
}

module.exports = {
  parseXlogLine,
};
