# Repaired browser runtime

The game C sources under `engine/` are unchanged. The mobile app now loads `runtime/build/tabboz.js` and its matching WebAssembly, compiled from those original game sources and the repaired Novantotto runtime.

Upstream versions and the compiler image are pinned in `UPSTREAM.json` and `scripts/build-engine.mjs`. The original prebuilt engine remains at `engine/zarrosim.js` / `engine/zarrosim.wasm`, and its untouched reference page remains at `/engine/index.html`.

## Repair

The original `ReleaseHandle` compared a RESOURCE pointer with a numeric parent HWND after clearing the parent's handle. Closed windows consequently left child controls in a fixed 100-entry table.

The repair preserves the numeric parent ID, releases children through the normal destructor, frees their class/property allocations, and clears slots for reuse. Dialog results are copied before destruction, and failed allocations are checked before dereferencing them. Registry/resource failure paths also release temporary allocations and clear freed payloads. The table remains at 100 entries.

The complete source diff is in `novantotto.patch`; the modified MPL-2.0 files retain their upstream notices.

## Build

Docker is needed only to rebuild the committed browser artifacts:

```sh
npm run build:engine
npm run prepare:offline
```

The compiler runs in a pinned Emscripten 3.1.55 container with project sources mounted read-only and only `runtime/build/` writable. No compiler is installed globally.

The build exports the game's existing `SalvaTutto` save routine, removing the previous need for compatibility-structure inspection in the mobile bridge. Diagnostic exports `TabbozHandleCount` and `TabbozHandleCapacity` report the real live resource count for regression tests.

## Validation

```sh
npm run test:runtime
npm run test:engine
npm test
```

The native tests need GCC (or `CC`). Browser tests need the running local server and Playwright's development dependency.

Validated results:

- 1,000 native dialog lifecycles, nested ownership/reference counts, exhausted pool, allocation failures, and dialog return values. The lifecycle regression fails against the original upstream cleanup.
- 43,047 tracked class/property allocations freed.
- 30 actual rejected approaches and 108 activity visits, with no reload during either stress phase.
- Live resources return to exactly 31 of 100 after every closed flow; 16 MiB heap remains unchanged.
- No blank/recovery windows or JavaScript page errors in those tests; profile/calendar survive reload.
- A save created with the untouched original engine loads correctly in the repaired build.

The browser stress test turns sounds off through the game's own settings to isolate the resource defect from previously observed missing/unplayable upstream audio assets. It does not claim to repair every pre-existing game or audio issue.

