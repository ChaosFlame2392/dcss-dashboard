/**
 * DCSS Reference Data & Constants
 * Contains official Species, Backgrounds, Gods, and Combo rules for DCSS 0.34 & 0.35 Trunk.
 */

// Species / Races (Abbr -> Full name & trunk validity)
const SPECIES = [
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

  // Retired / Legacy species
  { abbr: 'At', name: 'Armataur', trunk: false, legacy: true },
  { abbr: 'Gh', name: 'Ghoul', trunk: false, legacy: true },
  { abbr: 'Vp', name: 'Vampire', trunk: false, legacy: true },
  { abbr: 'HO', name: 'Hill Orc', trunk: false, legacy: true },
  { abbr: 'Og', name: 'Ogre', trunk: false, legacy: true },
  { abbr: 'Me', name: 'Meteoran', trunk: false, legacy: true },
  { abbr: 'Pa', name: 'Palentonga', trunk: false, legacy: true },
  { abbr: 'My', name: 'Mayflytaur', trunk: false, legacy: true },
  { abbr: 'DD', name: 'Deep Dwarf', trunk: false, legacy: true },
  { abbr: 'HE', name: 'High Elf', trunk: false, legacy: true },
  { abbr: 'Ce', name: 'Centaur', trunk: false, legacy: true },
  { abbr: 'Ha', name: 'Halfling', trunk: false, legacy: true },
  { abbr: 'SE', name: 'Sludge Elf', trunk: false, legacy: true },
  { abbr: 'OM', name: 'Ogre-Mage', trunk: false, legacy: true },
  { abbr: 'LO', name: 'Lava Orc', trunk: false, legacy: true },
  { abbr: 'Bu', name: 'Bultungin', trunk: false, legacy: true },
  { abbr: 'GE', name: 'Grey Elf', trunk: false, legacy: true },
  { abbr: 'HD', name: 'Hill Dwarf', trunk: false, legacy: true },
  { abbr: 'El', name: 'Elf', trunk: false, legacy: true },
  { abbr: 'Gm', name: 'Gnome', trunk: false, legacy: true },
];

// Sub-races that map to a base species
const DRACONIAN_SUBRACES = new Set([
  'Red Draconian', 'White Draconian', 'Green Draconian', 'Yellow Draconian',
  'Grey Draconian', 'Black Draconian', 'Purple Draconian', 'Mottled Draconian', 'Pale Draconian'
]);

// Backgrounds / Classes
const BACKGROUNDS = [
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
  { abbr: 'Tm', name: 'Transmuter', category: 'Adventurers', trunk: false, legacy: true },
  { abbr: 'He', name: 'Healer', category: 'Zealots', trunk: false, legacy: true },
  { abbr: 'Sk', name: 'Skald', category: 'Warriors', trunk: false, legacy: true },
  { abbr: 'DK', name: 'Death Knight', category: 'Zealots', trunk: false, legacy: true },
  { abbr: 'Pr', name: 'Priest', category: 'Zealots', trunk: false, legacy: true },
  { abbr: 'Cr', name: 'Crusader', category: 'Warriors', trunk: false, legacy: true },
  { abbr: 'Pa', name: 'Paladin', category: 'Zealots', trunk: false, legacy: true },
  { abbr: 'Th', name: 'Thief', category: 'Warriors', trunk: false, legacy: true },
  { abbr: 'Jr', name: 'Jester', category: 'Adventurers', trunk: false, legacy: true },
  { abbr: 'AK', name: 'Abyssal Knight', category: 'Zealots', trunk: false, legacy: true },
  { abbr: 'VM', name: 'Venom Mage', category: 'Mages', trunk: false, legacy: true },
];

// All valid DCSS Gods
const GODS = [
  'Ashenzari',
  'Beogh',
  'Cheibriados',
  'Dithmenos',
  'Elyvilon',
  'Fedhas',
  'Gozag',
  'Hepliaklqana',
  'Ignis',
  'Jiyva',
  'Kikubaaqudgha',
  'Lugonu',
  'Makhleb',
  'Nemelex Xobeh',
  'Okawaru',
  'Qazlal',
  'Ru',
  'Sif Muna',
  'The Shining One',
  'Trog',
  'Uskayaw',
  'Vehumet',
  'Wu Jian',
  'Xom',
  'Yredelemnul',
  'Zin',
];

