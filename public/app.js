/**
 * DCSS Stats Dashboard — High-Performance Client Controller
 * Instant client-side caching, 0ms live multi-token search with full abbreviation resolution,
 * clickable in-memory column sorting, clean combo roller, fixed hover geometry with god restrictions,
 * multi-character active run tracker, and purely dynamic version loading.
 */

// Application State
const state = {
  currentTab: 'overview',
  dateRange: 'all',
  customFrom: null,
  customTo: null,
  version: 'all',
  matrixMetric: 'games',
  matrixData: null,

  // In-memory run cache for instant 0ms search & filtering
  allGames: [],
  filteredGames: [],
  runsOffset: 0,
  runsLimit: 50,
  runsSearch: '',
  runsWinsOnly: false,
  explorerRendered: false,
  sortRules: [
    { field: 'end_time', order: 'desc' }
  ],
  sortField: 'end_time',
  sortOrder: 'desc',

  unwonCombos: [],
  unplayedCombos: [],
  topRecommendations: [],
  activeRun: null,
  activeRuns: [],
  selectedActiveRunIndex: 0,
  lastRolledMode: 'any',
};

// ======================== DCSS REFERENCE CONSTANTS ========================

const DCSS_SPECIES = [
  { abbr: 'Ko', name: 'Kobold', trunk: true },
  { abbr: 'VS', name: 'Vine Stalker', trunk: true },
  { abbr: 'Mi', name: 'Minotaur', trunk: true },
  { abbr: 'Sp', name: 'Spriggan', trunk: true },
  { abbr: 'Tr', name: 'Troll', trunk: true },
  { abbr: 'Dg', name: 'Demigod', trunk: true },
  { abbr: 'Dj', name: 'Djinni', trunk: true },
  { abbr: 'Ds', name: 'Demonspawn', trunk: true },
  { abbr: 'DE', name: 'Deep Elf', trunk: true },
  { abbr: 'Hu', name: 'Human', trunk: true },
  { abbr: 'Dr', name: 'Draconian', trunk: true },
  { abbr: 'Gr', name: 'Gargoyle', trunk: true },
  { abbr: 'Fo', name: 'Formicid', trunk: true },
  { abbr: 'Te', name: 'Tengu', trunk: true },
  { abbr: 'Fe', name: 'Felid', trunk: true },
  { abbr: 'MD', name: 'Mountain Dwarf', trunk: true },
  { abbr: 'Mf', name: 'Merfolk', trunk: true },
  { abbr: 'Mu', name: 'Mummy', trunk: true },
  { abbr: 'Na', name: 'Naga', trunk: true },
  { abbr: 'Op', name: 'Octopode', trunk: true },
  { abbr: 'On', name: 'Oni', trunk: true },
  { abbr: 'Ba', name: 'Barachi', trunk: true },
  { abbr: 'Gn', name: 'Gnoll', trunk: true },
  { abbr: 'GC', name: 'Gale Centaur', trunk: true },
  { abbr: 'Co', name: 'Coglin', trunk: true },
  { abbr: 'Re', name: 'Revenant', trunk: true },
  { abbr: 'Po', name: 'Poltergeist', trunk: true },
  // Legacy / Retired species
  { abbr: 'At', name: 'Armataur', trunk: false },
  { abbr: 'Gh', name: 'Ghoul', trunk: false },
  { abbr: 'Vp', name: 'Vampire', trunk: false },
  { abbr: 'HO', name: 'Hill Orc', trunk: false },
  { abbr: 'Og', name: 'Ogre', trunk: false },
  { abbr: 'Me', name: 'Meteoran', trunk: false },
  { abbr: 'Pa', name: 'Palentonga', trunk: false },
  { abbr: 'My', name: 'Mayflytaur', trunk: false },
  { abbr: 'DD', name: 'Deep Dwarf', trunk: false },
  { abbr: 'HE', name: 'High Elf', trunk: false },
  { abbr: 'Ce', name: 'Centaur', trunk: false },
  { abbr: 'Ha', name: 'Halfling', trunk: false },
  { abbr: 'SE', name: 'Sludge Elf', trunk: false },
  { abbr: 'OM', name: 'Ogre-Mage', trunk: false },
  { abbr: 'LO', name: 'Lava Orc', trunk: false },
  { abbr: 'Bu', name: 'Bultungin', trunk: false },
  { abbr: 'GE', name: 'Grey Elf', trunk: false },
  { abbr: 'HD', name: 'Hill Dwarf', trunk: false },
  { abbr: 'El', name: 'Elf', trunk: false },
  { abbr: 'Gm', name: 'Gnome', trunk: false },
];

const DCSS_BACKGROUNDS = [
  // Warriors
  { abbr: 'Fi', name: 'Fighter', category: 'Warriors', trunk: true },
  { abbr: 'Gl', name: 'Gladiator', category: 'Warriors', trunk: true },
  { abbr: 'Mo', name: 'Monk', category: 'Warriors', trunk: true },
  { abbr: 'Hu', name: 'Hunter', category: 'Warriors', trunk: true },
  { abbr: 'Br', name: 'Brigand', category: 'Warriors', trunk: true },
  // Zealots
  { abbr: 'Be', name: 'Berserker', category: 'Zealots', trunk: true },
  { abbr: 'CK', name: 'Chaos Knight', category: 'Zealots', trunk: true },
  { abbr: 'CA', name: 'Cinder Acolyte', category: 'Zealots', trunk: true },
  // Mages
  { abbr: 'FE', name: 'Fire Elementalist', category: 'Mages', trunk: true },
  { abbr: 'IE', name: 'Ice Elementalist', category: 'Mages', trunk: true },
  { abbr: 'AE', name: 'Air Elementalist', category: 'Mages', trunk: true },
  { abbr: 'EE', name: 'Earth Elementalist', category: 'Mages', trunk: true },
  { abbr: 'Al', name: 'Alchemist', category: 'Mages', trunk: true },
  { abbr: 'Cj', name: 'Conjurer', category: 'Mages', trunk: true },
  { abbr: 'En', name: 'Enchanter', category: 'Mages', trunk: true },
  { abbr: 'Ne', name: 'Necromancer', category: 'Mages', trunk: true },
  { abbr: 'Su', name: 'Summoner', category: 'Mages', trunk: true },
  { abbr: 'HW', name: 'Hedge Wizard', category: 'Mages', trunk: true },
  // Adventurers
  { abbr: 'Ar', name: 'Artificer', category: 'Adventurers', trunk: true },
  { abbr: 'Sh', name: 'Shapeshifter', category: 'Adventurers', trunk: true },
  { abbr: 'Wn', name: 'Wanderer', category: 'Adventurers', trunk: true },
  { abbr: 'Hs', name: 'Hexslinger', category: 'Adventurers', trunk: true },
  { abbr: 'Wr', name: 'Warper', category: 'Adventurers', trunk: true },
  { abbr: 'De', name: 'Delver', category: 'Adventurers', trunk: true },
  { abbr: 'Re', name: 'Reaver', category: 'Adventurers', trunk: true },
  { abbr: 'Fw', name: 'Forgewright', category: 'Adventurers', trunk: true },
  { abbr: 'St', name: 'Stalker', category: 'Adventurers', trunk: true },
  { abbr: 'My', name: 'Mystic', category: 'Adventurers', trunk: true },
  // Legacy Backgrounds
  { abbr: 'Tm', name: 'Transmuter', category: 'Adventurers', trunk: false },
  { abbr: 'He', name: 'Healer', category: 'Zealots', trunk: false },
  { abbr: 'Sk', name: 'Skald', category: 'Warriors', trunk: false },
  { abbr: 'DK', name: 'Death Knight', category: 'Zealots', trunk: false },
  { abbr: 'Pr', name: 'Priest', category: 'Zealots', trunk: false },
  { abbr: 'Cr', name: 'Crusader', category: 'Warriors', trunk: false },
  { abbr: 'Pa', name: 'Paladin', category: 'Zealots', trunk: false },
  { abbr: 'Th', name: 'Thief', category: 'Warriors', trunk: false },
  { abbr: 'Jr', name: 'Jester', category: 'Adventurers', trunk: false },
  { abbr: 'AK', name: 'Abyssal Knight', category: 'Zealots', trunk: false },
  { abbr: 'VM', name: 'Venom Mage', category: 'Mages', trunk: false },
];

