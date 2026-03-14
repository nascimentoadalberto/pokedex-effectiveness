const SPRITE    = id   => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const SPRITE_SD = name => `https://play.pokemonshowdown.com/sprites/dex/${encodeURIComponent(name)}.png`;

const ALL_TYPES = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];

const GEN_NAMES = {1:"I · Kanto",2:"II · Johto",3:"III · Hoenn",4:"IV · Sinnoh",5:"V · Unova",6:"VI · Kalos",7:"VII · Alola",8:"VIII · Galar",9:"IX · Paldea"};

const LIGHT_TYPES = new Set(["Electric","Ice","Ground","Steel","Fairy","Normal","Bug"]);

const GIMMICK_FILTER_GROUP = {
  mega:'__mega', mega_x:'__mega', mega_y:'__mega',
  gigantamax:'__gigantamax', eternamax:'__gigantamax',
  fusion:'__fusion', black_kyurem:'__fusion', white_kyurem:'__fusion',
  primal:'__alternate_forme', origin_forme:'__alternate_forme',
  sky_forme:'__alternate_forme', therian_forme:'__alternate_forme',
  zen_mode:'__alternate_forme', pirouette_forme:'__alternate_forme',
  ash_greninja:'__alternate_forme', blade_forme:'__alternate_forme',
  active_mode:'__alternate_forme', alternate_forme:'__alternate_forme',
  crowned:'__alternate_forme', apex_build:'__alternate_forme',
  terastal:'__alternate_forme', ultra_burst:'__alternate_forme',
};

const GIMMICK_ICON = { __mega:'🔮', __gigantamax:'💥', __fusion:'🔀', __alternate_forme:'🔄' };
const CAT_ICON = {legendary:'⭐', mythical:'✨', ultra_beast:'🌀', paradox:'⏳',pseudo_legendary:'💎', starter:'🌱', fossil:'🦕', baby:'🥚'};

const STAT_COLORS = { hp:'#ff5959',atk:'#f5ac78',def:'#fae078',spa:'#9db7f5',spd:'#a7db8d',spe:'#fa92b2' };
const STAT_LABELS = { hp:'HP',atk:'Atq',def:'Def',spa:'At.E',spd:'De.E',spe:'Vel' };

// ── Estado ───────────────────────────────────────────────────
let POKEMON     = [];
let pokemonById = {};
let TYPE_CHART  = {};
let TRAINERS    = {};

let activeGen            = 0;
let activeTypeFilter     = '';
let activeCategoryFilter = '';
let activeSortKey        = '';
let activeSortDir        = 'desc';
let catalogQuery         = '';
let hoverTimer           = null;

let team            = [null,null,null,null,null,null];
let selectedSlot    = -1;
let activeTrainerGen = null;
let activeTrainer    = null;

// ── Helpers ──────────────────────────────────────────────────
function typeColor(t) {
  return ({Normal:"#A8A878",Fire:"#F08030",Water:"#6890F0",Electric:"#F8D030",
    Grass:"#78C850",Ice:"#98D8D8",Fighting:"#C03028",Poison:"#A040A0",
    Ground:"#E0C068",Flying:"#A890F0",Psychic:"#F85888",Bug:"#A8B820",
    Rock:"#B8A038",Ghost:"#705898",Dragon:"#7038F8",Dark:"#705848",
    Steel:"#B8B8D0",Fairy:"#EE99AC"})[t] || "#888";
}

function typeBadge(t) {
  return `<span class="type-badge" style="background:${typeColor(t)};color:${LIGHT_TYPES.has(t)?"#222":"#fff"}">${t}</span>`;
}

function getDefMult(types) {
  const r = {};
  for (const atk of ALL_TYPES) {
    let m = 1;
    for (const def of types) m *= (TYPE_CHART[atk]?.[def] ?? 1);
    r[atk] = m;
  }
  return r;
}

function pad(n, len = 4) { return String(n).padStart(len, '0'); }
function teamContains(id) { return team.includes(id); }

