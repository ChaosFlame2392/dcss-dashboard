/**
 * DCSS Morgue File Parser
 * Parses both finished game morgues (extracting runes, details)
 * and live active character dumps (extracting ongoing run state).
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  resolveSpecies,
  resolveBackground,
  resolveComboFromText,
  BRANCHES,
  formatDuration,
} = require('./constants');

const DEATH_PATTERNS = [
  /Slain by/i,
  /Mangled by/i,
  /Shot by/i,
  /Succumbed to/i,
  /Killed by/i,
  /Escaped with the Orb/i,
  /Quit the game/i,
  /left the dungeon/i,
  /Asphyxiated/i,
  /Bludgeoned by/i,
  /Engulfed by/i,
  /Fried by/i,
  /Drained by/i,
  /Annihilated by/i,
  /The game lasted/i,
];

/**
 * Parses time string like "02:35:46" or "00:05:42" into seconds.
 */
function parseTimeStringToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Checks if a morgue file content represents a finished game or an active run.
 */
function isFinishedMorgue(content) {
  return DEATH_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Extracts runes from a morgue file content.
 * e.g. "}: 3/15 runes: decaying, silver, gossamer"
 */
function extractRunesFromMorgue(content) {
  const match = content.match(/^}:\s*(\d+)\/(\d+)\s+runes?:\s*([^\r\n]+)/m);
  if (match) {
    const count = parseInt(match[1], 10) || 0;
    const runesList = match[3]
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);
    return { count, list: runesList };
  }
  return { count: 0, list: [] };
}

/**
 * Parses an active character dump file (e.g. ChaosFlame.txt in morgue/)
 */