const UNAVAILABLE_COMBOS = new Set([
  'GhTm', 'MuTm', 'GhSh', 'MuSh', 'DgMo', 'DgCK', 'DgCA', 'DgBe', 'DgAK',
  'FeHu', 'FeGl', 'FeBr', 'FeHs', 'PoSh', 'ReSh'
]);

const GOD_RESTRICTIONS = {
  'Dg': 'Demigods cannot worship any deity (Strict Atheism).',
  'Dj': 'Cannot worship Sif Muna, Vehumet, or Kikubaaqudgha (casts spells with HP).',
  'Mu': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon) or Fedhas.',
  'Gh': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon) or Fedhas.',
  'Vp': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon).',
  'Re': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon) or Fedhas.',
  'Po': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon) or Fedhas.',
  'Ds': 'Cannot worship Good Gods (The Shining One, Zin, Elyvilon).'
};

// Official in-game DCSS recommended combos
const DCSS_RECOMMENDED_COMBOS = [
  { combo: 'MiBe', species: 'Minotaur', background: 'Berserker', note: 'Heavy melee powerhouse' },
  { combo: 'MiFi', species: 'Minotaur', background: 'Fighter', note: 'Straightforward martial fighter' },
  { combo: 'GrEE', species: 'Gargoyle', background: 'Earth Elementalist', note: 'Stonemail caster with high natural AC' },
  { combo: 'TrBe', species: 'Troll', background: 'Berserker', note: 'Natural claws with rapid regeneration' },
  { combo: 'MDBe', species: 'Mountain Dwarf', background: 'Berserker', note: 'Heavy armour specialist with divine fury' },
  { combo: 'MDFi', species: 'Mountain Dwarf', background: 'Fighter', note: 'Shields and heavy armour mastery' },
  { combo: 'DEFE', species: 'Deep Elf', background: 'Fire Elementalist', note: 'High magic aptitude elementalist' },
  { combo: 'DECj', species: 'Deep Elf', background: 'Conjurer', note: 'Direct destructive spellcaster' },
  { combo: 'SpEn', species: 'Spriggan', background: 'Enchanter', note: 'Fast stealth and hexes' },
  { combo: 'KoEn', species: 'Kobold', background: 'Enchanter', note: 'Nightstalker stealth stabber' },
  { combo: 'MfGl', species: 'Merfolk', background: 'Gladiator', note: 'Polearm master with high evasion' },
  { combo: 'MfFi', species: 'Merfolk', background: 'Fighter', note: 'Polearms and water movement' },
  { combo: 'DrCj', species: 'Draconian', background: 'Conjurer', note: 'Breath weapons and conjurations' },
  { combo: 'GnWn', species: 'Gnoll', background: 'Wanderer', note: 'Broad skills and versatility' },
  { combo: 'DjCj', species: 'Djinni', background: 'Conjurer', note: 'HP spellcasting and flight' },
  { combo: 'DjFE', species: 'Djinni', background: 'Fire Elementalist', note: 'Fire magic cast directly from HP' },
  { combo: 'VSFi', species: 'Vine Stalker', background: 'Fighter', note: 'Antimagic bite and spirit shield' },
  { combo: 'FoFi', species: 'Formicid', background: 'Fighter', note: 'Two-handed weapons with shields and digging' },
  { combo: 'OnBe', species: 'Oni', background: 'Berserker', note: 'Massive HP and giant weapons' },
  { combo: 'CoAr', species: 'Coglin', background: 'Artificer', note: 'Dual-wielding gadgeteer' },
  { combo: 'FeSu', species: 'Felid', background: 'Summoner', note: 'Minion army with feline extra lives' },
  { combo: 'HuFi', species: 'Human', background: 'Fighter', note: 'Balanced all-arounder' }
];

// Bidirectional abbreviation dictionaries for fast search
const SPECIES_BY_ABBR = {};
const SPECIES_BY_NAME = {};
DCSS_SPECIES.forEach(s => {
  SPECIES_BY_ABBR[s.abbr.toLowerCase()] = s;
  SPECIES_BY_NAME[s.name.toLowerCase()] = s;
});

const BG_BY_ABBR = {};
const BG_BY_NAME = {};
DCSS_BACKGROUNDS.forEach(b => {
  BG_BY_ABBR[b.abbr.toLowerCase()] = b;
  BG_BY_NAME[b.name.toLowerCase()] = b;
});

const DCSS_GOD_ALIASES = {
  'oka': 'okawaru',
  'okawaru': 'okawaru',
  'trog': 'trog',
  'goz': 'gozag',
  'gozag': 'gozag',
  'xom': 'xom',
  'ash': 'ashenzari',
  'ashenzari': 'ashenzari',
  'beogh': 'beogh',
  'chei': 'cheibriados',
  'cheibriados': 'cheibriados',
  'dith': 'dithmenos',
  'dithmenos': 'dithmenos',
  'ely': 'elyvilon',
  'elyvilon': 'elyvilon',
  'fed': 'fedhas',
  'fedhas': 'fedhas',
  'hep': 'hepliaklqana',
  'hepliaklqana': 'hepliaklqana',
  'ig': 'ignis',
  'ignis': 'ignis',
  'jiy': 'jiyva',
  'jiyva': 'jiyva',
  'kiku': 'kikubaaqudgha',
  'kikubaaqudgha': 'kikubaaqudgha',
  'lug': 'lugonu',
  'lugonu': 'lugonu',
  'makh': 'makhleb',
  'makhleb': 'makhleb',
  'nem': 'nemelex xobeh',
  'nemelex': 'nemelex xobeh',
  'qaz': 'qazlal',
  'qazlal': 'qazlal',
  'ru': 'ru',
  'sif': 'sif muna',
  'tso': 'the shining one',
  'shining one': 'the shining one',
  'the shining one': 'the shining one',
  'usk': 'uskayaw',
  'uskayaw': 'uskayaw',
  'veh': 'vehumet',
  'vehumet': 'vehumet',
  'wu': 'wu jian',
  'wjc': 'wu jian',
  'wu jian': 'wu jian',
  'yred': 'yredelemnul',
  'yredelemnul': 'yredelemnul',
  'zin': 'zin'
};

// ======================== INITIALIZATION ========================

document.addEventListener('DOMContentLoaded', () => {
  loadVersions();
  loadAllData();
  initMatrixEvents();

  // Delegated click handler for viewing morgue files (XSS-safe)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-morgue');
    if (btn && btn.dataset.morgue) {
      viewMorgue(btn.dataset.morgue);
    }
  });

  // Poll for active run updates every 10 seconds without disrupting UI
  setInterval(loadActiveRun, 10000);

  // Keyboard shortcut: Spacebar on Recommender tab triggers combo roll
  document.addEventListener('keydown', (e) => {
    if (state.currentTab === 'suggest' && e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      rollCombo(state.lastRolledMode || 'any');
    }
  });
});

async function loadVersions() {
  try {
    const res = await fetch('/api/versions');
    const data = await res.json();
    if (data.success && Array.isArray(data.versions)) {
      const select = document.getElementById('versionSelect');
      if (!select) return;

      const currentVal = select.value;
      select.innerHTML = '<option value="all">All Versions</option>';

      // Populate purely dynamically from /api/versions — no hardcoded options
      data.versions.forEach((v) => {
        if (!v) return;
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });

      if (Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
      } else {
        select.value = 'all';
      }
    }
  } catch (err) {
    console.warn('Could not fetch versions:', err);
  }
}

async function loadAllData() {
  await Promise.all([
    loadActiveRun(),
    loadStats(),
    loadMatrix(),
    loadSuggest(),
    fetchAllGamesForClientCache(),
  ]);
  renderRecentRuns();
  renderExplorerRuns();
}

