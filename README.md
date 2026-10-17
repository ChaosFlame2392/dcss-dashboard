# DCSS Stats Dashboard

Local web dashboard for Dungeon Crawl Stone Soup (DCSS). Reads your local game logs and morgue files to display player statistics, combination progress, active game status, and character recommendations.

## Requirements

- Node.js 22.5.0 or later (for native SQLite support)

## Setup and Usage

```bash
git clone https://github.com/ChaosFlame2392/dcss-dashboard.git
cd dcss-dashboard
npm install
./run.sh
```

Or run the server directly:

```bash
npm start
```

The dashboard will be available at `http://localhost:3333`.

## Configuration

Settings are stored in `config.json` at the root of the project:

```json
{
  "dcss_dir": "",
  "debug": false
}
```

- `dcss_dir`: Path to your DCSS data directory containing morgue files or saves. If left empty, the application checks standard paths automatically:
  - macOS: `~/Library/Application Support/Dungeon Crawl Stone Soup/`
  - Linux: `~/.crawl/`, `~/.local/share/crawl/`, or Flatpak paths
- `debug`: Set to `true` to enable verbose console logging for directory discovery, sync events, and request timings. Defaults to `false`.

Alternatively, the `DCSS_DIR` environment variable can be used to set a custom path for a single session:

```bash
DCSS_DIR="/custom/crawl/path" ./run.sh
```

## Data Safety

All DCSS game data (morgues and logfiles) is accessed strictly in read-only mode. The server never opens, modifies, or locks binary save files (`.cs`), and operates purely on completed logs and character dumps.

## License

MIT License. See LICENSE for details.
