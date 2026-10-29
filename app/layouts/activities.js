/* Compact views of original activity dialogs. GPL-3.0-or-later.
 * Original controls remain the engine's nodes; only their containers change.
 */
(() => {
  "use strict";
  const layouts = window.MobileLayouts = window.MobileLayouts || new Map();
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  };

  function context(api, kind) {
    const { win, body, items } = api;
    win.classList.add("activity-layout", "activity-" + kind);
    const used = new Set();
    const item = id => items.find(entry => !used.has(entry) &&
      (entry.node.matches(".control" + id) || entry.node.querySelector("input.control" + id)));
    const caption = (text, predicate = () => true) => items.find(entry => !used.has(entry) &&
      entry.node.textContent.trim() === text && predicate(entry));
    const take = entry => {
      if (!entry) return null;
      used.add(entry);
      return entry.node;
    };
    const control = id => take(item(id));
    const label = (text, predicate) => take(caption(text, predicate));
    const append = (parent, ...children) => {
      children.filter(Boolean).forEach(child => parent.append(child));
      return parent;
    };
    const metric = (captionNode, valueNode, extraClass = "") => {
      const result = node("div", "activity-metric " + extraClass);
      if (captionNode) append(result, append(node("div", "activity-metric-caption"), captionNode));
      if (valueNode) {
        valueNode.classList.add("activity-value");
        append(result, valueNode);
      }
      return result;
    };
    const stat = (text, id, predicate, extraClass) => metric(label(text, predicate), control(id), extraClass);
    const actions = (ids, extraClass = "") => {
      const group = node("div", "activity-actions " + extraClass);
      ids.forEach(id => {
        const action = control(id);
        if (action) { action.classList.add("activity-command"); group.append(action); }
      });
      return group;
    };
    const art = (entry, className = "") => {
      const image = take(entry);
      if (!image) return null;
      image.classList.add("activity-artwork");
      return append(node("div", "activity-art " + className), image);
    };
    const spareIcons = container => {
      items.filter(entry => !used.has(entry) && entry.node.classList.contains("mobile-icon")).forEach(entry => container.append(take(entry)));
    };
    const finish = () => {
      // Blank values are still real, live engine nodes. A dash is presentation
      // only and disappears immediately when the engine fills the field.
      const values = Array.from(body.querySelectorAll(".activity-value"));
      const update = () => values.forEach(value => {
        const empty = String(!value.textContent.trim());
        if (value.dataset.empty !== empty) value.dataset.empty = empty;
      });
      update();
      new MutationObserver(update).observe(body, { childList: true, characterData: true, subtree: true });
      return items.filter(entry => !used.has(entry));
    };
    return { ...api, used, item, caption, take, control, label, append, metric, stat, actions, art, spareIcons, finish };
  }

  function family(api) {
    const c = context(api, "family");
    const status = node("div", "activity-status activity-status-two");
    c.append(status, c.stat("Soldi:", 104), c.stat("Paghetta:", 105));
    const overview = node("div", "activity-family-status");
    c.spareIcons(overview);
    overview.append(status);
    c.body.append(overview, c.actions([101,102,103], "activity-actions-single"));
    return c.finish();
  }

  function company(api) {
    const c = context(api, "company");
    const overview = node("div", "activity-overview");
    c.append(overview, c.art(c.items.find(entry => entry.node.matches("img.mobile-art")), "activity-company-art"),
      c.stat("Reputazione:",104));
    c.body.append(overview, c.actions([101,102,103], "activity-actions-single"));
    return c.finish();
  }

  function scooter(api) {
    const c = context(api, "scooter");
    const title = c.label("Statistiche scooter");
    if (title) { title.classList.add("activity-section-title"); c.body.append(title); }
    const name = c.control(116);
    if (name) { name.classList.add("activity-value","activity-model-name"); c.body.append(name); }
    const details = node("div", "activity-status activity-status-two");
    c.append(details, c.stat("Velocita':",110), c.stat("Cilindrata:",113),
      c.stat("Efficienza:",115), c.stat("Benzina:",107));
    const balance = node("div", "activity-balance");
    c.spareIcons(balance);
    c.append(balance, c.stat("Soldi:",104));
    c.body.append(details, balance, c.actions([101,102,103,105,106]));
    return c.finish();
  }

  function relationship(api) {
    const c = context(api, "relationship");
    const overview = node("div", "activity-overview activity-relationship-overview");
    const illustration = c.items.find(entry => entry.node.matches("canvas.mobile-art,img.mobile-art"));
    c.append(overview, c.art(illustration, "activity-partner-art"));
    const facts = node("div", "activity-relationship-facts");
    c.append(facts, c.stat("Nome:",105),
      c.stat("Figosita':",106, entry => entry.y < 230),
      c.stat("Quanto stiamo bene insieme:",107));
    overview.append(facts);
    const ownFame = c.stat("Figosita':",104, entry => entry.y >= 230);
    ownFame.classList.add("activity-own-fame");
    c.spareIcons(ownFame);
    c.body.append(overview, ownFame, c.actions([110,111,112,113]));
    return c.finish();
  }

  function school(api) {
    const c = context(api, "school");
    const top = node("div", "activity-school-overview");
    c.append(top, c.art(c.items.find(entry => entry.node.matches("img.mobile-art")), "activity-school-art"));
    const total = c.stat("Profitto scolastico:",106);
    total.classList.add("activity-school-total");
    top.append(total);
    const status = node("div", "activity-status activity-status-two");
    c.append(status, c.stat("Reputazione:",105), c.stat("Soldi:",104));

    const picker = node("div", "activity-subject-picker");
    const selectLabel = node("label", "activity-subject-label", "Materia");
    const select = node("select", "activity-subject-select");
    select.id = c.win.id + "-subject";
    selectLabel.htmlFor = select.id;
    const scores = node("div", "activity-subject-scores");
    scores.setAttribute("aria-label", "Voto");
    scores.append(node("span", "activity-subject-grade-label", "Voto"));
    const source = node("div", "activity-source-controls");
    source.hidden = true;
    const subjects = [];
    for (let offset=0; offset<9; offset++) {
      const choiceEntry = c.item(110+offset);
      const score = c.control(120+offset);
      const choice = c.take(choiceEntry);
      if (!choice || !score) continue;
      const radio = choice.querySelector("input");
      const label = choice.querySelector("label");
      const option = node("option");
      option.value = String(offset);
      select.append(option);
      score.classList.add("activity-value","activity-subject-score");
      score.hidden = offset !== 0;
      scores.append(score);
      source.append(choice);
      subjects.push({ radio, label, option, score });
    }
    function synchronize() {
      const checked = subjects.findIndex(subject => subject.radio.checked);
      if (checked >= 0 && select.selectedIndex !== checked) select.selectedIndex = checked;
      subjects.forEach((subject, index) => {
        const name = subject.label.textContent.trim().replace(/:$/, "");
        const text = name;
        if (subject.option.textContent !== text) subject.option.textContent = text;
        subject.option.disabled = subject.radio.disabled;
        subject.score.hidden = index !== select.selectedIndex;
      });
      select.disabled = subjects.length > 0 && subjects.every(subject => subject.radio.disabled);
    }
    select.addEventListener("change", event => {
      event.stopPropagation();
      const subject = subjects[select.selectedIndex];
      if (subject) subject.radio.click();
      synchronize();
    });
    select.addEventListener("focus", synchronize);
    source.addEventListener("change", synchronize);
    new MutationObserver(synchronize).observe(scores, { childList:true, characterData:true, subtree:true });
    new MutationObserver(synchronize).observe(source, { childList:true, characterData:true, subtree:true });
    picker.append(selectLabel, select, scores, source);
    const actions = c.actions([103,102,101], "activity-school-actions");
    c.body.append(top, status, picker, actions);
    const extras = node("div", "activity-tiny-icons");
    c.spareIcons(extras);
    if (extras.children.length) c.body.append(extras);
    synchronize();
    requestAnimationFrame(synchronize);
    return c.finish();
  }

  function work(api) {
    const c = context(api, "work");
    const top = node("div", "activity-overview activity-work-overview");
    c.append(top, c.art(c.items.find(entry => entry.node.matches("img.mobile-art")), "activity-work-art"));
    const company = c.control(105);
    if (company) { company.classList.add("activity-value","activity-employer"); top.append(company); }
    const status = node("div", "activity-status activity-status-three");
    c.append(status, c.stat("Soldi:",104), c.stat("Impegno:",107), c.stat("Stipendio:",106));
    c.body.append(top, status, c.actions([110,116,114,111,113,112,115]));
    const extras = node("div", "activity-tiny-icons");
    c.spareIcons(extras);
    if (extras.children.length) c.body.append(extras);
    return c.finish();
  }

  function disco(api) {
    const c = context(api, "disco");
    const choices = node("div", "activity-club-choices");
    for (let id=101;id<=108;id++) {
      const choice = c.control(id);
      if (choice) choices.append(choice);
    }
    const description = c.control(120);
    if (description) description.classList.add("activity-club-description");
    const balance = node("div", "activity-balance");
    c.spareIcons(balance);
    c.append(balance, c.stat("Soldi:",110));
    c.append(c.body, choices, description, balance);
    return c.finish();
  }

  [["4",disco],["5",family],["6",company],["7",scooter],["9",relationship],["190",relationship],["10",school],["13",work]]
    .forEach(([id,layout]) => layouts.set(id,layout));
})();