// DCSS God Restrictions (crawl-ref/source/religion.cc lines 3342-3350)
const GOOD_GODS = new Set([
  'The Shining One',
  'Zin',
  'Elyvilon',
]);

const DJINNI_RESTRICTED_GODS = new Set([
  'Sif Muna',
  'Vehumet',
  'Kikubaaqudgha',
]);

const UNDEAD_OR_DEMONIC_SPECIES = new Set([
  'Mu', // Mummy
  'Gh', // Ghoul
  'Vp', // Vampire
  'Ds', // Demonspawn
]);

/**
 * Checks if a god refuses worship from a species (religion.cc:3342-3350)
 * - Demigod ('Dg'): strict atheism (MUT_FORLORN) - cannot worship ANY god
 * - Djinni ('Dj'): MUT_INNATE_CASTER - refused by Sif Muna, Vehumet, Kikubaaqudgha
 * - Undead ('Mu', 'Gh', 'Vp') & Demonspawn ('Ds'): refused by Good Gods (TSO, Zin, Elyvilon)
 * @param {string} speciesAbbr - Two-letter species abbreviation
 * @param {string} godName - God name
 * @returns {boolean}
 */
function isGodRestricted(speciesAbbr, godName) {
  if (!speciesAbbr || !godName) return false;
  const cleanGod = godName.trim().toLowerCase();
  const cleanSp = speciesAbbr.trim();

  // 1. Demigods (MUT_FORLORN): strict atheism
  if (cleanSp === 'Dg') {
    return true;
  }

  // 2. Djinni (MUT_INNATE_CASTER): Refused by spell/mana gods
  if (cleanSp === 'Dj') {
    for (const g of DJINNI_RESTRICTED_GODS) {
      if (cleanGod === g.toLowerCase()) return true;
    }
  }

  // 3. Undead & Demonic: Refused by Good Gods
  if (UNDEAD_OR_DEMONIC_SPECIES.has(cleanSp)) {
    for (const g of GOOD_GODS) {
      if (cleanGod === g.toLowerCase()) return true;
    }
  }

  return false;
}

// Official in-game recommended combos from crawl-ref/source/species-data.h & job-data.h (191 combos)
const RECOMMENDED_COMBOS = new Set([
  'HuBe', 'HuCA', 'HuCj', 'HuNe', 'HuIE', 'HuMy',
  'DEHW', 'DECj', 'DESu', 'DEFw', 'DENe', 'DEFE', 'DEIE', 'DEAE', 'DEEE', 'DEAl', 'DEMy',
  'KoBr', 'KoBe', 'KoHs', 'KoEn', 'KoCj', 'KoEE', 'KoSt',
  'MuCA', 'MuHW', 'MuCj', 'MuNe', 'MuIE', 'MuSu',
  'NaBe', 'NaSh', 'NaEn', 'NaFE', 'NaIE', 'NaWr', 'NaHW', 'NaAl',
  'OnGl', 'OnBe', 'OnCA', 'OnHW', 'OnAE', 'OnFE', 'OnMy',
  'TrFi', 'TrGl', 'TrBe', 'TrWr', 'TrSt', 'TrEE', 'TrHW',
  'DrBe', 'DrSh', 'DrMy', 'DrCj', 'DrFE', 'DrIE', 'DrAE', 'DrEE', 'DrAl',
  'DgSh', 'DgCj', 'DgFE', 'DgIE', 'DgAE', 'DgEE',
  'SpBr', 'SpAr', 'SpWr', 'SpEn', 'SpEE', 'SpAl', 'SpMy', 'SpSt',
  'MiFi', 'MiGl', 'MiMo', 'MiHu', 'MiBe',
  'DsGl', 'DsBe', 'DsHW', 'DsNe', 'DsFE', 'DsIE', 'DsAl',
  'TeBe', 'TeRe', 'TeHW', 'TeCj', 'TeSu', 'TeFE', 'TeAE', 'TeMy',
  'MfGl', 'MfBe', 'MfSh', 'MfSt', 'MfSu', 'MfIE', 'MfAl',
  'FeBe', 'FeEn', 'FeSh', 'FeIE', 'FeAE', 'FeCj', 'FeSu',
  'OpSh', 'OpHW', 'OpCj', 'OpBr', 'OpSt', 'OpFE', 'OpEE', 'OpAl',
  'DjCj', 'DjWr', 'DjHW', 'DjFE', 'DjIE', 'DjAE',
  'GrFi', 'GrGl', 'GrMo', 'GrBe', 'GrFE', 'GrEE', 'GrRe',
  'FoFi', 'FoHu', 'FoHs', 'FoEE', 'FoAl', 'FoFw',
  'VSFi', 'VSBr', 'VSBe', 'VSEn', 'VSCj', 'VSNe', 'VSIE',
  'BaFi', 'BaBe', 'BaWr', 'BaHs', 'BaSu', 'BaIE', 'BaRe', 'BaFw',
  'GnCA', 'GnRe', 'GnWr', 'GnHs', 'GnSh', 'GnWn', 'GnFw',
  'MDFi', 'MDMo', 'MDBe', 'MDCA', 'MDRe', 'MDFE', 'MDFw',
  'CoAr', 'CoHu', 'CoGl', 'CoWr', 'CoBe', 'CoAl', 'CoFw',
  'PoCK', 'PoEn', 'PoHs', 'PoNe', 'PoEE', 'PoIE', 'PoAl',
  'ReGl', 'ReMo', 'ReNe', 'ReIE', 'ReEE',
  'GCGl', 'GCBr', 'GCSt', 'GCHu', 'GCCj', 'GCAE', 'GCFE',
]);

