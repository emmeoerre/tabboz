# Mobile layout review - 29 October 2026

The mobile adapter groups original controls into activity panels, catalogs, forms and story cards. No original game C code, dialog template, writing or artwork was changed in this review. All play tests used isolated browser contexts and disposable saves.

## Current presentation

- Classic navy title bars and neutral gray surfaces replace the teal theme. Selections, status bars and text use neutral colors; original artwork remains unchanged.
- Message popups have a raised, beveled Windows border and a small shadow. Real message creation and dismissal were checked at 320x568, 360x640 and 390x700.
- School uses a native subject picker that forwards selection to the original radio and displays the corresponding original grade. Study and other actions remain original buttons.
- Activity status panels put money, reputation, scooter specifications, job details and partner information alongside compact action grids.
- Shops show compact catalogs and the selected item's original description. Phone ownership, carrier, credit, gym membership and scooter sale/upgrade details retain their live engine fields.
- Settings keep the original skill and miscellaneous groups in tabs. Work questionnaires show the complete original introduction and all three questions in one readable scrolling page. Submit follows question C in normal flow; there are no questionnaire tabs or sticky submit overlays.
- Profile, report cards, advertisements, event stories and About use grouped fields and smaller original art. The main Shops and Options tabs also use compact grids.
- Date and header remain above the scrolling dialog body. Long disco descriptions can scroll inside their own panel. Overflow remains available for unusually long content or smaller viewports.

## Geometry and control preservation

`npm run test:layouts` prepares every original secondary dialog template through the production adapter at 320x568, 360x640 and 390x700. It checks the original game date, retains every original `.dlg_item` node, detects clipping, and records outer and nested overflow.

The current run covers **240 default screen/viewport combinations**: no horizontal overflow, clipped controls, missing original controls or JavaScript page errors. Only the ten work questionnaire templates (200-209) scroll at these portrait sizes, intentionally. This template sweep checks geometry; it does not substitute for live gameplay checks.

Before the first compact refit, at 360x640, 43 of 80 secondary screens required outer scrolling. Representative excess heights included School 455 px, Settings 251 px, Work 189 px and the phone catalog 550 px.

Screenshots and geometry are generated under ignored `artifacts/layouts/after/`.

## Conditional and interactive states

Additional bounded checks covered:

- Settings tabs and expanded disclosures across all three sizes. The initial compact pass also exercised the former questionnaire tabs; those tabs have since been replaced with continuous scrolling.
- The current scrolling questionnaire through actual C submission at 320x568 and 390x700. Three native answer selections survived scrolling, B/C clicks retained the exact scroll position, and submission reached a normal interview result without a missing-answer warning.
- 78 catalog-description selections, plus 45 captures of real purchase/ownership states across all three sizes: phone purchase and SIM activation/refill, gym membership, scooter purchase/sale/tuning/upgrades, and clothing descriptions.
- Empty and populated scooter, job and partner screens, including both character genders.
- An actual scooter purchase while the parent Scooter screen was already open: its initially blank fields filled immediately in the same window, still without scrolling. Park/use toggles also worked.
- A real breakup: the existing partner fields cleared in the same screen, retaining visible containers rather than stale details.
- Selecting Fisica forwarded to the original radio; studying advanced its grade from 0 to 1 and advanced the date. Selecting Agraria then showed its unchanged grade of 0.
- Profile saving, settings persistence and reset-form gender/capacity changes.

Initially empty nodes remain connected, and selection visibility updates when the original controls change. Hidden native questionnaire inputs are positioned within their answer rows so browser focus follows the scrolled answer.

## Integration checks

`npm run check` and `npm test` passed after the theme, popup and questionnaire updates. The smoke suite covers saving/export/import, calendar updates, candidate stats, tobacco selection, all eight main activities and seven viewport sizes.

The earlier compact refit also passed `npm run test:engine`: 30 rejected approaches and 108 activity visits without handle exhaustion or recovery. This feedback pass changes presentation only.

Reports and captures from the bounded conditional-state checks are in ignored `artifacts/layouts/forms-*`, `artifacts/layouts/sh-*`, and `artifacts/qa/activity-*`. Theme and popup captures are in `artifacts/feedback/`. The game has randomized content, so these checks do not enumerate every possible future state.