// ── Boot ─────────────────────────────────────────────────────
async function loadData() {
  const base = import.meta.url.replace(/\/script\/[^/]+$/, '');
  const [a, b, c] = await Promise.all([
    fetch(`${base}/data/pokedex-data.json`),
    fetch(`${base}/data/type-chart.json`),
    fetch(`${base}/data/trainer-data.json`),
  ]);
  POKEMON     = await a.json();
  TYPE_CHART  = await b.json();
  TRAINERS    = await c.json();
  POKEMON.forEach(p => pokemonById[p.id] = p);
  initCatalog();
  activeTrainerGen = Object.keys(TRAINERS)[0];
}

// Expõe funções para handlers inline no HTML
Object.assign(window, {
  showPage, filterGen, filterType, filterCategory,
  setSortKey, toggleSortDir, onCatalogSearch,
  closeDetailPanel, removeFromTeam, renderTeamSearch,
  openDetailPanel, pokemonById,
});

document.addEventListener('DOMContentLoaded', loadData);

// ─────────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────────────────────
function showPage(page, btn) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (btn) btn.classList.add('active');
  if (page === 'team') initTeamPage();
}

// ─────────────────────────────────────────────────────────────
// CATÁLOGO — FILTROS
// ─────────────────────────────────────────────────────────────
function initCatalog() {
  _buildTypeRow();
  _buildCatRow();
  _buildSortRow();
  renderCatalog();
}

function filterGen(gen, btn) {
  activeGen = gen;
  document.querySelectorAll('.gen-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalog();
}

function filterType(type, btn) {
  activeTypeFilter = type;
  document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalog();
}

function filterCategory(cat, btn) {
  activeCategoryFilter = cat;
  document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalog();
}

function setSortKey(key, btn) {
  if (activeSortKey === key) { toggleSortDir(); return; }
  activeSortKey = key;
  activeSortDir = 'desc';
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _refreshSortDir();
  renderCatalog();
}

function toggleSortDir() {
  activeSortDir = activeSortDir === 'desc' ? 'asc' : 'desc';
  _refreshSortDir();
  renderCatalog();
}

function _refreshSortDir() {
  const el = document.getElementById('sortDirBtn');
  if (el) el.textContent = activeSortDir === 'desc' ? '▼' : '▲';
}

function onCatalogSearch(val) {
  catalogQuery = val.trim().toLowerCase();
  renderCatalog();
}

function _buildTypeRow() {
  const row = document.querySelector('.type-filter-row');
  ALL_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className   = 'type-filter-btn';
    btn.style.cssText = `background:${typeColor(t)};color:${LIGHT_TYPES.has(t)?'#222':'#fff'};border-color:transparent`;
    btn.textContent = t;
    btn.onclick     = function() { filterType(t, this); };
    row.appendChild(btn);
  });
}

function _buildCatRow() {
  const row  = document.querySelector('.cat-filter-row');
  const defs = [
    {key:'',label:'Todos'},{key:'legendary',label:'⭐ Lendário'},
    {key:'mythical',label:'✨ Mítico'},{key:'ultra_beast',label:'🌀 Ultra Beast'},
    {key:'paradox',label:'⏳ Paradoxo'},{key:'pseudo_legendary',label:'💎 Pseudo-Lend.'},
    {key:'starter',label:'🌱 Inicial'},{key:'fossil',label:'🦕 Fóssil'},
    {key:'baby',label:'🥚 Filhote'},{key:'__mega',label:'🔮 Mega'},
    {key:'__gigantamax',label:'💥 Gigantamax'},{key:'__fusion',label:'🔀 Fusão'},
    {key:'__alternate_forme',label:'🔄 Forma Alt.'},
  ];
  defs.forEach(({key,label}) => {
    const btn = document.createElement('button');
    btn.className   = 'cat-filter-btn' + (key===''?' active':'');
    btn.textContent = label;
    btn.onclick     = function() { filterCategory(key,this); };
    row.appendChild(btn);
  });
}

