/* Render the share card from an isolated fresh game's actual main screen. */
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const data = (file,type) => `data:${type};base64,${fs.readFileSync(path.join(root,file)).toString("base64")}`;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.gif':'image/gif','.ico':'image/x-icon','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
(async () => {
  const server = http.createServer((request,response) => {
    const relative = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const filename = path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
    if(!filename.startsWith(root+path.sep) || relative.split('/').some(part=>part.startsWith('.'))) {response.writeHead(404).end();return;}
    fs.readFile(filename,(error,buffer)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});response.end(buffer);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  let browser;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || (fs.existsSync(edge) ? edge : undefined)});
    const game = await browser.newPage({viewport:{width:480,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await game.goto(`http://127.0.0.1:${server.address().port}/`);
    await game.waitForFunction(()=>document.querySelector('.save-status')?.textContent==='Partita salvata');
    await game.evaluate(()=>document.fonts.ready);
    const hero = await game.locator('.hero').screenshot({type:'png'});
    const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face{font-family:Original;font-weight:bold;src:url('${data('engine/resources/css/ms_sans_serif_bold.woff2','font/woff2')}')}
      *{box-sizing:border-box}html,body{width:1200px;height:630px;margin:0;overflow:hidden;background:#808080;color:#222;font-family:Original,Arial,sans-serif}
      .window{position:absolute;inset:24px;padding:6px;display:flex;flex-direction:column;background:#d4d0c8;box-shadow:inset -2px -2px #0a0a0a,inset 2px 2px #fff,inset -4px -4px #808080,inset 4px 4px #dfdfdf}
      .title{height:56px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:4px 12px;background:#000080;color:#fff;font-size:30px;font-weight:bold}
      .title img{width:40px;height:40px;image-rendering:pixelated}
      .body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#f0f0f0}
      .game{display:block;width:912px;height:504px;image-rendering:pixelated}
    </style></head><body><main class="window"><div class="title"><img src="${data('engine/resources/icons/ZARROSIM.gif','image/gif')}" alt="">Tabboz Simulator</div><div class="body"><img class="game" src="data:image/png;base64,${hero.toString('base64')}" alt="Personaggio e statistiche di Tabboz Simulator"></div></main></body></html>`,{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(root,"app/share-preview-v1.png"),type:"png"});
    console.log("Rendered app/share-preview-v1.png (1200 x 630) from the actual character screen.");
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
