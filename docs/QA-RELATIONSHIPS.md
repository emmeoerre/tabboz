# Relationship play-test findings

**Repair update:** the mobile app now uses a source-built runtime with the child-handle cleanup fixed. Native lifecycle/failure tests pass, and 30 rejected approaches plus 108 activity visits keep live handles at exactly 31/100 without blank screens or reloads. See [runtime repair](../runtime/README.md). The findings below retain the original pre-repair evidence; the untouched reference engine still reproduces that defect.

Date: 2026-10-29. Tests used isolated browser contexts; the user's saved game was not accessed.

## Candidate statistics

- Male relationship page is dialog **9**; candidate search is **91**.
- Female relationship page is dialog **190**; candidate search is **191**.
- Candidate fields are **105** (name), **106** (rating), and **107** (description).
- Twenty repeated male searches followed by cancellation passed in each renderer: mobile and the untouched upstream page. No candidate fields were empty.
- Delayed double-tap tests passed for both genders in both renderers. The template response was delayed 150 ms and the search button double-tapped 25 ms apart. All active candidate fields populated.
- At the previous 390×700 layout, candidate fields appeared around y=389, 454, and 551 after a 264px illustration. This could make information appear missing on a short viewport. It was a mobile presentation issue, distinct from missing game data.
- Empty partner fields on dialog 9/190 are intentional when no relationship exists. Original `tipa.c:586` (`AggiornaTipa`) clears 105/106/107 when `Rapporti == 0`. This does not apply to the candidate's fields, which `CercaTipa` fills during `WM_INITDIALOG`.

The exact reported intermittent blank **candidate** screen was not reproduced in the bounded search/double-tap checks.

## Confirmed upstream failure: repeated rejected approaches

A separate, serious failure was reproduced in the untouched upstream renderer at `/engine/index.html`, then in the mobile renderer.

1. Use a fresh male character with zero fame/reputation.
2. Open Tipa → Cerca tipa → Ci provo.
3. Dismiss the rejection with Ci rinuncio and dismiss any original event messages.
4. Repeat about six times without reloading.

Observed upstream rejection dialog handles: **51 → 61 → 71 → 81 → 91 → 0**. The sixth rejected approach opened dialog **95** as `win0`, with its rejection text empty; its button could no longer close it. Candidate dialog 91 immediately before the failure still contained a name, rating, and description.

This is a failure of the existing browser compatibility runtime, reproduced with the original HTML/CSS/JS renderer and the same compiled engine. It is not caused by the mobile layout. The exact count can vary with additional event dialogs and other activities.

Primary source evidence:

- [Novantotto handle.c](https://github.com/andreax79/novantotto/blob/main/handle.c) allocates a fixed minimum table of 100 entries and returns NULL when full.
- Its `ReleaseHandle` child cleanup compares a RESOURCE pointer (`h`) with a numeric parent HWND (`child->hwndParent`), after clearing `h->handle`. This cannot reliably match the parent's child controls.
- [Novantotto window.c](https://github.com/andreax79/novantotto/blob/main/window.c) destroys the window and calls `ReleaseHandle`.
- [Novantotto dialog.c](https://github.com/andreax79/novantotto/blob/main/dialog.c) does not check for allocation failure before dereferencing the window resource.

These source defects and the monotonically increasing rejection handles support handle exhaustion/leaked controls as the cause. The exact compiled structure offsets were not assumed or patched. No C, WebAssembly, or upstream runtime file was modified. A proper follow-up should repair/rebuild the compatibility runtime and verify long sessions; blindly writing WASM memory is not an acceptable fix.

Audio playback errors also appeared in both renderers during rejection flows. They were not fully diagnosed in this pass.

## Reproduction and regression scripts

With the local server running and the development dependency installed:

```sh
node scripts/qa-relationships.cjs
node scripts/qa-relationships.cjs --exhaustion
```

The default is a passing candidate-field regression across both genders/renderers plus delayed double taps. The optional exhaustion audit records the known upstream failure without being wired into the normal CI/test command. Logs/screenshots go to ignored `artifacts/qa/`.

Evidence from the investigation includes `upstream-approach-log.json`, `mobile-approach-log.json`, `relationship-searches.json`, `relationship-doubletap.json`, and the candidate/zero-handle screenshots.


## Mobile fixes and recovery applied after the audit

Candidate dialogs 91/191 now place the original fields beside a smaller portrait; all three values and both actions were verified visible at 320×568 and 360×640. The initial data was not replaced or fabricated. The app also detects the upstream invalid-handle failure and presents a reload control while keeping that failed engine suspended. The upstream leak remains unresolved; recovery restores the last saved checkpoint.
