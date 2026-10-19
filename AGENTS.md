# DCSS Stats Dashboard — Master Operations Manual & Architecture Reference (AGENTS.md)

> **Document Status:** Verified & Synchronized with Active Codebase  
> **Target Audience:** Future AI Agents (Antigravity/Gemini/Claude), Developers, and Maintainers.  
> **Repository:** `dcss-dashboard` (Local DCSS Stats & Run Recommender)  

---

## 1. Project Overview & Design Philosophy

`dcss-dashboard` is an ultra-fast, local, single-page web dashboard and run recommender for **Dungeon Crawl Stone Soup (DCSS)**. It combines the deep analytics of `dcss-stats.com` with the beloved retro terminal vibe of the game and Sequell IRC bots (`!roll`).

### Core Tenets
1. **Zero External Runtime Heavyweight Dependencies:** Uses Node.js native `node:sqlite` (built into Node.js 22.5+) and minimal Express 5. No C++ compilers, `node-gyp`, or heavy frontend build pipelines required.
2. **Zero-Lag Responsiveness (0ms In-Memory Client Search):** The frontend fetches runs into memory on load. Filtering, searching, sorting, and tab-switching happen instantaneously in single-frame DOM updates without round-trip network lag.
3. **Strict Read-Only Data Safety & Zero Save Access:** Under no circumstances does the application open, read, stat, write to, modify, or lock DCSS save files (`.cs`). Binary save files are strictly ignored and never accessed. Completed logs (`logfile*`) and morgue character dumps (`morgue/*.txt`) are read strictly in read-only mode.
4. **Permanent Crawl Retro Aesthetic:** Monospace terminal font stack with authentic Crawl terminal colors (`#040204` black, `#fce94f` gold, `#8ae234` green, `#34e2e2` cyan, `#fd59fa` magenta).
5. **Cross-Platform Compatibility:** Native out-of-the-box support for macOS (`~/Library/Application Support/...`) and Linux (`~/.crawl`, `~/.local/share/crawl`, Flatpak, XDG), plus manual directory override via `DCSS_DIR`.

---

## 2. Repository Layout

```
dcss-dashboard/
├── .gitignore               # Ignores databases, node_modules, OS artifacts
├── AGENTS.md                # THIS FILE — Master agent reference and version update guide
├── package.json             # Minimal dependencies (express ^5.3.0), native node test runner
├── run.sh                   # Standalone cross-platform launcher (starts server + opens browser)
├── src/
│   ├── server.js            # Express server (REST endpoints, dynamic morgue resolver, graceful shutdown)
│   └── db/
│       ├── index.js         # Unified database client factory and singleton access
│       ├── schema.js        # SQLite schema, WAL mode, pragmas, and indexes
│       ├── constants.js     # DCSS 0.34/0.35 species, backgrounds, gods, and combination rules
│       ├── logfileParser.js # Deterministic xlogfile parser with SHA-1 ID generation
│       ├── morgueParser.js  # Parser for active character dumps and completed morgues
│       ├── sync.js          # Incremental sync engine with cross-platform auto-discovery
│       └── api.js           # Analytics engine: getStats, getComboMatrix, getGames, getSuggestions
├── public/
│   ├── index.html           # SPA structure with dynamic version filter and IRC bot console
│   ├── style.css            # Permanent Crawl retro terminal theme, fixed popovers, IRC box
│   └── app.js               # Client controller with 0ms in-memory cache and 2-axis popover math
└── tests/
    └── regression.test.js   # Native Node test suite verifying parsers, combos, and sync engine
```

---

## 3. Data Safety & DCSS File System Protocols

The application monitors two DCSS data sources:
1. **`logfile*` (xlog files):** Colon-delimited key-value event logs generated upon character deaths or wins (typically residing in the `saves/` folder on standard installs or directly in the crawl directory). The sync engine validates boundary newlines before ingestion to prevent reading partially written lines during an active crawl session. Read strictly in read-only mode.
2. **`morgue/*.txt`:** Full game summaries and active character dumps. Read strictly with `fs.readFileSync(..., 'utf8')`.
   - **Finished Morgues (`morgue-*.txt`):** Game summary dumps generated upon character deaths or wins.
   - **Active Character Dumps (`<CharacterName>.txt`):** Ongoing runs are discovered **SOLELY** from character dump files emitted by Crawl into `morgue/`. Stale dump detection compares timestamps against finished morgue dumps without touching save files.