function parseActiveDump(content, filePath = '') {
  const lines = content.split(/\r?\n/);
  if (lines.length < 5) return null;

  // Verify this is not a finished morgue
  if (isFinishedMorgue(content)) {
    return null;
  }

  // Version
  let version = null;
  const vMatch = content.match(/Dungeon Crawl Stone Soup version ([^\s]+)/);
  if (vMatch) version = vMatch[1];

  // Seed
  let seed = null;
  const seedMatch = content.match(/Game seed:\s*([^\s\r\n]+)/);
  if (seedMatch) seed = seedMatch[1];

  // Line with: "ChaosFlame the Spry (Djinni Conjurer)              Turns: 27530, Time: 02:35:46"
  let name = '';
  let title = '';
  let speciesName = '';
  let bgName = '';
  let turns = 0;
  let durationSeconds = 0;

  const headerRegex = /^([^\t\r\n(]+?)\s+(the\s+[^(]+?)\s*\(([^)]+)\)\s+Turns:\s*(\d+),\s*Time:\s*([0-9:]+)/m;
  const headerMatch = content.match(headerRegex);

  if (headerMatch) {
    name = headerMatch[1].trim();
    title = headerMatch[2].trim();
    const comboRaw = headerMatch[3].trim(); // e.g. "Djinni Conjurer"
    turns = parseInt(headerMatch[4], 10) || 0;
    durationSeconds = parseTimeStringToSeconds(headerMatch[5]);

    const resolved = resolveComboFromText(comboRaw);
    speciesName = resolved ? resolved.species.name : comboRaw;
    bgName = resolved ? resolved.background.name : 'Unknown';
  } else {
    return null;
  }

  const sp = resolveSpecies(speciesName);
  const bg = resolveBackground(bgName);
  const combo = `${sp.abbr}${bg.abbr}`;

  // Health, Magic, XL, Stats
  let hp = null, maxHp = null;
  let mp = null, maxMp = null;
  let ac = 0, ev = 0, sh = 0;
  let str = 0, int = 0, dex = 0;
  let xl = 1;
  let god = null;
  let piety = null;
  let gold = 0;

  const hpMatch = content.match(/(?:Health|HP):\s*(-?\d+)\/(\d+)/i);
  if (hpMatch) {
    hp = parseInt(hpMatch[1], 10);
    maxHp = parseInt(hpMatch[2], 10);
  }

  const mpMatch = content.match(/(?:Magic|MP):\s*(-?\d+)\/(\d+)/i);
  if (mpMatch) {
    mp = parseInt(mpMatch[1], 10);
    maxMp = parseInt(mpMatch[2], 10);
  }

  const xlMatch = content.match(/XL:\s*(\d+)/);
  if (xlMatch) xl = parseInt(xlMatch[1], 10);

  const acMatch = content.match(/AC:\s*(-?\d+)/);
  if (acMatch) ac = parseInt(acMatch[1], 10);

  const evMatch = content.match(/EV:\s*(-?\d+)/);
  if (evMatch) ev = parseInt(evMatch[1], 10);

  const shMatch = content.match(/SH:\s*(-?\d+)/);
  if (shMatch) sh = parseInt(shMatch[1], 10);

  const strMatch = content.match(/Str:\s*(-?\d+)/);
  if (strMatch) str = parseInt(strMatch[1], 10);

  const intMatch = content.match(/Int:\s*(-?\d+)/);
  if (intMatch) int = parseInt(intMatch[1], 10);

  const dexMatch = content.match(/Dex:\s*(-?\d+)/);
  if (dexMatch) dex = parseInt(dexMatch[1], 10);

  const goldMatch = content.match(/Gold:\s*(\d+)/);
  if (goldMatch) gold = parseInt(goldMatch[1], 10);

  // God & Piety
  const godMatch = content.match(/God:\s*([^\r\n[\]]+?)(?:\s*\[([*.]+)])?$/m);
  if (godMatch && godMatch[1].trim()) {
    god = godMatch[1].trim();
    if (godMatch[2]) {
      // count stars in piety e.g. [******]
      piety = (godMatch[2].match(/\*/g) || []).length;
    }
  }

  // Location / Place
  // e.g. "You are on level 2 of the Orcish Mines." or "You are on level 1 of the Dungeon."
  let place = '';
  let placeDescription = '';
  const placeMatch = content.match(/You are (?:on level (\d+) of the (.+?)|in the (.+?))\./);
  if (placeMatch) {
    if (placeMatch[1] && placeMatch[2]) {
      const lvl = placeMatch[1];
      const branchName = placeMatch[2];
      placeDescription = `Level ${lvl} of the ${branchName}`;
      // Map branchName to abbr
      let branchAbbr = 'D';
      for (const [abbr, fullName] of Object.entries(BRANCHES)) {
        if (branchName.toLowerCase().includes(fullName.toLowerCase()) || fullName.toLowerCase().includes(branchName.toLowerCase())) {
          branchAbbr = abbr;
          break;
        }
      }
      place = `${branchAbbr}:${lvl}`;
    } else if (placeMatch[3]) {
      placeDescription = placeMatch[3];
      place = placeMatch[3];
    }
  }

  const { count: runesCount, list: runesList } = extractRunesFromMorgue(content);
  const turnSpeed = durationSeconds > 0 ? Number((turns / durationSeconds).toFixed(2)) : 0.0;
  const timeDist = parseTimeDistribution(content);

  return {
    name,
    title,
    species: sp.name,
    species_abbr: sp.abbr,
    background: bg.name,
    background_abbr: bg.abbr,
    combo,
    char_name: `${sp.name} ${bg.name}`,
    xl,
    hp,
    max_hp: maxHp,
    mp,
    max_mp: maxMp,
    ac,
    ev,
    sh,
    str,
    int,
    dex,
    god,
    piety,
    gold,
    turns,
    duration_seconds: durationSeconds,
    duration_formatted: formatDuration(durationSeconds),
    turn_speed: turnSpeed,
    place,
    place_description: placeDescription,
    seed,
    version,
    runes_count: runesCount,
    runes_list: runesList,
    time_distribution: timeDist ? JSON.stringify(timeDist) : null,
    tactical_pct: timeDist ? timeDist.tactical_pct : null,
    explore_pct: timeDist ? timeDist.explore_pct : null,
    inter_travel_pct: timeDist ? timeDist.inter_travel_pct : null,
    resting_pct: timeDist ? timeDist.resting_pct : null,
    morgue_file: filePath,
    is_active: 1,
  };
}

/**
 * Parses decaaut time distribution from a DCSS morgue or active dump.
 * (Feature introduced in DCSS 0.35 Trunk).
 *
 * @param {string} content
 * @returns {object|null}
 */
function parseTimeDistribution(content) {
  if (!content || !content.includes('Table legend: (Time is in decaauts)')) {
    return null;
  }

  // Extract Total row:
  // e.g. Total | 7136 | 6658 | 478 | 495 | 4924 | 7 | 1019.4 |
  const totalMatch = content.match(/^\s*Total\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,.]+)\s*\|/m);
  if (!totalMatch) {
    return null;
  }

  const parseNum = (str) => parseInt(str.replace(/,/g, ''), 10) || 0;
  const parseFlt = (str) => parseFloat(str.replace(/,/g, '')) || 0.0;

  const totalDecaauts = parseNum(totalMatch[1]); // A = Elapsed time
  const nonTravelDecaauts = parseNum(totalMatch[2]); // B = Non-inter-level travel
  const interTravelDecaauts = parseNum(totalMatch[3]); // C = Inter-level travel
  const restingDecaauts = parseNum(totalMatch[4]); // D = Time resting
  const exploreDecaauts = parseNum(totalMatch[5]); // E = Time spent auto-exploring
  const levelsSeen = parseNum(totalMatch[6]); // F = Levels seen
  const meanPerLevel = parseFlt(totalMatch[7]); // G = Mean time per level

  // Tactical daAuts = B - (D + E)
  const tacticalDecaauts = Math.max(0, nonTravelDecaauts - (restingDecaauts + exploreDecaauts));

  // Percentages calculated over total elapsed decaauts (A)
  const tacticalPct = totalDecaauts > 0 ? Number(((tacticalDecaauts / totalDecaauts) * 100).toFixed(2)) : 0.0;
  const explorePct = totalDecaauts > 0 ? Number(((exploreDecaauts / totalDecaauts) * 100).toFixed(2)) : 0.0;
  const interTravelPct = totalDecaauts > 0 ? Number(((interTravelDecaauts / totalDecaauts) * 100).toFixed(2)) : 0.0;
  const restingPct = totalDecaauts > 0 ? Number(((restingDecaauts / totalDecaauts) * 100).toFixed(2)) : 0.0;

  // Extract "Top non-repeatable levels by time:"
  const topLevels = [];
  const topSectionMatch = content.match(/Top non-repeatable levels by time:([\s\S]*?)(?:\r?\n\s*\r?\n\S|$)/);
  if (topSectionMatch) {
    const sectionText = topSectionMatch[1];
    const levelRegex = /^\s*(.+?):\s*([\d,]+)\s*daAuts/gm;
    let lMatch;
    while ((lMatch = levelRegex.exec(sectionText)) !== null) {
      topLevels.push({
        place: lMatch[1].trim(),
        daAuts: parseInt(lMatch[2].replace(/,/g, ''), 10) || 0,
      });
    }
  }

  return {
    total_decaauts: totalDecaauts,
    non_travel_decaauts: nonTravelDecaauts,
    inter_travel_decaauts: interTravelDecaauts,
    resting_decaauts: restingDecaauts,
    explore_decaauts: exploreDecaauts,
    levels_seen: levelsSeen,
    mean_per_level: meanPerLevel,
    tactical_decaauts: tacticalDecaauts,
    tactical_pct: tacticalPct,
    explore_pct: explorePct,
    inter_travel_pct: interTravelPct,
    resting_pct: restingPct,
    top_levels: topLevels,
  };
}

