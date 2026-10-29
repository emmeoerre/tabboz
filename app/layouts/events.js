/* Compact narrative/credits views of the original dialogs. GPL-3.0-or-later. */
(() => {
  "use strict";
  const layouts = window.MobileLayouts = window.MobileLayouts || new Map();
  const el = (tag, className) => Object.assign(document.createElement(tag), { className });

  function narrative({win, body, items, byPosition}) {
    win.classList.add("event-layout");
    const used = new Set();
    const story = el("section", "event-story");
    const art = el("div", "event-story-art");
    const copy = el("div", "event-story-copy");
    const actions = el("div", "event-story-actions");
    for (const item of items.slice().sort(byPosition)) {
      if (item.node.matches("button")) actions.append(item.node);
      else if (item.node.matches("img,canvas")) art.append(item.node);
      else copy.append(item.node);
      used.add(item);
    }
    if (art.children.length) story.append(art);
    else story.classList.add("event-story-text-only");
    story.append(copy);
    body.append(story);
    if (actions.children.length) body.append(actions);
    return items.filter(item => !used.has(item));
  }

  function about({win, body, items}) {
    win.classList.add("about-layout");
    const used = new Set();
    function take(predicate) {
      const item = items.find(item => !used.has(item) && predicate(item.node));
      if (item) used.add(item);
      return item?.node;
    }
    function control(id) { return take(node => node.matches(".control" + id)); }
    function text(value) { return take(node => node.textContent.trim() === value); }
    function put(parent, ...nodes) { nodes.filter(Boolean).forEach(node => parent.append(node)); }
    const brand = el("section", "about-brand");
    const info = el("div", "about-brand-info");
    put(brand,take(node=>node.matches("img") && node.getAttribute("src").includes("SCOOTER")));
    put(info,text("Tabboz simulator 32bit"),control(115));
    put(brand,info);
    const copyright=el("div","about-copyright");
    put(copyright,take(node=>node.matches("img") && node.getAttribute("src").includes("ZEURO")),text("Copyright (C) 1997-2001 by"),control(116));
    body.append(brand,copyright);
    const logo = control(257); if (logo) {logo.classList.add("about-logo");body.append(logo);}
    const credits=el("section","about-credits");
    put(credits,text("Created by:"),control(110),control(111),control(112));
    const testers=el("section","about-testers");
    put(testers,text("Beta testers:"),text("Dino Lucci"),text("Giulio Lucci"));
    const warning=el("div","about-warning");
    put(warning,take(node=>node.matches("img") && node.getAttribute("src").includes("REDBABY")),take(node=>node.textContent.includes("Questo programma contiene")));
    const contact=el("div","about-contact");
    const originalSite=take(node=>node.textContent.trim().startsWith("http://"));
    const originalLink=el("a","about-project-link");
    originalLink.href="https://github.com/andreax79/tabboz";
    originalLink.target="_blank";
    originalLink.rel="noopener noreferrer";
    if(originalSite)originalLink.append(originalSite);
    const mobileLink=el("a","about-project-link");
    mobileLink.href="https://github.com/emmeoerre/tabboz";
    mobileLink.target="_blank";
    mobileLink.rel="noopener noreferrer";
    mobileLink.textContent="GitHub mobile: emmeoerre/tabboz";
    put(contact,originalSite?originalLink:null,mobileLink,take(node=>node.textContent.trim().startsWith("e-mail:")),control(113));
    body.append(credits,testers,warning,contact);
    return items.filter(item=>!used.has(item));
  }
  layouts.set("2",about);
  for (const id of ["95","100","101","102","103","104","105","106","107"]) layouts.set(id,narrative);
})();

