# Attribution and licenses

## Tabboz Simulator

Original game by Andrea Bonomi, Emanuele Caccialanza, and Daniele Gazzarri, credited in the original source as Obscured Truckware, 1997–2001.

Source: https://github.com/andreax79/tabboz

Imported snapshot: `142fa7de71fe3d4700fa0027f18d45c6ccdaa9be`, version `0.92q`.

The original source headers license Tabboz Simulator under the GNU General Public License, version 3 or any later version. The full license is preserved in `LICENSE` and `engine/LICENSE`. Original artwork, writing, sound files, and compiled game resources remain in the upstream snapshot with the original notices. The original game C sources and prebuilt engine snapshot remain unchanged under `engine/`. The app now uses a new WebAssembly build of those same game sources linked with the repaired compatibility runtime described below.

Mobile refit maintained by emmeoerre (https://github.com/emmeoerre).

This project adds the mobile HTML/CSS/JavaScript interface, dialog layout adaptation, browser save transfer, and install/offline support. These additions are distributed under GPL-3.0-or-later. The upstream snapshot remains under `engine/` for attribution, inspection, and rebuilding using its original instructions.

## Novantotto

Copyright (c) 2024 Andrea Bonomi.

Source: https://github.com/andreax79/novantotto

The compatibility runtime in `engine/resources/js/novantotto.js` states that it is licensed under the Mozilla Public License, version 2.0. Its original notices are retained. The full license is included in `docs/licenses/Novantotto-MPL-2.0.txt`.

A separately pinned source copy is included under `runtime/novantotto/`, commit `12176b4d630bfb2d7426ff8b5ddf81bbc875e550`. This project modifies `handle.c`, `dialog.c`, `registry.c`, and `resource.c` to correct child-resource release, slot reuse, dialog return lifetime, and allocation-failure handling. These files retain their MPL-2.0 notices and remain available in source form. `runtime/novantotto.patch` records the changes. `runtime/build/tabboz.js` and `tabboz.wasm` are generated from this source and the unchanged game sources using the pinned Emscripten toolchain documented in `runtime/README.md`.

## 98.css

Copyright (c) 2020 Jordan Scales.

Source: https://github.com/jdan/98.css

The bundled `engine/resources/css/98.css` identifies itself as version `0.1.20`. Its MIT license, obtained from the corresponding upstream release commit `94688d0dd72170c4cc33f4e604b65410343af441`, is preserved in `docs/licenses/98.css-MIT.txt`. The bundled styles and font files remain in their original resource directory.

## App icons

`app/icon-192.png` and `app/icon-512.png` are nearest-neighbor size conversions of the original `engine/resources/icons/ZARROSIM.gif`. No new character artwork was added.

## Sharing preview

`app/share-preview-v1.png` is a rendering of the mobile main screen's original character artwork and live controls in a fresh, isolated game. `scripts/render-share-preview.cjs` reproduces it using the original icon and bundled interface fonts. The character artwork remains the original authors' work.