/**
 * Parses a finished game morgue file content.
 */
function parseFinishedMorgue(content, filePath = '') {
  const beganMatch = content.match(/Began as an?\s+(.*?)\s+on/i);
  let resolved = null;

  if (beganMatch) {
    resolved = resolveComboFromText(beganMatch[1].trim());
  }
  if (!resolved) {
    const titleMatch = content.match(/\(([A-Za-z0-9 ]+?)\)\s+Turns:\s+\d+/);
    if (titleMatch) {
      resolved = resolveComboFromText(titleMatch[1].trim());
    }
  }

  const sp = resolved ? resolved.species : resolveSpecies('Unknown');
  const bg = resolved ? resolved.background : resolveBackground('Unknown');
  const combo = resolved ? resolved.combo : '????';

  // Outcome
  let outcome = 'Died';
  if (/Escaped with the Orb/i.test(content)) {
    const runesMatch = content.match(/and (\d+ runes)/i);
    outcome = runesMatch ? `Escaped with the Orb (${runesMatch[1]})!` : 'Escaped with the Orb!';
  } else {
    const killerMatch = content.match(/(Slain by [^\r\n]+|Killed by [^\r\n]+|Succumbed to [^\r\n]+|Mangled by [^\r\n]+|Shot by [^\r\n]+|Died [^\r\n]+)/i);
    const killer = killerMatch ? killerMatch[1].trim() : 'Died';
    const placeMatch = content.match(/\.\.\. on (.*?)\./);
    const place = placeMatch ? placeMatch[1].trim() : '';
    outcome = place ? `${killer} on ${place}` : killer;
  }

  // Clean redundant date and damage amounts
  outcome = outcome.replace(/\s+on\s+[A-Za-z]+\s+\d+,\s+\d+/g, '');
  outcome = outcome.replace(/\s*\(\d+\s+damage\)/g, '');
  outcome = outcome.replace(/\(invoked by (.*?)\)/g, '($1)');
  outcome = outcome.replace(/\(led by (.*?)\)/g, '($1)');

  // Convert branch names to compact notation
  outcome = outcome.replace(/on level (\d+) of the Dungeon/g, 'on D:$1');
  outcome = outcome.replace(/on level (\d+) of the Orcish Mines/g, 'on Orc:$1');
  outcome = outcome.replace(/on level (\d+) of the Lair of Beasts/g, 'on Lair:$1');
  outcome = outcome.replace(/on level (\d+) of the Vaults/g, 'on Vaults:$1');
  outcome = outcome.replace(/on level (\d+) of the Depths/g, 'on Depths:$1');
  outcome = outcome.replace(/on level (\d+) of the Elven Halls/g, 'on Elf:$1');

  const { count: runesCount, list: runesList } = extractRunesFromMorgue(content);

  return {
    combo,
    species: sp.name,
    species_abbr: sp.abbr,
    background: bg.name,
    background_abbr: bg.abbr,
    outcome,
    runes_count: runesCount,
    runes_list: runesList,
  };
}

module.exports = {
  isFinishedMorgue,
  extractRunesFromMorgue,
  parseActiveDump,
  parseFinishedMorgue,
  parseTimeStringToSeconds,
  parseTimeDistribution,
};

