/* Compact original forms and documents. GPL-3.0-or-later. */
(() => {
  "use strict";
  const layouts = window.MobileLayouts = window.MobileLayouts || new Map();
  const make = (tag, name) => { const node = document.createElement(tag); node.className = name; return node; };
  const position = (a, b) => a.y - b.y || a.x - b.x;
  const number = node => Number(node.className.match(/control(\d+)/)?.[1]);
  function context(args) {
    args.win.classList.add("forms-layout");
    const used = new Set();
    const take = test => {
      const item = args.items.find(candidate => !used.has(candidate) && (typeof test === "string" ? candidate.node.matches(test) : test(candidate)));
      if (item) used.add(item);
      return item?.node;
    };
    const append = (parent, node) => { if (node) parent.append(node); };
    return { ...args, used, take, append, remaining: () => args.items.filter(item => !used.has(item)) };
  }
  function text(c, value) { return c.take(item => item.node.textContent.trim() === value); }
  function field(c, caption, value, className = "") {
    const node = make("div", "forms-field " + className);
    if (caption) { caption.classList.add("forms-caption"); node.append(caption); }
    if (value) {
      value.classList.add("forms-value"); node.append(value);
      const input=value.matches("input,select,textarea")?value:value.querySelector("input,select,textarea");
      if(input&&!input.hasAttribute("aria-label")&&caption?.textContent.trim())input.setAttribute("aria-label",caption.textContent.trim());
    }
    return node;
  }
  function strip(c, items, className = "") {
    const node = make("div", "forms-inline " + className);
    items.sort(position).forEach(item => { c.used.add(item); node.append(item.node); });
    return node;
  }
  function buttons(c, items) {
    const actions = make("div", "forms-buttons");
    items.sort((a,b) => a.x-b.x || a.y-b.y).forEach(item => { c.used.add(item); actions.append(item.node); });
    return actions;
  }
  function profile(args) {
    const c = context(args), grid = make("div", "forms-profile");
    grid.append(field(c, text(c,"Cognome"), c.take("input.control101")), field(c, text(c,"Nome"), c.take("input.control102")));
    const birth = make("div", "forms-profile-birth");
    c.append(birth,c.take(".control109")); c.append(birth,c.take(".control103"));
    const icon = c.take("img"); c.append(birth,icon);
    grid.append(birth);
    grid.append(strip(c,c.remaining().filter(item => item.y === 102),"forms-document-line"));
    const birthplace = make("div","forms-inline forms-birthplace");
    c.remaining().filter(item=>item.y===126).sort((a,b)=>a.x-b.x).forEach(item=>{c.used.add(item);birthplace.append(item.node)});
    grid.append(birthplace);
    grid.append(field(c,text(c,"Cittadinanza"),text(c,"Italiana")));
    const town = field(c,text(c,"Residenza"),c.take("input.control111"),"forms-residence");
    c.append(town,c.take("input.control107")); grid.append(town);
    const facts=make("div","forms-profile-facts");
    facts.append(field(c,text(c,"Stato civile"),c.take(".control110")),field(c,text(c,"Professione"),c.take(".control108")));
    grid.append(facts); c.body.append(grid);
    return c.remaining();
  }
  function localTabs(c, entries, className) {
    const tabs=make("div","forms-tabs"), panels=make("div",className);
    tabs.setAttribute("role","tablist");
    const buttons=[];
    entries.forEach((entry,index)=>{
      const button=make("button","forms-tab"); button.type="button";
      if(typeof entry.label==="string")button.textContent=entry.label; else if(entry.label)button.append(entry.label);
      button.setAttribute("role","tab");
      const tabLabel=typeof entry.label === "string" ? entry.label : entry.label?.textContent.trim();
      if(tabLabel) button.setAttribute("aria-label",tabLabel.replace(/:$/, ""));
      button.setAttribute("aria-selected",String(index===0));
      button.tabIndex=index===0?0:-1;
      button.id=c.win.id+"-"+className+"-tab-"+index;
      entry.panel.id=c.win.id+"-"+className+"-panel-"+index;
      entry.panel.setAttribute("role","tabpanel");
      entry.panel.setAttribute("aria-labelledby",button.id);
      button.setAttribute("aria-controls",entry.panel.id);
      entry.panel.hidden=index!==0;
      button.addEventListener("click",event=>{
        event.stopPropagation();
        entries.forEach((other,i)=>{other.panel.hidden=i!==index;buttons[i].setAttribute("aria-selected",String(i===index));buttons[i].tabIndex=i===index?0:-1;});
        button.focus({preventScroll:true});
        c.body.scrollTop=0;
      });
      button.addEventListener("keydown",event=>{
        const offset=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
        const next=event.key==="Home"?0:event.key==="End"?entries.length-1:offset?(index+offset+entries.length)%entries.length:null;
        if(next!==null){event.preventDefault();event.stopPropagation();buttons[next].click();}
      });
      buttons.push(button);tabs.append(button);panels.append(entry.panel);
    });
    c.body.append(tabs,panels);
    return {tabs,buttons,panels};
  }
  function config(args) {
    const c=context(args), skill=make("div","forms-skill-list"), misc=make("div","forms-toggle-grid");
    c.remaining().filter(item=>item.node.querySelector('input[type="radio"]')).sort(position).forEach(item=>{c.used.add(item);skill.append(item.node);});
    c.remaining().filter(item=>item.node.querySelector('input[type="checkbox"]')).sort(position).forEach(item=>{c.used.add(item);misc.append(item.node);});
    const skillLabel=text(c,"Choose Skill level:"),miscLabel=text(c,"Misc:");
    localTabs(c,[{label:skillLabel,panel:skill},{label:miscLabel,panel:misc}],"forms-settings-panels");
    const notes=make("div","forms-settings-notes");
    c.remaining().filter(item=>item.node.matches("img")||/^(reset|Tabboz Simulator)$/.test(item.node.textContent.trim())).forEach(item=>{c.used.add(item);notes.append(item.node);});
    c.body.append(notes);
    return c.remaining();
  }
  function format(args) {
    const c=context(args), capacity=field(c,text(c,"Capacity:"),c.take(item=>!!item.node.querySelector("select")));
    c.body.append(capacity);
    const type=c.take(item=>item.node.matches("fieldset")&&item.node.textContent.trim()==="Format type")||make("fieldset","forms-format-type");
    type.classList.add("forms-format-type");
    c.remaining().filter(item=>!!item.node.querySelector('input[type="radio"]')).sort(position).forEach(item=>{c.used.add(item);type.append(item.node);});
    c.body.append(type);
    const options=c.take(item=>item.node.matches("fieldset")&&item.node.textContent.trim()==="Other options");
    if(options) {
      const details=make("details","forms-format-extras"),summary=make("summary","forms-extras-title");
      const legend=options.querySelector("legend"); if(legend)summary.append(legend);
      const optionBody=make("div","forms-extras-body"); optionBody.append(options);
      c.remaining().filter(item=>item.node.matches(":disabled")||item.node.querySelector(":disabled")||item.node.classList.contains("disabled")).sort(position).forEach(item=>{c.used.add(item);optionBody.append(item.node);});
      details.append(summary,optionBody);c.body.append(details);
    }
    const progress=make("div","forms-format-progress");
    c.append(progress,c.take(".control112"));c.append(progress,c.take(".control111"));c.body.append(progress);
    c.body.append(buttons(c,c.remaining().filter(item=>item.node.matches("button"))));
    return c.remaining();
  }
  function session(args) {
    const c=context(args), intro=make("div","forms-session-intro");
    c.remaining().filter(item=>item.y<60).sort(position).forEach(item=>{c.used.add(item);intro.append(item.node);});
    c.body.append(intro);
    const choices=make("div","forms-session-choices");
    c.remaining().filter(item=>item.node.querySelector("input")).sort(position).forEach(item=>{c.used.add(item);choices.append(item.node);});
    c.body.append(choices,buttons(c,c.remaining().filter(item=>item.node.matches("button"))));
    return c.remaining();
  }
  function network(args) {
    const c=context(args);
    const stats=make("section","forms-network-stats"),configuration=make("section","forms-network-config");
    const statsTitle=c.take(item=>item.node.textContent.includes("Network Server Stat"));
    const configTitle=c.take(item=>item.node.textContent.includes("Network Server Configuration"));
    c.append(stats,statsTitle); c.append(configuration,configTitle);
    for(const id of[101,102,103,104]){
      const valueItem=c.remaining().find(item=>item.node.matches(".control"+id));
      if(!valueItem)continue;
      const caption=c.take(item=>item.y===valueItem.y&&!item.node.matches("input,img,button")&&item.node!==valueItem.node);
      stats.append(field(c,caption,c.take(".control"+id)));
    }
    const port=c.remaining().find(item=>item.node.matches("input.control105"));
    if(port) configuration.append(field(c,c.take(item=>item.node.textContent.trim()==="TCP/IP Port"),c.take("input.control105")));
    const enable=c.take(item=>!!item.node.querySelector("input.control106"));
    if(enable){const row=make("div","forms-network-enable");row.append(enable);c.append(row,text(c,"Network Server"));configuration.append(row);}
    c.remaining().filter(item=>item.y>=174&&item.y<230).sort(position).forEach(item=>{c.used.add(item);configuration.append(item.node);});
    c.body.append(stats,configuration);
    const bottom=make("div","forms-network-status");
    c.remaining().filter(item=>item.y>=230).sort(position).forEach(item=>{c.used.add(item);bottom.append(item.node);});
    c.body.append(bottom);
    return c.remaining();
  }
  function report(args) {
    const c=context(args), lead=make("div","forms-report-lead");
    const art=c.take(item=>item.node.matches("img")&&item.w>40);
    if(art){art.classList.add("forms-report-art");lead.append(art)}
    const result=make("div","forms-report-result");c.append(result,c.take("img"));c.append(result,c.take(".control119"));lead.append(result);c.body.append(lead);
    const table=make("div","forms-report-table");
    for(const id of[120,121,122,123,124,125,126,127,128,129]){
      const val=c.remaining().find(item=>item.node.matches(".control"+id));if(!val)continue;
      const caption=c.take(item=>Math.abs(item.y-val.y)<=2&&item.node!==val.node&&item.node.textContent.trim());
      table.append(field(c,caption,c.take(".control"+id)));
    }
    c.body.append(table);return c.remaining();
  }
  function quiz(args) {
    // These are deliberately the source checkboxes, not replacement radios.
    // The native engine reads every answer when the final command is submitted.
    const c=context(args);c.win.classList.add("forms-quiz");
    const questions=c.items.filter(item=>/^[ABC]\.\s*/.test(item.node.textContent.trim())&&!item.node.querySelector("input")).sort(position);
    if(questions.length!==3)return c.items;
    const intro=make("div","forms-quiz-intro");
    c.remaining().filter(item=>item.y<questions[0].y&&!item.node.matches("button")).sort(position).forEach(item=>{
      c.used.add(item);
      if(/^Scheda numero/.test(item.node.textContent.trim()))item.node.classList.add("forms-quiz-sheet");
      intro.append(item.node);
    });
    c.body.append(intro);
    const questionnaire=make("div","forms-quiz-questions");
    questions.forEach((question,index)=>{
      const group=make("section","forms-question");
      const caption=make("div","forms-question-caption"),choices=make("div","forms-question-choices");
      caption.id=c.win.id+"-question-"+index;
      group.setAttribute("role","group");group.setAttribute("aria-labelledby",caption.id);
      const upper=index<2?questions[index+1].y:Infinity;
      c.remaining().filter(item=>item.y>=question.y&&item.y<upper&&!item.node.matches("button")).sort(position).forEach(item=>{
        c.used.add(item);
        if(item.node.querySelector("input"))choices.append(item.node);else caption.append(item.node);
      });
      group.append(caption,choices);questionnaire.append(group);
    });
    c.body.append(questionnaire);
    const submit=buttons(c,c.remaining().filter(item=>item.node.matches("button")));submit.classList.add("forms-quiz-submit");c.body.append(submit);
    return c.remaining();
  }
  function directory(args) {
    const c=context(args), lead=make("div","forms-directory-lead");
    c.remaining().filter(item=>item.node.matches("img")||(!item.node.matches("button")&&item.node.textContent.trim())).sort(position).forEach(item=>{c.used.add(item);lead.append(item.node)});
    const list=make("div","forms-directory-grid");
    c.remaining().filter(item=>item.node.matches("button")).sort((a,b)=>number(a.node)-number(b.node)).forEach(item=>{c.used.add(item);list.append(item.node)});
    c.body.append(lead,list);return c.remaining();
  }
  function article(args) {
    const c=context(args);c.win.classList.add("forms-article");
    const head=make("div","forms-article-head"),art=make("div","forms-article-art"),metadata=make("div","forms-article-meta");
    c.remaining().filter(item=>item.node.matches("img,canvas")).sort(position).forEach(item=>{c.used.add(item);art.append(item.node)});
    const isAdvert=Number(c.dialogId)>=390;
    if(isAdvert){head.append(art);head.classList.add("forms-advert-head");}
    else {
      c.remaining().filter(item=>item.y<170&&!item.node.matches("button")&&item.node.textContent.trim()).sort(position).forEach(item=>{c.used.add(item);metadata.append(item.node)});
      head.append(art,metadata);
    }
    const copy=make("div","forms-article-copy");
    c.remaining().filter(item=>!item.node.matches("button")).sort(position).forEach(item=>{c.used.add(item);copy.append(item.node)});
    c.body.append(head,copy);
    const actions=c.remaining().filter(item=>item.node.matches("button"));
    if(actions.length)c.body.append(buttons(c,actions));
    return c.remaining();
  }
  layouts.set("11",profile);layouts.set("14",config);layouts.set("15",format);layouts.set("16",session);layouts.set("17",network);layouts.set("110",report);
  for(let id=200;id<=209;id++)layouts.set(String(id),quiz);
  layouts.set("210",directory);
  for(let id=290;id<=297;id++)layouts.set(String(id),article);
  for(let id=390;id<=397;id++)layouts.set(String(id),article);
})();

