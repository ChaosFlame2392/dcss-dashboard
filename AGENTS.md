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
3. **Strict Read-Only Data Safety:** Under no circumstances does the application write to, modify, or lock DCSS save files (`.cs`), logfiles, or morgue directories.
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

The application monitors three DCSS data sources:
1. **`logfile*` (xlog files):** Colon-delimited key-value event logs generated upon character deaths or wins. The sync engine validates boundary newlines before ingestion to prevent reading partially written lines during an active crawl session.
2. **`morgue/*.txt`:** Full game summaries. Read strictly with `fs.readFileSync(..., 'utf8')`.
3. **`saves/*.cs`:** Active character save files. The app checks for the existence of `.cs` files to detect ongoing runs and reads the corresponding active character dump from the morgue directory.

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