function getFilterParams() {
  const params = new URLSearchParams();
  if (state.dateRange === 'custom') {
    if (state.customFrom) params.append('from', state.customFrom);
    if (state.customTo) params.append('to', state.customTo);
  } else if (state.dateRange && state.dateRange !== 'all') {
    params.append('dateRange', state.dateRange);
  }

  if (state.version && state.version !== 'all') {
    params.append('version', state.version);
  }
  return params;
}

// ======================== TAB NAVIGATION ========================

function switchTab(tabId) {
  if (state.currentTab === tabId) return;
  state.currentTab = tabId;

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.classList.toggle('active', tab.id === `tab-${tabId}`);
  });

  if (tabId === 'matrix' && !state.matrixData) {
    loadMatrix();
  } else if (tabId === 'runs' && !state.explorerRendered) {
    renderExplorerRuns();
  }
}

// ======================== ACTIVE GAME TRACKER ========================

async function loadActiveRun() {
  try {
    const res = await fetch('/api/active');
    const data = await res.json();
    const activeRuns = data.activeRuns || (data.activeRun ? [data.activeRun] : []);
    state.activeRuns = activeRuns.filter(r => r && r.is_active);

    const banner = document.getElementById('activeRunBanner');
    const tabsContainer = document.getElementById('activeRunsTabs');

    if (state.activeRuns.length === 0) {
      if (banner) banner.style.display = 'none';
      state.activeRun = null;
      return;
    }

    if (banner) banner.style.display = 'block';

    // If multiple active runs, render character tabs
    if (tabsContainer) {
      if (state.activeRuns.length > 1) {
        tabsContainer.style.display = 'flex';
        tabsContainer.innerHTML = '';
        state.activeRuns.forEach((run, idx) => {
          const btn = document.createElement('button');
          btn.className = `active-run-tab ${idx === state.selectedActiveRunIndex ? 'active' : ''}`;
          btn.textContent = `${run.name} (${run.combo || '??'}) 📍 ${run.place || 'Dungeon'}`;
          btn.onclick = () => selectActiveRun(idx);
          tabsContainer.appendChild(btn);
        });
      } else {
        tabsContainer.style.display = 'none';
      }
    }

    // Ensure selected index is in bounds
    if (state.selectedActiveRunIndex >= state.activeRuns.length) {
      state.selectedActiveRunIndex = 0;
    }

    const active = state.activeRuns[state.selectedActiveRunIndex];
    const prev = state.activeRun;
    const isSame = prev && active && prev.name === active.name && prev.turns === active.turns && prev.hp === active.hp && prev.place === active.place && prev.xl === active.xl;
    state.activeRun = active;
    if (!isSame) {
      renderActiveRunDetails(active);
    }
  } catch (err) {
    console.warn('Could not poll active runs:', err);
  }
}

function selectActiveRun(idx) {
  state.selectedActiveRunIndex = idx;
  const active = state.activeRuns[idx];
  state.activeRun = active;

  const tabs = document.querySelectorAll('.active-run-tab');
  tabs.forEach((tab, i) => {
    tab.classList.toggle('active', i === idx);
  });

  renderActiveRunDetails(active);
}

function renderActiveRunDetails(active) {
  if (!active) return;

  const nameEl = document.getElementById('activeRunName');
  if (nameEl) nameEl.textContent = `${active.name} ${active.title || ''}`;

  const comboEl = document.getElementById('activeRunCombo');
  if (comboEl) comboEl.textContent = `(${active.species} ${active.background})`;

  const placeEl = document.getElementById('activeRunPlace');
  if (placeEl) placeEl.textContent = active.place || 'Dungeon';

  // Live Dump Button in Active Run Banner
  const dumpFilename = active.morgue_file ? pathBasename(active.morgue_file) : (active.name ? `${active.name}.txt` : null);
  const dumpBtn = document.getElementById('activeRunViewDumpBtn');
  if (dumpBtn) {
    if (dumpFilename) {
      dumpBtn.style.display = 'inline-block';
      dumpBtn.dataset.morgue = dumpFilename;
    } else {
      dumpBtn.style.display = 'none';
    }
  }

  const xlEl = document.getElementById('activeRunXl');
  if (xlEl) xlEl.textContent = active.xl || 1;

  const hpEl = document.getElementById('activeRunHp');
  if (hpEl) hpEl.textContent = active.hp ?? '-';

  const maxHpEl = document.getElementById('activeRunMaxHp');
  if (maxHpEl) maxHpEl.textContent = active.max_hp ?? '-';

  const acEl = document.getElementById('activeRunAc');
  if (acEl) acEl.textContent = active.ac ?? 0;

  const evEl = document.getElementById('activeRunEv');
  if (evEl) evEl.textContent = active.ev ?? 0;

  const shEl = document.getElementById('activeRunSh');
  if (shEl) shEl.textContent = active.sh ?? 0;

  const godEl = document.getElementById('activeRunGod');
  if (godEl) godEl.textContent = active.god || 'Atheist';

  const pietyEl = document.getElementById('activeRunPiety');
  if (pietyEl) pietyEl.textContent = active.piety ? '★'.repeat(Math.min(6, active.piety)) : '';

  const turnsEl = document.getElementById('activeRunTurns');
  if (turnsEl) turnsEl.textContent = (active.turns || 0).toLocaleString();

  const timeEl = document.getElementById('activeRunTime');
  if (timeEl) timeEl.textContent = active.duration_formatted || '00:00:00';

  const speedEl = document.getElementById('activeRunSpeed');
  if (speedEl) speedEl.textContent = active.turn_speed ? active.turn_speed.toFixed(2) : '0.00';
}

// ======================== STATS & OVERVIEW ========================

