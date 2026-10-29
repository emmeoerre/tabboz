/* Game-calendar view. Dates come from the original engine, never the device clock. */
(() => {
  "use strict";

  const ROOT = "HKEY_CURRENT_USER\\Software\\Obscured Truckware\\Tabboz Simulator 32";
  const DATE_KEYS = new Set(["Giorno", "Mese", "GiornoSet"].map(key => ROOT + "\\" + key));
  // Same labels and ordering as InfoSettimana / InfoMese in engine/tempo.c.
  const weekdays = ["Lunedi'", "Martedi'", "Mercoledi'", "Giovedi'", "Venerdi'", "Sabato", "Domenica"];
  const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  let currentDate = "";
  let refreshQueued = false;

  function savedDate() {
    try {
      const read = key => Number(JSON.parse(localStorage.getItem(ROOT + "\\" + key) || "{}")[""]);
      const day = read("Giorno"), month = read("Mese"), weekday = read("GiornoSet");
      if (!Number.isInteger(day) || day < 1 || day > 31 ||
          !Number.isInteger(month) || month < 1 || month > 12 ||
          !Number.isInteger(weekday) || weekday < 1 || weekday > 7) return "";
      return weekdays[weekday - 1] + " " + day + " " + months[month - 1];
    } catch { return ""; }
  }

  function render(date) {
    if (!date) return;
    currentDate = date;
    document.querySelectorAll(".calendar-date").forEach(node => {
      if (node.textContent !== date) node.textContent = date;
    });
  }

  function refresh() { render(savedDate() || currentDate); }

  function watchMain(win) {
    const date = win.querySelector(".control157");
    if (!date) return;
    date.classList.add("calendar-date");
    date.setAttribute("aria-label", "Data di gioco");
    new MutationObserver(() => {
      if (date.textContent.trim()) render(date.textContent.trim());
    }).observe(date, { childList: true, characterData: true, subtree: true });
    render(date.textContent.trim() || savedDate() || currentDate);
  }

  function attach(win) {
    if (!win || win.querySelector(":scope > .dialog-day-strip")) return;
    const header = win.querySelector(":scope > .title-bar");
    if (!header) return;
    const strip = document.createElement("div");
    strip.className = "dialog-day-strip";
    const date = document.createElement("span");
    date.className = "calendar-date";
    date.setAttribute("aria-label", "Data di gioco");
    date.setAttribute("aria-live", "polite");
    strip.append(date);
    header.after(strip);
    render(currentDate || savedDate());
  }

  // Evento saves after an action, even while a school/shop/relationship
  // dialog is still open. Observe those existing writes without changing them.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (DATE_KEYS.has(String(key)) && !refreshQueued) {
      refreshQueued = true;
      queueMicrotask(() => {
        refreshQueued = false;
        refresh();
      });
    }
    return result;
  };

  window.MobileCalendar = { attach, watchMain, refresh };
})();