// Combinations forbidden by Crawl rules
const UNAVAILABLE_COMBOS = new Set([
  'GhTm',
  'MuTm',
  'GhSh',
  'MuSh',
  'DgMo',
  'DgCK',
  'DgCA',
  'DgBe',
  'DgAK',
  'FeHu',
  'FeGl',
  'FeBr',
  'FeHs',
  'PoSh',
  'ReSh',
]);

// Standard dungeon branches mapping
const BRANCHES = {
  'D': 'Dungeon',
  'Lair': 'Lair of Beasts',
  'Orc': 'Orcish Mines',
  'Elf': 'Elven Halls',
  'Vaults': 'Vaults',
  'Crypt': 'Crypt',
  'Tomb': 'Tomb of the Ancients',
  'Snake': 'Snake Pit',
  'Shoals': 'Shoals',
  'Swamp': 'Swamp',
  'Spider': 'Spider Nest',
  'Slime': 'Slime Pits',
  'Depths': 'Depths',
  'Zot': 'Realm of Zot',
  'Abyss': 'Abyss',
  'Pan': 'Pandemonium',
  'Hell': 'Hell',
  'Dis': 'Iron City of Dis',
  'Geh': 'Gehenna',
  'Coc': 'Cocytus',
  'Tar': 'Tartarus',
  'Temple': 'Ecumenical Temple',
  'Bailey': 'Bailey',
  'Gauntlet': 'Gauntlet',
  'Ossuary': 'Ossuary',
  'IceCave': 'Ice Cave',
  'Volcano': 'Volcano',
  'Sewer': 'Sewer',
  'Zig': 'Ziggurat',
  'Bazaar': 'Bazaar',
  'WizLab': 'Wizard Laboratory',
  'Desolation': 'Desolation of Salt',
};

// Maps for fast O(1) lookups
const SPECIES_BY_ABBR = new Map(SPECIES.map(s => [s.abbr, s]));
const SPECIES_BY_NAME = new Map(SPECIES.map(s => [s.name.toLowerCase(), s]));
const BACKGROUNDS_BY_ABBR = new Map(BACKGROUNDS.map(b => [b.abbr, b]));
const BACKGROUNDS_BY_NAME = new Map(BACKGROUNDS.map(b => [b.name.toLowerCase(), b]));

function resolveSpecies(raceName, charAbbr) {
  if (charAbbr && charAbbr.length >= 2) {
    const spAbbr = charAbbr.slice(0, 2);
    const sp = SPECIES_BY_ABBR.get(spAbbr);
    if (sp) return sp;
  }
  if (raceName) {
    if (DRACONIAN_SUBRACES.has(raceName)) {
      return SPECIES_BY_ABBR.get('Dr');
    }
    const sp = SPECIES_BY_NAME.get(raceName.toLowerCase());
    if (sp) return sp;
  }
  return { abbr: charAbbr?.slice(0, 2) || '??', name: raceName || 'Unknown', trunk: false };
}

