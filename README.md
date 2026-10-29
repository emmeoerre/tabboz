# Tabboz Simulator - mobile refit

A mobile browser interface for Tabboz Simulator, preserving the original Italian game, artwork, sounds and C game logic. The interface adapts the original dialogs and controls to a phone screen; the game runs as WebAssembly without a backend.

[Play Tabboz Simulator](https://emmeoerre.github.io/tabboz/)

## Credits

- **Original Windows game:** Andrea Bonomi, Emanuele Caccialanza and Daniele Gazzarri, **Obscured Truckware**, 1997-2001. Their original credits and copyright notices are preserved in the source and game resources.
- **Original browser/WebAssembly port:** Andrea Bonomi ([andreax79](https://github.com/andreax79)), author of [andreax79/tabboz](https://github.com/andreax79/tabboz) and the [Novantotto compatibility runtime](https://github.com/andreax79/novantotto). The [original browser version](https://andreax79.github.io/tabboz/) is the starting point for this refit.
- **Mobile refit:** [emmeoerre](https://github.com/emmeoerre), including phone layouts, save transfer, install/offline support and the compatibility-runtime repairs documented below.
- **98.css:** Jordan Scales ([jdan/98.css](https://github.com/jdan/98.css)), used by the original browser port for its Windows-style interface.

The original game and web port remain the work of their respective authors. This repository preserves their source, resources and notices and adds the mobile interface and documented runtime changes.

## Run locally

Use Node.js 18 or newer. No package installation is needed to play locally:

```sh
npm start
```

Open `http://localhost:4173/`. The server also prints an address for a phone on the same local network. It listens on all local interfaces; stop it with Ctrl+C when finished. Set `PORT` to choose a different port. The phone must be able to reach that port through the computer's firewall.

## GitHub Pages

The workflow in [pages.yml](.github/workflows/pages.yml) checks JavaScript, refreshes the offline inventory and publishes the static game on pushes to `main`. In repository **Settings > Pages**, the source is **GitHub Actions**.

To inspect the same deployable package locally:

```sh
npm run build:pages
```

The generated, ignored `dist/` contains runtime assets, licenses and a link to the corresponding source revision. Archived Windows binaries and raw game sources remain in this repository rather than the site package. The compiled engine is committed; the Pages job does not need Docker or Emscripten.

Link previews use static Open Graph/card metadata and `app/share-preview-v1.png`. To regenerate the image from an isolated fresh game's main screen, install the browser-test dependencies and run `npm run render:share`. Sharing URLs in the HTML are absolute so crawlers can find the image without running the game.

## Saves and offline play

Saves are stored in the browser's localStorage. The interface calls the original C save routine after completed actions when the engine is idle. Confirm profile edits before leaving that screen.

Use the in-game options to export a JSON backup or import one on another device. Saves belong to the browser and site address: export/import is also needed when moving from a local preview to the published site. There is no account or cloud save service.

On HTTPS or localhost, the service worker downloads the game resources for offline play after the first successful online load. Let that download finish before going offline. Supported phone browsers can add the game to the home screen. Ordinary HTTP over a local network can play the game, but service workers and installation require HTTPS or localhost.

The `prestart` and `predev` scripts regenerate the offline inventory. When changing files while the server is already running, run:

```sh
npm run prepare:offline
```

This refreshes `app/cache-assets.json` and the service worker version. The offline cache includes runtime assets, not the archived source code, Windows binaries or raw BMP resources.

## Source and runtime

- `index.html` and `app/`: the mobile shell, responsive original controls, layouts, shared calendar and save bridge.
- `engine/`: the unchanged upstream game snapshot, including its C source, resources, original JavaScript and WebAssembly.
- `runtime/novantotto/`: the pinned compatibility-runtime source, with the repairs recorded in `runtime/novantotto.patch`.
- `runtime/build/`: the JavaScript and WebAssembly used by the mobile app, built from the unchanged game C sources and repaired runtime.
- `scripts/`: local serving, offline packaging, engine build and regression checks.
- `service-worker.js` and `manifest.webmanifest`: offline and installed-app support.

The upstream game snapshot is version **0.92q**, commit [`142fa7de71fe3d4700fa0027f18d45c6ccdaa9be`](https://github.com/andreax79/tabboz/tree/142fa7de71fe3d4700fa0027f18d45c6ccdaa9be). It is later than the **0.9beta** Windows download on the [historical AABO mirror](https://www.aabo.it/house/katzate/tabboz/tabboz.htm).

The compatibility repair releases child controls when dialogs close, handles allocation failures and preserves dialog results. It keeps the original 100-entry handle pool and game rules. See [runtime build and repair notes](runtime/README.md) for the source patch, pinned Emscripten toolchain and rebuild instructions. Docker is needed to rebuild the committed engine artifacts, not to run the game.

## Checks

Syntax checks need only Node.js:

```sh
npm run check
```

Browser checks need a running local server and the development dependency:

```sh
npm install
npm test
npm run test:layouts
npm run test:engine
```

The tests use installed Microsoft Edge on Windows. Elsewhere, run `npx playwright install chromium`, or set `BROWSER_EXECUTABLE` to a compatible installed browser. Test screenshots and disposable saves are written to ignored `artifacts/`.

- [Layout review](docs/QA-LAYOUTS.md): all 80 secondary templates at three phone sizes, plus conditional content and live questionnaire checks.
- [Gameplay audit](docs/QA-GAMEPLAY.md) and [relationship audit](docs/QA-RELATIONSHIPS.md): mobile presentation issues, original game behavior and inherited browser-runtime defects.
- [Runtime validation](runtime/README.md): native lifecycle/failure checks and continuous-session browser regressions.

## License

The original game and mobile adaptation are distributed under **GPL-3.0-or-later**; see [LICENSE](LICENSE). Novantotto retains its **MPL-2.0** notices and 98.css its **MIT** license. Full attribution, version pins and component licenses are recorded in [NOTICE.md](NOTICE.md) and [docs/licenses/](docs/licenses/).
