const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = process.env.TABBOZ_URL || "http://localhost:4173/";
const defaultEdge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const executablePath = process.env.BROWSER_EXECUTABLE || (fs.existsSync(defaultEdge) ? defaultEdge : undefined);
const registryRoot = "HKEY_CURRENT_USER\\Software\\Obscured Truckware\\Tabboz Simulator 32";
let diagnosticPage;
const output = path.resolve("artifacts");
fs.mkdirSync(output, { recursive: true });

async function active(page) {
  await page.waitForFunction(() => !!document.getElementById("win" + window._activeWindowHwnd));
  const hwnd = await page.evaluate(() => window._activeWindowHwnd);
  return page.locator("#win" + hwnd);
}
async function mainReady(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector(".mobile-main");
    return main && !main.inert && !main.hidden && main.style.display !== "none";
  }, null, { timeout: 15000 });
}
async function returnToMain(page) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator(".mobile-main").evaluate(node => !node.inert && node.style.display !== "none")) return;
    const win = await active(page);
    const originalNode = await win.elementHandle();
    const back = win.locator(".title-bar-controls button").filter({ visible: true }).first();
    if (await back.count()) await back.click();
    else await win.locator("button.control1").click();
    await page.waitForFunction(node => !node.isConnected || node.inert || node.hidden || node.style.display === "none", originalNode);
    await page.waitForTimeout(80);
  }
  await mainReady(page);
}
async function dismissUntilDialog(page, dialogId) {
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(80);
    const win = await active(page);
    if (await win.getAttribute("data-dialog-id") === String(dialogId)) return win;
    const originalNode = await win.elementHandle();
    const back = win.locator(".title-bar-controls button").filter({ visible: true }).first();
    if (await back.count()) await back.click();
    else await win.locator("button.control1").click();
    await page.waitForFunction(node => !node.isConnected || node.inert || node.hidden || node.style.display === "none", originalNode);
  }
  throw new Error("Could not return to dialog " + dialogId);
}
async function assertFits(page, label) {
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    scroll: document.documentElement.scrollWidth,
    visibleWindows: [...document.querySelectorAll("#screen > .window")].filter(node => !node.hidden && !node.inert && node.style.display !== "none").map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right };
    })
  }));
  assert.ok(geometry.scroll <= geometry.viewport, label + ": horizontal overflow");
  for (const box of geometry.visibleWindows) {
    assert.ok(box.left >= -1 && box.right <= geometry.viewport + 1, label + ": window outside screen");
  }
}

