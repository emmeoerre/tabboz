/* Relationship screen regression and optional upstream bug reproduction. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const baseURL = process.env.TABBOZ_URL || "http://localhost:4173/";
const registry = "HKEY_CURRENT_USER\\Software\\Obscured Truckware\\Tabboz Simulator 32";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const output = path.resolve("artifacts/qa");
fs.mkdirSync(output, { recursive: true });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fixture(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.waitForSelector(".mobile-main");
    await page.waitForFunction(() => Object.keys(localStorage).length > 40);
    return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  } finally { await context.close(); }
}

async function openRelationship(browser, saved, mobile, sex) {
  const context = await browser.newContext({ viewport: mobile ? { width: 360, height: 640 } : { width: 1200, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const seed = {
    ...saved,
    [registry + "\\STARTcmdShow"]: JSON.stringify({ "": "0" }),
    [registry + "\\Sesso"]: JSON.stringify({ "": sex })
  };
  await page.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, seed);
  await page.goto(new URL(mobile ? "./" : "engine/index.html", baseURL).href);
  if (mobile) await page.waitForSelector(".mobile-main");
  else {
    await page.waitForFunction(() => Boolean(window.strings));
    await page.waitForTimeout(120);
    await page.locator(".desktop-item").click();
    await page.waitForSelector(".window button.control133");
  }
  await page.evaluate(() => {
    const original = window.dialogBox;
    window.dialogBox = async function(...args) {
      await original(...args);
      document.getElementById("win" + args[0]).dataset.qaDialog = String(args[1]);
    };
  });
  const main = await page.evaluate(() => window._activeWindowHwnd);
  await page.locator("#win" + main + " button.control133").click();
  const relationshipId = sex === "M" ? "9" : "190";
  await page.waitForFunction(id => document.getElementById("win" + window._activeWindowHwnd)?.dataset.qaDialog === id, relationshipId);
  const parent = await page.evaluate(() => window._activeWindowHwnd);
  return { context, page, parent, candidateId: sex === "M" ? "91" : "191" };
}

async function candidateFields(page) {
  return page.evaluate(() => {
    const win = document.getElementById("win" + window._activeWindowHwnd);
    return {
      hwnd: window._activeWindowHwnd,
      dialog: win.dataset.qaDialog,
      name: win.querySelector(".control105")?.textContent.trim(),
      rating: win.querySelector(".control106")?.textContent.trim(),
      description: win.querySelector(".control107")?.textContent.trim()
    };
  });
}

async function searches(browser, saved) {
  const results = [];
  for (const mobile of [true, false]) for (const sex of ["M", "F"]) {
    const run = await openRelationship(browser, saved, mobile, sex);
    const { context, page, parent, candidateId } = run;
    try {
      const samples = [];
      for (let iteration = 0; iteration < 10; iteration++) {
        await page.locator("#win" + parent + " button.control110").click();
        await page.waitForFunction(id => document.getElementById("win" + window._activeWindowHwnd)?.dataset.qaDialog === id, candidateId);
        await page.waitForFunction(() => {
          const win = document.getElementById("win" + window._activeWindowHwnd);
          return [105,106,107].every(id => win.querySelector(".control" + id)?.textContent.trim());
        });
        const fields = await candidateFields(page);
        assert.ok(fields.name && fields.description);
        assert.match(fields.rating, /^\d+\/100$/);
        samples.push(fields);
        if (iteration === 0) await page.screenshot({ path: path.join(output, (mobile ? "mobile" : "upstream") + "-candidate-" + sex + ".png"), fullPage: true });
        await page.locator("#win" + fields.hwnd + " button.control2").click();
        await page.waitForFunction(hwnd => window._activeWindowHwnd === hwnd, parent);
      }
      // Slow only the candidate template so two taps can arrive during opening.
      await page.route("**/" + candidateId + ".inc.html", async route => { await pause(150); await route.continue(); });
      await page.locator("#win" + parent + " button.control110").dblclick({ delay: 25 });
      await page.waitForFunction(id => document.getElementById("win" + window._activeWindowHwnd)?.dataset.qaDialog === id, candidateId);
      await page.waitForTimeout(350);
      const rapid = await candidateFields(page);
      assert.ok(rapid.name && rapid.rating && rapid.description, "Double tap must retain all candidate values");
      results.push({ renderer: mobile ? "mobile" : "upstream", sex, searches: samples.length, rapid });
    } finally { await context.close(); }
  }
  console.log("PASS: 40 candidate searches and 4 delayed double taps; male and female; mobile and untouched upstream.");
  return results;
}

async function reproduceExhaustion(browser, saved) {
  const { context, page, parent, candidateId } = await openRelationship(browser, saved, false, "M");
  const log = [];
  let exhausted = false;
  try {
    outer: for (let iteration = 0; iteration < 10; iteration++) {
      await page.locator("#win" + parent + " button.control110").click();
      await page.waitForFunction(id => document.getElementById("win" + window._activeWindowHwnd)?.dataset.qaDialog === id, candidateId);
      await page.waitForTimeout(70);
      const fields = await candidateFields(page);
      log.push({ iteration, type: "candidate", ...fields });
      if (fields.hwnd === 0) { exhausted = true; break; }
      await page.locator("#win" + fields.hwnd + " button.control101").click();
      for (let continuation = 0; continuation < 16; continuation++) {
        await page.waitForTimeout(110);
        const hwnd = await page.evaluate(() => window._activeWindowHwnd);
        if (hwnd === parent) break;
        const win = page.locator("#win" + hwnd);
        const state = await win.evaluate(node => ({
          dialog: node.dataset.qaDialog,
          title: node.querySelector(".title-bar-text")?.textContent.trim(),
          text: node.innerText
        }));
        log.push({ iteration, type: "continuation", hwnd, ...state });
        if (hwnd === 0) { exhausted = true; break outer; }
        const buttons = win.locator("button.control1,button.control2,button.control6").filter({ visible: true });
        if (!await buttons.count()) throw new Error("Unknown original continuation: " + JSON.stringify(state));
        await buttons.first().click();
      }
    }
    if (exhausted) await page.screenshot({ path: path.join(output, "upstream-zero-handle.png"), fullPage: true });
    console.log(exhausted ? "KNOWN UPSTREAM BUG REPRODUCED: HWND 0 after repeated rejected approaches." : "Upstream handle failure not reached in this run.");
    return { exhausted, log };
  } finally { await context.close(); }
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (fs.existsSync(edge) ? edge : undefined) });
    const saved = await fixture(browser);
    const result = process.argv.includes("--exhaustion") ? await reproduceExhaustion(browser, saved) : await searches(browser, saved);
    fs.writeFileSync(path.join(output, process.argv.includes("--exhaustion") ? "relationships-exhaustion.json" : "relationships-summary.json"), JSON.stringify(result, null, 2));
  } finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

