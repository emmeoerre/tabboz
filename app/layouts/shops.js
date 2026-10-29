/* Compact views of the original shop/dealer controls. GPL-3.0-or-later. */
(() => {
  'use strict';
  const layouts = window.MobileLayouts = window.MobileLayouts || new Map();
  const num = node => Number(node.className.match(/control(\d+)/)?.[1] || node.querySelector('input')?.className.match(/control(\d+)/)?.[1] || 0);
  const box = (name, tag = 'div') => { const n = document.createElement(tag); n.className = name; return n; };
  const text = item => item.node.textContent.trim();
  const radio = item => item.node.querySelector('input[type=radio]');

  function tools(ctx, name) {
    ctx.win.classList.add('shop-screen', ...name.split(' '));
    const used = new Set();
    const append = (parent, item) => { if (item) { parent.append(item.node); used.add(item); } return item; };
    const find = selector => ctx.items.find(item => !used.has(item) && item.node.matches(selector));
    const byText = label => ctx.items.find(item => !used.has(item) && text(item) === label);
    const takeId = (parent, id) => append(parent, find('.control' + id));
    const leftovers = () => ctx.items.filter(item => !used.has(item));
    return { used, append, find, byText, takeId, leftovers };
  }

  function status(ctx, t, pairs) {
    const bar = box('shop-status');
    for (const [caption, id] of pairs) {
      const value = t.find('.control' + id);
      if (!value) continue;
      const pair = box('shop-status-pair');
      t.append(pair, t.byText(caption));
      t.append(pair, value);
      bar.append(pair);
    }
    for (const item of ctx.items.filter(item => item.node.matches('img.mobile-icon'))) {
      t.append(bar, item);
      item.node.classList.add('shop-status-icon');
    }
    ctx.body.append(bar);
    return bar;
  }

  function facts(ctx, t, source, parent = ctx.body) {
    const panel = box('shop-facts');
    const pending = source.filter(item => !t.used.has(item)).sort((a,b) => a.y-b.y || a.x-b.x);
    const rows = [];
    for (const item of pending) {
      let row = rows.find(candidate => Math.abs(candidate.y-item.y) <= 5);
      if (!row) { row={y:item.y,items:[]}; rows.push(row); }
      row.items.push(item);
    }
    for (const row of rows) {
      const el = box('shop-facts-row');
      row.items.sort((a,b)=>a.x-b.x).forEach(item => t.append(el,item));
      if (row.items.length===1) el.classList.add('shop-facts-wide');
      panel.append(el);
    }
    parent.append(panel);
    return panel;
  }

  function choiceCard(item, image, t, grid) {
    const card = box('shop-product-option');
    if (image) t.append(card,image);
    t.append(card,item);
    const input=radio(item);
    card.addEventListener('click', event => {
      if (!event.target.closest('input,label')) {
        event.stopPropagation();
        if (!input.disabled) input.click();
      }
    });
    grid.append(card);
    return {card,input};
  }

  function choices(items) { return items.filter(radio).sort((a,b)=>num(a.node)-num(b.node)); }
  function bigImages(items) { return items.filter(item=>item.node.matches('img.mobile-art')).sort((a,b)=>num(a.node)-num(b.node)); }
  function watchSelection(cards, panels) {
    const update = () => {
      const selected=cards.findIndex(({input})=>input.checked);
      cards.forEach(({card},index)=>card.classList.toggle('is-selected',index===selected));
      panels.forEach(({node,indices})=>{ node.hidden=!indices.includes(selected<0?0:selected); });
    };
    cards.forEach(({input})=>input.addEventListener('change',update));
    update();
  }

  function clothing(ctx) {
    const t=tools(ctx,'shop-catalog');
    status(ctx,t,[['Soldi:',120],["Figosita':",121]]);
    const grid=box('shop-product-grid');
    const options=choices(ctx.items), images=bigImages(ctx.items);
    grid.style.setProperty('--shop-columns',String(ctx.dialogId==='83'?2:options.length));
    const cards=options.map((item,index)=>choiceCard(item,images[index],t,grid));
    ctx.body.append(grid);
    const copy=box('shop-copy');
    const descriptions=ctx.items.filter(item=>!t.used.has(item)&&!item.node.matches('button,img')&&!radio(item)&&item.h>=30&&text(item)).sort((a,b)=>a.y-b.y||a.x-b.x);
    const panels=[];
    for (const description of descriptions) {
      let indices;
      if (ctx.dialogId==='83') {
        indices=description.x>=320?[3]:description.y>=220?[2]:[0,1];
      } else if (description.y>=295) {
        // A shared original footnote belongs to every item, not one column.
        indices=options.map((_,i)=>i);
      } else {
        let nearest=0,dist=Infinity;
        options.forEach((option,index)=>{const d=Math.abs(description.x-option.x)+Math.abs(description.y-option.y);if(d<dist){nearest=index;dist=d;}});
        indices=[nearest];
      }
      const panel=box('shop-product-copy');
      t.append(panel,description);copy.append(panel);panels.push({node:panel,indices});
    }
    ctx.body.append(copy);
    watchSelection(cards,panels);
    return t.leftovers();
  }

  function menu(ctx) {
    const t=tools(ctx,'shop-menu');
    status(ctx,t,[['Soldi:',ctx.dialogId==='8'?120:104]]);
    const actions=box('shop-action-grid');
    ctx.items.filter(item=>item.node.matches('button')).sort((a,b)=>a.y-b.y||a.x-b.x).forEach(item=>t.append(actions,item));
    ctx.body.append(actions);
    return t.leftovers();
  }

  function scooterModels(ctx) {
    const t=tools(ctx,'shop-scooter-models');
    status(ctx,t,[['Soldi:',104]]);
    const grid=box('shop-product-grid');
    const options=choices(ctx.items),images=bigImages(ctx.items);
    grid.style.setProperty('--shop-columns',String(ctx.dialogId==='83'?2:options.length));
    const cards=options.map((item,index)=>choiceCard(item,images[index],t,grid));
    ctx.body.append(grid);
    facts(ctx,t,t.leftovers().filter(item=>!item.node.matches('button,img')&&!radio(item)));
    watchSelection(cards,[]);
    return t.leftovers();
  }

  function scooterDetails(ctx) {
    const t=tools(ctx,'shop-scooter-details');
    status(ctx,t,[['Soldi:',104]]);
    const hero=box('shop-details-hero');
    const info=box('shop-details-info');
    t.takeId(info,116);
    const remaining=t.leftovers().filter(item=>!item.node.matches('img,button')&&!radio(item));
    facts(ctx,t,remaining,info);
    hero.append(info);
    const art=box('shop-details-art');
    bigImages(t.leftovers()).forEach(item=>t.append(art,item));
    if(art.childElementCount)hero.append(art);
    ctx.body.append(hero);
    const actions=box('shop-action-grid');
    t.leftovers().filter(item=>item.node.matches('button')).sort((a,b)=>a.y-b.y).forEach(item=>t.append(actions,item));
    if(actions.childElementCount)ctx.body.append(actions);
    return t.leftovers();
  }

  function repair(ctx) {
    const t=tools(ctx,'shop-repair');
    status(ctx,t,[['Soldi:',104]]);
    const hero=box('shop-repair-hero');
    const image=bigImages(ctx.items)[0];t.append(hero,image);
    const advert=ctx.items.find(item=>item.h>100&&text(item));t.append(hero,advert);
    ctx.body.append(hero);
    facts(ctx,t,t.leftovers().filter(item=>!item.node.matches('button,img')));
    return t.leftovers();
  }

  function upgrades(ctx) {
    const t=tools(ctx,'shop-upgrades');
    status(ctx,t,[['Soldi:',104]]);
    const actions=ctx.items.filter(item=>item.node.matches('button')).sort((a,b)=>a.y-b.y||a.x-b.x);
    const grid=box('shop-upgrade-grid');
    for(const action of actions) {
      const card=box('shop-upgrade-option');t.append(card,action);
      const price=t.leftovers().filter(item=>!item.node.matches('button,img')&&item.x>action.x&&Math.abs(item.y-action.y)<=5).sort((a,b)=>a.x-b.x)[0];
      t.append(card,price);grid.append(card);
    }
    const hero=box('shop-upgrade-heading');
    bigImages(ctx.items).forEach(item=>t.append(hero,item));
    const details=box('shop-upgrade-info');t.takeId(details,109);facts(ctx,t,t.leftovers().filter(item=>!item.node.matches('button,img')),details);hero.append(details);
    ctx.body.append(hero,grid);
    return t.leftovers();
  }

  function phone(ctx) {
    const t=tools(ctx,'shop-phone');
    status(ctx,t,[['Soldi:',104]]);
    const details=box('shop-facts');
    [['Telefono:',120],['Abbonamento:',121],['Credito restante:',122]].forEach(([caption,id])=>{const row=box('shop-facts-row');t.append(row,t.byText(caption));t.takeId(row,id);details.append(row);});ctx.body.append(details);
    const actions=box('shop-action-grid');
    t.leftovers().filter(item=>item.node.matches('button')).sort((a,b)=>a.y-b.y).forEach(item=>t.append(actions,item));
    ctx.body.append(actions);
    return t.leftovers();
  }

  function phoneModels(ctx) {
    const t=tools(ctx,'shop-phone-models shop-catalog');
    status(ctx,t,[['Soldi:',104]]);
    const grid=box('shop-product-grid');grid.style.setProperty('--shop-columns','3');
    const copy=box('shop-copy'),cards=[],panels=[];
    const map=[{choice:110,image:452,price:120,x:68,y:48},{choice:111,image:451,price:121,x:106,y:238},{choice:112,image:450,price:122,x:302,y:48}];
    map.forEach((spec,index)=>{
      const option=ctx.items.find(item=>radio(item)&&num(item.node)===spec.choice);
      const image=t.find('.control'+spec.image);
      if(!option)return;
      const card=choiceCard(option,image,t,grid);t.takeId(card.card,spec.price);cards.push(card);
      const description=t.leftovers().find(item=>item.x===spec.x&&item.y===spec.y);
      if(description){const panel=box('shop-product-copy');t.append(panel,description);copy.append(panel);panels.push({node:panel,indices:[index]});}
    });
    ctx.body.append(grid,copy);watchSelection(cards,panels);
    return t.leftovers();
  }
  function plans(ctx) {
    const t=tools(ctx,'shop-phone-plans');
    status(ctx,t,[['Soldi:',104]]);
    const subscription=box('shop-subscription');
    t.append(subscription,t.byText('Abbonamento:'));t.takeId(subscription,105);
    ctx.body.append(subscription);
    const carriers=box('shop-carriers');
    const specs=[
      {image:470,activate:110,refills:[113,114],x:26,y:80,rx:140,ry:32,name:'Onmitel Pronto Italia'},
      {image:471,activate:111,refills:[115,116],x:294,y:82,rx:424,ry:32,name:'Delecom Italia Mobile'},
      {image:472,activate:112,refills:[117,118],x:22,y:204,rx:128,ry:138}
    ];
    const choice=id=>ctx.items.find(item=>!t.used.has(item)&&radio(item)&&num(item.node)===id);
    for(const spec of specs) {
      const card=box('shop-carrier'),head=box('shop-carrier-heading');
      t.takeId(head,spec.image);if(spec.name)t.append(head,t.byText(spec.name));card.append(head);
      const columns=box('shop-carrier-options'),activation=box('shop-activation'),refills=box('shop-refills');
      t.append(activation,t.leftovers().find(item=>item.x===spec.x&&item.y===spec.y));
      t.append(activation,choice(spec.activate));
      t.append(refills,t.leftovers().find(item=>item.x===spec.rx&&item.y===spec.ry));
      const refillOptions=box('shop-refill-options');
      spec.refills.forEach(id=>t.append(refillOptions,choice(id)));refills.append(refillOptions);
      columns.append(activation,refills);card.append(columns);carriers.append(card);
    }
    ctx.body.append(carriers);
    return t.leftovers();
  }

  function gym(ctx) {
    const t=tools(ctx,'shop-gym');
    status(ctx,t,[['Soldi:',104],["Figosita':",105]]);
    const hero=box('shop-gym-hero'),info=box('shop-gym-info');
    t.takeId(hero,240);t.takeId(info,110);t.takeId(info,106);t.takeId(info,107);hero.append(info);ctx.body.append(hero);
    const heading=box('shop-section-heading');t.append(heading,t.byText('Prezzi abbonamenti palestra'));ctx.body.append(heading);
    const grid=box('shop-gym-prices');
    [[115,120],[116,121],[117,122]].forEach(([button,price])=>{const card=box('shop-upgrade-option');t.takeId(card,price);t.takeId(card,button);grid.append(card);});
    ctx.body.append(grid);
    const lamp=box('shop-lamp');t.takeId(lamp,111);t.takeId(lamp,123);ctx.body.append(lamp);
    return t.leftovers();
  }

  ['80','81','82','83','84','85','86'].forEach(id=>layouts.set(id,clothing));
  ['8','70'].forEach(id=>layouts.set(id,menu));
  ['78','79'].forEach(id=>layouts.set(id,scooterModels));
  ['71','73'].forEach(id=>layouts.set(id,scooterDetails));
  layouts.set('72',repair);
  ['74','75','76','77'].forEach(id=>layouts.set(id,upgrades));
  layouts.set('120',phone);
  layouts.set('121',phoneModels);
  layouts.set('123',plans);
  layouts.set('89',gym);
})();




