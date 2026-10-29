/* Mobile interface for the original Tabboz Simulator. GPL-3.0-or-later. */
(() => {
  "use strict";

  const STORAGE_ROOT = "HKEY_CURRENT_USER\\Software\\Obscured Truckware\\Tabboz Simulator 32";
  const welcome = document.getElementById("welcome");
  const screen = document.getElementById("screen");
  const launch = document.getElementById("launch");
  const bootStatus = document.getElementById("boot-status");
  let mainWindow = null;
  let running = false;
  let saveTimer;
  let toastTimer;
  let saving = false;
  let lastActiveWindow = null;
  let controlsReady = false;
  let runtimeReady = false;
  let engineFailed = false;
  let pendingActionTarget = null;

  function startWhenReady() {
    if (!controlsReady || !runtimeReady) return;
    launch.disabled = false;
    bootStatus.textContent = "";
    setTimeout(() => launch.click(), 0);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function take(win, id) {
    const node = win.querySelector(".control" + id);
    node.removeAttribute("style");
    return node;
  }
  function toast(text) {
    const node = document.getElementById("toast");
    node.textContent = text;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }
  function recoverFromEngineFailure() {
    if (engineFailed) return;
    engineFailed = true;
    running = false;
    clearTimeout(saveTimer);
    document.documentElement.style.overflow = "hidden";
    screen.querySelectorAll(":scope > .window").forEach(win => { win.inert = true; win.hidden = true; });
    const panel = element("div", "game-recovery");
    panel.id = "game-recovery";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-labelledby", "recovery-title");
    const title = element("h1", "", "Schermata non disponibile");
    title.id = "recovery-title";
    const message = element("p", "", "Ricarica l'ultima partita salvata per continuare.");
    const reload = element("button", "", "Ricarica partita");
    reload.type = "button";
    reload.addEventListener("click", () => location.reload());
    panel.append(title, message, reload);
    screen.append(panel);
    reload.focus();
  }

  function command(id, target = window._activeWindowHwnd) {
    if (!running || target == null) return;
    pendingActionTarget = target;
    window._PostMessage(target, 0x111, id, 0);
    window.stopWaiting();
  }

  // Flush through the original WM_ENDSESSION handler without exiting the game.
  // Original actions save after Evento; profile edits save on confirmation.
  async function saveGame(announce = false) {
    if (!running || !mainWindow?.isConnected || saving) return;
    saving = true;
    const status = mainWindow.querySelector(".save-status");
    if (status) status.textContent = "Salvataggio…";
    try {
      const mainHandle = Number(mainWindow.id.slice(3));
      if (!window.EngineBridge.flushSave(mainHandle)) {
        window._PostMessage(mainHandle, 0x16, 1, 0);
        window.stopWaiting();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_ROOT));
      if (!keys.length) throw new Error("Save not written");
      if (status) status.textContent = "Partita salvata";
      if (announce) toast("Partita salvata su questo dispositivo.");
    } catch (error) {
      if (status) status.textContent = "Salvataggio non disponibile";
      if (announce) toast("Impossibile salvare. Controlla lo spazio del browser.");
      console.error("Tabboz save:", error);
    } finally { saving = false; }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void saveGame(); }, 120);
  }
  function syncWindows() {
    if (engineFailed) return;
    const allWindows = Array.from(screen.querySelectorAll(":scope > .window"));
    const windows = allWindows.filter(win => win.style.display !== "none");
    const active = windows.find(win => win.id === "win" + window._activeWindowHwnd) || windows.at(-1);
    for (const win of allWindows) {
      const isActive = win === active;
      win.inert = !isActive;
      win.setAttribute("aria-hidden", String(!isActive));
      if (win.classList.contains("mobile-dialog") || win.classList.contains("mobile-message")) win.hidden = !isActive;
    }
    document.documentElement.style.overflow = active && active !== mainWindow ? "hidden" : "";
    if (active && active !== lastActiveWindow) {
      if (active === mainWindow) scheduleSave();
      else active.querySelector(".mobile-dialog-body")?.focus({ preventScroll: true });
    }
    lastActiveWindow = active;
    if (!windows.length && mainWindow && !mainWindow.isConnected) {
      running = false;
      mainWindow = null;
      screen.hidden = true;
      welcome.hidden = false;
      launch.disabled = false;
      launch.textContent = "Gioca";
      launch.hidden = false;
    }
  }
  function makeStat(win, controlId, label, type) {
    const stat = element("div", "stat " + (type || ""));
    stat.append(element("span", "stat-label", label));
    const value = take(win, controlId);
    value.classList.add("stat-value");
    const track = element("div", "stat-track");
    track.setAttribute("aria-hidden", "true");
    track.append(element("div", "stat-fill"));
    stat.append(value, track);
    return stat;
  }
  function appPage(name) {
    const page = element("section", "app-page");
    page.id = "page-" + name;
    page.setAttribute("role", "tabpanel");
    page.setAttribute("aria-labelledby", "tab-" + name);
    page.hidden = name !== "home";
    return page;
  }
  function addDestination(list, title, icon, id) {
    const button = element("button", "control" + id + " destination-button");
    button.type = "button";
    button.setAttribute("aria-label", title);
    const image = element("img");
    image.src = "resources/icons/" + icon + ".gif";
    image.alt = "";
    button.append(image, element("span", "", title));
    list.append(button);
  }
  function addOption(list, title, id, onClick) {
    const button = element("button", (id ? "control" + id + " " : "") + "option-button", title);
    button.type = "button";
    button.setAttribute("aria-label", title);
    if (onClick) button.addEventListener("click", onClick);
    list.append(button);
  }

  function prepareMain(win) {
    mainWindow = win;
    win.dataset.dialog = "1";
    win.classList.add("mobile-main");
    win.setAttribute("role", "main");
    win.setAttribute("aria-label", "Tabboz Simulator");
    const originalBody = Array.from(win.children).find(node => node.className.startsWith("window-body"));
    const title = win.querySelector(".title-bar-text");
    const oldTitleBar = win.querySelector(".title-bar");
    oldTitleBar.className = "app-header";
    const headerOptions = element("button", "control140 header-action", "Opzioni");
    headerOptions.type = "button";
    oldTitleBar.replaceChildren(title, headerOptions);
    const content = element("div", "main-content");
    const home = appPage("home");
    const shops = appPage("shops");
    const options = appPage("options");
    const day = element("div", "day-strip");
    day.append(take(win,157), element("span", "save-status", "Salvataggio…"));
    content.append(day);
    const identity = element("div", "identity");
    const name = element("div", "identity-name");
    name.append(element("span", "label", "NOME"), take(win,102));
    const balance = element("div", "balance");
    balance.append(element("span", "label", "SOLDI"), take(win,105));
    identity.append(name, balance);
    const hero = element("div", "hero");
    const portrait = element("div", "portrait");
    const canvas = take(win,103);
    canvas.setAttribute("aria-label", "Il tuo personaggio con i vestiti e gli accessori attuali");
    portrait.append(canvas);
    const stats = element("div", "status-column");
    stats.append(makeStat(win,152,"Reputazione"), makeStat(win,151,"Figosita'"), makeStat(win,153,"Profitto scolastico","stat-school"));
    const relationship = element("div", "detail relationship-detail");
    relationship.append(take(win,170), take(win,155), take(win,154), element("span", "empty-detail", "Nessuna storia"));
    const scooter = element("div", "detail scooter-detail");
    scooter.append(element("span", "detail-label", "Scooter"), take(win,150), take(win,156), element("span", "empty-detail", "Ancora a piedi"));
    stats.append(relationship, scooter);
    hero.append(portrait, stats);
    const activityHeading = element("div", "section-heading");
    activityHeading.append(element("h2", "", "Attività"));
    const activities = element("div", "activity-grid");
    const actionIcons = {130:"SCOOTER",131:"ZCOMUNE",132:"ZDISCO",136:"ZSCUOLA",137:"ZLAVORO2",133:"ZTIPA",134:"ZNET",135:"ZFAMIGLIA"};
    for (const id of [130,131,132,136,137,133,134,135]) {
      const button = take(win,id);
      button.classList.add("activity-button");
      button.type = "button";
      button.style.setProperty("--activity-icon", "url('" + new URL("resources/icons/" + actionIcons[id] + ".gif", document.baseURI).href + "')");
      activities.append(button);
    }
    home.append(identity, hero, activityHeading, activities);
    shops.append(element("h1", "page-heading", "Negozi"));
    const destinations = element("div", "destination-list");
    for (const [shopName, icon, id] of [
      ["Bau House","Z1",143],["Blue Rider","Z1",147],["Zoccolaro","Z1",144],
      ["Footsmocker","Z1",145],["Footsmocker II","Z1",146],
      ["Bar Tabacchi","ZTABACCHI",141],["Palestra","ZPALESTRA",142],["Telefonino","ZTELEFONO",155]
    ]) addDestination(destinations, shopName, icon, id);
    shops.append(destinations);
    options.append(element("h1", "page-heading", "Opzioni"));
    const personGroup = element("div", "option-group");
    personGroup.append(element("h3", "", "Personaggio"));
    addOption(personGroup, "Informazioni personali", 139);
    addOption(personGroup, "Configurazione", 140);
    const saveGroup = element("div", "option-group save-options");
    saveGroup.append(element("h3", "", "Partita su questo dispositivo"));
    addOption(saveGroup, "Salva ora", null, () => { void saveGame(true); });
    addOption(saveGroup, "Esporta partita", null, exportGame);
    addOption(saveGroup, "Importa partita", null, () => document.getElementById("import-file").click());
    saveGroup.append(element("p", "options-note", "La partita si salva automaticamente. Esportala per conservarne una copia o trasferirla su un altro telefono."));
    const credits = element("div", "option-group");
    credits.append(element("h3", "", "Obscured Truckware"));
    addOption(credits, "Crediti", 120);
    addOption(credits, "Logo", 121);
    const note = element("p", "options-note", "Tabboz Simulator 0.92q · Andrea Bonomi, Emanuele Caccialanza e Daniele Gazzari. ");
    const sourceLink = element("a", "", "Codice e licenze");
    sourceLink.href = "../NOTICE.md";
    sourceLink.target = "_blank";
    note.append(sourceLink);
    credits.append(note);
    options.append(personGroup, saveGroup, credits);
    content.append(home, shops, options);
    const nav = element("nav", "app-nav");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Navigazione principale");
    for (const [tabName, label, icon] of [["home","Il Tabboz","ZARROSIM"],["shops","Negozi","ZCOMUNE"],["options","Altro","AICON"]]) {
      const button = element("button", "", label);
      button.id = "tab-" + tabName;
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(tabName === "home"));
      button.setAttribute("aria-controls", "page-" + tabName);
      button.style.setProperty("--nav-icon", "url('" + new URL("resources/icons/" + icon + ".gif", document.baseURI).href + "')");
      button.addEventListener("click", () => {
        for (const page of content.querySelectorAll(".app-page")) page.hidden = page.id !== "page-" + tabName;
        for (const tab of nav.children) tab.setAttribute("aria-selected", String(tab === button));
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      nav.append(button);
    }
    win.append(content, nav);
    originalBody.remove();
    window.MobileCalendar.watchMain(win);
    const updateMeters = () => {
      for (const stat of stats.querySelectorAll(".stat")) {
        const value = parseInt(stat.querySelector(".stat-value").textContent, 10) || 0;
        stat.style.setProperty("--value", Math.max(0, Math.min(100, value)) + "%");
      }
      relationship.classList.toggle("has-value", Boolean(relationship.querySelector(".control155").textContent.trim()));
      scooter.classList.toggle("has-value", Boolean(scooter.querySelector(".control150").textContent.trim()));
    };
    new MutationObserver(updateMeters).observe(stats, { childList: true, subtree: true, characterData: true });
    updateMeters();
  }


  // Once a command has finished and the engine is waiting for its next
  // input, flush through its original save callback. The shipped build can
  // otherwise keep calendar changes only in memory until returning home.
  const originalWait = window.waitEvent;
  window.waitEvent = function() {
    const waiting = originalWait();
    queueMicrotask(() => {
      if (!running || !mainWindow || pendingActionTarget == null) return;
      if (window._activeWindowHwnd !== pendingActionTarget && document.getElementById("win" + pendingActionTarget)) return;
      if (window.EngineBridge.flushSave(Number(mainWindow.id.slice(3)))) {
        pendingActionTarget = null;
        window.MobileCalendar.refresh();
      }
    });
    return waiting;
  };

  // Intercept the HTML boundary; the original C/WASM still owns game rules.
  const originalDialog = window.dialogBox;
  window.dialogBox = async function(hWnd, dialog, parentWindowId, hInstance) {
    if (hWnd === 0) {
      recoverFromEngineFailure();
      // Keep the broken engine suspended until reload; do not resume C with
      // an invalid resource and risk overwriting the last committed save.
      return new Promise(() => {});
    }
    await originalDialog(hWnd, dialog, parentWindowId, hInstance);
    const win = document.getElementById("win" + hWnd);
    if (!win) return;
    if (String(dialog) === "12" && !mainWindow) {
      win.hidden = true;
      setTimeout(() => command(202, hWnd), 0);
      return;
    }
    if (String(dialog) === "1") prepareMain(win);
    else {
      window.MobileDialogs.prepare(win, String(dialog));
      window.MobileCalendar.attach(win);
    }
    syncWindows();
    requestAnimationFrame(syncWindows);
  };
  const originalMessage = window.messageBox;
  window.messageBox = async function(...args) {
    if (args[0] === 0) {
      recoverFromEngineFailure();
      return new Promise(() => {});
    }
    await originalMessage(...args);
    const win = document.getElementById("win" + args[0]);
    if (win) {
      window.MobileDialogs.prepareMessage(win);
      window.MobileCalendar.attach(win);
    }
    syncWindows();
  };
  const originalDestroy = window.destroyWindow;
  window.destroyWindow = function(hWnd) {
    originalDestroy(hWnd);
    queueMicrotask(syncWindows);
  };
  const originalActive = window.setActiveWindow;
  window.setActiveWindow = function(hWnd) {
    originalActive(hWnd);
    queueMicrotask(syncWindows);
  };
  const originalMove = window.moveWindow;
  window.moveWindow = function(hWnd, ...args) {
    if (document.getElementById("win" + hWnd)?.matches(".mobile-main,.mobile-dialog,.mobile-message")) return true;
    return originalMove(hWnd, ...args);
  };

  // Labels, nested icons and disabled controls resolve to the actual Win32
  // control. No duplicate command on touch, keyboard or radio selection.
  window.eventListenerSetup = function() {
    function dispatch(event) {
      if (event.defaultPrevented) return;
      const target = event.target.closest("[class]");
      if (!target) return;
      const control = target.closest(".dlg_item,button[class*='control'],li[class*='menu']");
      if (!control || control.closest("[inert]") || control.disabled || control.classList.contains("disabled")) return;
      const match = control.className.match(/(?:control|menu)(\d+)/);
      if (!match || Number(match[1]) === 0) return;
      const id = Number(match[1]);
      if (event.type === "input" || event.type === "change") {
        if (control.matches("input[type='checkbox'],input[type='radio']") && event.type !== "change") return;
        if (!control.matches("input[type='checkbox'],input[type='radio']") && event.type !== "input") return;
      } else if (control.matches("input[type='checkbox'],input[type='radio']")) {
        return;
      } else if (control.matches("input,select,textarea") && event.type === "click") {
        return;
      }
      if (event.type === "click" && control.tagName === "CANVAS") {
        const rect = control.getBoundingClientRect();
        const x = Math.round((event.clientX - rect.left) * control.width / rect.width);
        const y = Math.round((event.clientY - rect.top) * control.height / rect.height);
        window._PostMessage(window._activeWindowHwnd, 0x111, id, ((y & 0xffff) << 16) + (x & 0xffff));
        window.stopWaiting();
      } else command(id);
    }
    document.body.addEventListener("click", dispatch);
    document.body.addEventListener("input", dispatch);
    document.body.addEventListener("change", dispatch);
    document.body.addEventListener("keydown", event => {
      if (event.key === "Tab" && running) {
        const win = document.getElementById("win" + window._activeWindowHwnd);
        if (win && win !== mainWindow) {
          const focusable = Array.from(win.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']")).filter(node => node.getClientRects().length);
          const first = focusable[0], last = focusable.at(-1);
          if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
            event.preventDefault(); first?.focus();
          }
        }
      }
      if (event.key === "Escape" && running) {
        window._PostMessage(window._activeWindowHwnd, 0x100, 0x1b, 0);
        window.stopWaiting();
      }
    });
    controlsReady = true;
    startWhenReady();
  };

  async function exportGame() {
    await saveGame();
    const registry = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_ROOT)) registry[key] = localStorage.getItem(key);
    }
    if (!Object.keys(registry).length) return toast("Non c'è ancora una partita da esportare.");
    const backup = { format: "tabboz-mobile-save", version: 1, engine: "0.92q", exportedAt: new Date().toISOString(), registry };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = element("a");
    link.href = url;
    link.download = "tabboz-partita-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Copia della partita esportata.");
  }

  document.getElementById("import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("File troppo grande.");
      const backup = JSON.parse(await file.text());
      if (backup.format !== "tabboz-mobile-save" || backup.version !== 1 || !backup.registry || typeof backup.registry !== "object") throw new Error("Formato non riconosciuto.");
      const entries = Object.entries(backup.registry);
      if (!entries.length || entries.length > 300) throw new Error("Partita non valida.");
      for (const [key, value] of entries) {
        if (!(key === STORAGE_ROOT || key.startsWith(STORAGE_ROOT + "\\")) || typeof value !== "string" || value.length > 8192) throw new Error("Partita non valida.");
        const data = JSON.parse(value);
        if (!data || typeof data !== "object" || Array.isArray(data) || Object.values(data).some(item => typeof item !== "string")) throw new Error("Partita non valida.");
      }
      if (!window.confirm("Sostituire la partita su questo dispositivo con quella importata?")) return;
      await saveGame();
      clearTimeout(saveTimer);
      const previous = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_ROOT)).map(key => [key, localStorage.getItem(key)]);
      running = false;
      try {
        for (const [key] of previous) localStorage.removeItem(key);
        for (const [key, value] of entries) localStorage.setItem(key, value);
      } catch (error) {
        for (const [key] of entries) localStorage.removeItem(key);
        for (const [key, value] of previous) localStorage.setItem(key, value);
        running = true;
        throw error;
      }
      location.reload();
    } catch (error) {
      toast("Impossibile importare: " + error.message);
    }
  });

  launch.addEventListener("click", () => {
    if (running || launch.disabled) return;
    running = true;
    launch.disabled = true;
    welcome.hidden = true;
    screen.hidden = false;
    window._WinMainStartup();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) void saveGame(); });
  window.addEventListener("pagehide", () => { if (running) void saveGame(); });

  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    return nativePlay.apply(this, args).catch(error => {
      if (error.name !== "NotAllowedError") throw error;
    });
  };
  window.Module = {
    postRun: () => {
      window.EngineBridge.install();
      runtimeReady = true;
      startWhenReady();
    },
    print: text => console.debug(text),
    printErr: text => console.error(text),
    onAbort: () => {
      bootStatus.textContent = "Il gioco non si è caricato. Ricarica la pagina per riprovare.";
      launch.disabled = true;
    }
  };
  const engineScript = document.createElement("script");
  engineScript.src = "../runtime/build/tabboz.js";
  engineScript.async = true;
  engineScript.onerror = () => { bootStatus.textContent = "Connessione interrotta. Ricarica per riprovare."; };
  document.body.append(engineScript);
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("../service-worker.js", document.baseURI)).catch(error => console.debug("Offline cache:", error));
    });
  }
})();