(async () => {
  let browser;
  const pageErrors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
    const page = await context.newPage();
    diagnosticPage = page;
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(base);
    await mainReady(page);
    await page.waitForFunction(() => document.querySelector(".save-status").textContent === "Partita salvata");
    assert.equal(await page.locator("#welcome").isVisible(), false, "The app opens directly into the game");
    assert.equal(await page.locator(".activity-grid button").count(), 8);
    await assertFits(page, "Main");
    await page.screenshot({ path: path.join(output, "main-phone.png"), fullPage: true });

    // Keep broad UI scenarios independent; the rebuilt runtime also has a
    // separate continuous-session stress regression.
    for (const id of [130, 131, 132, 133, 134, 135, 136, 137]) {
      await page.reload();
      await mainReady(page);
      await page.locator(".activity-grid .control" + id).click();
      await page.waitForFunction(() => document.querySelector(".mobile-main").inert);
      await assertFits(page, "Activity " + id);
      const activity = await active(page);
      assert.equal(await activity.locator(":scope > .dialog-day-strip .calendar-date").innerText(), await page.locator(".day-strip .calendar-date").innerText(), "Calendar shown in activity " + id);
      await activity.locator(".mobile-dialog-body").evaluate(node => { node.scrollTop = node.scrollHeight; });
      const dayBox = await activity.locator(":scope > .dialog-day-strip").boundingBox();
      assert.ok(dayBox.y >= 0 && dayBox.y + dayBox.height <= 100, "Calendar stays above scrolling activity " + id);
      await returnToMain(page);
    }

    // Real original school action, including its event progression and save.
    await page.reload();
    await mainReady(page);
    const dayBefore = await page.locator(".day-strip .control157").innerText();
    await page.locator(".activity-grid .control136").click();
    await page.waitForFunction(() => document.querySelector(".mobile-main").inert);
    let win = await active(page);
    assert.equal(await win.locator(".activity-subject-grade").count(), 9, "All subject grades are on the pagella");
    for (const grade of await win.locator(".activity-subject-grade").all()) {
      assert.equal(await grade.isVisible(), true, "Grades are visible before selecting a subject");
    }
    await win.locator(".activity-subject-option:has(input.control111) label").click();
    await page.waitForFunction(() => document.querySelector('[data-dialog-id="10"] button.control103').textContent.includes("Fisica"));
    assert.equal(await win.locator("input.control111").isChecked(), true, "The pagella selects the original Fisica radio");
    await win.getByRole("button", { name: "Studia Fisica", exact: true }).click();
    const school = await dismissUntilDialog(page, 10);
    assert.equal((await school.locator(".control121").innerText()).trim(), "1", "Study updates the selected subject's original grade");
    assert.equal((await school.locator(".control120").innerText()).trim(), "0", "The other subject's grade stays unchanged");
    await page.waitForFunction(before => document.querySelector('[data-dialog-id="10"] .calendar-date').textContent !== before, dayBefore);
    assert.equal(await school.locator(".calendar-date").isVisible(), true, "Calendar advances before leaving school");
    await returnToMain(page);
    const dayAfter = await page.locator(".day-strip .control157").innerText();
    assert.notEqual(dayBefore, dayAfter, "Studying advances the original calendar");
    assert.notEqual(await page.locator(".stat-school .stat-value").innerText(), "0/100", "Studying updates the original school stat");

    // Original profile dialog still reads and writes its real control IDs.
    await page.locator("#tab-options").click();
    await page.locator("#page-options .control139").click();
    await page.waitForFunction(() => document.querySelector(".mobile-main").inert);
    win = await active(page);
    await win.locator("input.control102").fill("MobileTest");
    await win.locator("button.control1").click();
    await mainReady(page);
    await page.locator("#tab-home").click();
    assert.match(await page.locator(".identity-name .control102").innerText(), /MobileTest/);
    await page.reload();
    await mainReady(page);
    assert.match(await page.locator(".identity-name .control102").innerText(), /MobileTest/, "Confirmed profile survives reload");
    assert.equal(await page.locator(".day-strip .control157").innerText(), dayAfter, "Original action survives reload");

    // Shop cards use the original menu commands, with no desktop menu required.
    await page.locator("#tab-shops").click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const tabDate = await page.locator(".day-strip .calendar-date").boundingBox();
    assert.ok(tabDate.y >= 40 && tabDate.y + tabDate.height <= 65, "Date stays visible while scrolling the shops tab");
    await page.locator("#page-shops .control143").click();
    await page.waitForFunction(() => document.querySelector(".mobile-main").inert);
    await assertFits(page, "Clothes shop");
    await page.screenshot({ path: path.join(output, "shop-phone.png"), fullPage: true });
    await returnToMain(page);

    // Tobacco remains a real original selector, with all brands accessible.
    await page.reload();
    await mainReady(page);
    await page.locator("#tab-shops").click();
    await page.locator("#page-shops .control141").click();
    await page.waitForSelector('[data-dialog-id="88"]:not([hidden])');
    win = await active(page);
    assert.equal(await win.locator(".mobile-brand-button").count(), 24);
    await win.getByRole("button", { name: "Winston", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-dialog-id="88"] .control106').textContent.includes("Winston"));
    assert.equal(await win.locator('.mobile-brand-button[aria-pressed="true"]').count(), 1);
    await win.locator("button.control2").click();
    await mainReady(page);

    // Candidate stats must exist and be visible on a short phone screen.
    await page.reload();
    await mainReady(page);
    await page.locator("#tab-home").click();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator(".activity-grid .control133").click();
    await page.waitForSelector('[data-dialog-id="9"]:not([hidden])');
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator('[data-dialog-id="9"] .control110').click();
      await page.waitForSelector('[data-dialog-id="91"]:not([hidden])');
      win = await active(page);
      for (const id of [105, 106, 107]) {
        const value = win.locator(".control" + id);
        await page.waitForFunction(id => document.querySelector('[data-dialog-id="91"] .control' + id).textContent.trim().length > 0, id);
        const box = await value.boundingBox();
        assert.ok(box.y >= 64 && box.y + box.height < 568, "Candidate stat " + id + " visible without scrolling");
      }
      await win.locator("button.control2").click();
      await page.waitForFunction(() => !document.querySelector('[data-dialog-id="9"]').inert);
    }
    await returnToMain(page);

    // Export comes from original registry state; a separate browser imports it.
    await page.locator("#tab-options").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Esporta partita", exact: true }).click();
    const download = await downloadPromise;
    const savePath = path.join(output, "roundtrip-save.json");
    await download.saveAs(savePath);
    const backup = JSON.parse(fs.readFileSync(savePath, "utf8"));
    assert.equal(backup.format, "tabboz-mobile-save");
    assert.ok(Object.keys(backup.registry).length > 40);
    assert.ok(Object.keys(backup.registry).every(key => key.startsWith(registryRoot)));

    const importedContext = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    const imported = await importedContext.newPage();
    imported.on("pageerror", error => pageErrors.push(error.message));
    await imported.goto(base);
    await mainReady(imported);
    imported.on("dialog", dialog => dialog.accept());
    await Promise.all([
      imported.waitForEvent("load"),
      imported.locator("#import-file").setInputFiles(savePath)
    ]);
    await mainReady(imported);
    assert.match(await imported.locator(".identity-name .control102").innerText(), /MobileTest/, "Export/import restores the original profile");
    await assertFits(imported, "320px main");
    await imported.screenshot({ path: path.join(output, "main-320.png"), fullPage: true });

    for (const [width, height] of [[320,568],[360,640],[390,700],[390,844],[430,932],[844,390],[1280,900]]) {
      await page.setViewportSize({ width, height });
      await page.locator("#tab-home").click();
      await assertFits(page, width + "px main");
      if (height >= 568) {
        const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, viewport: innerHeight, actions: document.querySelector(".activity-grid").getBoundingClientRect().bottom, nav: document.querySelector(".app-nav").getBoundingClientRect().top, header: document.querySelector(".app-header").getBoundingClientRect().height }));
        assert.ok(fit.scroll <= fit.viewport + 1, width + "px main fits without vertical scrolling");
        assert.ok(fit.actions <= fit.nav, width + "px actions stay above navigation");
        assert.ok(fit.header <= 44, "Compact main header");
      }
      const sizes = await page.locator(".activity-grid button").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      assert.ok(sizes.every(height => height >= 44), "Touch targets at " + width + "px");
    }

    assert.deepEqual(pageErrors, [], "No browser JavaScript errors");
    console.log("PASS: direct game entry, 8 activity flows, original study progression, profile/reload, shop, export/import, 7 viewports, persistent secondary calendar, tobacco selector, candidate stats above fold.");
  } catch (error) {
    if (diagnosticPage) {
      console.error(await diagnosticPage.evaluate(() => ({ active: window._activeWindowHwnd, windows: [...document.querySelectorAll("#screen > .window")].map(node => ({ id: node.id, inert: node.inert, hidden: node.hidden, display: node.style.display, text: node.innerText.slice(0, 400) })) })).catch(() => ({})));
      await diagnosticPage.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