function resolveBackground(clsName, charAbbr) {
  if (charAbbr) {
    if (charAbbr.length === 2 && BACKGROUNDS_BY_ABBR.has(charAbbr)) {
      return BACKGROUNDS_BY_ABBR.get(charAbbr);
    }
    if (charAbbr.length >= 4) {
      const bgAbbr = charAbbr.slice(2, 4);
      const bg = BACKGROUNDS_BY_ABBR.get(bgAbbr);
      if (bg) return bg;
    }
  }
  if (clsName) {
    const bg = BACKGROUNDS_BY_NAME.get(clsName.toLowerCase());
    if (bg) return bg;
  }
  return { abbr: charAbbr?.slice(2, 4) || charAbbr || '??', name: clsName || 'Unknown', category: 'Adventurers', trunk: false };
}

function isValidCombo(combo) {
  if (!combo || combo.length !== 4) return false;
  if (UNAVAILABLE_COMBOS.has(combo)) return false;
  const sp = combo.slice(0, 2);
  const bg = combo.slice(2, 4);
  const spObj = SPECIES_BY_ABBR.get(sp);
  const bgObj = BACKGROUNDS_BY_ABBR.get(bg);
  return Boolean(spObj?.trunk && bgObj?.trunk);
}

/**
 * Format duration in seconds to human readable HH:MM:SS or string
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

/**
 * Parses raw DCSS date string (YYYYMMDDHHMMSS[S/D]) where month is 0-indexed.
 * Returns ISO string (e.g. "2026-10-17T13:39:07.000Z")
 */
function parseRawDate(rawStr) {
  if (!rawStr) return null;
  const digits = rawStr.replace(/[^0-9]/g, '');
  if (digits.length < 14) return null;

  const year = parseInt(digits.slice(0, 4), 10);
  const monthIndex = parseInt(digits.slice(4, 6), 10); // 0-indexed in DCSS!
  const day = parseInt(digits.slice(6, 8), 10);
  const hour = parseInt(digits.slice(8, 10), 10);
  const min = parseInt(digits.slice(10, 12), 10);
  const sec = parseInt(digits.slice(12, 14), 10);

  const date = new Date(Date.UTC(year, monthIndex, day, hour, min, sec));
  return date.toISOString();
}

/**
 * Resolves a full text combination (e.g. "Oni Hedge Wizard", "Mountain Dwarf Berserker")
 * correctly handling multi-word species and multi-word backgrounds.
 */
function resolveComboFromText(text) {
  if (!text) return null;
  const clean = text.trim();
  const sortedSpecies = [...SPECIES].sort((a, b) => b.name.length - a.name.length);
  for (const sp of sortedSpecies) {
    if (clean.toLowerCase().startsWith(sp.name.toLowerCase())) {
      const rest = clean.slice(sp.name.length).trim();
      const bg = resolveBackground(rest);
      return {
        species: sp,
        background: bg,
        combo: `${sp.abbr}${bg.abbr}`,
        charName: `${sp.name} ${bg.name}`,
      };
    }
  }
  return null;
}

/**
 * Rolls a random combo from the official in-game RECOMMENDED_COMBOS set
 */
function rollRecommendedCombo() {
  const combos = Array.from(RECOMMENDED_COMBOS);
  const picked = combos[Math.floor(Math.random() * combos.length)];
  const spAbbr = picked.slice(0, 2);
  const bgAbbr = picked.slice(2, 4);
  const sp = resolveSpecies('', spAbbr);
  const bg = resolveBackground('', bgAbbr);
  return {
    combo: picked,
    species: sp.name,
    speciesAbbr: sp.abbr,
    background: bg.name,
    backgroundAbbr: bg.abbr,
    name: `${sp.name} ${bg.name}`,
    reason: 'Official in-game recommended combo for character creation',
  };
}

module.exports = {
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
  BRANCHES,
  DRACONIAN_SUBRACES,
  SPECIES_BY_ABBR,
  BACKGROUNDS_BY_ABBR,
  resolveSpecies,
  resolveBackground,
  resolveComboFromText,
  isValidCombo,
  formatDuration,
  parseRawDate,
};