function _buildSortRow() {
  const row  = document.querySelector('.sort-row');
  if (!row) return;
  [{key:'',label:'# Dex'},{key:'total',label:'BST'},{key:'hp',label:'HP'},
   {key:'atk',label:'Atq'},{key:'def',label:'Def'},{key:'spa',label:'At.E'},
   {key:'spd',label:'De.E'},{key:'spe',label:'Vel'}
  ].forEach(({key,label}) => {
    const btn = document.createElement('button');
    btn.className   = 'sort-btn'+(key===''?' active':'');
    btn.textContent = label;
    btn.onclick     = function(){ setSortKey(key,this); };
    row.appendChild(btn);
  });
  const dir = document.createElement('button');
  dir.id='sortDirBtn'; dir.className='sort-btn sort-dir'; dir.textContent='▼';
  dir.onclick=toggleSortDir;
  row.appendChild(dir);
}

// ─────────────────────────────────────────────────────────────
// CATÁLOGO — RENDERIZAÇÃO
// ─────────────────────────────────────────────────────────────
function _buildDisplayList() {
  const list = [];
  const isCatGimmick = activeCategoryFilter.startsWith('__');

  for (const p of POKEMON) {
    if (activeGen > 0 && p.gen !== activeGen) continue;

    if (catalogQuery) {
      const q = catalogQuery;
      if (!p.name.toLowerCase().includes(q) && !String(p.id).includes(q)
          && !p.types.some(t => t.toLowerCase().includes(q))) continue;
    }

    if (activeTypeFilter) {
      if (!p.types.includes(activeTypeFilter)
          && !p.gimmicks.some(g => g.types?.includes(activeTypeFilter))) continue;
    }

    if (activeCategoryFilter) {
      if (isCatGimmick) {
        if (!p.gimmicks.some(g => GIMMICK_FILTER_GROUP[g.kind] === activeCategoryFilter)) continue;
      } else {
        if (p.category !== activeCategoryFilter) continue;
      }
    }

    list.push({kind:'base', pokemon:p, gimmick:null});

    if (!activeCategoryFilter || isCatGimmick) {
      for (const g of p.gimmicks) {
        if (activeTypeFilter && g.types && !g.types.includes(activeTypeFilter)) continue;
        if (isCatGimmick && GIMMICK_FILTER_GROUP[g.kind] !== activeCategoryFilter) continue;
        list.push({kind:'gimmick', pokemon:p, gimmick:g});
      }
    }
  }

  if (activeSortKey) {
    list.sort((a,b) => {
      const sa = (a.kind==='gimmick'&&a.gimmick.stats?a.gimmick.stats:a.pokemon.stats)?.[activeSortKey]??0;
      const sb = (b.kind==='gimmick'&&b.gimmick.stats?b.gimmick.stats:b.pokemon.stats)?.[activeSortKey]??0;
      return activeSortDir==='desc' ? sb-sa : sa-sb;
    });
  }
  return list;
}

function renderCatalog() {
  const container = document.getElementById('catalog-container');
  const list      = _buildDisplayList();

  if (activeSortKey) {
    container.innerHTML = `<div class="gen-section">
      <div class="gen-title">Ordenado por <span>${activeSortKey.toUpperCase()}</span> ${activeSortDir==='desc'?'▼':'▲'} — ${list.length} entradas</div>
      <div class="pokemon-grid" id="flatGrid"></div></div>`;
    list.forEach(e => container.querySelector('#flatGrid').appendChild(_makeCard(e)));
  } else {
    const byGen = {};
    list.forEach(e => { const g=e.pokemon.gen; (byGen[g]=byGen[g]||[]).push(e); });
    container.innerHTML = '';
    Object.keys(byGen).sort((a,b)=>a-b).forEach(gen => {
      const sec = document.createElement('div');
      sec.className = 'gen-section';
      sec.innerHTML = `<div class="gen-title">Geração <span>${GEN_NAMES[gen]}</span> — ${byGen[gen].length} entradas</div>`;
      const grid = document.createElement('div');
      grid.className = 'pokemon-grid';
      byGen[gen].forEach(e => grid.appendChild(_makeCard(e)));
      sec.appendChild(grid);
      container.appendChild(sec);
    });
  }
}