> [!IMPORTANT]
> **Zero Save Access Protocol (`.cs`):** Under no circumstances does the application open, read, stat, scan, or access DCSS save files (`.cs`). Binary save files are strictly untouched and completely ignored by the sync engine. Ongoing games are detected purely via text character dumps in `morgue/`.

### Directory Discovery Sequence (`src/db/sync.js`)
Candidate directories are checked in the following precedence order:
1. **Environment Variables:** `DCSS_DIR` or `DCSS_DIRS` (comma/colon delimited paths).
2. **macOS Paths:**
   - `~/Library/Application Support/Dungeon Crawl Stone Soup/Stable`
   - `~/Library/Application Support/Dungeon Crawl Stone Soup/Trunk`
   - `~/Library/Application Support/Dungeon Crawl Stone Soup`
3. **Linux Standard & Package Paths:**
   - `~/.crawl` (standard Debian/Ubuntu package layout)
   - `~/.local/share/crawl` / `~/.local/share/dcss` (XDG data home)
   - `~/.var/app/org.develz.Crawl/data/crawl` (Flatpak)
   - `/var/games/crawl` / `/usr/share/games/crawl` (system multi-user installs)

Both **hierarchical** (`dcssDir/saves`, `dcssDir/morgue`) and **flat** (where logs and morgues are in the same folder) structures are supported automatically via `locateArtifactDirs()`.

---

## 4. API Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | `GET` | Player summary metrics: total games, wins, win rate, score stats (best, avg, median, total), total playtime, average duration, fastest win, turn stats, runes breakdown. Accepts `?dateRange=`, `?from=`, `?to=`, `?version=`. |
| `/api/matrix` | `GET` | Species × Background matrix (games, wins, win rates, max XL, deities worshipped) plus row/column totals. |
| `/api/games` | `GET` | Paginated list of games. Accepts `?limit=`, `?offset=`, `?sort=`, `?order=`, `?version=`, `?is_win=`, `?q=`. |
| `/api/active` | `GET` | Current active run status (character level, HP/MP, AC/EV/SH, god piety, turns, duration, turn speed). |
| `/api/suggest` | `GET` | Recommender engine: top picks, unwon combos (sorted by highest XL), unplayed high-synergy combos, and milestone progress. |
| `/api/versions` | `GET` | Returns distinct versions and source folders detected in database. |
| `/api/config` | `GET` | Returns detected DCSS directories, platform, and architecture. |
| `/api/morgue/:filename` | `GET` | Dynamically locates and returns raw text content of a morgue file across all monitored DCSS folders. |
| `/api/sync` | `POST` | Triggers an immediate incremental synchronization. |

---

## 5. Protocol for Updating to Future DCSS Versions

When a new DCSS version drops (e.g., 0.36, 0.37, or a major Trunk overhaul), follow this concise checklist:

1. **Verify New Species & Backgrounds in `src/db/constants.js`:**
   - Update `SPECIES` array: add newly introduced species or flag retired species (`trunk: false`).
   - Update `BACKGROUNDS` array: add newly introduced backgrounds or update categories.
   - Update `GODS` list if a new deity is added.
2. **Update Forbidden / Impossible Combinations:**
   - Check `UNAVAILABLE_COMBOS` set in `src/db/constants.js`. (e.g., Demigod zealots, species unable to use magic or certain weapon classes).
3. **Verify Parser Grammar in `src/db/morgueParser.js`:**
   - If Crawl changes its morgue header formatting, verify `parseFinishedMorgue` and `parseActiveDump` against a fresh morgue dump.
4. **Run the Automated Regression Suite:**
   ```bash
   npm test
   ```
   Ensure all 10+ regression tests pass cleanly.

---

## 6. Developer Commands

```bash
# Install dependencies
npm install

# Run automated test suite (zero external test runner)
npm test

# Start the dashboard server
npm start

# Run standalone launcher (starts server + opens browser)
./run.sh

# Run with custom DCSS morgue directory
DCSS_DIR="/custom/path/to/crawl" npm start
```

---

## 7. Diagnostic & Debug Logging

Debug logging is **OFF by default** to keep production and regular play completely silent and zero-overhead. It is intentionally **not** exposed in the web UI.

To activate debug logging for troubleshooting directory discovery, sync ingestion, or HTTP requests:
1. Open `config.json` in any text editor.
2. Change `"debug": false` to `"debug": true`.
3. Save the file. Detailed discovery traces, active run ingestion, and HTTP response timings will be logged to the console.

---

## 8. Backlog & Architectural Considerations

