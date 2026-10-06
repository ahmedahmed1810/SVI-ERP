const API_URL = "https://script.google.com/macros/s/AKfycbzFgUloyiRJe-QmR7nRqJ4bfWqvfA_6LSgotJRrRt87yeRfWtdY7nxXMR9avafSJUPg4Q/exec";
const API_KEY = "SVI-H88-2026-ERP";
const $ = id => document.getElementById(id);

let db = { chs: [], projects: [], lots: [], primaries: [], secondaries: [], brd: [] };
let selection = { project: null, lot: null, primary: null, secondary: null };
let rowContext = null;
let longPressTimer = null;

function normalise(v){ return String(v ?? "").trim(); }
function num(v){ const n=Number(String(v??0).replace(/\s/g,"").replace(",",".")); return Number.isFinite(n)?n:0; }
function money(v){ return num(v).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function esc(v){ return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }

async function apiGet(action="bootstrap"){
  const url =
    API_URL +
    "?key=" + encodeURIComponent(API_KEY) +
    "&action=" + encodeURIComponent(action) +
    "&_=" + Date.now();

  const r = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  const data = await r.json();

  if(!data.ok){
    throw new Error(data.error || "ERREUR API");
  }

  return data;
}

async function apiPost(action, data={}){
  const r = await fetch(API_URL,{
    method:"POST",
    body:JSON.stringify({key:API_KEY,action,...data})
  });
  const out = await r.json();
  if(!out.ok) throw new Error(out.error || "ERREUR API");
  return out;
}

function mapBootstrap(data) {
  db.chs = (data.chs || []).map(x => ({
    id: x.ID,
    article: x.ARTICLE,
    designation: x.DESIGNATION,
    unit: x.UNITE,
    pcs: num(x.PCS)
  }));

  const all = data.bds || [];

  db.projects = all
    .filter(x => String(x.TYPE || "").trim().toUpperCase() === "PROJECT")
    .map(x => ({
      id: x.ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.lots = all
    .filter(x => String(x.TYPE || "").trim().toUpperCase() === "LOT")
    .map(x => ({
      id: x.ID,
      projectId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.primaries = all
    .filter(x => String(x.TYPE || "").trim().toUpperCase() === "PRIMARY")
    .map(x => ({
      id: x.ID,
      lotId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.secondaries = all
    .filter(x => String(x.TYPE || "").trim().toUpperCase() === "SECONDARY")
    .map(x => ({
      id: x.ID,
      primaryId: x.PARENT_ID,
      code: x.CODE,
      name: x.NOM,
      order: num(x.ORDRE)
    }));

  db.brd = (data.brd || [])
    .filter(x => String(x.ACTIF || "").trim().toUpperCase() !== "NON")
    .map(x => ({
      id: x.ID,
      secondaryId: x.TACHE_SECONDAIRE_ID,
      article: x.ARTICLE,
      designation: x.DESIGNATION,
      unit: x.UNITE,
      qty: num(x.QUANTITE),
      price: num(x.PRIX)
    }));
}

async function reloadAll(){
  try{
    const data=await apiGet("bootstrap");
    mapBootstrap(data);
    renderChs();
    renderHierarchy();
  }catch(e){
    alert("CONNEXION GOOGLE SHEETS IMPOSSIBLE : "+e.message);
  }
}

/* ========================= MISE A JOUR LOCALE RAPIDE ========================= */

function upsertLocalCHS(x){
  const item={
    id:x.ID,
    article:x.ARTICLE,
    designation:x.DESIGNATION,
    unit:x.UNITE,
    pcs:num(x.PCS)
  };
  const i=db.chs.findIndex(r=>r.id===item.id);
  if(i>=0) db.chs[i]=item;
  else db.chs.push(item);
}

function upsertLocalBDS(x){
  const type=String(x.TYPE||"").toUpperCase();

  let arrName="";
  let item=null;

  if(type==="PROJECT"){
    arrName="projects";
    item={id:x.ID,code:x.CODE,name:x.NOM,order:num(x.ORDRE)};
  }else if(type==="LOT"){
    arrName="lots";
    item={id:x.ID,projectId:x.PARENT_ID,code:x.CODE,name:x.NOM,order:num(x.ORDRE)};
  }else if(type==="PRIMARY"){
    arrName="primaries";
    item={id:x.ID,lotId:x.PARENT_ID,code:x.CODE,name:x.NOM,order:num(x.ORDRE)};
  }else if(type==="SECONDARY"){
    arrName="secondaries";
    item={id:x.ID,primaryId:x.PARENT_ID,code:x.CODE,name:x.NOM,order:num(x.ORDRE)};
  }

  if(!arrName||!item) return;

  const arr=db[arrName];
  const i=arr.findIndex(r=>r.id===item.id);
  if(i>=0) arr[i]=item;
  else arr.push(item);
}

function upsertLocalBRD(x){
  const item={
    id:x.ID,
    secondaryId:x.TACHE_SECONDAIRE_ID,
    article:x.ARTICLE,
    designation:x.DESIGNATION,
    unit:x.UNITE,
    qty:num(x.QUANTITE),
    price:num(x.PRIX)
  };
  const i=db.brd.findIndex(r=>r.id===item.id);
  if(i>=0) db.brd[i]=item;
  else db.brd.push(item);
}

function removeLocalBDS(type,id){
  if(type==="project"){
    const lotIds=db.lots.filter(x=>x.projectId===id).map(x=>x.id);
    const primaryIds=db.primaries.filter(x=>lotIds.includes(x.lotId)).map(x=>x.id);
    const secondaryIds=db.secondaries.filter(x=>primaryIds.includes(x.primaryId)).map(x=>x.id);

    db.brd=db.brd.filter(x=>!secondaryIds.includes(x.secondaryId));
    db.secondaries=db.secondaries.filter(x=>!secondaryIds.includes(x.id));
    db.primaries=db.primaries.filter(x=>!primaryIds.includes(x.id));
    db.lots=db.lots.filter(x=>!lotIds.includes(x.id));
    db.projects=db.projects.filter(x=>x.id!==id);
    selection={project:null,lot:null,primary:null,secondary:null};
    return;
  }

  if(type==="lot"){
    const primaryIds=db.primaries.filter(x=>x.lotId===id).map(x=>x.id);
    const secondaryIds=db.secondaries.filter(x=>primaryIds.includes(x.primaryId)).map(x=>x.id);

    db.brd=db.brd.filter(x=>!secondaryIds.includes(x.secondaryId));
    db.secondaries=db.secondaries.filter(x=>!secondaryIds.includes(x.id));
    db.primaries=db.primaries.filter(x=>!primaryIds.includes(x.id));
    db.lots=db.lots.filter(x=>x.id!==id);

    if(selection.lot===id){
      selection.lot=null;
      selection.primary=null;
      selection.secondary=null;
    }
    return;
  }

  if(type==="primary"){
    const secondaryIds=db.secondaries.filter(x=>x.primaryId===id).map(x=>x.id);

    db.brd=db.brd.filter(x=>!secondaryIds.includes(x.secondaryId));
    db.secondaries=db.secondaries.filter(x=>!secondaryIds.includes(x.id));
    db.primaries=db.primaries.filter(x=>x.id!==id);

    if(selection.primary===id){
      selection.primary=null;
      selection.secondary=null;
    }
    return;
  }

  if(type==="secondary"){
    db.brd=db.brd.filter(x=>x.secondaryId!==id);
    db.secondaries=db.secondaries.filter(x=>x.id!==id);

    if(selection.secondary===id) selection.secondary=null;
  }
}

function initNav(){
  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
      document.querySelectorAll(".view").forEach(x=>x.classList.remove("active-view"));
      btn.classList.add("active");
      $(btn.dataset.view).classList.add("active-view");
      $("pageSubtitle").textContent = btn.dataset.view==="chs" ? "VERSION 2 â CHARGES STANDARDS" :
        btn.dataset.view==="bds" ? "VERSION 2 â DÃCOMPOSITION" : "VERSION 2 â BUDGET";
    });
  });
}

/* ========================= CHS ========================= */
function renderChs(){
  const q=normalise($("chsSearch").value).toUpperCase();
  const rows=db.chs.filter(r=>[r.article,r.designation,r.unit].join(" ").toUpperCase().includes(q));
  $("chsCount").textContent=`${rows.length} CHARGE${rows.length>1?"S":""}`;
  $("chsTable").querySelector("tbody").innerHTML=rows.length?rows.map(r=>`
    <tr class="data-row" data-type="chs" data-id="${r.id}">
      <td>${esc(r.article)}</td><td>${esc(r.designation)}</td><td>${esc(r.unit)}</td>
      <td class="number yellow">${money(r.pcs)}</td>
    </tr>`).join(""):`<tr><td colspan="4" class="empty">AUCUNE CHARGE STANDARD</td></tr>`;
  bindRows();
}

function chsForm(item=null, duplicate=false){
  openForm(item&&!duplicate?"MODIFIER CHARGE STANDARD":"AJOUTER CHARGE STANDARD",[
    f("article","ARTICLE",duplicate?`${item.article}-COPIE`:item?.article||""),
    f("designation","DÃSIGNATION",item?.designation||"","text",true),
    f("unit","UNITÃ",item?.unit||""),
    f("pcs","PCS",item?.pcs??"","number")
  ], async values=>{
    const out=await apiPost("saveCHS",{data:{
      ID: item&&!duplicate ? item.id : "",
      ARTICLE:values.article,
      DESIGNATION:values.designation,
      UNITE:values.unit,
      PCS:values.pcs
    }});

    upsertLocalCHS(out.data);
    renderChs();
  });
}

/* ========================= BDS ========================= */
const cfg={
  project:{arr:"projects",list:"projectList",parent:null,title:"PROJET",type:"PROJECT"},
  lot:{arr:"lots",list:"lotList",parent:"project",fk:"projectId",title:"LOT",type:"LOT"},
  primary:{arr:"primaries",list:"primaryList",parent:"lot",fk:"lotId",title:"TÃCHE PRIMAIRE",type:"PRIMARY"},
  secondary:{arr:"secondaries",list:"secondaryList",parent:"primary",fk:"primaryId",title:"TÃCHE SECONDAIRE",type:"SECONDARY"}
};

function rowsFor(type){
  const c=cfg[type];
  let rows=db[c.arr];
  if(c.parent) rows=rows.filter(r=>r[c.fk]===selection[c.parent]);
  const search=document.querySelector(`[data-search="${type}"]`);
  const q=normalise(search?.value).toUpperCase();
  if(q) rows=rows.filter(r=>`${r.code} ${r.name}`.toUpperCase().includes(q));
  return [...rows].sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name,"fr"));
}

function renderHierarchy(){
  ["project","lot","primary","secondary"].forEach(type=>{
    const rows=rowsFor(type), el=$(cfg[type].list);
    el.innerHTML=rows.length?rows.map(r=>`
      <div class="list-item ${selection[type]===r.id?"selected":""}" data-select="${type}" data-id="${r.id}">
        <span class="code">${esc(r.code)}</span><span class="name">${esc(r.name)}</span>
      </div>`).join(""):`<div class="empty">AUCUN ÃLÃMENT</div>`;
  });

  document.querySelectorAll("[data-select]").forEach(el=>{
    el.onclick=()=>selectHierarchy(el.dataset.select,el.dataset.id);
    bindLongPress(el,{type:el.dataset.select,id:el.dataset.id});
  });

  renderContext();
  renderBrd();
}

function selectHierarchy(type,id){
  selection[type]=id;
  if(type==="project"){selection.lot=selection.primary=selection.secondary=null;}
  if(type==="lot"){selection.primary=selection.secondary=null;}
  if(type==="primary"){selection.secondary=null;}
  renderHierarchy();
}

function getBy(type,id){
  return db[cfg[type].arr].find(x=>x.id===id);
}

function addHierarchy(type,item=null,duplicate=false){
  const c=cfg[type];
  if(c.parent&&!selection[c.parent]) return alert(`SÃLECTIONNEZ D'ABORD : ${cfg[c.parent].title}`);

  openForm(item&&!duplicate?"MODIFIER "+c.title:"AJOUTER "+c.title,[
    f("code","CODE / ABRÃVIATION",duplicate?`${item.code}-C`:item?.code||""),
    f("name","NOM",item?.name||"","text",true),
    f("order","ORDRE",item?.order??"","number")
  ],async values=>{
    const out=await apiPost("saveBDS",{data:{
      ID:item&&!duplicate?item.id:"",
      TYPE:c.type,
      PARENT_ID:c.parent?selection[c.parent]:"",
      CODE:values.code,
      NOM:values.name,
      ORDRE:values.order,
      ACTIF:"OUI"
    }});

    upsertLocalBDS(out.data);
    renderHierarchy();
  });
}

function renderContext(){
  const parts=[];
  if(selection.project) parts.push(`PROJET : ${getBy("project",selection.project)?.code||""}`);
  if(selection.lot) parts.push(`LOT : ${getBy("lot",selection.lot)?.name||""}`);
  if(selection.primary) parts.push(`TÃCHE PRIMAIRE : ${getBy("primary",selection.primary)?.name||""}`);
  if(selection.secondary) parts.push(`TÃCHE SECONDAIRE : ${getBy("secondary",selection.secondary)?.name||""}`);
  $("bdsContext").textContent=parts.length?parts.join(" | "):"SÃLECTIONNEZ UNE TÃCHE SECONDAIRE";
}

function renderBrd(){
  const q=normalise($("brdSearch").value).toUpperCase();
  let rows=db.brd.filter(r=>r.secondaryId===selection.secondary);
  if(q) rows=rows.filter(r=>`${r.article} ${r.designation} ${r.unit}`.toUpperCase().includes(q));

  $("brdCount").textContent=`${rows.length} ARTICLE${rows.length>1?"S":""}`;

  let total=0;
  $("brdTable").querySelector("tbody").innerHTML=rows.length?rows.map(r=>{
    const amount=num(r.qty)*num(r.price); total+=amount;
    return `<tr class="data-row" data-type="brd" data-id="${r.id}">
      <td>${esc(r.article)}</td><td>${esc(r.designation)}</td><td>${esc(r.unit)}</td>
      <td class="number">${money(r.qty)}</td><td class="number">${money(r.price)}</td>
      <td class="number">${money(amount)}</td></tr>`;
  }).join(""):`<tr><td colspan="6" class="empty">${selection.secondary?"AUCUN ARTICLE":"SÃLECTIONNEZ UNE TÃCHE SECONDAIRE"}</td></tr>`;

  $("brdTotal").textContent=money(total);
  bindRows();
}

function brdForm(item=null,duplicate=false){
  if(!selection.secondary&&!item) return alert("SÃLECTIONNEZ D'ABORD UNE TÃCHE SECONDAIRE");

  openForm(item&&!duplicate?"MODIFIER ARTICLE BORDEREAU":"AJOUTER ARTICLE BORDEREAU",[
    f("article","ARTICLE",duplicate?`${item.article}-C`:item?.article||""),
    f("designation","DÃSIGNATION",item?.designation||"","text",true),
    f("unit","UNITÃ",item?.unit||""),
    f("qty","QUANTITÃ",item?.qty??0,"number"),
    f("price","PRIX",item?.price??0,"number")
  ],async values=>{
    const out=await apiPost("saveBRD",{data:{
      ID:item&&!duplicate?item.id:"",
      TACHE_SECONDAIRE_ID:selection.secondary,
      ARTICLE:values.article,
      DESIGNATION:values.designation,
      UNITE:values.unit,
      QUANTITE:values.qty,
      PRIX:values.price,
      ACTIF:"OUI"
    }});

    upsertLocalBRD(out.data);
    renderBrd();
  });
}

/* ========================= FORMULAIRES ========================= */
function f(name,label,value="",type="text",full=false){
  return {name,label,value,type,full};
}

function openForm(title,fields,onSave){
  $("modalTitle").textContent=title;

  $("modalForm").innerHTML=fields.map(x=>`
    <div class="field ${x.full?"full":""}">
      <label>${esc(x.label)}</label>
      <input name="${x.name}" type="${x.type}" value="${esc(x.value)}"
        ${x.type==="number"?'step="any" inputmode="decimal"':""} required>
    </div>`).join("")+`
    <div class="form-actions">
      <button type="button" class="secondary" id="cancelForm">ANNULER</button>
      <button class="primary" type="submit">ENREGISTRER</button>
    </div>`;

  $("modal").classList.remove("hidden");
  $("cancelForm").onclick=closeModal;

  $("modalForm").onsubmit=async e=>{
    e.preventDefault();
    const btn=e.currentTarget.querySelector('button[type="submit"]');
    btn.disabled=true;
    btn.textContent="ENREGISTREMENT...";

    try{
      await onSave(Object.fromEntries(new FormData(e.currentTarget).entries()));
      closeModal();
    }catch(err){
      alert(err.message||String(err));
      btn.disabled=false;
      btn.textContent="ENREGISTRER";
    }
  };
}

function closeModal(){
  $("modal").classList.add("hidden");
}

/* ========================= APPUI LONG ========================= */
function bindLongPress(el,ctx){
  const start=e=>{
    clearTimeout(longPressTimer);
    longPressTimer=setTimeout(()=>showRowMenu(e,ctx),550);
  };
  const stop=()=>clearTimeout(longPressTimer);

  el.addEventListener("pointerdown",start);
  el.addEventListener("pointerup",stop);
  el.addEventListener("pointerleave",stop);
  el.addEventListener("pointercancel",stop);
  el.addEventListener("contextmenu",e=>{
    e.preventDefault();
    showRowMenu(e,ctx);
  });
}

function bindRows(){
  document.querySelectorAll("tr.data-row").forEach(el=>{
    bindLongPress(el,{type:el.dataset.type,id:el.dataset.id});
  });
}

function showRowMenu(e,ctx){
  rowContext=ctx;
  const menu=$("rowMenu");
  menu.style.left=Math.min(e.clientX||20,window.innerWidth-200)+"px";
  menu.style.top=Math.min(e.clientY||20,window.innerHeight-190)+"px";
  menu.classList.remove("hidden");
}

function rowItem(ctx){
  if(ctx.type==="chs") return db.chs.find(x=>x.id===ctx.id);
  if(ctx.type==="brd") return db.brd.find(x=>x.id===ctx.id);
  return getBy(ctx.type,ctx.id);
}

async function deleteRow(ctx){
  if(ctx.type==="chs"){
    await apiPost("deleteCHS",{id:ctx.id});
    db.chs=db.chs.filter(x=>x.id!==ctx.id);
    renderChs();
    return;
  }

  if(ctx.type==="brd"){
    await apiPost("deleteBRD",{id:ctx.id});
    db.brd=db.brd.filter(x=>x.id!==ctx.id);
    renderBrd();
    return;
  }

  await apiPost("deleteBDS",{id:ctx.id});
  removeLocalBDS(ctx.type,ctx.id);
  renderHierarchy();
}

function infoRow(ctx){
  const x=rowItem(ctx);
  if(!x) return;

  const lines=Object.entries(x)
    .filter(([k])=>k!=="id"&&!k.endsWith("Id"))
    .map(([k,v])=>`${k.toUpperCase()} : ${v}`)
    .join("\n");

  alert(lines);
}

$("rowMenu").addEventListener("click",async e=>{
  const action=e.target.dataset.action;
  if(!action||!rowContext) return;

  const item=rowItem(rowContext);
  $("rowMenu").classList.add("hidden");

  try{
    if(action==="info") infoRow(rowContext);

    if(action==="delete"&&confirm("CONFIRMER LA SUPPRESSION ?")){
      await deleteRow(rowContext);
    }

    if(action==="edit"){
      if(rowContext.type==="chs") chsForm(item);
      else if(rowContext.type==="brd") brdForm(item);
      else addHierarchy(rowContext.type,item);
    }

    if(action==="duplicate"){
      if(rowContext.type==="chs") chsForm(item,true);
      else if(rowContext.type==="brd") brdForm(item,true);
      else addHierarchy(rowContext.type,item,true);
    }
  }catch(err){
    alert(err.message||String(err));
  }
});

/* ========================= DÃMARRAGE ========================= */
document.addEventListener("DOMContentLoaded",async ()=>{
  initNav();

  $("chsSearch").addEventListener("input",renderChs);
  $("brdSearch").addEventListener("input",renderBrd);

  $("addChsBtn").onclick=()=>chsForm();
  $("addBrdBtn").onclick=()=>brdForm();

  $("modalClose").onclick=closeModal;
  $("modal").addEventListener("click",e=>{
    if(e.target===$("modal")) closeModal();
  });

  document.addEventListener("click",e=>{
    if(!e.target.closest("#rowMenu")) $("rowMenu").classList.add("hidden");
  });

  document.querySelectorAll("[data-add]").forEach(b=>{
    b.onclick=()=>addHierarchy(b.dataset.add);
  });

  document.querySelectorAll("[data-search]").forEach(i=>{
    i.addEventListener("input",renderHierarchy);
  });

  await reloadAll();
});