function _makeCard(entry) {
  const {kind, pokemon:p, gimmick:g} = entry;
  const isG   = kind==='gimmick';
  const types = isG && g.types ? g.types : p.types;
  const name  = isG ? g.name : p.name;
  const stats = isG && g.stats ? g.stats : p.stats;
  const def   = getDefMult(types);
  const url   = isG ? SPRITE_SD(g.sprite_name) : SPRITE(p.id);

  const card = document.createElement('div');
  card.className       = 'poke-card'+(isG?' gimmick-card':'');
  card.dataset.id      = p.id;
  card.dataset.gimmick = isG ? g.kind : '';

  const iconHtml = isG
    ? `<div class="card-icon gimmick-icon" title="${g.kind}">${GIMMICK_ICON[GIMMICK_FILTER_GROUP[g.kind]]||'✦'}</div>`
    : (CAT_ICON[p.category]?`<div class="card-icon" title="${p.category}">${CAT_ICON[p.category]}</div>`:'');

  const bst = stats?.total ?? 0;
  const bstPct = Math.min(100, Math.round(bst/720*100));
  const bstColor = bstPct>83?'#ffd700':bstPct>65?'#00e676':'#6890F0';

  card.innerHTML = `
    <div class="card-4x-badge" style="display:none">4×</div>
    ${iconHtml}
    <img class="poke-sprite" src="${url}" alt="${name}" loading="lazy"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="poke-sprite-fallback">?</div>
    <div class="poke-id">#${pad(p.id)}</div>
    <div class="poke-name">${name}</div>
    <div class="poke-types">${types.map(typeBadge).join('')}</div>
    ${bst?`<div class="card-stat-bar" title="BST ${bst}">
      <div class="card-stat-fill" style="width:${bstPct}%;background:${bstColor}"></div>
    </div>`:''}
  `;

  if (teamContains(p.id)) card.classList.add('in-team');
  card.addEventListener('mouseenter', ()=>_hover(p,types,def,name));
  card.addEventListener('mouseleave', _hoverEnd);
  card.addEventListener('click',      ()=>openDetailPanel(p, isG?g:null));
  return card;
}

// ─────────────────────────────────────────────────────────────
// HOVER
// ─────────────────────────────────────────────────────────────
function _hover(p, types, def, name) {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const t4=[], t2=[], tIm=[], tRe=[];
    ALL_TYPES.forEach(atk => {
      const m = def[atk]??1;
      if(m>=4)t4.push(atk); else if(m>=2)t2.push(atk);
      else if(m===0)tIm.push(atk); else if(m<1)tRe.push(atk);
    });

    document.querySelectorAll('.poke-card').forEach(card => {
      const cp = pokemonById[+card.dataset.id]; if(!cp) return;
      const gk = card.dataset.gimmick;
      const cg = gk ? cp.gimmicks.find(x=>x.kind===gk) : null;
      const ct = cg?.types || cp.types;
      let best=0; ct.forEach(t=>{ const m=def[t]??1; if(m>best)best=m; });
      card.classList.remove('effective-4x','effective-2x','weakened');
      const b4=card.querySelector('.card-4x-badge');
      if(b4)b4.style.display='none';
      if(best>=4){card.classList.add('effective-4x');if(b4)b4.style.display='block';}
      else if(best>=2)card.classList.add('effective-2x');
      else if(best<=0.5||best===0)card.classList.add('weakened');
    });

    document.getElementById('hoverName').textContent   = `${name}  (${types.join(' / ')})`;
    document.getElementById('hoverX4').textContent     = t4.length?t4.join(', '):'—';
    document.getElementById('hoverStrong').textContent = t2.length?t2.join(', '):'—';
    let resist=tRe.join(', ')||'—';
    if(tIm.length)resist+=`  |  Imune: ${tIm.join(', ')}`;
    document.getElementById('hoverWeak').textContent = resist;
    document.getElementById('hoverX4Row').style.display = t4.length?'flex':'none';
    document.getElementById('hoverBar').classList.add('visible');
  }, 80);
}

function _hoverEnd() {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    document.querySelectorAll('.poke-card').forEach(card => {
      card.classList.remove('effective-4x','effective-2x','weakened');
      const b=card.querySelector('.card-4x-badge'); if(b)b.style.display='none';
    });
    document.getElementById('hoverBar').classList.remove('visible');
  }, 150);
}