### 8.1 Early Splat / Short Run Filter (`runsMinTurns`)
- **Context & Motivation:** DCSS players frequently experience rapid D:1 deaths (< 500 turns or < 1 minute) when experimenting with combos, testing keybindings, or hitting bad early RNG. These runs can skew speed/duration metrics and add noise to Run Explorer.
- **Decision & Current State:** An "Exclude D:1 splats (< 500 turns)" toggle was prototyped and tested, but intentionally removed from the production UI to keep the interface clean, fast, and unopinionated (avoiding hardcoded magic numbers like 500 turns).
- **Future Blueprint:** If re-introduced, do not hardcode a specific "D:1" checkbox. Instead, consider:
  1. A generalized turn-count or duration filter dropdown/slider (e.g. `Min Turns: All / >500 / >2000`).
  2. An optional advanced filter drawer that allows filtering by minimum XL (e.g. `XL >= 3`).
  3. Client-side filter implementation in `applyClientFilter()`: `if (minTurns && (Number(run.turns) || 0) < minTurns) return false;`.

### 8.2 Multi-Column Sorting Engine
- **UX Design:** Run Explorer supports multi-column sorting via `Shift+Click` (or `Ctrl/Cmd+Click`) on table headers.
- **Priority Indicators:** Superscripts (`¹`, `²`, `³`) indicate sort priority directly next to sort arrows `▲`/`▼`.
- **Sort Pills Bar:** An active sort breadcrumb bar displays currently applied sort criteria with individual remove buttons and a "Reset Sort" button.
- **Tie-Breaking:** Sorting falls back to `end_time DESC` so identical values have deterministic order.

### 8.3 Zero-Lag UI Performance & Memory Architecture
- **Compositor-Level Tab Switching (0ms Delay):** Rather than destroying and reconstructing the layout tree via `display: none` / `display: block` (which forces synchronous reflow and box-tree reconstruction of 2,100+ matrix cells and 90+ sticky headers), inactive tabs use `position: absolute; visibility: hidden; height: 0; overflow: hidden; pointer-events: none;`. Active tabs use `position: relative; visibility: visible; height: auto;`. The browser computes layout once on load and switches tabs instantly (0ms) on the GPU compositor thread without freezing the main thread.
- **Fixed-Layout Matrix Table:** `table.matrix-table` uses `table-layout: fixed; border-collapse: separate; border-spacing: 0;`. This avoids the expensive O(N*M) two-pass content-measurement algorithm across thousands of table cells and resolves border conflict overhead on sticky headers.
- **Lightweight Memory Caching & Precomputed Keys:** To prevent high RAM usage and garbage collection stutter when scaling to 10,000+ runs:
  - Integer timestamps (`_time = Date.parse(end_time)`) are calculated once on fetch. Multi-column sorting compares raw numeric timestamps (`a._time - b._time`), performing ZERO object allocations during sorts.
  - Lowercase search strings and consolidated search haystacks (`_haystack`) are cached on run objects, enabling fast single-pass native substring searches without runtime lowercasing or multi-field regex loops.
- **Atomic DOM Updates:** Functions that render run lists (`renderRecentRuns`, `renderExplorerRuns`) concatenate HTML strings in memory and execute a single `tbody.innerHTML = html` assignment.

### 8.4 Table Layout & Character Dump Accessibility
- **Column Ordering:** Table columns are structured as `#`, `Combo` (4-letter shortcut code e.g. `MfSh`, full name in hover title), `Morgue` (`[View]` button placed up front so players never need horizontal scrolling), `God`, `XL`, `Score`, `Turns`, `Duration`, `Speed`, `Outcome & Location`, and `Time` (`Oct 17 19:09` compact format at the utter right).
- **Live Character Dumps:** Active ongoing runs feature a direct `[View Dump]` button on the Overview Live Game Hero Card that opens `morgue/<Character>.txt` in the modal. Redundant dump buttons in Explorer are omitted for UI clarity.

### 8.5 Matrix Hover Popovers & Header Popovers
- **Cell vs Header Hover Separation:** Popovers are displayed strictly when hovering valid combo cells (`td[data-combo]`), background column headers (`th[data-bg]`, `td[data-bg-total]`), or species row headers (`td[data-species]`, `td[data-species-total]`).
- **Immediate Disappearance on Mouse Exit:** Moving cursor off a cell onto table borders, neutral padding, or outside the table container immediately calls `hidePopover()`.
- **Dedicated Header Popovers:**
  - Background headers show full name, category, trunk/legacy status, total games, wins, win rate, and combos completed.
  - Species headers show full name, trunk/legacy status, god restrictions (if any), total games, wins, win rate, and combos completed.
