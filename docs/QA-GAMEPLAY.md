# Gameplay audit — 29 October 2026

**Repair update:** the mobile app now uses a source-built runtime with the child-handle cleanup fixed. Native lifecycle/failure tests pass, and 30 rejected approaches plus 108 activity visits keep live handles at exactly 31/100 without blank screens or reloads. See [runtime repair](../runtime/README.md). The findings below retain the original pre-repair evidence; the untouched reference engine still reproduces that defect.

Tested the mobile app at `http://localhost:4173/` in isolated Chromium contexts, with phone dimensions of 390 × 700. The user's browser and save were not accessed. No original engine or app files were edited by this audit.

## Confirmed mobile issue

| Finding | Attribution | Evidence | Status |
| --- | --- | --- | --- |
| Bar Tabacchi displayed its 24 cigarette choices as 24 separate artwork rows, with no accessible brand labels. The selection and purchase commands still worked, but browsing required excessive scrolling. | Mobile adapter: generic artwork normalization/reflow; the original dialog positions the same choices in an 8 × 3 grid. | Dialog 88, image commands 400–423. Before the fix, at 390 × 700 the content viewport was 636 px high and its scroll height was 2202 px. Images shared x = 170 and occupied successive rows. Captured in ignored `artifacts/qa/tobacco-layout.json` and `tobacco-before.png`. | Parent implemented a compact, labelled gallery while retaining the original image command targets. |

Selecting a cigarette image sets `scelta = id - 400` and updates control 106 with the original brand/price/constituent description. It does not immediately purchase. OK (1) deducts the price, adds cigarettes and fame, shows the original warning, calls `Evento()`, and closes. Controls 104 and 105 display money and cigarette count. Source: `engine/vestiti.c`, the `Tabacchi` procedure (around lines 333–430), and `engine/resources/dialogs/includes/88.inc.html`.

## Gameplay exercised

- Studied Agraria and Fisica: grades and total school score changed, and the calendar advanced.
- Requested a school bribe and declined its original confirmation.
- Requested family allowance increases/extra money with low school performance; the original refusal messages appeared.
- Went out with the company; reputation increased, an event/day advanced, and the game returned to the main screen.
- Tried scooter racing without owning a scooter; the original rejection appeared.
- Tried working while unemployed, then followed job advertisements, completed questionnaires with one answer per question, handled hiring/rejection results, and exercised a work action.
- Encountered the Saturday half-allowance message and the Sunday tobacco-shop closure.
- Selected and purchased the first cigarette pack through the original image and OK command; handled its warning/event messages.
- Tried an unaffordable jacket purchase; handled the original insufficient-money flow.
- In a separate funded test-save fixture, bought jacket 1, a Motorolo d170 phone, and a Magutty Firecow scooter through the actual touch controls. Jacket money decreased by 348000 L. and fame changed from 40 to 48; phone money decreased by 290000 L. The phone appeared in its status screen, and the scooter appeared at 100/100 condition. Money and scooter state survived reload.

The funded fixture used a copy of a fresh original save with money/fame adjusted solely to reach purchase paths. The actual purchase handlers and progression remained the original engine's. Evidence is in ignored `artifacts/qa/rich-purchases.json`.

## Behaviors confirmed in the original source

These were not classified as mobile bugs:

- Company outing closes its dialog after `Evento()`: `engine/zarrosim.c`, company command 102 (around lines 1582–1595).
- Family allowance requests depend on school score and cooldown: `engine/zarrosim.c`, `Famiglia` (around lines 1377–1482).
- Job details are blank when unemployed: `engine/lavoro.c`, `AggiornaLavoro` (around lines 430–447).
- Job offers/outcomes involve random selection; completing a questionnaire does not guarantee employment: `engine/lavoro.c`, command 110.
- Unowned scooter/phone details and scooter purchase specifications before selecting a model may be blank by design.
- Shop opening rules and insufficient-money denials are original game rules, not missing touch commands.

No JavaScript page errors were observed in the exercised flows. This bounded audit does not establish that the whole original game or compatibility runtime is bug-free. The separately assigned relationship audit covers the reported missing candidate stats and longer-running dialog behavior.

## Longer-session compatibility failure and recovery

A subsequent comparison reproduced the shipped engine's dialog-pool problem, including an invalid handle 0 / `wall0` in the unchanged renderer. This is not evidence that the original C game's Windows build has the same defect; the demonstrated failure is in the supplied browser engine/compatibility build.

The mobile wrapper now detects an invalid dialog/message handle and offers **Ricarica partita**, keeping the failed engine suspended so it cannot overwrite the last committed save. This is recovery, not a repair of the upstream allocation problem.

`node scripts/qa-recovery.cjs` exercised the real failure path, without directly calling a dialog with handle 0:

1. Confirmed a profile named `RecoveryQA Caio` and studied once, then confirmed the main save at Tuesday 1 October.
2. Opened and closed all eight main activities through actual buttons.
3. Opened Work and clicked **Lavora** while unemployed, which requires the original nested rejection message.
4. The handle-allocation failure reached the recovery panel after 10 UI actions in one cycle.
5. Verified that all failed windows were hidden/inert and the saved registry was unchanged.
6. Clicked **Ricarica partita** and verified that the same name/date returned, the recovery panel disappeared, and no JavaScript page errors occurred.

Evidence: ignored `artifacts/qa/engine-recovery-results.json` and `engine-recovery.png`.

## Calendar persistence comparison

The exact open/close sequence for commands 130 through 137 followed by studying Agraria was also run against `/engine/index.html` and the mobile app. In the captured run, both renderers updated the school grade immediately, while their main-screen date remained Monday 30 September until the school dialog closed. The unchanged renderer had no `Giorno`, `Mese`, or `Studio` localStorage entries even after closing, though its main date then became Tuesday 1 October. The mobile main-save flush persisted `Giorno=1`, `Mese=10`, and `Studio=1` after closing.

This demonstrates that the shipped browser engine's save/date-refresh behavior cannot be assumed to match every `TABBOZ_EM` save call present in the repository's C source. Immediate fresh-screen results may also depend on a previously scheduled mobile main-save flush. Evidence is in ignored `artifacts/qa/calendar-sequence-comparison.json`.

### Mobile calendar synchronization fix

After the comparison above, `app/engine-bridge.js` was added to capture the original pointers returned by `AllocateControl`, validate the pinned RESOURCE layout and original main callback, and invoke its existing `WM_ENDSESSION` save handler only when the engine is idle after a completed command. This reads compatibility metadata without writing game memory or allocating extra controls. The original save code persists the actual game calendar, which `app/calendar.js` then renders in every activity. A live check confirmed Monday 30 September changed to Tuesday 1 October while the same School dialog remained active, with no page errors. Main tabs also keep their header/date sticky while their content scrolls.