// ─────────────────────────────────────────────────────────────
// PAINEL DE DETALHE
// ─────────────────────────────────────────────────────────────
function openDetailPanel(p, gimmick=null) {
  const isG   = !!gimmick;
  const types = isG&&gimmick.types ? gimmick.types : p.types;
  const name  = isG ? gimmick.name : p.name;
  const stats = isG&&gimmick.stats ? gimmick.stats : p.stats;
  const def   = getDefMult(types);
  const url   = isG ? SPRITE_SD(gimmick.sprite_name) : SPRITE(p.id);

  const quad4 = ALL_TYPES.filter(t=>(def[t]??1)>=4);

  // Representante icônico do tipo
  function rep(t) {
    return POKEMON.find(pk=>pk.types[0]===t&&pk.category!=='regular')
        || POKEMON.find(pk=>pk.types[0]===t);
  }

  // Stats HTML
  const statsHtml = stats ? `<div class="detail-stats">
    ${['hp','atk','def','spa','spd','spe'].map(k=>{
      const pct=Math.round(stats[k]/255*100);
      return `<div class="stat-row">
        <span class="stat-label">${STAT_LABELS[k]}</span>
        <span class="stat-val">${stats[k]}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div></div>
      </div>`;
    }).join('')}
    <div class="stat-row stat-total">
      <span class="stat-label">BST</span>
      <span class="stat-val gold">${stats.total}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.min(100,Math.round(stats.total/720*100))}%;background:var(--gold)"></div></div>
    </div>
  </div>` : '';

  // 4× HTML
  const quad4Html = `<div class="detail-section">
    <h4 class="detail-section-title ${quad4.length?'danger':'neutral'}">
      ${quad4.length?'⚡ Sofre 4× de dano de':'✓ Sem vulnerabilidade 4×'}
    </h4>
    ${quad4.length?`<div class="detail-4x-grid">${quad4.map(t=>{
      const r=rep(t);
      return `<div class="detail-4x-type">
        <span class="type-badge" style="background:${typeColor(t)};color:${LIGHT_TYPES.has(t)?'#222':'#fff'};font-size:11px;padding:3px 12px">${t}</span>
        ${r?`<div class="detail-4x-rep">
          <img src="${SPRITE(r.id)}" alt="${r.name}" title="${r.name}" style="width:44px;height:44px;image-rendering:pixelated">
          <span class="detail-4x-repname">${r.name}</span>
        </div>`:''}
      </div>`;
    }).join('')}</div>`:''}
  </div>`;

  // Gimmicks HTML
  const gimmicksHtml = (!isG && p.gimmicks?.length) ? `<div class="detail-section">
    <h4 class="detail-section-title accent">✦ Formas & Gimmicks</h4>
    <div class="detail-gimmick-list">
      ${p.gimmicks.map((g,gi)=>`
        <div class="detail-gimmick-item" data-pid="${p.id}" data-gi="${gi}">
          <img src="${SPRITE_SD(g.sprite_name)}" alt="${g.name}"
               style="width:52px;height:52px;image-rendering:pixelated"
               onerror="this.src='${SPRITE(p.id)}'">
          <span class="detail-gimmick-name">${g.name}</span>
          ${g.stats?`<span class="detail-gimmick-bst">BST ${g.stats.total}</span>`:''}
        </div>`).join('')}
    </div>
  </div>` : '';

  const catLabel = isG
    ? `${GIMMICK_ICON[GIMMICK_FILTER_GROUP[gimmick.kind]]||'✦'} ${gimmick.kind.replace(/_/g,' ')}`
    : `${CAT_ICON[p.category]||''} ${p.category}`.trim();

  const panel = document.getElementById('detailPanel');
  panel.innerHTML = `
    <div class="detail-header">
      <img class="detail-sprite" src="${url}" alt="${name}" onerror="this.src='${SPRITE(p.id)}'">
      <div class="detail-info">
        <div class="detail-id">#${pad(p.id)}</div>
        <div class="detail-name">${name}</div>
        <div class="poke-types" style="gap:5px;margin-top:6px">${types.map(typeBadge).join('')}</div>
        <div class="detail-cat-tag">${catLabel}</div>
      </div>
      <button class="detail-close" onclick="closeDetailPanel()">✕</button>
    </div>
    ${statsHtml}
    ${quad4Html}
    ${gimmicksHtml}
  `;

  // Eventos nos gimmick items (sem inline JSON)
  panel.querySelectorAll('.detail-gimmick-item').forEach(el => {
    el.addEventListener('click', () => {
      const pk=pokemonById[+el.dataset.pid], gi=+el.dataset.gi;
      if(pk?.gimmicks[gi]) openDetailPanel(pk, pk.gimmicks[gi]);
    });
  });

  panel.classList.add('open');
  document.getElementById('detailOverlay').classList.add('open');
}

