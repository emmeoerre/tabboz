/* Responsive view adapter for original Tabboz dialogs.
 * Game controls and their Win32 command identifiers remain the original nodes.
 * Copyright (c) 2026. Distributed under GPL-3.0-or-later with this project.
 */
(function (global) {
  'use strict';

  const POSITION_PROPERTIES = ['position', 'left', 'right', 'top', 'bottom', 'width', 'height', 'margin'];
  const PRODUCT_DIALOGS = new Set(['80', '81', '82', '83', '84', '85', '86']);
  const ART_ACTIONS = {
    '2': {257: 'Logo originale Obscured Truckware'},
    '12': {202: 'Continua'},
    '14': {203: 'Nuovo personaggio'},
  };
  const byPosition = (a, b) => a.y - b.y || a.x - b.x;

  function bodyOf(win) {
    return Array.from(win.children).find(node =>
      Array.from(node.classList).some(name => name.startsWith('window-body'))
    );
  }

  function clearPosition(node) {
    POSITION_PROPERTIES.forEach(property => node.style.removeProperty(property));
  }

  function isDecorative(node) {
    return node.getAttribute('data-class') === 'BorShade' ||
      /(?:horizontal|vertical)_bump/.test(node.className);
  }

  function itemOf(node) {
    return {
      node,
      x: parseFloat(node.style.left) || 0,
      y: parseFloat(node.style.top) || 0,
      w: parseFloat(node.style.width) || parseFloat(node.getAttribute('width')) || 0,
      h: parseFloat(node.style.height) || parseFloat(node.getAttribute('height')) || 0,
    };
  }

  function normalize(node, item, dialogId) {
    if (isDecorative(node)) {
      node.classList.add('mobile-decoration');
      return;
    }
    clearPosition(node);
    node.classList.add('mobile-control');
    // Generated templates contain layout newlines inside every control.
    // Remove only surrounding whitespace so empty values do not become rows.
    if (!node.children.length && !node.matches('input, img, canvas')) {
      node.textContent = node.textContent.trim();
    } else {
      Array.from(node.childNodes).filter(child => child.nodeType === 3 && !child.textContent.trim()).forEach(child => child.remove());
    }
    // An underlined accelerator is presentation only; direct text also makes
    // touch events reach the original command-bearing button or label.
    node.querySelectorAll('span.hotkey').forEach(span => span.replaceWith(span.textContent));
    if (node.matches('input[type="text"], select, textarea')) {
      node.classList.add('mobile-input');
    }
    const choice = node.querySelector('input[type="radio"], input[type="checkbox"]');
    if (choice) {
      node.classList.add('mobile-choice');
      const label = node.querySelector('label');
      if (label) label.classList.add('mobile-choice-label');
    }
    if (node.matches('button')) {
      node.classList.add('mobile-action');
      node.type = 'button';
      if (node.classList.contains('button_ok')) {
        node.textContent = 'OK';
        node.setAttribute('aria-label', 'OK');
        node.classList.add('mobile-confirm');
      } else if (node.classList.contains('button_cancel')) {
        node.textContent = 'Annulla';
        node.setAttribute('aria-label', 'Annulla');
      }
    }
    if (node.matches('img, canvas')) {
      node.classList.add(item.w <= 40 && item.h <= 40 ? 'mobile-icon' : 'mobile-art');
      if (node.tagName === 'IMG') {
        if (item.w) node.width = item.w;
        if (item.h) node.height = item.h;
        if (!node.hasAttribute('alt')) node.alt = '';
        const controlId = node.className.match(/control(\d+)/)?.[1];
        const actionLabel = ART_ACTIONS[String(dialogId)]?.[controlId];
        if (actionLabel) {
          node.tabIndex = 0;
          node.setAttribute('role', 'button');
          node.setAttribute('aria-label', actionLabel);
          node.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              node.click();
            }
          });
        }
      }
    }
    // Original disabled fields keep their display and disabled state.
    node.querySelectorAll('select, input[type="text"], textarea').forEach(clearPosition);
  }

  function addRows(destination, items) {
    const ordered = items.slice().sort(byPosition);
    const rows = [];
    for (const item of ordered) {
      const isImage = item.node.matches('img, canvas') && !item.node.classList.contains('mobile-icon');
      const isButton = item.node.matches('button');
      const standalone = isImage || isButton || item.h > 42 ||
        item.node.matches('fieldset') || item.node.querySelector('select');
      let row = !standalone && rows.findLast(candidate =>
        !candidate.standalone && Math.abs(candidate.y - item.y) <= 5
      );
      if (!row) {
        row = {y: item.y, standalone, items: []};
        rows.push(row);
      }
      row.items.push(item);
    }
    rows.sort((a, b) => a.y - b.y || a.items[0].x - b.items[0].x);
    // A desktop dialog can put action buttons beside a long radio list. Keep
    // each named choice group together before those actions on the phone.
    const radioGroups = new Map();
    for (const row of rows) {
      const radio = row.items.map(item => item.node.querySelector('input[type=radio][name]')).find(Boolean);
      if (!radio) continue;
      row.radioGroup = radio.name;
      if (!radioGroups.has(radio.name)) radioGroups.set(radio.name, []);
      radioGroups.get(radio.name).push(row);
    }
    const coherentRows = [];
    const visitedGroups = new Set();
    for (const row of rows) {
      if (!row.radioGroup) coherentRows.push(row);
      else if (!visitedGroups.has(row.radioGroup)) {
        visitedGroups.add(row.radioGroup);
        coherentRows.push(...radioGroups.get(row.radioGroup));
      }
    }
    for (const row of coherentRows) {
      const group = document.createElement('div');
      group.className = 'mobile-row';
      const sorted = row.items.sort((a, b) => a.x - b.x);
      const hasChoice = sorted.some(item => item.node.classList.contains('mobile-choice'));
      if (hasChoice) group.classList.add('mobile-choice-row');
      if (sorted.length === 2 && !hasChoice && sorted.every(item => !item.node.matches('img, canvas, button'))) {
        group.classList.add('mobile-pair');
      }
      if (sorted.some(item => item.node.classList.contains('mobile-art'))) group.classList.add('mobile-art-row');
      if (sorted.some(item => item.node.matches('button'))) group.classList.add('mobile-action-row');
      sorted.forEach(item => group.appendChild(item.node));
      const field = group.querySelector('input[type="text"], select, textarea');
      if (field && !field.hasAttribute('aria-label')) {
        const caption = sorted.find(item => item.node !== field && item.node.textContent.trim());
        if (caption) field.setAttribute('aria-label', caption.node.textContent.trim());
      }
      destination.appendChild(group);
    }
  }

  function addProducts(body, items) {
    const images = items.filter(item => item.node.classList.contains('mobile-art')).sort((a, b) => a.x - b.x);
    if (images.length < 2) return items;
    const footerY = Math.min(...items.filter(item => item.node.classList.contains('button_ok')).map(item => item.y));
    const products = document.createElement('div');
    products.className = 'mobile-products';
    const used = new Set();
    images.forEach((image, index) => {
      const from = index === 0 ? -Infinity : (images[index - 1].x + image.x) / 2;
      const to = index === images.length - 1 ? Infinity : (image.x + images[index + 1].x) / 2;
      const column = items.filter(item => item.y < footerY && item.x >= from && item.x < to && !item.node.matches('button'));
      const card = document.createElement('section');
      card.className = 'mobile-product';
      column.sort(byPosition).forEach(item => {
        card.appendChild(item.node);
        used.add(item);
      });
      products.appendChild(card);
    });
    body.appendChild(products);
    return items.filter(item => !used.has(item));
  }

  function addTobacco(body, items) {
    // Original SizeMem order and spelling from engine/vestiti.c. Prices and
    // product effects continue to come from the engine's selection handler.
    const names = ["Barclay", "Camel", "Davidoff Superior Lights", "Davidoff Mildnes", "Davidoff Classic", "Diana Blu", "Diana Rosse", "Dunhill Lights", "Merit", "Gauloises Blu", "Gauloises Rosse", "Unlucky Strike", "Unlucky Strike Lights", "Malborro Medium", "Malborro Rosse", "Malborro Lights", "NS Rosse", "NS Mild", "Poll Mon Blu", "Poll Mon Rosse", "Philip Morris", "Philip Morris Super Light", "Armadis", "Winston"];
    const used = new Set();
    const status = document.createElement('div');
    status.className = 'mobile-row mobile-tobacco-status';
    const statusItems = items.filter(item => item.node.matches('.control104,.control105') || /^(Soldi:|Sizze:)$/.test(item.node.textContent.trim())).sort((a, b) => a.x - b.x);
    statusItems.forEach(item => { status.append(item.node); used.add(item); });
    body.append(status);
    const description = items.find(item => item.node.matches('.control106'));
    if (description) {
      description.node.classList.add('mobile-tobacco-description');
      description.node.setAttribute('aria-live', 'polite');
      body.append(description.node);
      used.add(description);
    }
    const gallery = document.createElement('div');
    gallery.className = 'mobile-tobacco-brands';
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-label', 'Sigarette');
    names.forEach((name, index) => {
      const item = items.find(candidate => candidate.node.matches('img.control' + (400 + index)));
      if (!item) return;
      const image = item.node;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-brand-button';
      button.setAttribute('aria-label', name);
      button.setAttribute('aria-pressed', 'false');
      const label = document.createElement('span');
      label.className = 'mobile-brand-name';
      label.textContent = name;
      button.append(image, label);
      button.addEventListener('click', event => {
        gallery.querySelectorAll('button').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
        if (event.target !== image) {
          event.stopPropagation();
          image.click();
        }
      });
      gallery.append(button);
      used.add(item);
    });
    body.append(gallery);
    items.filter(item => item.node.classList.contains('mobile-icon')).forEach(item => {
      item.node.hidden = true;
      body.append(item.node);
      used.add(item);
    });
    return items.filter(item => !used.has(item));
  }

  function addCandidate(body, items) {
    const used = new Set();
    const card = document.createElement('section');
    card.className = 'mobile-candidate-card';
    const facts = document.createElement('div');
    facts.className = 'mobile-candidate-facts';
    const captions = [
      {id: 105, labels: ['Nome:']},
      {id: 106, labels: ["Figosita':"]},
      {id: 107, labels: ['Giudizio', 'Complessivo:']},
    ];
    captions.forEach(({id, labels}) => {
      const field = document.createElement('div');
      field.className = 'mobile-candidate-field';
      const caption = document.createElement('div');
      caption.className = 'mobile-candidate-caption';
      labels.forEach(text => {
        const item = items.find(candidate => candidate.node.textContent.trim() === text);
        if (item) { caption.append(item.node); used.add(item); }
      });
      const value = items.find(candidate => candidate.node.matches('.control' + id));
      field.append(caption);
      if (value) {
        value.node.classList.add('mobile-candidate-value');
        field.append(value.node);
        used.add(value);
      }
      facts.append(field);
    });
    const portrait = document.createElement('div');
    portrait.className = 'mobile-candidate-portrait';
    items.filter(item => item.node.matches('img, canvas')).forEach(item => {
      portrait.append(item.node);
      used.add(item);
    });
    card.append(facts, portrait);
    body.append(card);
    const actions = document.createElement('div');
    actions.className = 'mobile-candidate-actions';
    for (const id of [101, 2]) {
      const action = items.find(item => item.node.matches('button.control' + id));
      if (action) { actions.append(action.node); used.add(action); }
    }
    body.append(actions);
    return items.filter(item => !used.has(item));
  }

  function prepare(win, dialogId) {
    if (!win || String(dialogId) === '1' || win.dataset.mobilePrepared) return win;
    const body = bodyOf(win);
    if (!body) return win;
    win.dataset.mobilePrepared = 'true';
    win.dataset.dialogId = String(dialogId);
    win.classList.add('mobile-dialog');
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'true');
    clearPosition(win);
    body.className = 'window-body mobile-dialog-body';
    body.setAttribute('tabindex', '-1');
    const heading = win.querySelector('.title-bar-text');
    if (heading) {
      heading.id = win.id + '-title';
      win.setAttribute('aria-labelledby', heading.id);
    }
    let close = win.querySelector('.title-bar-controls .control61536');
    if (!close) {
      const originalExit = win.querySelector('button.button_cancel, button.button_ok');
      const controls = win.querySelector('.title-bar-controls');
      if (originalExit && controls && String(dialogId) !== '12') {
        close = document.createElement('button');
        close.className = 'mobile-back';
        close.type = 'button';
        close.addEventListener('click', event => {
          event.stopPropagation();
          originalExit.click();
        });
        controls.appendChild(close);
      }
    }
    if (close) {
      close.setAttribute('aria-label', 'Indietro');
      close.setAttribute('title', 'Indietro');
      close.textContent = '←';
    }
    const menu = win.querySelector('#menubar, .menubar');
    if (menu && !menu.textContent.trim()) menu.hidden = true;
    let items = Array.from(body.children).map(itemOf);
    items.forEach(item => normalize(item.node, item, dialogId));
    const decorations = items.filter(item => isDecorative(item.node));
    items = items.filter(item => !isDecorative(item.node));
    const footerItems = items.filter(item => item.node.matches('button') &&
      (item.node.classList.contains('button_ok') || item.node.classList.contains('button_cancel')));
    const footer = document.createElement('div');
    footer.className = 'mobile-dialog-actions';
    footerItems.sort((a, b) => a.x - b.x).forEach(item => footer.appendChild(item.node));
    items = items.filter(item => !footerItems.includes(item));
    body.replaceChildren();
    const customLayout = global.MobileLayouts?.get(String(dialogId));
    if (customLayout) {
      items = customLayout({win, dialogId: String(dialogId), body, items, footer, footerItems, addRows, byPosition});
    } else if (String(dialogId) === '88') {
      items = addTobacco(body, items);
    } else if (String(dialogId) === '91' || String(dialogId) === '191') {
      items = addCandidate(body, items);
    } else if (PRODUCT_DIALOGS.has(String(dialogId))) {
      items = addProducts(body, items.concat(footerItems)).filter(item => !footerItems.includes(item));
    } else {
      // Desktop dialogs often put a picture beside a long form. Give that
      // picture one coherent place above the form in the phone layout.
      const artwork = items.filter(item => item.node.classList.contains('mobile-art'));
      addRows(body, artwork);
      items = items.filter(item => !artwork.includes(item));
    }
    addRows(body, items);
    if (footerItems.length) body.appendChild(footer);
    decorations.forEach(item => body.appendChild(item.node));
    if (String(dialogId) === '11') {
      const names = {101:'Cognome', 102:'Nome', 105:'Luogo di nascita', 107:'Indirizzo', 111:'Città di residenza'};
      Object.entries(names).forEach(([id, label]) => {
        const field = win.querySelector('input.control' + id);
        if (field) field.setAttribute('aria-label', label);
      });
    }
    if (String(dialogId) === '14') {
      const reset = win.querySelector('img.control203');
      if (reset) {
        reset.hidden = true;
        reset.tabIndex = -1;
        reset.setAttribute('aria-hidden', 'true');
        reset.classList.add('mobile-reset-source');
        const resetLabel = Array.from(body.querySelectorAll('.mobile-control')).find(node => node.textContent.trim() === 'reset');
        if (resetLabel) resetLabel.hidden = true;
        const row = document.createElement('div');
        row.className = 'mobile-row mobile-action-row';
        const newCharacter = document.createElement('button');
        newCharacter.type = 'button';
        newCharacter.className = 'mobile-action mobile-new-character';
        newCharacter.textContent = 'Nuovo personaggio';
        newCharacter.addEventListener('click', event => {
          event.stopPropagation();
          reset.click();
        });
        row.appendChild(newCharacter);
        body.insertBefore(row, footerItems.length ? footer : null);
      }
    }
    if (String(dialogId) === '12') {
      win.classList.add('mobile-splash');
      if (heading) heading.textContent = 'Tabboz Simulator';
      const image = win.querySelector('img.control202');
      if (image) {
        image.alt = 'Logo originale di Tabboz Simulator';
        image.setAttribute('aria-label', 'Continua');
        const row = document.createElement('div');
        row.className = 'mobile-splash-action';
        const proceed = document.createElement('button');
        proceed.type = 'button';
        proceed.className = 'mobile-action mobile-confirm';
        proceed.textContent = 'Continua';
        proceed.addEventListener('click', event => {
          event.stopPropagation();
          image.click();
        });
        row.appendChild(proceed);
        body.appendChild(row);
      }
    }
    return win;
  }

  function prepareMessage(win) {
    if (!win || win.dataset.mobilePrepared) return win;
    win.dataset.mobilePrepared = 'true';
    win.classList.add('mobile-dialog', 'mobile-message');
    win.setAttribute('role', 'alertdialog');
    win.setAttribute('aria-modal', 'true');
    clearPosition(win);
    const title = win.querySelector('.title-bar-text');
    const content = win.querySelector('.content');
    if (title) {
      title.id = win.id + '-title';
      win.setAttribute('aria-labelledby', title.id);
    }
    if (content) {
      content.id = win.id + '-content';
      win.setAttribute('aria-describedby', content.id);
    }
    const close = win.querySelector('.title-bar-controls .control61536');
    if (close) {
      close.textContent = '×';
      close.setAttribute('aria-label', 'Chiudi');
    }
    win.querySelectorAll('.field-row button').forEach(button => {
      button.classList.add('mobile-action');
      button.type = 'button';
      if (button.textContent === 'Yes') button.textContent = 'Sì';
      if (button.textContent === 'Cancel') button.textContent = 'Annulla';
    });
    return win;
  }

  global.MobileDialogs = {prepare, prepareMessage};
})(window);
