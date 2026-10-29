/* Long-session regression for the rebuilt browser compatibility runtime.
 * Run against a running local preview: node scripts/qa-engine-stress.cjs
 * Each scenario keeps one engine session alive until its final persistence check.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseURL = process.env.TABBOZ_URL || "http://localhost:4173/";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const executablePath = process.env.BROWSER_EXECUTABLE || (fs.existsSync(edge) ? edge : undefined);
const output = path.resolve("artifacts/qa");
const approachTarget = Number(process.env.TABBOZ_STRESS_APPROACHES || 30);
const activityTarget = Number(process.env.TABBOZ_STRESS_ACTIVITIES || 100);
const registry = "HKEY_CURRENT_USER\\Software\\Obscured Truckware\\Tabboz Simulator 32";
fs.mkdirSync(output, { recursive: true });

async function health(page) {
  const bad = await page.evaluate(() => ({
    recovery: !!document.querySelector("#game-recovery"),
    zeroWindow: !!document.querySelector("#win0, #wall0")
  }));
  assert.equal(bad.recovery, false, "The engine must not fall back to recovery");
  assert.equal(bad.zeroWindow, false, "The engine must never create handle 0");
}

async function active(page) {
  await page.waitForFunction(() => {
    if (document.querySelector("#game-recovery, #win0, #wall0")) return true;
    const win = document.getElementById("win" + window._activeWindowHwnd);
    return win && !win.hidden && !win.inert && win.style.display !== "none" &&
      (!window.Asyncify || (window.Asyncify.state === 0 && !window.Asyncify.exportCallStack.length));
  });
  await health(page);
  return page.locator("#win" + await page.evaluate(() => window._activeWindowHwnd));
}

async function mainReady(page) {
  await page.waitForFunction(() => {
    if (document.querySelector("#game-recovery, #win0, #wall0")) return true;
    const main = document.querySelector(".mobile-main");
    return main && window._activeWindowHwnd === Number(main.id.slice(3)) &&
      !main.inert && !main.hidden && main.style.display !== "none";
  });
  await health(page);
  return page.locator(".mobile-main");
}

async function dialogReady(page, dialog) {
  await page.waitForFunction(id => {
    if (document.querySelector("#game-recovery, #win0, #wall0")) return true;
    const win = document.getElementById("win" + window._activeWindowHwnd);
    return win && win.dataset.dialogId === String(id) && !win.inert && !win.hidden;
  }, dialog);
  return active(page);
}

async function clickControl(page, id) {
  const win = await active(page);
  const control = win.locator("button.control" + id).filter({ visible: true }).first();
  assert.ok(await control.count(), "Missing original button " + id);
  await control.click();
}

async function closeActive(page) {
  const win = await active(page);
  const previous = await win.elementHandle();
  const exit = win.locator(".title-bar-controls button").filter({ visible: true }).first();
  if (await exit.count()) await exit.click();
  else {
    const cancel = win.locator("button.control2").filter({ visible: true }).first();
    if (await cancel.count()) await cancel.click();
    else await win.locator("button.control1").filter({ visible: true }).first().click();
  }
  await page.waitForFunction(node => !node.isConnected || node.inert || node.hidden || node.style.display === "none" ||
    !!document.querySelector("#game-recovery, #win0, #wall0"), previous);
  await health(page);
}

async function dismissToRelationship(page) {
  for (let continuation = 0; continuation < 40; continuation++) {
    const win = await active(page);
    if (await win.getAttribute("data-dialog-id") === "9") return win;
    // These are the original acknowledgement/decline controls. Do not create
    // a game command or alter state through a JavaScript shortcut.
    let button;
    for (const id of [1, 7, 2, 6]) {
      const choice = win.locator("button.control" + id).filter({ visible: true }).first();
      if (await choice.count()) { button = choice; break; }
    }
    assert.ok(button, "Unknown original event continuation: " + await win.innerText());
    const previous = await win.elementHandle();
    await button.click();
    await page.waitForFunction(node => !node.isConnected || node.inert || node.hidden || node.style.display === "none" ||
      !!document.querySelector("#game-recovery, #win0, #wall0"), previous);
    await health(page);
  }
  throw new Error("Original event chain did not finish within 40 acknowledgements");
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const count = window._TabbozHandleCount || window.Module?._TabbozHandleCount;
    const capacity = window._TabbozHandleCapacity || window.Module?._TabbozHandleCapacity;
    return {
      count: typeof count === "function" ? count() : null,
      capacity: typeof capacity === "function" ? capacity() : null,
      heapBytes: window.HEAPU8?.byteLength || null
    };
  });
}

async function assertSavedAndReload(page, name, date) {
  await page.locator("#tab-options").click();
  await page.getByRole("button", { name: "Salva ora", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".save-status")?.textContent === "Partita salvata");
  const stored = await page.evaluate(root => ({
    name: JSON.parse(localStorage.getItem(root + "\\Nome") || "{}")[""],
    day: JSON.parse(localStorage.getItem(root + "\\Giorno") || "{}")[""]
  }), registry);
  assert.ok(stored.name && stored.day, "Original registry save exists");
  await page.reload();
  await mainReady(page);
  assert.equal(await page.locator(".identity-name .control102").innerText(), name, "Profile survives reload after long session");
  assert.equal(await page.locator(".day-strip .control157").innerText(), date, "Calendar survives reload after long session");
}

async function configure(page) {
  await mainReady(page);
  await page.locator("#tab-options").click();
  await page.locator("#page-options .control139").click();
  const profile = await dialogReady(page, 11);
  await profile.locator("input.control102").fill("StressQA");
  await profile.locator("button.control1").click();
  await mainReady(page);
  await page.locator("#page-options .control140").click();
  const options = await dialogReady(page, 14);
  await options.getByRole("tab", { name: "Misc", exact: true }).click();
  const sound = options.locator("input.control110");
  if (await sound.isChecked()) {
    await options.locator(".mobile-choice:has(input.control110) label").click();
    assert.equal(await sound.isChecked(), false);
  }
  await options.locator("button.control1").click();
  await mainReady(page);
  await page.locator("#tab-home").click();
  return {
    name: await page.locator(".identity-name .control102").innerText(),
    initialDate: await page.locator(".day-strip .control157").innerText()
  };
}

async function approaches(browser, failurePages) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  failurePages.push(page);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseURL);
  const initial = await configure(page);
  const samples = [];
  let searches = 0;
  for (let attempt = 0; attempt < approachTarget; attempt++) {
    await mainReady(page);
    const stats = await page.evaluate(() => ({
      fame: parseInt(document.querySelector(".mobile-main .control151").textContent, 10) || 0,
      reputation: parseInt(document.querySelector(".mobile-main .control152").textContent, 10) || 0
    }));
    // Force the rejection branch using a legitimately generated candidate for
    // whom success is mathematically impossible under the original formula.
    const minimumRating = Math.floor((stats.fame + stats.reputation + 29) / 2) + 1;
    assert.ok(minimumRating <= 100, "Fixture gained too many stats for a guaranteed rejection");
    const dateBefore = await page.locator(".day-strip .control157").innerText();
    await page.locator(".activity-grid .control133").click();
    await dialogReady(page, 9);
    let candidate;
    let fields;
    for (let search = 0; search < 60; search++) {
      await clickControl(page, 110);
      candidate = await dialogReady(page, 91);
      await page.waitForFunction(() => {
        const win = document.getElementById("win" + window._activeWindowHwnd);
        return [105,106,107].every(id => win?.querySelector(".control" + id)?.textContent.trim());
      });
      fields = await candidate.evaluate(win => ({
        name: win.querySelector(".control105").textContent.trim(),
        rating: win.querySelector(".control106").textContent.trim(),
        description: win.querySelector(".control107").textContent.trim()
      }));
      searches++;
      assert.ok(fields.name && fields.description);
      assert.match(fields.rating, /^\d+\/100$/);
      if (parseInt(fields.rating, 10) >= minimumRating) break;
      await candidate.locator("button.control2").click();
      await dialogReady(page, 9);
      candidate = null;
    }
    assert.ok(candidate, "Could not generate a candidate for the guaranteed rejection branch");
    await candidate.locator("button.control101").click();
    const rejection = await dialogReady(page, 95);
    await page.waitForFunction(() => document.querySelector('[data-dialog-id="95"] .control105')?.textContent.trim());
    assert.ok((await rejection.locator(".control105").innerText()).trim().length > 0, "Rejection text populated");
    await rejection.locator("button.control1").click();
    await dismissToRelationship(page);
    await clickControl(page, 1);
    await mainReady(page);
    const date = await page.locator(".day-strip .control157").innerText();
    assert.notEqual(date, dateBefore, "Original event advances the calendar after a rejected approach");
    samples.push({ attempt: attempt + 1, fields, date, handles: await diagnostics(page) });
  }
  const approachHandles = samples.map(sample => sample.handles.count);
  if (approachHandles.every(count => count !== null)) {
    assert.ok(approachHandles.every(count => count === approachHandles[0]), "Live handles return to a stable baseline after every rejected approach");
  }
  const finalDate = await page.locator(".day-strip .control157").innerText();
  assert.notEqual(finalDate, initial.initialDate);
  assert.deepEqual(errors, [], "No JavaScript errors during repeated approaches");
  await assertSavedAndReload(page, initial.name, finalDate);
  await page.screenshot({ path: path.join(output, "engine-stress-approaches.png"), fullPage: true });
  await context.close();
  return { rejectedApproaches: samples.length, candidateSearches: searches, initialDate: initial.initialDate, finalDate, samples, errors };
}

async function mixedActivities(browser, failurePages) {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  failurePages.push(page);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseURL);
  await mainReady(page);
  const mainId = await page.locator(".mobile-main").getAttribute("id");
  const name = await page.locator(".identity-name .control102").innerText();
  const date = await page.locator(".day-strip .control157").innerText();
  const ids = [130,131,132,133,134,135,136,137];
  const samples = [];
  // One warm-up visit per activity admits any lazily cached shared resources.
  for (let index = 0; index < activityTarget + ids.length; index++) {
    await mainReady(page);
    const command = ids[index % ids.length];
    await page.locator(".activity-grid .control" + command).click();
    const win = await active(page);
    assert.notEqual(await win.getAttribute("id"), mainId, "Activity opens a secondary dialog");
    assert.ok((await win.locator(".title-bar-text").innerText()).trim(), "Activity title is populated");
    assert.ok((await win.locator(".calendar-date").innerText()).trim(), "Activity date is populated");
    await closeActive(page);
    await mainReady(page);
    samples.push({ visit: index + 1, command, handles: await diagnostics(page) });
  }
  const tail = samples.slice(ids.length).map(sample => sample.handles.count);
  if (tail.every(count => count !== null)) {
    assert.ok(tail.every(count => count === tail[0]), "Live handles return to a stable baseline after every closed activity");
  }
  assert.deepEqual(errors, [], "No JavaScript errors during activity cycling");
  await assertSavedAndReload(page, name, date);
  await page.screenshot({ path: path.join(output, "engine-stress-activities.png"), fullPage: true });
  await context.close();
  return { visits: samples.length, testedAfterWarmup: activityTarget, samples, errors };
}

(async () => {
  let browser;
  const failurePages = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    const result = {
      approaches: await approaches(browser, failurePages),
      mixed: await mixedActivities(browser, failurePages)
    };
    fs.writeFileSync(path.join(output, "engine-stress-results.json"), JSON.stringify(result, null, 2));
    console.log("PASS: " + result.approaches.rejectedApproaches + " rejected approaches, " +
      result.mixed.visits + " activity visits, populated dialogs, no recovery/zero handles, and save/reload persistence.");
  } catch (error) {
    for (let index = 0; index < failurePages.length; index++) {
      const page = failurePages[index];
      if (page.isClosed()) continue;
      await page.screenshot({ path: path.join(output, "engine-stress-failure-" + index + ".png"), fullPage: true }).catch(() => {});
      console.error(await page.evaluate(() => ({
        active: window._activeWindowHwnd,
        recovery: document.querySelector("#game-recovery")?.innerText,
        text: document.getElementById("win" + window._activeWindowHwnd)?.innerText.slice(0, 1200)
      })).catch(() => ({})));
    }
    throw error;
  } finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