function closeDetailPanel() {
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('detailOverlay').classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
// TIME
// ─────────────────────────────────────────────────────────────
function initTeamPage() {
  _buildTrainerSelector();
  renderTeamSlots();
  renderTeamSearch();
  _buildAnalysis();
}

function _buildTrainerSelector() {
  const genTabs = document.getElementById('trainerGenTabs');
  genTabs.innerHTML = '';
  Object.keys(TRAINERS).forEach(gen => {
    const btn = document.createElement('button');
    btn.className   = 'trainer-gen-btn'+(activeTrainerGen===gen?' active':'');
    btn.textContent = gen;
    btn.onclick     = () => {
      activeTrainerGen=gen; activeTrainer=null;
      document.querySelectorAll('.trainer-gen-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _buildTrainerList();
    };
    genTabs.appendChild(btn);
  });
  _buildTrainerList();
}

function _buildTrainerList() {
  const list = document.getElementById('trainerList');
  list.innerHTML = '';
  if(!activeTrainerGen||!TRAINERS[activeTrainerGen]) return;
  Object.entries(TRAINERS[activeTrainerGen]).forEach(([tname,ids]) => {
    const btn = document.createElement('button');
    btn.className   = 'trainer-btn'+(activeTrainer===tname?' active':'');
    btn.textContent = tname;
    btn.onclick     = () => {
      activeTrainer=tname;
      for(let i=0;i<6;i++) team[i]=ids[i]??null;
      selectedSlot=-1;
      document.querySelectorAll('.trainer-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderTeamSlots(); _buildAnalysis(); renderTeamSearch();
    };
    list.appendChild(btn);
  });
}

function renderTeamSlots() {
  const el = document.getElementById('teamSlots');
  el.innerHTML = '';
  for(let i=0;i<6;i++) {
    const pid  = team[i];
    const slot = document.createElement('div');
    slot.className = ['team-slot',pid?'filled':'',selectedSlot===i?'selected':''].filter(Boolean).join(' ');

    if(pid && pokemonById[pid]) {
      const p = pokemonById[pid];
      slot.innerHTML = `
        <div class="team-slot-num">Slot ${i+1}</div>
        <img src="${SPRITE(pid)}" alt="${p.name}" style="width:64px;height:64px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div class="poke-name" style="font-size:11px;margin:4px 0">${p.name}</div>
        <div class="poke-types">${p.types.map(typeBadge).join('')}</div>
        <button class="team-slot-remove">×</button>
      `;
      slot.querySelector('.team-slot-remove').addEventListener('click', e => {
        e.stopPropagation(); removeFromTeam(i);
      });
    } else {
      slot.innerHTML = `
        <div class="team-slot-num">Slot ${i+1}</div>
        <div class="team-slot-empty">+</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">Vazio</div>
      `;
    }
    slot.addEventListener('click', () => { selectedSlot=i; renderTeamSlots(); });
    el.appendChild(slot);
  }
}

function addToTeam(pid) {
  if(team.includes(pid)) return;
  const idx = (selectedSlot>=0 && team[selectedSlot]===null)
    ? selectedSlot : team.findIndex(t=>t===null);
  if(idx===-1) return;
  team[idx] = pid;
  selectedSlot = team.findIndex(t=>t===null);
  activeTrainer=null;
  document.querySelectorAll('.trainer-btn').forEach(b=>b.classList.remove('active'));
  renderTeamSlots(); _buildAnalysis(); renderTeamSearch();
}

function removeFromTeam(idx) {
  team[idx]=null; selectedSlot=idx; activeTrainer=null;
  document.querySelectorAll('.trainer-btn').forEach(b=>b.classList.remove('active'));
  renderTeamSlots(); _buildAnalysis(); renderTeamSearch();
}

function renderTeamSearch() {
  const q    = (document.getElementById('teamSearch')?.value??'').toLowerCase().trim();
  const grid = document.getElementById('teamSearchGrid');
  grid.innerHTML = '';
  const src = q ? POKEMON.filter(p=>p.name.toLowerCase().includes(q)||String(p.id).includes(q)) : POKEMON;
  src.slice(0,150).forEach(p => {
    const card = document.createElement('div');
    card.className = 'team-mini-card'+(team.includes(p.id)?' in-team':'');
    card.innerHTML = `
      <img src="${SPRITE(p.id)}" alt="${p.name}" style="width:56px;height:56px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="font-size:9px;color:var(--muted)">#${pad(p.id,3)}</div>
      <div style="font-size:10px;font-weight:800">${p.name}</div>
      <div style="display:flex;gap:2px;justify-content:center;margin-top:3px">${p.types.map(typeBadge).join('')}</div>
    `;
    card.onclick=()=>addToTeam(p.id);
    grid.appendChild(card);
  });
}

function _buildAnalysis() {
  const panel  = document.getElementById('analysisContent');
  const active = team.filter(Boolean);
  if(!active.length){
    panel.innerHTML='<div class="empty-team-msg">Monte um time para ver a análise!</div>';
    return;
  }

  const threat2={},threat4={},coverage={};
  ALL_TYPES.forEach(t=>{threat2[t]=0;threat4[t]=0;coverage[t]=0;});

  active.forEach(pid=>{
    const p=pokemonById[pid]; if(!p) return;
    const def=getDefMult(p.types);
    ALL_TYPES.forEach(atk=>{
      if(def[atk]>=4)threat4[atk]++;
      else if(def[atk]>=2)threat2[atk]++;
    });
    ALL_TYPES.forEach(dt=>{
      const best=Math.max(...p.types.map(at=>TYPE_CHART[at]?.[dt]??1));
      if(best>=2)coverage[dt]++;
    });
  });

  const n=active.length;
  const threats=ALL_TYPES.filter(t=>threat2[t]+threat4[t]>0)
    .sort((a,b)=>(threat4[b]*10+threat2[b])-(threat4[a]*10+threat2[a]));
  const covers=ALL_TYPES.filter(t=>coverage[t]>0).sort((a,b)=>coverage[b]-coverage[a]);

  function row(type,label,pct,extra=''){
    const bg=typeColor(type),fg=LIGHT_TYPES.has(type)?'#222':'#fff';
    return `<div class="type-row">
      <span class="type-row-badge" style="background:${bg};color:${fg}">${type}</span>
      <div class="count-bar" style="background:${bg}99;width:${Math.round(pct*80)}px"></div>
      <span class="type-count">${label}${extra}</span>
    </div>`;
  }

  const tHtml = threats.length
    ? threats.map(t=>{
        const tot=threat4[t]+threat2[t];
        return row(t,`${tot}/${n}`,tot/n, threat4[t]?`<span class="tag-4x">4×</span>`:'');
      }).join('')
    : '<p class="analysis-empty">Nenhuma ameaça crítica!</p>';

  const cHtml = covers.length
    ? covers.map(t=>row(t,`${coverage[t]}/${n}`,coverage[t]/n)).join('')
    : '<p class="analysis-empty">Sem cobertura super-efetiva.</p>';

  panel.innerHTML=`
    <div class="analysis-section">
      <h4 class="threat">⚠️ Super Efetivo CONTRA o time</h4>${tHtml}
    </div>
    <div class="analysis-section">
      <h4 class="coverage">✅ Time é Super Efetivo contra</h4>${cHtml}
    </div>`;
}
