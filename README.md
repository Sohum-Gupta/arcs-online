# Arcs Online

An unofficial browser implementation of **Arcs base game and Leaders & Lore**, for 2–4 players. A server-authoritative rules engine powers a shared map, physical-style player boards, guided turns, card inspection, battle explanations, undo/redo within supported decision windows, and configurable turn clocks with automatic legal play on timeout.

The **implementation is open source under MIT**. Publisher artwork, card scans, card text, and FAQ/errata reproductions are **not bundled or licensed by this repository**. Import content you are authorized to use locally to get the full visual experience. Without it, the rules tests and build work, but original imagery and reproduced reference text are unavailable. This project is independent of the publisher; the official rules remain the authority. The Blighted Reach campaign is outside scope.

## Quick start

Requires **Node.js 24** and npm. No external AI service or API key is required.

```sh
npm ci
npm run check
npm start
```

Open `http://localhost:3001`. Saved games are written to `var/` by default. For development, run `PORT=4317 npm start` and `npm run dev` in separate terminals; Vite serves `http://localhost:5173` and proxies the game API to port 4317.

Create a table, share its invitation link, and join from separate browsers. Seat credentials are stored in the joining browser. Keep invitation links and browser storage private. Practice opponents and timeout resolution use a local heuristic policy; they are not expert players.

## Optional local publisher content

From an existing installation whose content you are authorized to use:

```sh
npm run assets:import -- /path/to/authorized-installation
npm run verify:assets
npm run build
```

The source directory should contain `public/assets/` and optionally `data/cards.json`, `data/faq.json`, and `data/errata.json`. The importer copies only manifest-listed WebP files and those three JSON catalogs. It does not copy server data, environment files, or credentials and does not download content. Missing files are reported by the asset verification command.

Imported artwork goes into ignored `public/assets/` paths; reference text goes into ignored `data/private/`. `assets:prepare` merges optional text with the tracked card metadata into ignored `data/*.runtime.json` files. Tests, builds, and server startup prepare these automatically. Run `npm run assets:prepare` before invoking engine modules directly.

**Do not commit imported publisher content.** An artwork manifest or public source URL does not grant redistribution rights. See [third-party notices](THIRD_PARTY_NOTICES.md).

## Validation

```sh
npm run check                  # Rules/server tests and production build
npm run test:simulation        # Additional legal-play simulations
npm run test:timeout-simulations
```

Browser checks require imported artwork, a running local server, and Playwright Chromium:

```sh
npx playwright install chromium
npm run test:browser
npm run test:player-table
npm run test:shared-board
```

`TEST_URL` defaults to the local development server. Run browser checks only against disposable test instances: some create tables or take actions. Screenshots and generated reports belong in ignored `work/`. Automated coverage is substantial but does not prove every possible card interaction correct.

## Hosting

The Dockerfile builds and tests on Node 24. Configure `PORT` (default `3001`) and a persistent `DATA_DIR` (the Docker default is `/data`). Health check: `/api/health`. On Railway, deploy from this repository or Dockerfile and attach a volume at `/data`.

Keep **one replica**: SQLite storage and the live WebSocket registry run in one process. Back up the persistent volume securely. Never publish saved-game databases, seat credentials, journals, environment files, or hosting configuration containing account identifiers. If you use locally imported content, ensure your deployment has permission to serve it; the public repository does not supply that content.

## Project layout

- `game/`: rules, map and card metadata, legal decisions, scoring, practice policy.
- `server/`: room API, WebSockets, SQLite persistence, turn history and clocks.
- `src/`: React interface, map controls, player boards and guided decisions.
- `tests/`: rule regressions, synthetic game states, simulations and server tests.
- `scripts/`: content preparation and verification, browser checks and simulations.

## Credits and rules

Arcs was designed by Cole Wehrle and illustrated by Kyle Ferrin. Arcs names and publisher materials belong to their respective owners. This is an unofficial fan implementation, not an endorsed release.

- [Official base rulebook](https://buriedgiant.com/arcs/Arcs_Base_Rulebook.pdf)
- [Official player aid](https://buriedgiant.com/arcs/Arcs_Aid_Booklet.pdf)
- [Publisher card library](https://cards.buriedgiant.com/)
- [Searchable official rules](https://rules.buriedgiant.com/?product=arcs&locale=en-US&printing=p1)
- [HRF reference implementation](https://github.com/haunt-roll-fail/haunt-roll-fail), used to cross-check rules, map, setup and dice; its MIT notice is preserved in `docs/HRF-LICENSE.txt`.

Fraunces and Source Sans 3 fonts are bundled under the SIL Open Font License, with their license files in `public/assets/fonts/`.
