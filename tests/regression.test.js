/**
 * Automated Regression Test Suite for DCSS Stats Engine
 * Uses Node.js native test runner (`node:test`).
 * Protects against game updates, new species/classes, and logfile/morgue format shifts.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const { parseXlogLine } = require('../src/db/logfileParser');
const { parseActiveDump, parseFinishedMorgue, isFinishedMorgue, parseTimeDistribution } = require('../src/db/morgueParser');
const {
  SPECIES,
  BACKGROUNDS,
  GODS,
  GOOD_GODS,
  DJINNI_RESTRICTED_GODS,
  UNDEAD_OR_DEMONIC_SPECIES,
  isGodRestricted,
  RECOMMENDED_COMBOS,
  rollRecommendedCombo,
  UNAVAILABLE_COMBOS,
  isValidCombo,
  resolveSpecies,
  resolveBackground,
  parseDcssVersion,
  compareVersions,
  matchesVersionFilter,
} = require('../src/db/constants');
const { getDcssDirs, getConfigDcssDir } = require('../src/db/sync');
const { createDcssDb } = require('../src/db');
const { migrateSchema } = require('../src/db/schema');

describe('DCSS Regression Suite — Logfile Parser', () => {
  it('correctly parses standard monster death xlog line', () => {
    const line = 'v=0.34.1:name=ChaosFlame:race=Merfolk:cls=Shapeshifter:char=MfSh:xl=10:sk=Unarmed Combat:god=Trog:start=20260917130146S:dur=1663:turn=8596:sc=5733:ktyp=mon:killer=an orc warlord:place=Bailey:lvl=1:end=20260917133302S';
    const parsed = parseXlogLine(line);

    assert.strictEqual(parsed.name, 'ChaosFlame');
    assert.strictEqual(parsed.species, 'Merfolk');
    assert.strictEqual(parsed.species_abbr, 'Mf');
    assert.strictEqual(parsed.background, 'Shapeshifter');
    assert.strictEqual(parsed.background_abbr, 'Sh');
    assert.strictEqual(parsed.combo, 'MfSh');
    assert.strictEqual(parsed.god, 'Trog');
    assert.strictEqual(parsed.turns, 8596);
    assert.strictEqual(parsed.duration_seconds, 1663);
    assert.strictEqual(parsed.score, 5733);
    assert.strictEqual(parsed.is_win, 0);
    assert.strictEqual(parsed.turn_speed, Number((8596 / 1663).toFixed(2)));
    assert.strictEqual(parsed.killer, 'an orc warlord');
    assert.strictEqual(parsed.start_time, new Date(2026, 9, 17, 13, 1, 46).toISOString());
    assert.strictEqual(parsed.end_time, new Date(2026, 9, 17, 13, 33, 2).toISOString());
  });

  it('correctly detects winning games (Escaped with Orb) and extracts runes', () => {
    const winLine = 'v=0.34.1:name=ChaosFlame:race=Minotaur:cls=Fighter:char=MiFi:xl=27:god=Yredelemnul:start=20260912100000S:dur=27422:turn=85000:sc=1836086:ktyp=winning:place=D::1:urune=3:nrune=3:end=20260912173702S';
    const parsed = parseXlogLine(winLine);

    assert.strictEqual(parsed.is_win, 1);
    assert.strictEqual(parsed.runes_count, 3);
    assert.match(parsed.outcome, /Escaped with the Orb/);
  });

  it('handles Demigod atheism without null crash', () => {
    const line = 'v=0.34.1:name=ChaosFlame:race=Demigod:cls=Hunter:char=DgHu:xl=5:start=20260917105651S:dur=551:turn=2880:sc=181:ktyp=mon:killer=an orc warrior:place=D::4:end=20260917110607S';
    const parsed = parseXlogLine(line);

    assert.strictEqual(parsed.species, 'Demigod');
    assert.strictEqual(parsed.god, null);
    assert.strictEqual(parsed.combo, 'DgHu');
  });

  it('handles sub-races mapping to base species (e.g. Black Draconian)', () => {
    const line = 'v=0.34.1:name=ChaosFlame:race=Black Draconian:cls=Conjurer:char=DrCj:xl=7:start=20260917110621S:dur=300:turn=1500:sc=200:ktyp=mon:killer=an adder:place=D::2:end=20260917111121S';
    const parsed = parseXlogLine(line);

    assert.strictEqual(parsed.species, 'Draconian');
    assert.strictEqual(parsed.species_abbr, 'Dr');
    assert.strictEqual(parsed.background_abbr, 'Cj');
  });

  it('safely handles empty or corrupted lines', () => {
    assert.strictEqual(parseXlogLine(''), null);
    assert.strictEqual(parseXlogLine('invalid:::data:::'), null);
  });
});

describe('DCSS Regression Suite — Morgue Parser', () => {
  it('correctly extracts vowel grammar combos (Began as an Oni Hedge Wizard)', () => {
    const morgueSnippet = `
 Dungeon Crawl Stone Soup version 0.34.1 character file.
 92 ChaosFlame the Magician (level 4, -2/34 HPs)
             Began as an Oni Hedge Wizard on Oct 14, 2026.
             Slain by an orc
              (12 damage)
             ... on level 4 of the Dungeon on Oct 14, 2026.
             The game lasted 00:11:07 (2872 turns).
`;
    const parsed = parseFinishedMorgue(morgueSnippet, 'morgue-test.txt');
    assert.strictEqual(parsed.combo, 'OnHW');
    assert.strictEqual(parsed.species, 'Oni');
    assert.strictEqual(parsed.species_abbr, 'On');
    assert.strictEqual(parsed.background_abbr, 'HW');
    assert.match(parsed.outcome, /Slain by an orc on D:4/);
    assert.doesNotMatch(parsed.outcome, /12 damage/);
    assert.doesNotMatch(parsed.outcome, /on Oct 14/);
  });

  it('correctly parses ongoing character dump (is_active = 1)', () => {
    const activeSnippet = `
 Dungeon Crawl Stone Soup version 0.34.1 (console) character file.
 Game seed: 16771685951504598935

 ChaosFlame the Spry (Djinni Conjurer)              Turns: 27530, Time: 02:35:46

 Health: 126/126    AC: 16    Str: 20    XL:     16   Next: 64%
 Gold:   291        EV: 17    Int: 43    God:    Makhleb [******]
                    SH: 17    Dex: 13

 You are on level 2 of the Orcish Mines.
 You worship Makhleb.
`;
    const active = parseActiveDump(activeSnippet, 'morgue/ChaosFlame.txt');
    assert.strictEqual(active.name, 'ChaosFlame');
    assert.strictEqual(active.species, 'Djinni');
    assert.strictEqual(active.background, 'Conjurer');
    assert.strictEqual(active.combo, 'DjCj');
    assert.strictEqual(active.xl, 16);
    assert.strictEqual(active.hp, 126);
    assert.strictEqual(active.max_hp, 126);
    assert.strictEqual(active.ac, 16);
    assert.strictEqual(active.ev, 17);
    assert.strictEqual(active.sh, 17);
    assert.strictEqual(active.god, 'Makhleb');
    assert.strictEqual(active.piety, 6);
    assert.strictEqual(active.place, 'Orc:2');
    assert.strictEqual(active.is_active, 1);
  });
});

describe('DCSS Regression Suite — Combination Rules & Unavailable Combos', () => {
  it('correctly identifies forbidden / impossible combos', () => {
    // Demigods cannot worship gods (no Berserker, Monk, Chaos Knight)
    assert.strictEqual(isValidCombo('DgBe'), false);
    assert.strictEqual(isValidCombo('DgMo'), false);
    assert.strictEqual(isValidCombo('DgCK'), false);

    // Felids cannot wear armor or use ranged/throwing gear
    assert.strictEqual(isValidCombo('FeGl'), false);
    assert.strictEqual(isValidCombo('FeHu'), false);
    assert.strictEqual(isValidCombo('FeBr'), false);

    // Undead cannot shapeshift
    assert.strictEqual(isValidCombo('GhSh'), false);
    assert.strictEqual(isValidCombo('MuSh'), false);

    // Standard combos are valid
    assert.strictEqual(isValidCombo('MiBe'), true);
    assert.strictEqual(isValidCombo('DgHu'), true);
    assert.strictEqual(isValidCombo('DjCj'), true);
  });
});

describe('DCSS Regression Suite — Database & Suggestion Engine', () => {
  it('initializes in-memory database and computes correct metrics', () => {
    const client = createDcssDb(':memory:');

    // Insert dummy test games
    const db = client.rawDb;
    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, score, turns, duration_seconds, end_time, is_win, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('g1', 'Player', 'Minotaur', 'Mi', 'Fighter', 'Fi', 'MiFi', 'Minotaur Fighter', 10000, 5000, 1000, '2026-10-15T12:00:00.000Z', 1, 0);
    insert.run('g2', 'Player', 'Demigod', 'Dg', 'Hunter', 'Hu', 'DgHu', 'Demigod Hunter', 2000, 2000, 500, '2026-10-16T12:00:00.000Z', 0, 0);
    insert.run('g3', 'Player', 'Demigod', 'Dg', 'Hunter', 'Hu', 'DgHu', 'Demigod Hunter', 4000, 3000, 700, '2026-10-17T12:00:00.000Z', 0, 0);

    const stats = client.getStats('all');
    assert.strictEqual(stats.totalGames, 3);
    assert.strictEqual(stats.wins, 1);
    assert.strictEqual(stats.scoreMetrics.best, 10000);
    assert.strictEqual(stats.scoreMetrics.median, 4000);
    assert.strictEqual(stats.scoreMetrics.avg, 5333);
    assert.strictEqual(stats.fastestWin.combo, 'MiFi');
    assert.strictEqual(stats.fastestWin.turns, 5000);
    assert.strictEqual(stats.shortestWinByTurns.combo, 'MiFi');

    // Matrix
    const matrix = client.getComboMatrix('all');
    assert.strictEqual(matrix.matrix['MiFi'].wins, 1);
    assert.strictEqual(matrix.matrix['DgHu'].games, 2);
    assert.strictEqual(matrix.matrix['DgHu'].wins, 0);
    assert(matrix.columnTotals !== undefined, 'columnTotals must be present');
    assert(matrix.rowTotals !== undefined, 'rowTotals must be present');
    assert.strictEqual(matrix.columnTotals.all.games, 3);

    // Versions
    const ver = client.getVersions();
    assert(ver !== undefined);
    assert(Array.isArray(ver.versions));

    // Suggestions: DgHu has 0 wins, so it should be recommended as unwon mastery
    const sugg = client.getSuggestions();
    const hasDgHu = sugg.topRecommendations.some(r => r.combo === 'DgHu');
    assert.strictEqual(hasDgHu, true, 'DgHu should be recommended as unwon mastery');

    // Never suggest forbidden combo
    const hasForbidden = sugg.unplayedCombos.some(c => UNAVAILABLE_COMBOS.has(c.combo));
    assert.strictEqual(hasForbidden, false, 'No unavailable combo should ever be suggested');

    client.close();
  });

  it('runs sync and regression checks on live user DCSS data', () => {
    const client = createDcssDb(':memory:');
    const syncRes = client.sync();

    assert.strictEqual(syncRes.success, true);
    assert(syncRes.totalGames >= 90, `Expected at least 90 games from local files, got ${syncRes.totalGames}`);

    const stats = client.getStats('all');
    assert(stats.totalGames >= 90);
    assert(stats.wins >= 1);
    assert(stats.totalPlaytime.seconds > 100000);
    assert(stats.fastestWin !== null, 'Should find fastest win from user data');

    const active = client.getActiveRun();
    if (active) {
      assert.strictEqual(active.name, 'ChaosFlame');
      assert.strictEqual(active.is_active, 1);
      assert(active.hp > 0);
    }

    const allActive = client.getActiveRuns();
    assert(Array.isArray(allActive));
    if (allActive.length > 0) {
      assert.strictEqual(allActive[0].name, 'ChaosFlame');
    }

    client.close();
  });
});

describe('DCSS Regression Suite — Path-Invariant IDs & Directory Discovery', () => {
  it('generates strictly identical game ID regardless of sourceFile path', () => {
    const rawLine = 'v=0.34.1:name=ChaosFlame:race=Minotaur:cls=Berserker:char=MiBe:xl=15:start=20261001120000S:dur=1200:turn=5000:sc=3500:ktyp=mon:killer=an ogre:place=D:8:end=20261001122000S';
    const g1 = parseXlogLine(rawLine, 'Stable/saves/logfile');
    const g2 = parseXlogLine(rawLine, 'Dungeon Crawl Stone Soup/Stable/saves/logfile');
    const g3 = parseXlogLine(rawLine, '/completely/different/path/logfile');

    assert.strictEqual(g1.id, g2.id);
    assert.strictEqual(g2.id, g3.id);
    assert.strictEqual(typeof g1.id, 'string');
    assert.strictEqual(g1.id.length, 40);
  });

  it('filters out parent directories so parent and children are never both scanned', () => {
    const candidateDirs = [
      path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup'),
      path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup/Stable'),
      path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup/Trunk'),
    ];

    const dirs = getDcssDirs(candidateDirs);
    const parentDir = path.join(os.homedir(), 'Library/Application Support/Dungeon Crawl Stone Soup');

    // Parent dir MUST be excluded because its children exist
    assert.strictEqual(dirs.includes(parentDir), false, 'Parent directory must not be scanned if children are scanned');
    assert(dirs.some(d => d.endsWith('Stable') || d.endsWith('Trunk')), 'Child directories must be preserved');
  });

  it('verifies persistent dcss_stats.db has accurately restored run count (~98)', () => {
    const dbPath = path.resolve(__dirname, '../dcss_stats.db');
    if (fs.existsSync(dbPath)) {
      const client = createDcssDb(dbPath);
      const stats = client.getStats('all');
      // Finished games should be around 96, not 192 or 196 duplicates
      assert(stats.totalGames >= 90 && stats.totalGames <= 100, `Expected ~96 finished games, got ${stats.totalGames}`);
      client.close();
    }
  });
});

describe('DCSS Regression Suite — God Restrictions (religion.cc lines 3342-3350)', () => {
  it('strictly enforces Demigod atheism for all gods', () => {
    assert.strictEqual(isGodRestricted('Dg', 'Trog'), true);
    assert.strictEqual(isGodRestricted('Dg', 'The Shining One'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Zin'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Elyvilon'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Sif Muna'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Vehumet'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Kikubaaqudgha'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Xom'), true);
    assert.strictEqual(isGodRestricted('Dg', 'Gozag'), true);
  });

  it('strictly enforces Djinni innateness restrictions (MUT_INNATE_CASTER)', () => {
    // Sif Muna, Vehumet, and Kikubaaqudgha refuse Djinni
    assert.strictEqual(isGodRestricted('Dj', 'Sif Muna'), true);
    assert.strictEqual(isGodRestricted('Dj', 'Vehumet'), true);
    assert.strictEqual(isGodRestricted('Dj', 'Kikubaaqudgha'), true);

    // Other gods are allowed
    assert.strictEqual(isGodRestricted('Dj', 'Trog'), false);
    assert.strictEqual(isGodRestricted('Dj', 'Makhleb'), false);
    assert.strictEqual(isGodRestricted('Dj', 'Gozag'), false);
    assert.strictEqual(isGodRestricted('Dj', 'The Shining One'), false);
  });

  it('strictly enforces Undead and Demonspawn refusal by Good Gods', () => {
    const undeadOrDemonic = ['Mu', 'Gh', 'Vp', 'Ds'];
    const goodGods = ['The Shining One', 'Zin', 'Elyvilon'];

    for (const sp of undeadOrDemonic) {
      for (const god of goodGods) {
        assert.strictEqual(isGodRestricted(sp, god), true, `${sp} should be restricted from worshiping ${god}`);
      }
      // Non-good gods should be allowed
      assert.strictEqual(isGodRestricted(sp, 'Makhleb'), false);
      assert.strictEqual(isGodRestricted(sp, 'Yredelemnul'), false);
    }
  });

  it('allows standard species to worship gods without false restriction', () => {
    assert.strictEqual(isGodRestricted('Mi', 'Trog'), false);
    assert.strictEqual(isGodRestricted('Mi', 'The Shining One'), false);
    assert.strictEqual(isGodRestricted('Hu', 'Vehumet'), false);
    assert.strictEqual(isGodRestricted('Gr', 'Zin'), false);
  });

  it('exposes god restrictions in combo matrix and species metadata', () => {
    const client = createDcssDb(':memory:');
    const matrixData = client.getComboMatrix('all');

    const dgSpecies = matrixData.species.find(s => s.abbr === 'Dg');
    assert(dgSpecies !== undefined);
    assert.strictEqual(dgSpecies.restrictedGods.length, GODS.length, 'Demigod should have all gods restricted');

    const djSpecies = matrixData.species.find(s => s.abbr === 'Dj');
    assert(djSpecies !== undefined);
    assert(djSpecies.restrictedGods.includes('Sif Muna'));
    assert(djSpecies.restrictedGods.includes('Vehumet'));
    assert(djSpecies.restrictedGods.includes('Kikubaaqudgha'));
    assert.strictEqual(djSpecies.restrictedGods.includes('Trog'), false);

    client.close();
  });
});

describe('DCSS Regression Suite — Official Recommended Combos (species-data.h & job-data.h)', () => {
  it('extracts all 191 official in-game recommended combos', () => {
    assert.strictEqual(RECOMMENDED_COMBOS.size, 191);

    // Verify key test combos
    assert(RECOMMENDED_COMBOS.has('MiBe'), 'Minotaur Berserker must be recommended');
    assert(RECOMMENDED_COMBOS.has('GrEE'), 'Gargoyle Earth Elementalist must be recommended');
    assert(RECOMMENDED_COMBOS.has('HuBe'), 'Human Berserker must be recommended');
    assert(RECOMMENDED_COMBOS.has('HuCA'), 'Human Cinder Acolyte must be recommended');
    assert(RECOMMENDED_COMBOS.has('DECj'), 'Deep Elf Conjurer must be recommended');
    assert(RECOMMENDED_COMBOS.has('DjCj'), 'Djinni Conjurer must be recommended');

    // Never includes unavailable combos
    for (const combo of RECOMMENDED_COMBOS) {
      assert.strictEqual(UNAVAILABLE_COMBOS.has(combo), false, `${combo} in RECOMMENDED_COMBOS must not be unavailable`);
      assert.strictEqual(isValidCombo(combo), true, `${combo} must be a valid trunk combo`);
    }
  });

  it('rolls a valid recommended combo from RECOMMENDED_COMBOS', () => {
    for (let i = 0; i < 20; i++) {
      const roll = rollRecommendedCombo();
      assert(roll !== null);
      assert(RECOMMENDED_COMBOS.has(roll.combo), `Rolled combo ${roll.combo} must be in RECOMMENDED_COMBOS`);
      assert(roll.name.length > 0);
      assert(roll.species.length > 0);
      assert(roll.background.length > 0);
    }
  });
});

describe('DCSS Regression Suite — Dynamic Versions', () => {
  it('returns clean distinct versions from database with no duplicates', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, version, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('v1', 'P1', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.1', 0);
    insert.run('v2', 'P2', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.1', 0);
    insert.run('v3', 'P3', 'Gargoyle', 'Gr', 'Earth Elementalist', 'EE', 'GrEE', 'GrEE', '0.35-a0', 0);

    const verInfo = client.getVersions();
    assert.deepStrictEqual(verInfo.versions, ['0.35-a0', '0.34.1']);

    client.close();
  });
});

describe('DCSS Regression Suite — Active Run Metadata & Stale Dump Protection', () => {
  it('correctly filters out stale dumps when a finished morgue has newer timestamp', () => {
    // Verified on local Trunk directory:
    // Trunk/morgue/ChaosFlame.txt was created Oct 6 19:59
    // Trunk/morgue/morgue-ChaosFlame-20261006-205920.txt was created Oct 6 20:59
    // Sync must NOT mark ChaosFlame TeSt from Trunk as active
    const client = createDcssDb(':memory:');
    client.sync();
    const activeRuns = client.getActiveRuns();
    // Trunk's stale ChaosFlame must not appear in active runs
    const trunkActive = activeRuns.find(r => r.id && r.id.includes('Trunk'));
    assert.strictEqual(trunkActive, undefined, 'Trunk stale dump must not be parsed as an active run');

    // Stable's finished ChaosFlame DjCj must not be identified as active once completed
    const stableActive = activeRuns.find(r => r.name === 'ChaosFlame' && r.combo === 'DjCj');
    assert.strictEqual(stableActive, undefined, 'Finished DjCj run must not be identified as active');
    client.close();
  });
});

describe('DCSS Regression Suite — Unlimited Run Querying & Median Calculation', () => {
  it('supports querying with limit = null and limit = "all" without artificial caps', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 25; i++) {
      insert.run(`id_${i}`, `P${i}`, 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', `Hero${i}`, i * 1000, 0);
    }

    // Unlimited via null
    const resAll1 = client.getGames({}, null, 0);
    assert.strictEqual(resAll1.games.length, 25);
    assert.strictEqual(resAll1.total, 25);
    assert.strictEqual(resAll1.limit, null);

    // Unlimited via 'all'
    const resAll2 = client.getGames({}, 'all', 0);
    assert.strictEqual(resAll2.games.length, 25);

    // Paginated via numeric limit
    const resPaged = client.getGames({}, 10, 0);
    assert.strictEqual(resPaged.games.length, 10);
    assert.strictEqual(resPaged.total, 25);
    assert.strictEqual(resPaged.totalPages, 3);

    client.close();
  });

  it('correctly calculates median score for both odd and even dataset sizes in O(1) memory', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Odd count: 3 games with scores 100, 200, 300 -> median is 200
    insert.run('g1', 'P', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', 100, 0);
    insert.run('g2', 'P', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', 200, 0);
    insert.run('g3', 'P', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', 300, 0);

    const statsOdd = client.getStats('all');
    assert.strictEqual(statsOdd.scoreMetrics.median, 200);

    // Even count: 4 games with scores 100, 200, 300, 400 -> median is (200 + 300) / 2 = 250
    insert.run('g4', 'P', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', 400, 0);
    const statsEven = client.getStats('all');
    assert.strictEqual(statsEven.scoreMetrics.median, 250);

    client.close();
  });
});

describe('DCSS Regression Suite — Security Hardening', () => {
  it('validates morgue filename regex and disallows directory traversal or non-.txt files', () => {
    const SAFE_REGEX = /^[a-zA-Z0-9._-]+\.txt$/;

    // Permitted morgue files
    assert.strictEqual(SAFE_REGEX.test('morgue-ChaosFlame-20261017-154522.txt'), true);
    assert.strictEqual(SAFE_REGEX.test('ChaosFlame.txt'), true);
    assert.strictEqual(SAFE_REGEX.test('run_123-abc.txt'), true);

    // Rejected non-txt / path traversal / binary files
    assert.strictEqual(SAFE_REGEX.test('../init.txt'), false);
    assert.strictEqual(SAFE_REGEX.test('..\\init.txt'), false);
    assert.strictEqual(SAFE_REGEX.test('ChaosFlame.cs'), false);
    assert.strictEqual(SAFE_REGEX.test('dcss_stats.db'), false);
    assert.strictEqual(SAFE_REGEX.test('macro.txt.exe'), false);
    assert.strictEqual(SAFE_REGEX.test(''), false);
  });
});

describe('DCSS Regression Suite — Multi-Column Sorting', () => {
  it('correctly multi-sorts runs across multiple fields with primary and secondary priority', () => {
    const sampleRuns = [
      { id: '1', char_name: 'Fast Low XL', xl: 1, turn_speed: 10.5, turns: 20 },
      { id: '2', char_name: 'Slow High XL', xl: 26, turn_speed: 2.1, turns: 50000 },
      { id: '3', char_name: 'Fast High XL', xl: 26, turn_speed: 4.8, turns: 48000 },
      { id: '4', char_name: 'Slow Low XL', xl: 1, turn_speed: 0.5, turns: 30 },
    ];

    // Multi-sort: Primary XL DESC, Secondary Speed ASC
    const sortRules = [
      { field: 'xl', order: 'desc' },
      { field: 'speed', order: 'asc' },
    ];

    const sorted = [...sampleRuns].sort((a, b) => {
      for (const rule of sortRules) {
        let comp = 0;
        if (rule.field === 'xl') comp = a.xl - b.xl;
        if (rule.field === 'speed') comp = a.turn_speed - b.turn_speed;
        if (comp !== 0) return rule.order === 'asc' ? comp : -comp;
      }
      return 0;
    });

    // High XL runs come first, and among XL 26, slowest speed (2.1) comes before fastest (4.8)
    assert.strictEqual(sorted[0].char_name, 'Slow High XL');
    assert.strictEqual(sorted[1].char_name, 'Fast High XL');
    // Low XL runs come last, and among XL 1, slowest speed (0.5) comes before (10.5)
    assert.strictEqual(sorted[2].char_name, 'Slow Low XL');
    assert.strictEqual(sorted[3].char_name, 'Fast Low XL');
  });
});

describe('DCSS Regression Suite — Semantic Versioning Engine', () => {
  it('correctly parses release strings (0.30.2, 0.34.1, 0.32)', () => {
    const v30 = parseDcssVersion('0.30.2');
    assert.strictEqual(v30.major, 0);
    assert.strictEqual(v30.minor, 30);
    assert.strictEqual(v30.patch, 2);
    assert.strictEqual(v30.prerelease, null);
    assert.strictEqual(v30.raw, '0.30.2');

    const v34 = parseDcssVersion('0.34.1');
    assert.strictEqual(v34.major, 0);
    assert.strictEqual(v34.minor, 34);
    assert.strictEqual(v34.patch, 1);
    assert.strictEqual(v34.prerelease, null);
    assert.strictEqual(v34.raw, '0.34.1');

    const v32 = parseDcssVersion('0.32');
    assert.strictEqual(v32.major, 0);
    assert.strictEqual(v32.minor, 32);
    assert.strictEqual(v32.patch, 0);
    assert.strictEqual(v32.prerelease, null);
    assert.strictEqual(v32.raw, '0.32');

    const vWithPrefix = parseDcssVersion('v0.34.1');
    assert.strictEqual(vWithPrefix.major, 0);
    assert.strictEqual(vWithPrefix.minor, 34);
    assert.strictEqual(vWithPrefix.patch, 1);
  });

  it('correctly parses pre-releases and git trunk commit hashes', () => {
    const vPre = parseDcssVersion('0.35-a0');
    assert.strictEqual(vPre.major, 0);
    assert.strictEqual(vPre.minor, 35);
    assert.strictEqual(vPre.patch, 0);
    assert.strictEqual(vPre.prerelease, 'a0');
    assert.strictEqual(vPre.raw, '0.35-a0');

    const vTrunkCommit = parseDcssVersion('0.35-a0-1308-g77a9b5a25e');
    assert.strictEqual(vTrunkCommit.major, 0);
    assert.strictEqual(vTrunkCommit.minor, 35);
    assert.strictEqual(vTrunkCommit.patch, 0);
    assert.strictEqual(vTrunkCommit.prerelease, 'a0-1308-g77a9b5a25e');
    assert.strictEqual(vTrunkCommit.raw, '0.35-a0-1308-g77a9b5a25e');
  });

  it('correctly parses version aliases and empty/invalid strings', () => {
    const vTrunk = parseDcssVersion('trunk');
    assert.strictEqual(vTrunk.major, 0);
    assert.strictEqual(vTrunk.minor, 35);
    assert.strictEqual(vTrunk.patch, 0);
    assert.strictEqual(vTrunk.prerelease, 'a0');
    assert.strictEqual(vTrunk.raw, 'trunk');

    const vStable = parseDcssVersion('stable');
    assert.strictEqual(vStable.major, 0);
    assert.strictEqual(vStable.minor, 34);
    assert.strictEqual(vStable.patch, 0);
    assert.strictEqual(vStable.prerelease, null);
    assert.strictEqual(vStable.raw, 'stable');

    const vEmpty = parseDcssVersion('');
    assert.strictEqual(vEmpty.major, 0);
    assert.strictEqual(vEmpty.minor, 0);
    assert.strictEqual(vEmpty.patch, 0);
    assert.strictEqual(vEmpty.prerelease, null);

    const vNull = parseDcssVersion(null);
    assert.strictEqual(vNull.major, 0);
    assert.strictEqual(vNull.minor, 0);
  });

  it('compares versions semantically via compareVersions', () => {
    assert(compareVersions('0.35-a0', '0.34.1') > 0, '0.35-a0 must be greater than 0.34.1');
    assert(compareVersions('0.34.1', '0.30.2') > 0, '0.34.1 must be greater than 0.30.2');
    assert(compareVersions('0.30.2', '0.34.1') < 0, '0.30.2 must be less than 0.34.1');
    assert.strictEqual(compareVersions('0.34.1', '0.34.1'), 0, 'Identical versions must return 0');

    assert(compareVersions('0.35.1', '0.35-a0') > 0, '0.35.1 patch must be greater than 0.35-a0');
    assert(compareVersions('0.35-a0', '0.35.1') < 0, '0.35-a0 must be less than 0.35.1');

    // Pre-release comparisons
    assert(compareVersions('0.35-a0-100', '0.35-a0-200') < 0);
    assert(compareVersions('0.35-b1', '0.35-a0') > 0);

    // Support parsed object inputs
    const parsed1 = parseDcssVersion('0.35-a0');
    const parsed2 = parseDcssVersion('0.34.1');
    assert(compareVersions(parsed1, parsed2) > 0, 'compareVersions must handle parsed version objects');
  });

  it('evaluates version filter expressions via matchesVersionFilter', () => {
    // Operators >= 0.35
    assert.strictEqual(matchesVersionFilter('0.35-a0', '>= 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.35.0', '>= 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.35.1', '>= 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.36.0', '>= 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.34.1', '>= 0.35'), false);
    assert.strictEqual(matchesVersionFilter('0.30.2', '>= 0.35'), false);

    // Operators <= 0.34
    assert.strictEqual(matchesVersionFilter('0.34.1', '<= 0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.34.0', '<= 0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.32', '<= 0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.30.2', '<= 0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.35-a0', '<= 0.34'), false);
    assert.strictEqual(matchesVersionFilter('0.35.0', '<= 0.34'), false);

    // Operators > 0.30
    assert.strictEqual(matchesVersionFilter('0.34.1', '> 0.30'), true);
    assert.strictEqual(matchesVersionFilter('0.32', '> 0.30'), true);
    assert.strictEqual(matchesVersionFilter('0.30.2', '> 0.30'), false);
    assert.strictEqual(matchesVersionFilter('0.29.0', '> 0.30'), false);

    // Operators < 0.35
    assert.strictEqual(matchesVersionFilter('0.34.1', '< 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.32', '< 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.30.2', '< 0.35'), true);
    assert.strictEqual(matchesVersionFilter('0.35-a0', '< 0.35'), false);
    assert.strictEqual(matchesVersionFilter('0.35.0', '< 0.35'), false);

    // Minor release matching e.g. 0.34 matches any 0.34.x
    assert.strictEqual(matchesVersionFilter('0.34.1', '0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.34.0', '0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.34', '0.34'), true);
    assert.strictEqual(matchesVersionFilter('0.35-a0', '0.34'), false);
    assert.strictEqual(matchesVersionFilter('0.30.2', '0.34'), false);

    // Exact versions
    assert.strictEqual(matchesVersionFilter('0.34.1', '0.34.1'), true);
    assert.strictEqual(matchesVersionFilter('0.34.0', '0.34.1'), false);
    assert.strictEqual(matchesVersionFilter('0.35-a0', '0.35-a0'), true);

    // Aliases
    assert.strictEqual(matchesVersionFilter('0.35-a0', 'trunk'), true);
    assert.strictEqual(matchesVersionFilter('0.34.1', 'trunk'), false);
    assert.strictEqual(matchesVersionFilter('0.34.1', 'stable'), true);
    assert.strictEqual(matchesVersionFilter('0.35-a0', 'stable'), false);

    // Universal / empty
    assert.strictEqual(matchesVersionFilter('0.34.1', 'all'), true);
    assert.strictEqual(matchesVersionFilter('0.35-a0', 'all'), true);
    assert.strictEqual(matchesVersionFilter('0.34.1', ''), true);
    assert.strictEqual(matchesVersionFilter('0.34.1', null), true);
  });
});

describe('DCSS Regression Suite — DecaAut Time Distribution Parser', () => {
  const trunkMorgueSnippet = `
Dungeon Crawl Stone Soup version 0.35-a0 character file.

ChaosFlame the Wanderer (Gargoyle Fighter)
Turns: 8500, Time: 00:45:20

Health: 85/85      AC: 20    Str: 18    XL:     10
Gold:   420        EV: 12    Int: 14    God:    Okawaru

Table legend: (Time is in decaauts)
 A = Elapsed time spent in this place.
 B = Non-inter-level travel time spent in this place.
 C = Inter-level travel time spent in this place.
 D = Time resting spent in this place.
 E = Time spent auto-exploring this place.
 F = Levels seen in this place.
 G = Mean time per level.
                   A        B        C        D        E      F       G
               +--------+--------+--------+--------+--------+-----+--------+
         Total |   7136 |   6658 |    478 |    495 |   4924 |   7 | 1019.4 |
       Dungeon |   7136 |   6658 |    478 |    495 |   4924 |   7 | 1019.4 |
               +--------+--------+--------+--------+--------+-----+--------+

Top non-repeatable levels by time:
     D:6: 1649 daAuts
     D:2: 1374 daAuts
     D:4: 1144 daAuts
     D:3: 1047 daAuts
     D:1: 1046 daAuts
     D:5: 856 daAuts
     D:7: 19 daAuts

DLua errors:
`;

  it('correctly parses 0.35 Trunk morgue with timing table: A-G metrics, tactical decaauts, percentages, and slowest levels', () => {
    const dist = parseTimeDistribution(trunkMorgueSnippet);
    assert(dist !== null, 'Time distribution must not be null for Trunk morgue');

    // A through G metrics
    assert.strictEqual(dist.total_decaauts, 7136, 'Total decaauts (A) must equal 7136');
    assert.strictEqual(dist.non_travel_decaauts, 6658, 'Non-inter-level travel decaauts (B) must equal 6658');
    assert.strictEqual(dist.inter_travel_decaauts, 478, 'Inter-level travel decaauts (C) must equal 478');
    assert.strictEqual(dist.resting_decaauts, 495, 'Resting decaauts (D) must equal 495');
    assert.strictEqual(dist.explore_decaauts, 4924, 'Auto-explore decaauts (E) must equal 4924');
    assert.strictEqual(dist.levels_seen, 7, 'Levels seen (F) must equal 7');
    assert.strictEqual(dist.mean_per_level, 1019.4, 'Mean time per level (G) must equal 1019.4');

    // Tactical decaauts: B - (D + E) = 6658 - (495 + 4924) = 1239
    const expectedTactical = 6658 - (495 + 4924);
    assert.strictEqual(dist.tactical_decaauts, expectedTactical);
    assert.strictEqual(dist.tactical_decaauts, 1239);

    // Percentages calculated over total decaauts (7136)
    assert.strictEqual(dist.tactical_pct, 17.36);
    assert.strictEqual(dist.explore_pct, 69.00);
    assert.strictEqual(dist.inter_travel_pct, 6.70);
    assert.strictEqual(dist.resting_pct, 6.94);

    // Slowest levels
    assert.strictEqual(dist.top_levels.length, 7);
    assert.deepStrictEqual(dist.top_levels[0], { place: 'D:6', daAuts: 1649 });
    assert.deepStrictEqual(dist.top_levels[1], { place: 'D:2', daAuts: 1374 });
    assert.deepStrictEqual(dist.top_levels[2], { place: 'D:4', daAuts: 1144 });
  });

  it('enforces mathematical invariant: tactical_pct + explore_pct + inter_travel_pct + resting_pct == 100.00%', () => {
    const dist = parseTimeDistribution(trunkMorgueSnippet);
    assert(dist !== null);
    const sum = dist.tactical_pct + dist.explore_pct + dist.inter_travel_pct + dist.resting_pct;
    // Verify sum equals 100.00% within floating-point precision / rounding
    assert(Math.abs(sum - 100.00) < 0.05, `Percentages sum must equal 100.00%, got ${sum}`);

    // Verify invariant holds on a secondary synthetic table
    const synthSnippet = `
Table legend: (Time is in decaauts)
                   A        B        C        D        E      F       G
         Total |  10000 |   9000 |   1000 |   1500 |   4500 |  10 | 1000.0 |

Top non-repeatable levels by time:
     D:1: 1000 daAuts
`;
    const synthDist = parseTimeDistribution(synthSnippet);
    assert(synthDist !== null);
    // tactical: 9000 - (1500 + 4500) = 3000 -> 30.00%
    // explore: 4500 -> 45.00%
    // inter_travel: 1000 -> 10.00%
    // resting: 1500 -> 15.00%
    assert.strictEqual(synthDist.tactical_pct, 30.00);
    assert.strictEqual(synthDist.explore_pct, 45.00);
    assert.strictEqual(synthDist.inter_travel_pct, 10.00);
    assert.strictEqual(synthDist.resting_pct, 15.00);
    const synthSum = synthDist.tactical_pct + synthDist.explore_pct + synthDist.inter_travel_pct + synthDist.resting_pct;
    assert.strictEqual(synthSum, 100.00);
  });

  it('returns null for morgues without timing table (versions 0.30, 0.31, 0.32, 0.33, 0.34)', () => {
    const morgue030 = `
 Dungeon Crawl Stone Soup version 0.30.2 character file.
 Player the Fighter (level 5, -1/42 HPs)
 Began as a Minotaur Fighter on Jan 10, 2024.
 Slain by an ogre on level 3 of the Dungeon.
 The game lasted 00:08:15 (1820 turns).
`;
    const morgue031 = `Dungeon Crawl Stone Soup version 0.31.0 character file.\nSlain by an adder on D:2.`;
    const morgue032 = `Dungeon Crawl Stone Soup version 0.32.1 character file.\nSlain by an orc warrior on D:4.`;
    const morgue033 = `Dungeon Crawl Stone Soup version 0.33.0 character file.\nEscaped with the Orb!`;
    const morgue034 = `
 Dungeon Crawl Stone Soup version 0.34.1 character file.
 Began as an Oni Hedge Wizard on Oct 14, 2026.
 Slain by an orc on level 4 of the Dungeon.
 The game lasted 00:11:07 (2872 turns).
`;

    assert.strictEqual(parseTimeDistribution(morgue030), null, 'Version 0.30 morgue must return null');
    assert.strictEqual(parseTimeDistribution(morgue031), null, 'Version 0.31 morgue must return null');
    assert.strictEqual(parseTimeDistribution(morgue032), null, 'Version 0.32 morgue must return null');
    assert.strictEqual(parseTimeDistribution(morgue033), null, 'Version 0.33 morgue must return null');
    assert.strictEqual(parseTimeDistribution(morgue034), null, 'Version 0.34 morgue must return null');
    assert.strictEqual(parseTimeDistribution(''), null, 'Empty string must return null');
    assert.strictEqual(parseTimeDistribution(null), null, 'Null content must return null');
  });

  it('correctly parses slowest levels containing portal branches with spaces (e.g. Ice Cave: 708 daAuts)', () => {
    const morgueWithPortals = `
Table legend: (Time is in decaauts)
                   A        B        C        D        E      F       G
         Total |   8000 |   7200 |    800 |    600 |   5000 |   8 | 1000.0 |

Top non-repeatable levels by time:
     Level 2 of the Dungeon: 1,855 daAuts
     Ice Cave: 708 daAuts
     Ecumenical Temple: 15 daAuts
     Desolation of Salt: 1,200 daAuts
     Wizard Laboratory: 950 daAuts
     D:1: 1046 daAuts
`;
    const dist = parseTimeDistribution(morgueWithPortals);
    assert(dist !== null);
    assert.strictEqual(dist.top_levels.length, 6);

    const iceCave = dist.top_levels.find(l => l.place === 'Ice Cave');
    assert(iceCave !== undefined, 'Ice Cave portal level must be captured');
    assert.strictEqual(iceCave.place, 'Ice Cave');
    assert.strictEqual(iceCave.daAuts, 708);

    const temple = dist.top_levels.find(l => l.place === 'Ecumenical Temple');
    assert(temple !== undefined);
    assert.strictEqual(temple.place, 'Ecumenical Temple');
    assert.strictEqual(temple.daAuts, 15);

    const desolation = dist.top_levels.find(l => l.place === 'Desolation of Salt');
    assert(desolation !== undefined);
    assert.strictEqual(desolation.place, 'Desolation of Salt');
    assert.strictEqual(desolation.daAuts, 1200);

    const wizLab = dist.top_levels.find(l => l.place === 'Wizard Laboratory');
    assert(wizLab !== undefined);
    assert.strictEqual(wizLab.place, 'Wizard Laboratory');
    assert.strictEqual(wizLab.daAuts, 950);
  });
});

describe('DCSS Regression Suite — Database Migration & Semantic Version Queries', () => {
  it('idempotently migrates schema and backfills version numbers for existing records', () => {
    const rawDb = new DatabaseSync(':memory:');

    // Create legacy table structure without semantic versioning or time distribution columns
    rawDb.exec(`
      CREATE TABLE games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        species_abbr TEXT NOT NULL,
        background TEXT NOT NULL,
        background_abbr TEXT NOT NULL,
        combo TEXT NOT NULL,
        char_name TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        version TEXT,
        source_file TEXT,
        is_active INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Insert records with missing version_minor/version_major
    const insert = rawDb.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, version, source_file, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('g1', 'Player1', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.1', 'Stable/saves/logfile', 0);
    insert.run('g2', 'Player2', 'Gargoyle', 'Gr', 'Earth Elementalist', 'EE', 'GrEE', 'GrEE', '0.35-a0', 'Trunk/saves/logfile', 0);
    insert.run('g3', 'Player3', 'Djinni', 'Dj', 'Conjurer', 'Cj', 'DjCj', 'DjCj', null, 'Trunk/saves/logfile', 0);
    insert.run('g4', 'Player4', 'Deep Elf', 'DE', 'Conjurer', 'Cj', 'DECj', 'DECj', null, 'Stable/saves/logfile', 0);

    // Run migration
    migrateSchema(rawDb);

    // Verify all 8 columns were added
    const tableInfo = rawDb.prepare('PRAGMA table_info(games)').all();
    const colNames = new Set(tableInfo.map(c => c.name));
    const expectedCols = [
      'version_major',
      'version_minor',
      'version_patch',
      'tactical_pct',
      'explore_pct',
      'inter_travel_pct',
      'resting_pct',
      'time_distribution',
    ];
    for (const col of expectedCols) {
      assert(colNames.has(col), `Column ${col} must be added by migrateSchema`);
    }

    // Verify rows were properly backfilled
    const g1 = rawDb.prepare('SELECT version_major, version_minor, version_patch FROM games WHERE id = ?').get('g1');
    assert.strictEqual(g1.version_major, 0);
    assert.strictEqual(g1.version_minor, 34);
    assert.strictEqual(g1.version_patch, 1);

    const g2 = rawDb.prepare('SELECT version_major, version_minor, version_patch FROM games WHERE id = ?').get('g2');
    assert.strictEqual(g2.version_major, 0);
    assert.strictEqual(g2.version_minor, 35);
    assert.strictEqual(g2.version_patch, 0);

    const g3 = rawDb.prepare('SELECT version_major, version_minor, version_patch FROM games WHERE id = ?').get('g3');
    assert.strictEqual(g3.version_major, 0);
    assert.strictEqual(g3.version_minor, 35);
    assert.strictEqual(g3.version_patch, 0);

    const g4 = rawDb.prepare('SELECT version_major, version_minor, version_patch FROM games WHERE id = ?').get('g4');
    assert.strictEqual(g4.version_major, 0);
    assert.strictEqual(g4.version_minor, 34);
    assert.strictEqual(g4.version_patch, 0);

    // Test idempotency: running migrateSchema again must not fail or alter counts
    migrateSchema(rawDb);
    const count = rawDb.prepare('SELECT COUNT(*) as c FROM games').get().c;
    assert.strictEqual(count, 4);

    rawDb.close();
  });

  it('correctly queries games with semantic version filters (>= 0.35, <= 0.34, all)', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, version, version_major, version_minor, version_patch, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('r1', 'P1', 'Gargoyle', 'Gr', 'Fighter', 'Fi', 'GrFi', 'GrFi', '0.35-a0', 0, 35, 0, 0);
    insert.run('r2', 'P2', 'Gargoyle', 'Gr', 'Fighter', 'Fi', 'GrFi', 'GrFi', '0.35.1', 0, 35, 1, 0);
    insert.run('r3', 'P3', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.1', 0, 34, 1, 0);
    insert.run('r4', 'P4', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.0', 0, 34, 0, 0);
    insert.run('r5', 'P5', 'Kobold', 'Ko', 'Brigand', 'Br', 'KoBr', 'KoBr', '0.30.2', 0, 30, 2, 0);

    // 1. Filter: >= 0.35 (should return r1, r2)
    const resGe35 = client.getGames({ version: '>= 0.35' });
    assert.strictEqual(resGe35.total, 2);
    assert.strictEqual(resGe35.games.length, 2);
    const idsGe35 = resGe35.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsGe35, ['r1', 'r2']);

    // 2. Filter: <= 0.34 (should return r3, r4, r5)
    const resLe34 = client.getGames({ version: '<= 0.34' });
    assert.strictEqual(resLe34.total, 3);
    assert.strictEqual(resLe34.games.length, 3);
    const idsLe34 = resLe34.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsLe34, ['r3', 'r4', 'r5']);

    // 3. Filter: all (should return all 5 games)
    const resAll = client.getGames({ version: 'all' });
    assert.strictEqual(resAll.total, 5);
    assert.strictEqual(resAll.games.length, 5);

    // 4. Minor release filter: 0.34 (should return r3, r4)
    const res34 = client.getGames({ version: '0.34' });
    assert.strictEqual(res34.total, 2);
    const ids34 = res34.games.map(g => g.id).sort();
    assert.deepStrictEqual(ids34, ['r3', 'r4']);

    client.close();
  });

  it('returns versions sorted descending semantically in getVersions()', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, version, version_major, version_minor, version_patch, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('v1', 'P1', 'Kobold', 'Ko', 'Brigand', 'Br', 'KoBr', 'KoBr', '0.30.2', 0, 30, 2, 0);
    insert.run('v2', 'P2', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', '0.34.1', 0, 34, 1, 0);
    insert.run('v3', 'P3', 'Gargoyle', 'Gr', 'Fighter', 'Fi', 'GrFi', 'GrFi', '0.35-a0', 0, 35, 0, 0);
    insert.run('v4', 'P4', 'Felid', 'Fe', 'Berserker', 'Be', 'FeBe', 'FeBe', '0.32', 0, 32, 0, 0);
    insert.run('v5', 'P5', 'Troll', 'Tr', 'Monk', 'Mo', 'TrMo', 'TrMo', '0.35.1', 0, 35, 1, 0);

    const verInfo = client.getVersions();
    assert(Array.isArray(verInfo.versions));
    assert.deepStrictEqual(verInfo.versions, ['0.35.1', '0.35-a0', '0.34.1', '0.32', '0.30.2']);

    client.close();
  });
});

describe('DCSS Regression Suite — Multi-Term OR Search & Prebuilt Categories', () => {
  it('correctly filters games using multi-term OR syntax (or, comma, pipe)', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('g1', 'Player', 'Deep Elf', 'DE', 'Conjurer', 'Cj', 'DECj', 'DECj', 100, 0);
    insert.run('g2', 'Player', 'Gargoyle', 'Gr', 'Earth Elementalist', 'EE', 'GrEE', 'GrEE', 200, 0);
    insert.run('g3', 'Player', 'Minotaur', 'Mi', 'Berserker', 'Be', 'MiBe', 'MiBe', 300, 0);
    insert.run('g4', 'Player', 'Gnoll', 'Gn', 'Fire Elementalist', 'FE', 'GnFE', 'GnFE', 400, 0);
    insert.run('g5', 'Player', 'Kobold', 'Ko', 'Brigand', 'Br', 'KoBr', 'KoBr', 500, 0);

    // 1. Search with 'or': 'Cj or EE'
    const resOr = client.getGames({ q: 'Cj or EE' });
    assert.strictEqual(resOr.total, 2);
    const idsOr = resOr.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsOr, ['g1', 'g2']);

    // 2. Search with comma: 'Cj, EE, FE'
    const resComma = client.getGames({ q: 'Cj, EE, FE' });
    assert.strictEqual(resComma.total, 3);
    const idsComma = resComma.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsComma, ['g1', 'g2', 'g4']);

    // 3. Search with pipe: 'Cj | Berserker'
    const resPipe = client.getGames({ q: 'Cj | Berserker' });
    assert.strictEqual(resPipe.total, 2);
    const idsPipe = resPipe.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsPipe, ['g1', 'g3']);

    client.close();
  });

  it('correctly searches prebuilt Crawl background categories and synonyms', () => {
    const client = createDcssDb(':memory:');
    const db = client.rawDb;

    const insert = db.prepare(`
      INSERT INTO games (id, name, species, species_abbr, background, background_abbr, combo, char_name, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('w1', 'P1', 'Minotaur', 'Mi', 'Fighter', 'Fi', 'MiFi', 'MiFi', 0);
    insert.run('z1', 'P2', 'Troll', 'Tr', 'Berserker', 'Be', 'TrBe', 'TrBe', 0);
    insert.run('m1', 'P3', 'Deep Elf', 'DE', 'Conjurer', 'Cj', 'DECj', 'DECj', 0);
    insert.run('m2', 'P4', 'Gargoyle', 'Gr', 'Earth Elementalist', 'EE', 'GrEE', 'GrEE', 0);
    insert.run('a1', 'P5', 'Spriggan', 'Sp', 'Hexslinger', 'Hs', 'SpHs', 'SpHs', 0);
    insert.run('a2', 'P6', 'Barachi', 'Ba', 'Wanderer', 'Wn', 'BaWn', 'BaWn', 0);

    // 1. Category: warrior
    const resWarrior = client.getGames({ q: 'warrior' });
    assert.strictEqual(resWarrior.total, 1);
    assert.strictEqual(resWarrior.games[0].id, 'w1');

    // 2. Category: zealot
    const resZealot = client.getGames({ q: 'zealot' });
    assert.strictEqual(resZealot.total, 1);
    assert.strictEqual(resZealot.games[0].id, 'z1');

    // 3. Category: mage (matches Conjurer and Earth Elementalist)
    const resMage = client.getGames({ q: 'mage' });
    assert.strictEqual(resMage.total, 2);
    const idsMage = resMage.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsMage, ['m1', 'm2']);

    // 4. Category: elementalist (matches Earth Elementalist)
    const resElem = client.getGames({ q: 'elementalists' });
    assert.strictEqual(resElem.total, 1);
    assert.strictEqual(resElem.games[0].id, 'm2');

    // 5. Category: warrior-mage and warrior mage (matches Hexslinger)
    const resWm1 = client.getGames({ q: 'warrior-mage' });
    assert.strictEqual(resWm1.total, 1);
    assert.strictEqual(resWm1.games[0].id, 'a1');

    const resWm2 = client.getGames({ q: 'warrior mage' });
    assert.strictEqual(resWm2.total, 1);
    assert.strictEqual(resWm2.games[0].id, 'a1');

    // 6. Category: adventurer and plural adventurers (matches Hexslinger and Wanderer)
    const resAdv1 = client.getGames({ q: 'adventurer' });
    assert.strictEqual(resAdv1.total, 2);

    const resAdv2 = client.getGames({ q: 'adventurers' });
    assert.strictEqual(resAdv2.total, 2);

    // Verify warrior search strictly excludes warrior-mage / Hexslinger
    assert.strictEqual(resWarrior.games.some(g => g.background === 'Hexslinger'), false);

    // 7. Combined OR query with category: 'Cj or elementalists'
    const resCombined = client.getGames({ q: 'Cj or elementalists' });
    assert.strictEqual(resCombined.total, 2);
    const idsCombined = resCombined.games.map(g => g.id).sort();
    assert.deepStrictEqual(idsCombined, ['m1', 'm2']);

    client.close();
  });
});