- **Clean Tooltip Presentation:** Redundant native browser `title` attributes on table cells and headers are omitted so native OS tooltips never obscure custom terminal-themed popovers.

### 8.6 Semantic Versioning Engine & Dynamic Version Discovery
- **Crawl SemVer Representation:** DCSS versions span official release tags (`0.34.1`, `0.30.2`), trunk pre-releases (`0.35-a0`, `0.35-a0-1308-g77a9b5a25e`), and directory aliases (`trunk` -> `0.35-a0`, `stable` -> `0.34.0`).
- **Semantic Parsing & Database Indexing:** `parseDcssVersion(vStr)` decomposes versions into `{ major, minor, patch, prerelease, raw }`. SQLite schema stores `version_major`, `version_minor`, and `version_patch` with composite index `idx_games_version_nums (version_major, version_minor)` for fast filtered range queries.
- **Pre-Release Trunk Semantics:** Standard SemVer 2.0.0 defines `0.35-a0 < 0.35.0`. In Crawl, players on pre-release `0.35-a0` expect `>= 0.35` and `0.35` to match. `compareVersions()` and `matchesVersionFilter()` evaluate major and minor numbers for major/minor version queries while preserving full patch/prerelease precedence when exact patch strings are provided.
- **Supported Operator Filters:** Supports relational operators (`>=`, `<=`, `>`, `<`), minor releases (`0.34` matches all `0.34.x`), exact version strings, and named aliases (`stable`, `trunk`).
- **100% Dynamic Discovery (Zero Phantom Versions):** The version dropdown is populated dynamically strictly from `SELECT DISTINCT version FROM games`. Zero hardcoded version options are shown; if a database has only 0.34 and 0.35 runs, older versions (e.g. 0.30) never appear in the dropdown.

### 8.7 DecaAut Time Distribution & Non-Duplicative Time Popover
- **DecaAut Telemetry in DCSS 0.35+ Trunk:** DCSS 0.35 introduced a decaaut-level timing table in morgues (`Table legend: (Time is in decaauts)`). Columns represent:
  - Elapsed Decaauts ($A$)
  - Non-Inter-Level Travel Decaauts ($B$)
  - Inter-Level Travel Decaauts ($C$)
  - Resting Decaauts ($D$)
  - Auto-Explore Decaauts ($E$)
  - Levels Seen ($F$)
  - Mean Time per Level ($G$)
- **Tactical DecaAuts Calculation:** Pure tactical time spent fighting, casting, and making decisions is calculated as:
  $$\text{Tactical daAuts} = B - (D + E)$$
- **Exact Proportional Distribution:**
  - $\text{Tactical } \% = \frac{\text{Tactical daAuts}}{A} \times 100$
  - $\text{Auto-Explore } \% = \frac{E}{A} \times 100$
  - $\text{Inter-Travel } \% = \frac{C}{A} \times 100$
  - $\text{Resting } \% = \frac{D}{A} \times 100$
  - Invariant: $\text{Tactical } \% + \text{Auto-Explore } \% + \text{Inter-Travel } \% + \text{Resting } \% = 100.00\%$
- **Portal Branch & Slowest Levels Parsing:** Slowest non-repeatable levels are parsed using non-greedy regex (`^\s*(.+?):\s*([\d,]+)\s*daAuts`) to support multi-word portal branches (e.g. `Ice Cave: 708 daAuts`).
- **Lowest Common Denominator (LCD) Table Architecture:** Rather than adding 6 redundant columns to the main table, table columns remain universal and uncrowded. Hovering over the **Time** cell triggers a retro terminal popover:
  - For **0.35 Trunk runs**: Renders a segmented CSS flex-ratio bar (Cyan `#34e2e2` Tactical, Green `#8ae234` Explore, Magenta `#fd59fa` Inter-Travel, Blue `#729fcf` Resting), exact percentages and raw daAuts, and slowest levels.
  - For **0.30–0.34 runs**: DecaAut section is hidden completely. The popover displays clean, useful timestamps (ended and started / last action). **Strictly zero duplication** of adjacent table columns (no redundant Turns, Duration, or Speed).
- **Morgue Modal Time Card:** In the Morgue Modal (`[View]`), `#morgueTimeCard` displays the visual distribution bar and metric breakdown directly above raw morgue text for runs with decaaut telemetry.
- **Pure Information Principle:** Absolutely no hardcoded speed classifications, judgmental thresholds, or subjective speed labels ("reckless", "deliberate", "travel tax"). Pure statistics and percentages are delivered directly to the player.