async function loadStats() {
  try {
    const params = getFilterParams();
    const res = await fetch(`/api/stats?${params.toString()}`);
    const { stats } = await res.json();

    if (!stats) return;

    // Header Winrate
    const wins = stats.wins || 0;
    const games = stats.totalGames || 0;
    const rate = stats.winRatePercent || 0;

    document.getElementById('profileWins').textContent = `${wins}W`;
    document.getElementById('profileGames').textContent = `${games}G`;
    document.getElementById('profileRate').textContent = `${rate.toFixed(2)}% WR`;

    // Dynamic Player Name
    const playerNameEl = document.getElementById('profilePlayerName');
    if (playerNameEl) {
      const pName = (state.activeRun && state.activeRun.name) ||
                    (state.allGames[0] && state.allGames[0].name) ||
                    'Player';
      playerNameEl.textContent = pName;
    }

    // Context subtext
    const ctx = document.getElementById('profileFilterContext');
    if (ctx) {
      const vText = state.version !== 'all' ? ` (v${state.version})` : '';
      ctx.textContent = `Across ${state.dateRange === 'all' ? 'All Time' : state.dateRange}${vText}`;
    }

    // 1. Score Metrics
    document.getElementById('statBestScore').textContent = (stats.scoreMetrics?.best || 0).toLocaleString();
    document.getElementById('statAvgScore').textContent = Math.round(stats.scoreMetrics?.avg || 0).toLocaleString();
    document.getElementById('statMedianScore').textContent = (stats.scoreMetrics?.median || 0).toLocaleString();
    document.getElementById('statTotalScore').textContent = (stats.scoreMetrics?.total || 0).toLocaleString();

    // 2. Playtime Metrics
    document.getElementById('statTotalTime').textContent = stats.totalPlaytime?.formatted || '00:00:00';
    document.getElementById('statAvgDuration').textContent = stats.avgDuration?.formatted || '00:00:00';

    const fastestWinEl = document.getElementById('statFastestWin');
    if (fastestWinEl) {
      if (stats.fastestWin) {
        fastestWinEl.textContent = `${stats.fastestWin.duration_formatted} (${stats.fastestWin.combo})`;
        fastestWinEl.title = `${stats.fastestWin.char_name} - ${stats.fastestWin.turns.toLocaleString()} turns`;
      } else {
        fastestWinEl.textContent = 'None';
      }
    }

    const shortestWinEl = document.getElementById('statShortestWin');
    if (shortestWinEl) {
      if (stats.shortestWinByTurns) {
        shortestWinEl.textContent = `${stats.shortestWinByTurns.turns.toLocaleString()} turns (${stats.shortestWinByTurns.combo})`;
      } else {
        shortestWinEl.textContent = 'None';
      }
    }

    // 3. Turn Metrics
    const totalTurns = stats.turnSpeedMetrics?.totalTurns || 0;
    const avgTurns = games > 0 ? Math.round(totalTurns / games) : 0;
    const avgSpeed = stats.turnSpeedMetrics?.avg || 0;
    const secPerTurn = avgSpeed > 0 ? (1 / avgSpeed).toFixed(2) : '0.00';

    document.getElementById('statTotalTurns').textContent = totalTurns.toLocaleString();
    document.getElementById('statAvgTurns').textContent = avgTurns.toLocaleString();
    document.getElementById('statAvgTurnSpeed').textContent = `${avgSpeed.toFixed(2)} turns/sec`;
    document.getElementById('statTurnDuration').textContent = `${secPerTurn} sec/turn`;

    // 4. Runes & Milestones
    document.getElementById('statRunesWon').textContent = stats.runes?.totalExtracted || 0;
    document.getElementById('statMaxRunes').textContent = stats.runes?.maxInSingleGame || 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ======================== MULTI-TOKEN SEARCH ENGINE (0ms LAG) ========================

function matchesToken(run, token) {
  // 1. 4-character combo code (e.g. 'mifi', 'deee', 'gree')
  if (token.length === 4) {
    if ((run.combo || '').toLowerCase() === token) return true;
    const sp = token.slice(0, 2);
    const bg = token.slice(2, 4);
    if ((run.species_abbr || '').toLowerCase() === sp && (run.background_abbr || '').toLowerCase() === bg) return true;
  }

  // 2. 2-character species or background abbreviation (exact abbreviation resolution)
  if (token.length === 2) {
    if (SPECIES_BY_ABBR[token]) {
      if (run._spAbbrLower === token || run._spLower === SPECIES_BY_ABBR[token].name.toLowerCase()) return true;
    }
    if (BG_BY_ABBR[token]) {
      if (run._bgAbbrLower === token || run._bgLower === BG_BY_ABBR[token].name.toLowerCase()) return true;
    }
    // If it matches a known 2-letter species/background abbreviation, do not do loose substring matching
    if (SPECIES_BY_ABBR[token] || BG_BY_ABBR[token]) {
      return false;
    }
  }

  // 3. Species by full name
  if (SPECIES_BY_NAME[token]) {
    if (run._spLower === token || run._spAbbrLower === SPECIES_BY_NAME[token].abbr.toLowerCase()) return true;
  }

  // 4. Background by full name
  if (BG_BY_NAME[token]) {
    if (run._bgLower === token || run._bgAbbrLower === BG_BY_NAME[token].abbr.toLowerCase()) return true;
  }

  // 5. God alias / abbreviation / name
  if (token === 'atheist' || token === 'none') {
    if (!run.god || run.god.trim() === '') return true;
  }
  if (DCSS_GOD_ALIASES[token]) {
    const target = DCSS_GOD_ALIASES[token];
    const rg = (run._godLower || '').trim();
    if (rg && (rg === target || rg.startsWith(target) || target.startsWith(rg))) return true;
  }
  if (run._godLower && run._godLower.trim().startsWith(token)) return true;

  // 6. Win
  if ((token === 'win' || token === 'won') && run.is_win) return true;

  // 7. Fast single-pass substring search via precomputed haystack
  if (run._haystack) {
    return run._haystack.includes(token);
  }

  return false;
}

function runMatchesAllTokens(run, tokens) {
  for (const token of tokens) {
    if (!matchesToken(run, token)) {
      return false;
    }
  }
  return true;
}

// ======================== CLIENT-SIDE DATA CACHE & SORTING ========================

async function fetchAllGamesForClientCache() {
  try {
    const params = getFilterParams();
    params.append('limit', 'all'); // Fetch all games without any artificial run limit
    params.append('sort', 'end_time');
    params.append('order', 'desc');

    const res = await fetch(`/api/games?${params.toString()}`);
    const data = await res.json();
    state.allGames = (data.games || []).map((r) => {
      // Pre-compute lightweight integer timestamp and lowercase fields for 0ms sorting and filtering
      r._time = r.end_time ? new Date(r.end_time).getTime() : 0;
      r._comboLower = (r.combo || r.char_name || '').toLowerCase();
      r._godLower = (r.god || '').toLowerCase();
      r._spLower = (r.species || '').toLowerCase();
      r._bgLower = (r.background || '').toLowerCase();
      r._spAbbrLower = (r.species_abbr || '').toLowerCase();
      r._bgAbbrLower = (r.background_abbr || '').toLowerCase();
      r._outcomeLower = (r.outcome || '').toLowerCase();
      r._haystack = [
        r.combo, r.species, r.species_abbr, r.background, r.background_abbr,
        r.god, r.killer, r.place, r.outcome, r.char_name, r.name, r.seed,
        r.xl !== undefined ? String(r.xl) : ''
      ].filter(Boolean).join(' ').toLowerCase();
      return r;
    });

    // Filter and sort in-memory
    applyClientFilter();
  } catch (err) {
    console.error('Error caching runs client-side:', err);
  }
}

function applyClientFilter() {
  const rawSearch = (state.runsSearch || '').trim();
  const winsOnly = state.runsWinsOnly;

  // Multi-token splitting by spaces, commas, or carets ^
  const tokens = rawSearch
    ? rawSearch.split(/[\s,\^]+/).map(t => t.trim().toLowerCase()).filter(Boolean)
    : [];

  state.filteredGames = state.allGames.filter((run) => {
    if (winsOnly && !run.is_win) return false;
    if (tokens.length === 0) return true;
    return runMatchesAllTokens(run, tokens);
  });

  // In-memory instant multi-column sorting
  sortRunsMulti(state.filteredGames, state.sortRules);
  updateSortHeadersUI();
  state.runsOffset = 0;
}

function compareRuns(a, b, field) {
  switch (field) {
    case 'id':
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    case 'end_time':
      return (a._time || 0) - (b._time || 0);
    case 'combo':
      return (a._comboLower || '').localeCompare(b._comboLower || '');
    case 'god':
      return (a._godLower || '').localeCompare(b._godLower || '');
    case 'xl':
      return (Number(a.xl) || 0) - (Number(b.xl) || 0);
    case 'score':
      return (Number(a.score) || 0) - (Number(b.score) || 0);
    case 'turns':
      return (Number(a.turns) || 0) - (Number(b.turns) || 0);
    case 'duration':
      return (Number(a.duration_seconds) || 0) - (Number(b.duration_seconds) || 0);
    case 'speed':
      return (Number(a.turn_speed) || 0) - (Number(b.turn_speed) || 0);
    case 'outcome': {
      const wa = a.is_win ? 1 : 0;
      const wb = b.is_win ? 1 : 0;
      if (wa !== wb) return wa - wb;
      return (a._outcomeLower || '').localeCompare(b._outcomeLower || '');
    }
    default:
      return (a._time || 0) - (b._time || 0);
  }
}

function sortRunsMulti(runs, sortRules) {
  if (!sortRules || sortRules.length === 0) {
    sortRules = [{ field: 'end_time', order: 'desc' }];
  }
  return runs.sort((a, b) => {
    for (const rule of sortRules) {
      const comp = compareRuns(a, b, rule.field);
      if (comp !== 0) {
        return rule.order === 'asc' ? comp : -comp;
      }
    }
    return (b._time || 0) - (a._time || 0);
  });
}

function handleSortClick(field, event) {
  const isShift = Boolean(event && (event.shiftKey || event.ctrlKey || event.metaKey));
  const descDefaults = new Set(['end_time', 'xl', 'score', 'turns', 'duration', 'speed', 'outcome']);

  if (!isShift) {
    // Normal click: if this field is already the single primary sort, toggle order
    if (state.sortRules.length === 1 && state.sortRules[0].field === field) {
      state.sortRules[0].order = state.sortRules[0].order === 'asc' ? 'desc' : 'asc';
    } else {
      // Set as sole primary sort
      state.sortRules = [{
        field,
        order: descDefaults.has(field) ? 'desc' : 'asc'
      }];
    }
  } else {
    // Shift+Click: Multi-sort stack
    const existingIndex = state.sortRules.findIndex(r => r.field === field);
    if (existingIndex !== -1) {
      if (state.sortRules[existingIndex].order === 'desc') {
        state.sortRules[existingIndex].order = 'asc';
      } else {
        // Toggle or remove on 3rd click if multiple criteria exist
        if (state.sortRules.length > 1) {
          state.sortRules.splice(existingIndex, 1);
        } else {
          state.sortRules[0].order = 'desc';
        }
      }
    } else {
      // Append secondary or tertiary sort criterion
      state.sortRules.push({
        field,
        order: descDefaults.has(field) ? 'desc' : 'asc'
      });
    }
  }

  // Update legacy state fields
  if (state.sortRules.length > 0) {
    state.sortField = state.sortRules[0].field;
    state.sortOrder = state.sortRules[0].order;
  }

  sortRunsMulti(state.filteredGames, state.sortRules);
  state.runsOffset = 0;
  updateSortHeadersUI();
  renderExplorerRuns();
}

function removeSortRule(field) {
  state.sortRules = state.sortRules.filter(r => r.field !== field);
  if (state.sortRules.length === 0) {
    state.sortRules = [{ field: 'end_time', order: 'desc' }];
  }
  state.sortField = state.sortRules[0].field;
  state.sortOrder = state.sortRules[0].order;
  sortRunsMulti(state.filteredGames, state.sortRules);
  state.runsOffset = 0;
  updateSortHeadersUI();
  renderExplorerRuns();
}

function resetSort() {
  state.sortRules = [{ field: 'end_time', order: 'desc' }];
  state.sortField = 'end_time';
  state.sortOrder = 'desc';
  sortRunsMulti(state.filteredGames, state.sortRules);
  state.runsOffset = 0;
  updateSortHeadersUI();
  renderExplorerRuns();
}

const FIELD_LABELS = {
  id: '#',
  combo: 'Combo',
  god: 'God',
  xl: 'XL',
  score: 'Score',
  turns: 'Turns',
  duration: 'Duration',
  speed: 'Speed',
  outcome: 'Outcome',
  end_time: 'Time',
};

function formatShortDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day} ${hours}:${mins}`;
}

function updateSortHeadersUI() {
  const fields = ['id', 'combo', 'god', 'xl', 'score', 'turns', 'duration', 'speed', 'outcome', 'end_time'];
  const isMulti = state.sortRules.length > 1;

  fields.forEach((f) => {
    const arrow = document.getElementById(`sortArrow-${f}`);
    if (!arrow) return;

    const ruleIndex = state.sortRules.findIndex(r => r.field === f);
    if (ruleIndex !== -1) {
      const rule = state.sortRules[ruleIndex];
      const arrowSymbol = rule.order === 'asc' ? '▲' : '▼';
      if (isMulti) {
        const superscripts = ['¹', '²', '³', '⁴', '⁵'];
        const superChar = superscripts[ruleIndex] || `${ruleIndex + 1}`;
        arrow.innerHTML = ` ${arrowSymbol}<span class="sort-priority">${superChar}</span>`;
      } else {
        arrow.textContent = ` ${arrowSymbol}`;
      }
    } else {
      arrow.textContent = '';
    }
  });

  // Render active sort pills bar
  const sortBar = document.getElementById('activeSortDisplay');
  if (sortBar) {
    if (state.sortRules.length > 1 || (state.sortRules.length === 1 && state.sortRules[0].field !== 'end_time')) {
      sortBar.style.display = 'flex';
      let pillsHtml = '<span style="font-weight: 700;">Active Sort:</span>';
      state.sortRules.forEach((rule, idx) => {
        const label = FIELD_LABELS[rule.field] || rule.field;
        const arrow = rule.order === 'asc' ? '▲' : '▼';
        pillsHtml += `
          <span class="sort-pill">
            <span class="sort-pill-priority">${idx + 1}.</span>
            <strong>${label}</strong> ${arrow}
            <span class="remove-sort" onclick="removeSortRule('${rule.field}')" title="Remove this sort criteria">✕</span>
          </span>
        `;
      });
      pillsHtml += `<button class="btn" style="padding: 0.15rem 0.5rem; font-size: 0.7rem;" onclick="resetSort()">Reset Sort</button>`;
      pillsHtml += `<span style="color: var(--muted-foreground); font-size: 0.7rem; margin-left: auto;">Tip: Shift+click headers to add secondary sort</span>`;
      sortBar.innerHTML = pillsHtml;
    } else {
      sortBar.style.display = 'none';
    }
  }
}

function renderRecentRuns() {
  const tbody = document.getElementById('recentRunsBody');
  if (!tbody) return;

  const runs = state.allGames.slice(0, 10);
  if (runs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--muted-foreground); padding: 1.5rem;">No completed runs in selected period.</td></tr>';
    return;
  }

  let html = '';
  runs.forEach((run) => {
    const winClass = run.is_win ? ' class="win-row"' : '';
    const dateStr = formatShortDateTime(run.end_time);
    const dateTitle = run.end_time ? new Date(run.end_time).toLocaleString() : '';

    const morgueBtn = run.morgue_file
      ? `<button class="btn btn-view-morgue" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;" data-morgue="${escapeHtml(pathBasename(run.morgue_file))}">View</button>`
      : '-';

    html += `
      <tr${winClass}>
        <td><strong title="${escapeHtml(run.char_name || run.name || '')}">${escapeHtml(run.combo || run.char_name || '')}</strong></td>
        <td>${morgueBtn}</td>
        <td style="color: var(--warning);">${escapeHtml(run.god || '-')}</td>
        <td style="font-weight: 700;">${run.xl || 1}</td>
        <td>${(run.score || 0).toLocaleString()}</td>
        <td>${(run.turns || 0).toLocaleString()}</td>
        <td>${escapeHtml(run.duration_formatted || '-')}</td>
        <td>${run.is_win ? '<span class="win-badge">WON</span> ' : ''}${escapeHtml(run.outcome || 'Died')}</td>
        <td style="font-family: var(--font-mono); color: var(--muted-foreground); text-align: right;" title="${escapeHtml(dateTitle)}">${dateStr}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderExplorerRuns() {
  const tbody = document.getElementById('allRunsBody');
  if (!tbody) return;

  const total = state.filteredGames.length;
  const page = state.filteredGames.slice(state.runsOffset, state.runsOffset + state.runsLimit);

  if (page.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--muted-foreground); padding: 2.5rem;">No runs match your criteria.</td></tr>';
    updatePaginationUI(0, 0, 0);
    state.explorerRendered = true;
    return;
  }

  let html = '';
  page.forEach((run, index) => {
    const winClass = run.is_win ? ' class="win-row"' : '';
    const rowNum = state.runsOffset + index + 1;
    const dateStr = formatShortDateTime(run.end_time);
    const dateTitle = run.end_time ? new Date(run.end_time).toLocaleString() : '';

    const morgueBtn = run.morgue_file
      ? `<button class="btn btn-view-morgue" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;" data-morgue="${escapeHtml(pathBasename(run.morgue_file))}">View</button>`
      : '-';

    html += `
      <tr${winClass}>
        <td style="color: var(--muted-foreground);">${rowNum}</td>
        <td><strong title="${escapeHtml(run.char_name || run.name || '')}">${escapeHtml(run.combo || run.char_name || '')}</strong></td>
        <td>${morgueBtn}</td>
        <td style="color: var(--warning);">${escapeHtml(run.god || '-')}</td>
        <td style="font-weight: 700;">${run.xl || 1}</td>
        <td>${(run.score || 0).toLocaleString()}</td>
        <td>${(run.turns || 0).toLocaleString()}</td>
        <td>${escapeHtml(run.duration_formatted || '-')}</td>
        <td>${run.turn_speed ? run.turn_speed.toFixed(2) : '-'}</td>
        <td>${run.is_win ? '<span class="win-badge">WON</span> ' : ''}${escapeHtml(run.outcome || 'Died')}</td>
        <td style="font-family: var(--font-mono); color: var(--muted-foreground); text-align: right;" title="${escapeHtml(dateTitle)}">${dateStr}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
  state.explorerRendered = true;

  updatePaginationUI(state.runsOffset + 1, Math.min(state.runsOffset + state.runsLimit, total), total);
}

function updatePaginationUI(from, to, total) {
  const info = document.getElementById('runsPaginationInfo');
  if (info) {
    info.textContent = total > 0 ? `Showing ${from} to ${to} of ${total} runs` : 'No runs found';
  }

  const prevBtn = document.getElementById('runsPrevBtn');
  if (prevBtn) prevBtn.disabled = state.runsOffset === 0;

  const nextBtn = document.getElementById('runsNextBtn');
  if (nextBtn) nextBtn.disabled = state.runsOffset + state.runsLimit >= total;
}

function handleRunsSearchInput() {
  const input = document.getElementById('runsSearchInput');
  if (!input) return;

  state.runsSearch = input.value;
  applyClientFilter();
  renderExplorerRuns();
}

function clearRunsSearch() {
  const input = document.getElementById('runsSearchInput');
  if (input) input.value = '';
  state.runsSearch = '';
  applyClientFilter();
  renderExplorerRuns();
}

function applyRunsFilter() {
  const winsCheck = document.getElementById('runsWinsOnly');
  state.runsWinsOnly = winsCheck ? winsCheck.checked : false;

  applyClientFilter();
  renderExplorerRuns();
}

function prevRunsPage() {
  if (state.runsOffset >= state.runsLimit) {
    state.runsOffset -= state.runsLimit;
    renderExplorerRuns();
  }
}

function nextRunsPage() {
  if (state.runsOffset + state.runsLimit < state.filteredGames.length) {
    state.runsOffset += state.runsLimit;
    renderExplorerRuns();
  }
}

// ======================== COMBO MATRIX ========================

async function loadMatrix() {
  try {
    const params = getFilterParams();
    const res = await fetch(`/api/matrix?${params.toString()}`);
    const data = await res.json();
    state.matrixData = data.matrix;

    renderMatrix();

    if (state.matrixData && state.matrixData.summary) {
      const sum = state.matrixData.summary;
      const combosWonEl = document.getElementById('statCombosWon');
      if (combosWonEl) combosWonEl.textContent = `${sum.combosWon} of 745`;

      const combosPlayedEl = document.getElementById('statCombosPlayed');
      if (combosPlayedEl) combosPlayedEl.textContent = sum.combosPlayed;
    }
  } catch (err) {
    console.error('Error loading matrix:', err);
  }
}

function renderMatrix() {
  const container = document.getElementById('matrixContainer');
  const metricSelect = document.getElementById('matrixMetricSelect');
  const metric = metricSelect ? metricSelect.value : 'games';
  state.matrixMetric = metric;

  if (!state.matrixData || !container) return;

  const { species, backgrounds, matrix, columnTotals, rowTotals } = state.matrixData;

  let html = '<table class="matrix-table"><thead><tr>';
  html += '<th class="species-col">Species</th>';
  html += '<th class="total-col" style="min-width: 44px; color: var(--page-heading);">Total</th>';

  backgrounds.forEach((bg) => {
    html += `<th data-bg="${bg.abbr}">${bg.abbr}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Column Totals Summary Row
  html += '<tr style="background-color: var(--surface-muted); font-weight: 700;">';
  html += '<td class="species-col" style="color: var(--page-heading);">Total</td>';
  html += `<td class="total-col" style="color: var(--page-heading);">${formatMetricValue(columnTotals?.all?.[metric] ?? 0, metric)}</td>`;
  backgrounds.forEach((bg) => {
    const colTot = columnTotals?.[bg.abbr]?.[metric] ?? 0;
    html += `<td data-bg-total="${bg.abbr}">${colTot > 0 ? formatMetricValue(colTot, metric) : '-'}</td>`;
  });
  html += '</tr>';

  // Species Rows
  species.forEach((sp) => {
    html += '<tr>';
    html += `<td class="species-col" data-species="${sp.abbr}">${sp.abbr}</td>`;

    const rowTot = rowTotals?.[sp.abbr]?.[metric] ?? 0;
    html += `<td class="total-col" data-species-total="${sp.abbr}" style="font-weight: 700;">${rowTot > 0 ? formatMetricValue(rowTot, metric) : '-'}</td>`;

    backgrounds.forEach((bg) => {
      const combo = `${sp.abbr}${bg.abbr}`;
      const cell = matrix[combo];
      const isUnavailable = UNAVAILABLE_COMBOS.has(combo);

      if (isUnavailable || (cell && !cell.isValid)) {
        html += `<td class="cell-unavailable" data-combo="${combo}">·</td>`;
      } else if (cell && cell.wins > 0) {
        const val = getCellValue(cell, metric);
        html += `<td class="cell-won" data-combo="${combo}">${val}</td>`;
      } else if (cell && cell.games > 0) {
        const val = getCellValue(cell, metric);
        html += `<td class="cell-played" data-combo="${combo}">${val}</td>`;
      } else {
        html += `<td class="cell-unplayed" data-combo="${combo}">·</td>`;
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
  initMatrixEvents();
}

function getCellValue(cell, metric) {
  if (metric === 'wins') return cell.wins;
  if (metric === 'winRate') return `${(cell.winRate * 100).toFixed(0)}%`;
  if (metric === 'maxXl') return cell.maxXl || '-';
  return cell.games;
}

function formatMetricValue(val, metric) {
  if (metric === 'winRate') return `${(Number(val) * 100).toFixed(0)}%`;
  return Number(val).toLocaleString();
}

// ======================== MATRIX HOVER & POPOVER ENGINE ========================

function initMatrixEvents() {
  const container = document.getElementById('matrixContainer');
  if (!container || container.dataset.eventsBound) return;
  container.dataset.eventsBound = 'true';

  let currentTargetEl = null;

  container.addEventListener('mouseover', (e) => {
    // 1. Combo Cell
    const cell = e.target.closest('td[data-combo]');
    if (cell) {
      if (cell === currentTargetEl) return;
      currentTargetEl = cell;
      showPopoverForCell(cell, cell.dataset.combo);
      return;
    }

    // 2. Background Column Header or Column Total
    const bgHeader = e.target.closest('th[data-bg], td[data-bg-total]');
    if (bgHeader) {
      if (bgHeader === currentTargetEl) return;
      currentTargetEl = bgHeader;
      const bgAbbr = bgHeader.dataset.bg || bgHeader.dataset.bgTotal;
      showPopoverForBackground(bgHeader, bgAbbr);
      return;
    }

    // 3. Species Row Header or Row Total
    const spHeader = e.target.closest('td[data-species], td[data-species-total]');
    if (spHeader) {
      if (spHeader === currentTargetEl) return;
      currentTargetEl = spHeader;
      const spAbbr = spHeader.dataset.species || spHeader.dataset.speciesTotal;
      showPopoverForSpecies(spHeader, spAbbr);
      return;
    }

    // 4. Over neutral elements, borders, or non-data headers: hide immediately
    currentTargetEl = null;
    hidePopover();
  });

  container.addEventListener('mouseleave', () => {
    currentTargetEl = null;
    hidePopover();
  });

  container.addEventListener('click', (e) => {
    const cell = e.target.closest('td[data-combo]');
    if (cell && (cell.classList.contains('cell-won') || cell.classList.contains('cell-played'))) {
      filterByCombo(cell.dataset.combo);
      return;
    }

    const bgHeader = e.target.closest('th[data-bg], td[data-bg-total]');
    if (bgHeader) {
      const bgAbbr = bgHeader.dataset.bg || bgHeader.dataset.bgTotal;
      filterByCombo(bgAbbr);
      return;
    }

    const spHeader = e.target.closest('td[data-species], td[data-species-total]');
    if (spHeader) {
      const spAbbr = spHeader.dataset.species || spHeader.dataset.speciesTotal;
      filterByCombo(spAbbr);
      return;
    }
  });
}

function positionPopover(targetEl) {
  const popover = document.getElementById('comboPopover');
  if (!popover || !targetEl || !targetEl.getBoundingClientRect) return;

  const popWidth = 310;
  const popHeight = 220;

  const rect = targetEl.getBoundingClientRect();
  let x = rect.right + 10;
  let y = rect.top - 6;

  if (x + popWidth > window.innerWidth - 12) {
    x = rect.left - popWidth - 10;
  }

  if (x < 12) x = 12;
  if (y + popHeight > window.innerHeight - 12) {
    y = Math.max(12, window.innerHeight - popHeight - 12);
  }
  if (y < 12) y = 12;

  popover.style.left = `${Math.round(x)}px`;
  popover.style.top = `${Math.round(y)}px`;
  popover.style.display = 'block';
}

function showPopoverForCell(td, combo) {
  const popover = document.getElementById('comboPopover');
  if (!popover || !combo || combo.length < 4) return;

  const spAbbr = combo.slice(0, 2);
  const bgAbbr = combo.slice(2, 4);
  const spObj = SPECIES_BY_ABBR[spAbbr.toLowerCase()] || { name: spAbbr };
  const bgObj = BG_BY_ABBR[bgAbbr.toLowerCase()] || { name: bgAbbr };
  const isForbidden = UNAVAILABLE_COMBOS.has(combo);

  // Retrieve cell data or default to 0 for unplayed combos
  const cell = (state.matrixData && state.matrixData.matrix && state.matrixData.matrix[combo]) || {
    combo,
    species: spAbbr,
    speciesName: spObj.name,
    background: bgAbbr,
    backgroundName: bgObj.name,
    games: 0,
    wins: 0,
    winRate: 0,
    maxXl: 0,
    maxScore: 0,
    maxRunes: 0,
    gods: {},
    isValid: !isForbidden,
  };

  const titleEl = document.getElementById('popoverTitle');
  if (titleEl) {
    titleEl.textContent = `${spObj.name} ${bgObj.name} (${combo})`;
  }

  const comboSection = document.getElementById('popoverComboSection');
  if (comboSection) comboSection.style.display = 'block';

  const headerSection = document.getElementById('popoverHeaderSection');
  if (headerSection) headerSection.style.display = 'none';

  const gamesEl = document.getElementById('popoverGames');
  if (gamesEl) gamesEl.textContent = cell.games || 0;

  const winsEl = document.getElementById('popoverWins');
  if (winsEl) winsEl.textContent = cell.wins || 0;

  const rateEl = document.getElementById('popoverRate');
  if (rateEl) rateEl.textContent = `${((cell.winRate || 0) * 100).toFixed(2)}%`;

  const xlEl = document.getElementById('popoverXl');
  if (xlEl) xlEl.textContent = cell.maxXl || '-';

  const scoreEl = document.getElementById('popoverScore');
  if (scoreEl) scoreEl.textContent = (cell.maxScore || 0).toLocaleString();

  const runesEl = document.getElementById('popoverRunes');
  if (runesEl) runesEl.textContent = cell.maxRunes || 0;

  // Deities Worshipped breakdown
  const godsContainer = document.getElementById('popoverGodsList');
  if (godsContainer) {
    if (spAbbr === 'Dg') {
      godsContainer.textContent = 'None (Demigods cannot worship deities)';
    } else if (cell.gods && Object.keys(cell.gods).length > 0) {
      const godList = Object.entries(cell.gods)
        .map(([god, data]) => `${god} (${data.games}G${data.wins > 0 ? `, ${data.wins}W` : ''})`)
        .join(', ');
      godsContainer.textContent = godList;
    } else {
      godsContainer.textContent = 'None';
    }
  }

  // God Restrictions
  const restrContainer = document.getElementById('popoverRestrictions');
  const restrText = document.getElementById('popoverRestrictionsText');
  const restriction = GOD_RESTRICTIONS[spAbbr];
  if (restrContainer && restrText) {
    if (restriction) {
      restrContainer.style.display = 'block';
      restrText.textContent = restriction;
    } else {
      restrContainer.style.display = 'none';
    }
  }

  positionPopover(td);
}

function showPopoverForBackground(el, bgAbbr) {
  const popover = document.getElementById('comboPopover');
  if (!popover || !bgAbbr) return;

  const bgObj = BG_BY_ABBR[bgAbbr.toLowerCase()] || { name: bgAbbr, category: 'Background' };
  const colTot = state.matrixData?.columnTotals?.[bgAbbr] || { games: 0, wins: 0, winRate: 0, combosPlayedCount: 0, combosWonCount: 0 };

  const titleEl = document.getElementById('popoverTitle');
  if (titleEl) {
    titleEl.textContent = `${bgObj.name} (${bgAbbr})`;
  }

  const comboSection = document.getElementById('popoverComboSection');
  if (comboSection) comboSection.style.display = 'none';

  const headerSection = document.getElementById('popoverHeaderSection');
  if (headerSection) headerSection.style.display = 'block';

  const labelEl = document.getElementById('popoverHeaderTypeLabel');
  if (labelEl) labelEl.textContent = 'Category';

  const catEl = document.getElementById('popoverHeaderCategory');
  if (catEl) catEl.textContent = bgObj.category || 'Background';

  const gamesEl = document.getElementById('popoverHeaderGames');
  if (gamesEl) gamesEl.textContent = colTot.games || 0;

  const winsEl = document.getElementById('popoverHeaderWins');
  if (winsEl) winsEl.textContent = colTot.wins || 0;

  const rateEl = document.getElementById('popoverHeaderRate');
  if (rateEl) rateEl.textContent = `${((colTot.winRate || 0) * 100).toFixed(2)}%`;

  const wonEl = document.getElementById('popoverHeaderWon');
  if (wonEl) wonEl.textContent = colTot.combosWonCount || 0;

  const playedEl = document.getElementById('popoverHeaderPlayed');
  if (playedEl) playedEl.textContent = colTot.combosPlayedCount || 0;

  const restrContainer = document.getElementById('popoverRestrictions');
  if (restrContainer) restrContainer.style.display = 'none';

  positionPopover(el);
}

function showPopoverForSpecies(el, spAbbr) {
  const popover = document.getElementById('comboPopover');
  if (!popover || !spAbbr) return;

  const spObj = SPECIES_BY_ABBR[spAbbr.toLowerCase()] || { name: spAbbr };
  const rowTot = state.matrixData?.rowTotals?.[spAbbr] || { games: 0, wins: 0, winRate: 0, combosPlayedCount: 0, combosWonCount: 0 };

  const titleEl = document.getElementById('popoverTitle');
  if (titleEl) {
    titleEl.textContent = `${spObj.name} (${spAbbr})`;
  }

  const comboSection = document.getElementById('popoverComboSection');
  if (comboSection) comboSection.style.display = 'none';

  const headerSection = document.getElementById('popoverHeaderSection');
  if (headerSection) headerSection.style.display = 'block';

  const labelEl = document.getElementById('popoverHeaderTypeLabel');
  if (labelEl) labelEl.textContent = 'Type';

  const catEl = document.getElementById('popoverHeaderCategory');
  if (catEl) catEl.textContent = spObj.trunk ? 'Species' : 'Legacy Species';

  const gamesEl = document.getElementById('popoverHeaderGames');
  if (gamesEl) gamesEl.textContent = rowTot.games || 0;

  const winsEl = document.getElementById('popoverHeaderWins');
  if (winsEl) winsEl.textContent = rowTot.wins || 0;

  const rateEl = document.getElementById('popoverHeaderRate');
  if (rateEl) rateEl.textContent = `${((rowTot.winRate || 0) * 100).toFixed(2)}%`;

  const wonEl = document.getElementById('popoverHeaderWon');
  if (wonEl) wonEl.textContent = rowTot.combosWonCount || 0;

  const playedEl = document.getElementById('popoverHeaderPlayed');
  if (playedEl) playedEl.textContent = rowTot.combosPlayedCount || 0;

  // God Restrictions for species
  const restrContainer = document.getElementById('popoverRestrictions');
  const restrText = document.getElementById('popoverRestrictionsText');
  const restriction = GOD_RESTRICTIONS[spAbbr];
  if (restrContainer && restrText) {
    if (restriction) {
      restrContainer.style.display = 'block';
      restrText.textContent = restriction;
    } else {
      restrContainer.style.display = 'none';
    }
  }

  positionPopover(el);
}

function showPopover(event, combo) {
  const td = event?.currentTarget || event?.target;
  showPopoverForCell(td, combo);
}

function hidePopover() {
  const popover = document.getElementById('comboPopover');
  if (popover) {
    popover.style.display = 'none';
  }
}

function filterByCombo(combo) {
  hidePopover();
  switchTab('runs');
  const searchInput = document.getElementById('runsSearchInput');
  if (searchInput) {
    searchInput.value = combo;
    handleRunsSearchInput();
  }
}

// ======================== COMBO ROLLER ========================

async function loadSuggest() {
  try {
    const res = await fetch('/api/suggest');
    const { suggestions } = await res.json();
    if (!suggestions) return;

    state.unwonCombos = suggestions.unwonCombos || [];
    state.unplayedCombos = suggestions.unplayedCombos || [];
    state.topRecommendations = suggestions.topRecommendations || [];
    state.recommendedCombos = suggestions.recommendedCombos || [];
  } catch (err) {
    console.error('Error loading suggestions:', err);
  }
}

// 4-Button Clean Combo Roller
function rollCombo(mode = 'any') {
  state.lastRolledMode = mode;
  let pool = [];

  if (mode === 'recommended') {
    if (state.recommendedCombos && state.recommendedCombos.length > 0) {
      pool = state.recommendedCombos.map(combo => {
        const spAbbr = combo.slice(0, 2);
        const bgAbbr = combo.slice(2, 4);
        const sp = SPECIES_BY_ABBR[spAbbr.toLowerCase()];
        const bg = BG_BY_ABBR[bgAbbr.toLowerCase()];
        return {
          combo,
          species: sp ? sp.name : spAbbr,
          background: bg ? bg.name : bgAbbr,
          mode: 'Recommended',
          badge: 'Official Recommended',
          note: 'Official in-game character creation recommendation',
        };
      });
    } else {
      pool = DCSS_RECOMMENDED_COMBOS.map(r => ({
        combo: r.combo,
        species: r.species,
        background: r.background,
        mode: 'Recommended',
        badge: 'Official Recommended',
        note: r.note,
      }));
    }
  } else if (mode === 'unwon') {
    pool = state.unwonCombos.map(u => ({
      combo: u.combo,
      species: u.species,
      background: u.background,
      mode: 'Unwon',
      badge: 'Unwon Finish',
      games: u.games,
      maxXl: u.maxXl,
      maxScore: u.maxScore,
    }));
  } else if (mode === 'unplayed') {
    pool = state.unplayedCombos.map(u => ({
      combo: u.combo,
      species: u.species,
      background: u.background,
      mode: 'Unplayed',
      badge: 'Unplayed',
      category: u.category,
    }));
  } else {
    // 'any' mode: all valid combinations
    const trunkSpecies = DCSS_SPECIES.filter(s => s.trunk);
    const trunkBgs = DCSS_BACKGROUNDS.filter(b => b.trunk);
    const allValid = [];
    trunkSpecies.forEach(sp => {
      trunkBgs.forEach(bg => {
        const c = `${sp.abbr}${bg.abbr}`;
        if (!UNAVAILABLE_COMBOS.has(c)) {
          allValid.push({
            combo: c,
            species: sp.name,
            background: bg.name,
            mode: 'Any',
            badge: 'Random Roll',
            category: bg.category,
          });
        }
      });
    });
    pool = allValid;
  }

  const display = document.getElementById('rollDisplay');
  if (!display) return;

  if (!pool || pool.length === 0) {
    display.innerHTML = `<div class="roll-placeholder">No combinations found for mode '${mode}'.</div>`;
    return;
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];

  // Look up player history for this combo if available
  const matrixCell = state.matrixData && state.matrixData.matrix && state.matrixData.matrix[picked.combo];
  let statsText = '';

  if (mode === 'recommended') {
    statsText = `Official DCSS In-Game Recommendation · ${picked.note || 'High-synergy starter combination'}`;
  } else if (mode === 'unwon') {
    statsText = `Played ${picked.games} game${picked.games > 1 ? 's' : ''} · Max XL ${picked.maxXl} · Best Score: ${(picked.maxScore || 0).toLocaleString()}`;
  } else if (mode === 'unplayed') {
    statsText = `Never played · Category: ${picked.category || 'Adventurers'}`;
  } else {
    if (matrixCell && matrixCell.games > 0) {
      statsText = `Played ${matrixCell.games} game${matrixCell.games > 1 ? 's' : ''} · ${matrixCell.wins} wins (${(matrixCell.winRate * 100).toFixed(0)}% WR) · Max XL ${matrixCell.maxXl || 1}`;
    } else {
      statsText = `Unplayed combination · Category: ${picked.category || 'Adventurers'}`;
    }
  }

  display.innerHTML = `
    <div class="roll-result">
      <div class="roll-result-top">
        <div class="roll-result-title">
          <span class="roll-combo-name">${escapeHtml(picked.species)} ${escapeHtml(picked.background)}</span>
          <span class="roll-combo-code">(${escapeHtml(picked.combo)})</span>
        </div>
        <span class="badge-tag">${escapeHtml(picked.badge)}</span>
      </div>
      <div class="roll-result-stats">${escapeHtml(statsText)}</div>
      <div class="roll-result-actions">
        <button class="btn" style="font-size: 0.75rem;" onclick="filterByCombo('${escapeHtml(picked.combo)}')">
          View Runs in Explorer →
        </button>
      </div>
    </div>
  `;
}

// ======================== MORGUE VIEWER MODAL ========================

async function viewMorgue(filename) {
  const modal = document.getElementById('morgueModal');
  const title = document.getElementById('morgueModalTitle');
  const body = document.getElementById('morgueModalBody');

  if (!modal || !title || !body) return;

  title.textContent = filename.startsWith('morgue-') ? `Morgue — ${filename}` : `Live Character Dump — ${filename}`;
  body.textContent = 'Loading file from disk...';
  modal.style.display = 'flex';

  try {
    const res = await fetch(`/api/morgue/${encodeURIComponent(filename)}`);
    const data = await res.json();
    if (data.success && data.content) {
      body.textContent = data.content;
    } else {
      body.textContent = `Error: ${data.error || 'Could not load morgue file.'}`;
    }
  } catch (err) {
    body.textContent = `Network error loading morgue file: ${err.message}`;
  }
}

function closeMorgueModal(e) {
  if (e && e.target && e.target.classList.contains('modal-content')) return;
  const modal = document.getElementById('morgueModal');
  if (modal) modal.style.display = 'none';
}

// ======================== GLOBAL FILTERS ========================

function setDateRange(range) {
  state.dateRange = range;
  state.customFrom = null;
  state.customTo = null;

  document.querySelectorAll('.date-preset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === range);
  });

  const customInputs = document.getElementById('customDateInputs');
  if (customInputs) customInputs.style.display = 'none';

  loadAllData();
}

function showCustomDates() {
  state.dateRange = 'custom';
  document.querySelectorAll('.date-preset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.range === 'custom');
  });

  const customInputs = document.getElementById('customDateInputs');
  if (customInputs) customInputs.style.display = 'flex';
}

function applyCustomDates() {
  const from = document.getElementById('dateFrom')?.value;
  const to = document.getElementById('dateTo')?.value;
  state.customFrom = from || null;
  state.customTo = to || null;

  loadAllData();
}

function handleVersionChange() {
  const select = document.getElementById('versionSelect');
  if (select) {
    state.version = select.value;
    loadAllData();
  }
}

async function triggerSync() {
  const btnText = document.getElementById('syncBtnText');
  if (btnText) btnText.textContent = 'Syncing...';

  try {
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
    const data = await res.json();
    if (data.success) {
      await loadAllData();
    }
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    if (btnText) btnText.textContent = 'Sync';
  }
}

// ======================== UTILITIES ========================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pathBasename(filepath) {
  if (!filepath) return '';
  const parts = filepath.split(/[\/\\]/);
  return parts[parts.length - 1];
}
