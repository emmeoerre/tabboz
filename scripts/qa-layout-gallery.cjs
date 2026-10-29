const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const before = process.argv.includes("--before");
const output = path.resolve("artifacts/layouts/" + (before ? "before" : "after"));
const ids = fs.readdirSync("engine/resources/dialogs/includes").map(name => /^(\d+)\.inc\.html$/.exec(name)?.[1]).filter(id => id && id !== "1").sort((a,b) => Number(a)-Number(b));
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
(async () => {
 let browser;
 const all = [], errors = [];
 try {
  browser = await chromium.launch({ headless:true, executablePath:process.env.BROWSER_EXECUTABLE || (fs.existsSync(edge) ? edge : undefined) });
  for (const [width,height] of [[320,568],[360,640],[390,700]]) {
   const directory = path.join(output, width + "x" + height);
   fs.mkdirSync(directory, { recursive: true });
   const page = await browser.newPage({ viewport:{ width,height }, isMobile:true, hasTouch:true });
   page.on("pageerror", error => errors.push(error.message));
   await page.goto(process.env.TABBOZ_URL || "http://localhost:4173/");
   await page.waitForFunction(() => document.querySelector(".save-status")?.textContent === "Partita salvata" && document.querySelector(".day-strip .calendar-date")?.textContent.trim());
   const date = await page.locator(".day-strip .calendar-date").innerText();
   await page.evaluate(disable => {
     document.body.innerHTML = '<div id="screen"></div>';
     if (disable) window.MobileLayouts = new Map();
   }, before);
   const results=[];
   for (const id of ids) {
    const result = await page.evaluate(async id => {
      const response = await fetch("resources/dialogs/includes/" + id + ".inc.html");
      const html = await response.text();
      const template = document.createElement("template"); template.innerHTML = html.trim();
      const win = template.content.firstElementChild; win.id = "audit-" + id;
      const originals = Array.from(win.querySelectorAll(".dlg_item"));
      document.getElementById("screen").replaceChildren(win);
      window.MobileDialogs.prepare(win,id); window.MobileCalendar.attach(win);
      const body=win.querySelector(".mobile-dialog-body");
      const nested = Array.from(body.querySelectorAll("*")).filter(node => node.clientHeight > 40 && node.scrollHeight > node.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(node).overflowY));
      const clipped = originals.filter(node => {
        const rect=node.getBoundingClientRect();
        if (!rect.width || !rect.height || getComputedStyle(node).opacity === "0") return false;
        for(let parent=node.parentElement;parent && parent!==body;parent=parent.parentElement) {
          const style=getComputedStyle(parent), box=parent.getBoundingClientRect();
          if (/hidden|clip/.test(style.overflowX) && (rect.left<box.left-2 || rect.right>box.right+2)) return true;
          if (/hidden|clip/.test(style.overflowY) && (rect.top<box.top-2 || rect.bottom>box.bottom+2)) return true;
        }
        return false;
      }).map(node=>node.className);
      return {
        id, width:innerWidth, height:innerHeight, title:win.querySelector(".title-bar-text").textContent.trim(),
        bodyHeight:body.clientHeight, contentHeight:body.scrollHeight, scroll:Math.max(0,body.scrollHeight-body.clientHeight),
        horizontal:document.documentElement.scrollWidth-innerWidth,
        date:win.querySelector(".calendar-date")?.textContent,
        nestedScroll:nested.map(node => ({class:node.className,height:node.clientHeight,scroll:node.scrollHeight})),
        controls:originals.length, lostControls:originals.filter(node=>!win.contains(node)).length, clipped
      };
    },id);
    assert.equal(result.date,date,"Original calendar retained in dialog " + id);
    await page.screenshot({path:path.join(directory,id+".png")});
    results.push(result);
   }
   fs.writeFileSync(path.join(directory,"screens.json"),JSON.stringify(results,null,2));
   all.push(...results);
   await page.close();
  }
  fs.writeFileSync(path.join(output,"screens.json"),JSON.stringify(all,null,2));
  const summary={screens:all.length,lostControls:all.filter(r=>r.lostControls),horizontal:all.filter(r=>r.horizontal>1),clipped:all.filter(r=>r.clipped.length),scrolling:all.filter(r=>r.scroll>2).map(r=>({id:r.id,width:r.width,title:r.title,extra:r.scroll})),errors};
  console.log(JSON.stringify(summary,null,2));
  assert.deepEqual(summary.lostControls,[],"Every original control remains connected");
  assert.deepEqual(summary.horizontal,[],"No horizontal overflow");
  assert.deepEqual(summary.clipped,[],"No original control clipped by compact containers");
  assert.deepEqual(errors,[],"No page errors");
 } finally { if(browser) await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
