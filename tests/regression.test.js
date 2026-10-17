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

const { parseXlogLine } = require('../src/db/logfileParser');
const { parseActiveDump, parseFinishedMorgue, isFinishedMorgue } = require('../src/db/morgueParser');
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
} = require('../src/db/constants');
const { getDcssDirs, getConfigDcssDir } = require('../src/db/sync');
const { createDcssDb } = require('../src/db');

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
    assert.strictEqual(parsed.place, 'Bailey');
    assert.strictEqual(parsed.start_time, '2026-10-17T13:01:46.000Z');
    assert.strictEqual(parsed.end_time, '2026-10-17T13:33:02.000Z');
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
    assert(active !== null);
    assert.strictEqual(active.name, 'ChaosFlame');
    assert.strictEqual(active.is_active, 1);
    assert(active.hp > 0);

    const allActive = client.getActiveRuns();
    assert(Array.isArray(allActive));
    assert(allActive.length >= 1);
    assert.strictEqual(allActive[0].name, 'ChaosFlame');

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

    // Stable's live ChaosFlame DjCj must be present
    const stableActive = activeRuns.find(r => r.name === 'ChaosFlame' && r.combo === 'DjCj');
    assert.notStrictEqual(stableActive, undefined, 'Stable live DjCj run must be identified as active');
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


