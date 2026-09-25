/* eslint-disable */
import * as DOMAIN from '@/lib/domain';
import { store, notify, REACT_VIEWS } from '@/lib/store';
import { ICONS } from '@/lib/icons';
/* =====================================================================
   Übergangsschicht: Logik des UI-Prototyps (EnergyEngel/mb-dashboard.html)
   unverändert übernommen, damit das Dashboard 1:1 gleich aussieht und sich
   gleich verhält. Wird schrittweise durch React-Komponenten und echte Daten
   (Datenbank, Pipedrive, DocuSign) ersetzt – danach entfällt diese Datei.
   ===================================================================== */
let started = false;

export function startPrototype() {
  if (started) return; /* React StrictMode ruft Effekte im Dev-Modus doppelt auf */
  started = true;
/* Geschäftsregeln (src/lib/domain.ts) und Daten aus dem gemeinsamen Store (src/lib/store.ts).
   Arrays nur in place ändern (push/splice), nie neu zuweisen – sonst sehen die React-Ansichten die Änderung nicht. */
const { PRODUCTS, STATUS, PIPELINE, FEEDBACK_FRIST_H, FEEDBACK_OPTIONS, PAYOUT_STATUS, CONTRACT_TEMPLATES, GUIDES, LOSS_REASONS, PROV, WIDERRUF_TAGE } = DOMAIN;
const { NOW, PEOPLE, ROLE_USER, LEADS, APPTS, SLOTS, PAYOUTS, CONTRACTS, EVENTS, BOARD, BOARD_ARCHIVE, PROFILES, TEAM, NOTIFS, WEEKLY, LOSS_STATS, CALL_DAY, DAY_GOAL, SETTER_BOARD, MB_STATS, BENCH, MONEY_GOAL } = store.data;
/* =====================================================================
   CORE – Zustand, Helfer, Shell (Navigation, Rollen, Theme, Overlays)
   ===================================================================== */
const ico = (n, cls='') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]||''}"/></svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = n => n.toLocaleString('de-DE', { style:'currency', currency:'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
const $ = s => document.querySelector(s);
const WD = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MON = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const pad = n => String(n).padStart(2,'0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const fmtDay = k => { const d = parseKey(k); return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth()+1)}.`; };
const fmtHour = h => `${pad(Math.floor(h))}:${h % 1 ? '30' : '00'}`;
const nowStamp = () => `${pad(NOW.getDate())}.${pad(NOW.getMonth()+1)}. ${pad(NOW.getHours())}:${pad(NOW.getMinutes())}`;
const maskIban = iban => { const c = iban.replace(/\s/g,''); return `${c.slice(0,2)}•• •••• •••• ${c.slice(-4)}`; };
const fmtIban = iban => iban.replace(/\s/g,'').replace(/(.{4})/g,'$1 ').trim();
const person = k => PEOPLE[k] || { name:k, first:k, initials:'?' };
const lead = id => LEADS.find(l => l.id === id);

/* ---------- Navigation je Rolle ---------- */
const NAV = {
  setter:[['uebersicht','Übersicht','home'],['erfassen','Lead erfassen','plus'],['leads','Pipeline','list'],['rangliste','Rangliste','trophy'],['auszahlungen','Auszahlungen','euro'],['vertraege','Verträge','doc'],['events','Events','flag'],['stammdaten','Stammdaten','user'],['neu','Weitere Funktion','plus']],
  presetter:[['uebersicht','Übersicht','home'],['leitfaden','Leitfaden','phone'],['leads','Pipeline','list'],['auszahlungen','Auszahlungen','euro'],['vertraege','Verträge','doc'],['events','Events','flag'],['stammdaten','Stammdaten','user'],['neu','Weitere Funktion','plus']],
  closer:[['uebersicht','Übersicht','home'],['kalender','Kalender','cal'],['termine','Termine','clock'],['auszahlungen','Auszahlungen','euro'],['vertraege','Verträge','doc'],['events','Events','flag'],['rangliste','Rangliste','trophy'],['stammdaten','Stammdaten','user'],['neu','Weitere Funktion','plus']],
  admin:[['uebersicht','Übersicht','home'],['team','Team & Setter','team'],['leads','Pipeline','list'],['rangliste','Ranglisten','trophy'],['events','Events','flag'],['vertraege','Verträge','doc'],['auszahlungen','Auszahlungen','euro'],['neu','Weitere Funktion','plus']],
};
const ROLE_LABEL = { setter:'Setter', presetter:'Presetter', closer:'Closer', admin:'Admin' };

/* ---------- Zustand (nur im Speicher) ---------- */
/* Gemeinsame Felder (role, view, lead*) liegen in store.ui, damit React-Ansichten sie lesen können */
const S = Object.assign(store.ui, {
  guideProduct:'wp', guideLead:null, guideSlot:null,
  calWeek:0, calDay:2,
  editProfile:false, showIban:false, editGoal:false,
  newSetter:null, contractFilter:'alle', ask:null, board:'cup',
});
/* Array in place filtern (statt neu zuzuweisen), damit der Store dasselbe Objekt behält */
const keepWhere = (arr, pred) => { for (let i = arr.length - 1; i >= 0; i--) if (!pred(arr[i])) arr.splice(i, 1); };
const me = () => ROLE_USER[S.role];

let theme = null;
try { theme = localStorage.getItem('ee-theme'); } catch(e) {}
function applyTheme(){
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#themeBtn').innerHTML = ico(dark ? 'sun' : 'moon');
}

/* ---------- Toast ---------- */
function toast(msg, icon='check'){
  const el = document.createElement('div');
  el.className = 'ee-toast'; el.setAttribute('data-component','Toast');
  el.innerHTML = `${ico(icon)}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Kopieren (mit Fallback) ---------- */
function copyText(text, label='Kopiert'){
  const fallback = () => {
    const f = $('#copyFallback'); f.value = text; f.select();
    try { document.execCommand('copy'); toast(label); } catch(e) { toast('Bitte Text manuell kopieren', 'info'); }
  };
  try {
    navigator.clipboard.writeText(text).then(() => toast(label), fallback);
  } catch(e) { fallback(); }
}

/* ---------- Benachrichtigungen ---------- */
function pushNotif(who, t, status=null){
  (NOTIFS[who] = NOTIFS[who] || []).unshift({ t, time:'gerade eben', status, unread:true });
}
const unread = () => (NOTIFS[me()]||[]).filter(n => n.unread).length;

function renderNotif(){
  const list = NOTIFS[me()] || [];
  const icoFor = n => n.status ? 'bolt' : 'bell';
  $('#notifPanel').innerHTML = `
    <div class="ee-notif__head"><h3>Benachrichtigungen</h3>
      <button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="notif-read">Alle gelesen</button></div>
    ${list.length ? list.map(n => `
      <div class="ee-notif__item ${n.unread?'is-new':''}">
        <div class="ee-notif__icon">${ico(icoFor(n),'sm')}</div>
        <div><div class="ee-notif__text">${esc(n.t)}</div>
        <div class="ee-notif__time">${esc(n.time)} ${n.status ? '· '+chip(n.status) : ''}</div></div>
      </div>`).join('') : `<div class="ee-notif__item muted">Keine Benachrichtigungen.</div>`}
    ${S.role==='setter' ? `<div class="ee-notif__foot"><button class="ee-btn ee-btn--sm ee-btn--block" data-act="notif-demo">${ico('bolt','sm')} Demo: Statusänderung aus Pipedrive simulieren</button></div>` : ''}`;
}

/* ---------- Gemeinsame Komponenten ---------- */
function chip(status){
  const s = STATUS[status]; if (!s) return '';
  return `<span class="ee-chip ${s.tone ? 'ee-chip--'+s.tone : ''}" data-component="StatusChip">${s.label}</span>`;
}
function toneChip(label, tone){ return `<span class="ee-chip ${tone ? 'ee-chip--'+tone : ''}" data-component="StatusChip">${esc(label)}</span>`; }
function steps(status){
  const MAP = {
    eingereicht:['on','','','',''], termin:['on','on','','',''], checks:['on','on','on','',''],
    verkauft:['on','on','on','win',''], ausgezahlt:['on','on','on','win','paid'], abgesagt:['fail','','','',''], verloren:['on','on','fail','',''],
  };
  return `<div data-component="PipelineSteps" title="${STATUS[status].label}"><div class="ee-steps">${MAP[status].map(c => `<i class="${c}"></i>`).join('')}</div></div>`; /* Segmente: Eingereicht · Termin · Checks · Verkauf · Ausgezahlt */
}
/* Einfärbung: Geld immer grün ('money'); Quoten/Zahlen je nach Vergleich grün ('good') oder rot ('bad') */
function perfTone(value, bench, higherIsBetter = true){
  if (!bench) return '';
  const r = higherIsBetter ? value / bench : bench / value;
  return r >= 1.15 ? 'good' : r <= 0.85 ? 'bad' : '';
}
/* Vergleich mit dem Teamschnitt als Klartext: ▲ 6 über Teamschnitt (23) */
function vsTeam(v, bench, unit='', higherIsBetter=true){
  const diff = Math.round((v - bench) * 10) / 10, better = higherIsBetter ? diff >= 0 : diff <= 0;
  if (!diff) return `genau im Teamschnitt (${bench}${unit})`;
  return `<span class="${better ? 'is-good' : 'is-bad'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toLocaleString('de-DE')}${unit} ${diff > 0 ? 'über' : 'unter'}</span> Teamschnitt (${bench}${unit})`;
}
function kpi(label, value, meta='', tone=''){
  if (tone === true) tone = 'money';
  return `<div class="ee-kpi ${tone ? 'ee-kpi--'+tone : ''}" data-component="KpiTile"><div class="ee-kpi__label">${label}</div><div class="ee-kpi__value">${value}</div>${meta?`<div class="ee-kpi__meta">${meta}</div>`:''}</div>`;
}
function pageHead(title, actions=''){
  return `<div class="ee-pagehead"><h1>${title}</h1>${actions?`<div class="row">${actions}</div>`:''}</div>`;
}
function mascot(label='Maskottchen<br>(Platzhalter)'){ return `<div class="ee-mascot" data-component="MascotSlot">${label}</div>`; }

/* ---------- Drawer ---------- */
function openDrawer(html){
  const d = $('#drawer'); d.innerHTML = html; d.classList.add('is-open'); d.setAttribute('aria-hidden','false');
  $('#backdrop').classList.add('is-open');
}
function closeOverlays(){
  $('#drawer').classList.remove('is-open'); $('#drawer').setAttribute('aria-hidden','true');
  $('#moreSheet').classList.remove('is-open');
  $('#backdrop').classList.remove('is-open');
  $('#notifPanel').hidden = true; $('#bellBtn').setAttribute('aria-expanded','false');
}
function drawerHead(title, sub=''){
  return `<div class="ee-drawer__head"><div><h2>${title}</h2>${sub?`<div class="muted" style="margin-top:4px;font-size:.88rem">${sub}</div>`:''}</div>
    <button class="ee-iconbtn" data-act="close" aria-label="Schließen">${ico('close')}</button></div>`;
}

/* ---------- Shell rendern ---------- */
function navBadge(view){
  if (view === 'vertraege') {
    const n = S.role === 'admin' ? CONTRACTS.filter(c => c.status==='open').length : CONTRACTS.filter(c => c.who===me() && c.status==='open').length;
    return n ? `<span class="ee-nav__badge">${n}</span>` : '';
  }
  if (view === 'termine' && S.role === 'closer') { const n = pendingFeedback(me()).length; return n ? `<span class="ee-nav__badge">${n}</span>` : ''; }
  return '';
}
function renderShell(){
  const items = NAV[S.role];
  const u = person(me());
  $('#sideNav').innerHTML = `<div class="ee-nav__label">${ROLE_LABEL[S.role]}</div>` + items.map(([v,l,i]) =>
    `<button class="ee-nav__item ${v==='neu'?'ee-nav__item--ghost':''}" data-act="nav" data-view="${v}" ${S.view===v?'aria-current="page"':''}>${ico(i)}<span>${l}</span>${navBadge(v)}</button>`).join('');
  $('#sideMe').innerHTML = `<div class="ee-avatar">${u.initials}</div><div><div class="ee-me__name">${esc(u.name)}</div><div class="ee-me__role">${ROLE_LABEL[S.role]} · Beispielkonto</div></div>`;
  $('#roleSeg').innerHTML = Object.keys(ROLE_LABEL).map(r => `<button data-act="role" data-role="${r}" aria-pressed="${S.role===r}">${ROLE_LABEL[r]}</button>`).join('');
  $('#roleSelect').innerHTML = Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${S.role===r?'selected':''}>${ROLE_LABEL[r]}</option>`).join('');
  const cur = items.find(i => i[0]===S.view);
  $('#topTitle').textContent = cur ? cur[1] : '';
  const n = unread();
  $('#bellBtn').innerHTML = ico('bell') + (n ? `<span class="ee-iconbtn__dot">${n}</span>` : '');
  // Mobile: 4 Hauptpunkte + „Mehr“
  const main = items.slice(0,4), rest = items.slice(4);
  const restActive = rest.some(i => i[0]===S.view);
  $('#bottomNav').innerHTML = main.map(([v,l,i]) => `<button data-act="nav" data-view="${v}" ${S.view===v?'aria-current="page"':''}>${ico(i)}<span>${({'Meine Leads':'Leads','Alle Leads':'Leads','Team & Setter':'Team','Lead erfassen':'Erfassen'})[l] || l}</span>${navBadge(v)}</button>`).join('')
    + `<button data-act="more" ${restActive?'aria-current="page"':''}>${ico('more')}<span>Mehr</span></button>`;
  $('#moreSheet').innerHTML = `<div class="ee-more__grip"></div>` + rest.map(([v,l,i]) =>
    `<button class="ee-nav__item ${v==='neu'?'ee-nav__item--ghost':''}" data-act="nav" data-view="${v}" ${S.view===v?'aria-current="page"':''}>${ico(i)}<span>${l}</span>${navBadge(v)}</button>`).join('');
}

function render(){
  if (!NAV[S.role].some(i => i[0]===S.view)) S.view = 'uebersicht';
  renderShell();
  /* Bereits umgestellte Ansichten zeichnet React (src/components/ReactViews.tsx) */
  const isReact = REACT_VIEWS.has(S.view), fn = VIEWS[S.view];
  $('#view').hidden = isReact;
  $('#view').innerHTML = !isReact && fn ? fn() : '';
  if (!$('#notifPanel').hidden) renderNotif();
  notify();
}
function go(view){ S.view = view; S.editProfile = false; S.showIban = false; closeOverlays(); render(); window.scrollTo({top:0}); }
/* =====================================================================
   VIEWS – eine Funktion je Ansicht, rollenabhängig
   ===================================================================== */
const myLeads = () => {
  const k = me();
  if (S.role === 'setter') return LEADS.filter(l => l.setter === k);
  if (S.role === 'presetter') return LEADS.filter(l => l.presetter === k);
  if (S.role === 'closer') return LEADS.filter(l => l.closer === k);
  return LEADS;
};
const hadTermin = s => ['termin','checks','verkauft','ausgezahlt','verloren'].includes(s);

/* ---------- Helfer Runde 2: Telefon, Eingangsalter, Provision ---------- */
const telFull = l => l.tel.replace('••••','4418');
const telHref = l => 'tel:' + telFull(l).replace(/\s/g,'');
function parseStamp(t){ const m = String(t).match(/(\d{2})\.(\d{2})\.\s+(\d{2}):(\d{2})/); return m ? new Date(2026, +m[2]-1, +m[1], +m[3], +m[4]) : NOW; }
const eingang = l => parseStamp(l.hist[l.hist.length-1][1]);
const ageH = l => (NOW - eingang(l)) / 36e5;
/* Überfällig: eingereicht, noch nie angerufen und älter als 24 Std. */
const isOverdue = l => l.status === 'eingereicht' && !l.attempts && !l.nextTry && ageH(l) >= 24;
function ageBadge(l){
  const h = ageH(l);
  const txt = h < 1 ? `seit ${Math.max(1,Math.round(h*60))} Min.` : h < 48 ? `seit ${Math.round(h)} Std.` : `seit ${Math.round(h/24)} Tagen`;
  return toneChip(txt, h < 2 ? 'ok' : h < 24 ? 'warn' : 'bad');
}
/* Fälligkeit aus "nextTry" (z. B. "Rückruf heute 18:00", "Do 24.09. ab 18:00", "Fr 25.09. vormittags") */
function dueAt(l){
  const t = l.nextTry || ''; if (!t) return null;
  const d = t.match(/(\d{2})\.(\d{2})\./), h = t.match(/(\d{1,2}):(\d{2})/);
  const day = d ? new Date(2026, +d[2]-1, +d[1]) : new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  day.setHours(h ? +h[1] : /vormittag/.test(t) ? 10 : 17, h ? +h[2] : 0); return day;
}
const isCallback = l => /^Rückruf/.test(l.nextTry || '');
const callbackLate = l => isCallback(l) && dueAt(l) < NOW;
/* Status-Chip für offene Anrufe – überall gleich */
function tryChip(l, short){
  if (!l.nextTry) return ageBadge(l);
  if (callbackLate(l)) return toneChip(`Rückruf überfällig (${l.nextTry.replace(/^Rückruf /,'')})`, 'bad');
  if (isCallback(l)) return toneChip(short ? l.nextTry.replace(/^Rückruf /,'') : l.nextTry.replace(/^Rückruf /,'Rückruf: '), 'info');
  return toneChip(`${short ? '' : 'Nächster Versuch: '}${l.nextTry}`, 'warn');
}
/* Anrufliste: überfällige Rückrufe und neue Leads zuerst (älteste oben), dann nach Fälligkeit */
function urgencySort(a, b){
  const grp = l => callbackLate(l) ? 0 : !l.attempts && !l.nextTry ? 1 : 2;
  return grp(a) - grp(b) || (grp(a) === 1 ? ageH(b) - ageH(a) : dueAt(a) - dueAt(b));
}
function nextTryText(n){ return n === 1 ? 'heute ab 17:00' : n === 2 ? 'Do 24.09. ab 18:00' : n < 5 ? 'Fr 25.09. vormittags' : 'letzter Versuch, danach absagen'; }

/* Provision je Lead aus Sicht der aktuellen Rolle */
function provFor(l){
  const r = S.role === 'admin' ? 'setter' : S.role, P = PROV[r];
  if (STATUS[l.status].fail) return { txt:'–', amount:0 };
  if (r === 'presetter') {
    if (['termin','checks','verkauft','ausgezahlt'].includes(l.status)) return { txt:`${eur(P.termin)} verdient`, amount:0 };
    return { txt:`+${eur(P.termin)} bei Termin`, amount:P.termin };
  }
  const a = P.abschluss; /* Setter und Closer: pauschal je Abschluss */
  if (l.status === 'verkauft') return { txt:`${eur(a)} vorläufig`, amount:0, done:true };
  if (l.status === 'ausgezahlt') return { txt:`${eur(a)} ausgezahlt`, amount:0, done:true };
  return { txt:`+${eur(a)} bei Verkauf`, amount:a };
}
const pipelineSum = leads => leads.reduce((s,l) => s + provFor(l).amount, 0);
function provCell(l){ const p = provFor(l); return `<span class="ee-prov ${p.amount ? '' : 'is-muted'}">${p.txt}</span>`; }

/* ---------- LeadTable ---------- */
function leadTable(leads, opts={}){
  if (!leads.length) return `<div class="ee-empty">Keine Leads für diesen Filter.</div>`;
  const prov = S.role !== 'admin';
  return `<div class="ee-table-wrap"><table class="ee-table ee-table--stack" data-component="LeadTable">
    <thead><tr><th>Kunde</th><th>Status</th><th>Pipeline</th>${opts.setter?'<th>Setter</th>':''}${prov?'<th>Deine Provision</th>':''}<th>Eingereicht</th></tr></thead>
    <tbody>${leads.map(l => `<tr class="is-click" data-act="lead" data-id="${l.id}" tabindex="0">
      <td><div class="who">${esc(l.kunde)}</div><div class="sub">${esc(l.ort)}</div></td>
      <td class="r-sm">${chip(l.status)}${l.reason ? `<div class="sub" style="margin-top:3px">${esc(l.reason)}</div>` : ''}</td>
      <td data-hide-sm>${steps(l.status)}</td>
      ${opts.setter?`<td data-hide-sm>${esc(person(l.setter).first)}</td>`:''}
      ${prov?`<td>${provCell(l)}</td>`:''}
      <td class="sub num">${l.datum.slice(0,6)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}
const isLost = l => !!STATUS[l.status].fail;
const activeLeads = leads => leads.filter(l => !isLost(l));

/* ---------- Lead-Details (Drawer) ---------- */
function openLead(id){
  const l = lead(id); if (!l) return;
  const appt = APPTS.find(a => a.lead === id);
  let actions = '';
  if (S.role === 'presetter' && STATUS[l.status].stage === 1 && !isLost(l))
    actions = `<div class="stack" style="gap:8px"><div class="row">${[['nicht_erreicht','Nicht erreicht'],['abgesagt','Abgesagt']].map(([s,t]) => `<button class="ee-btn ee-btn--sm" data-act="set-status" data-id="${id}" data-status="${s}">${t}</button>`).join('')}</div>
      <a class="ee-btn ee-btn--primary" href="${telHref(l)}" data-act="call" data-id="${id}">${ico('phone','sm')} Anrufen und Leitfaden öffnen</a></div>`;
  if (S.role === 'closer') { const due = APPTS.find(a => a.lead === id && needsFeedback(a));
    if (due) actions = `<button class="ee-btn ee-btn--primary" data-act="feedback" data-id="${due.id}">${ico('check','sm')} Rückmeldung geben</button>`; }
  if (S.role === 'admin')
    actions = `<div class="row"><button class="ee-btn" data-act="toast" data-msg="Würde Deal #${l.pd||'–'} in Pipedrive öffnen">${ico('ext','sm')} In Pipedrive öffnen</button></div>`;
  openDrawer(drawerHead(esc(l.kunde), esc(l.adresse || l.ort)) + `<div class="ee-drawer__body" data-component="LeadDrawer">
    <div class="row">${chip(l.status)} ${steps(l.status)}</div>
    ${l.reason ? `<div class="ee-note" style="background:var(--bad-soft)"><b>Grund:</b> ${esc(l.reason)}${l.reasonNote ? ' – ' + esc(l.reasonNote) : ''}</div>` : ''}
    <dl class="ee-facts">
      <div><dt>Lead-ID</dt><dd class="mono">${l.id}</dd></div>
      <div><dt>Pipedrive</dt><dd class="mono">${l.pd ? '#'+l.pd : 'noch nicht angelegt'}</dd></div>
      <div><dt>Eingereicht</dt><dd>${l.datum}</dd></div>
      <div><dt>Telefon</dt><dd class="mono">${S.role==='setter' ? l.tel : telFull(l)}</dd></div>
      <div><dt>Setter</dt><dd>${esc(person(l.setter).name)}</dd></div>
      <div><dt>Presetter</dt><dd>${l.presetter ? esc(person(l.presetter).name) : '–'}</dd></div>
      <div><dt>Closer</dt><dd>${l.closer ? esc(person(l.closer).name) : '–'}</dd></div>
      ${appt ? `<div><dt>Termin</dt><dd>${fmtDay(appt.date)} ${fmtHour(appt.start)}</dd></div>` : ''}
      ${l.attempts ? `<div><dt>Anrufversuche</dt><dd>${l.attempts}${l.nextTry ? ' · nächster ' + esc(l.nextTry) : ''}</dd></div>` : ''}
      ${S.role !== 'admin' ? `<div><dt>Deine Provision</dt><dd>${provCell(l)}</dd></div>` : ''}
    </dl>
    ${S.role !== 'setter' ? customerBrief(l) : ''}
    ${l.setNote ? `<div class="ee-note"><b>Aus dem Setting:</b> ${esc(l.setNote)}</div>` : ''}
    ${l.preNote ? `<div class="ee-note"><b>Aus dem Presetting:</b> ${esc(l.preNote)}</div>` : ''}
    ${actions}
    <div class="stack" style="gap:10px"><span class="eyebrow">Verlauf (aus Pipedrive)</span>
      <ul class="ee-timeline">${l.hist.map(([s,t]) => `<li><b>${esc(s)}</b> <span class="faint">· ${esc(t)}</span></li>`).join('')}</ul></div>
  </div>`);
}

/* ---------- Grund abfragen (Pflicht bei Abgesagt / Verloren) ---------- */
function openReason(id, status){
  const l = lead(id); if (!l) return;
  openDrawer(drawerHead(`Warum ${STATUS[status].label.toLowerCase()}?`, esc(l.kunde)) + `<div class="ee-drawer__body">
    <form id="reasonForm" class="stack" data-id="${id}" data-status="${status}" data-component="ReasonForm">
      <fieldset class="ee-reasons"><legend class="lbl">Grund auswählen (Pflicht)</legend>
        ${LOSS_REASONS[status].map((r,i) => `<label class="ee-reason"><input type="radio" name="reason" value="${esc(r)}" ${i===0?'required':''}><span>${esc(r)}</span></label>`).join('')}
      </fieldset>
      <div class="ee-field"><label for="reasonNote">Notiz (optional)</label><textarea class="ee-textarea" id="reasonNote" placeholder="z. B. Vermieter entscheidet, Kunde meldet sich im Frühjahr"></textarea></div>
      <div class="row"><button class="ee-btn ee-btn--danger" type="submit">Als „${STATUS[status].label}“ speichern</button><button class="ee-btn ee-btn--ghost" type="button" data-act="close">Abbrechen</button></div>
    </form></div>`);
}
/* ---------- Status ändern (Presetter/Closer) ---------- */
function setStatus(id, status, silent, reason, note){
  const l = lead(id); if (!l) return;
  const attempt = status === 'nicht_erreicht'; /* „Nicht erreicht“ = Anrufversuch ohne Erfolg, Lead bleibt in „Lead eingereicht“ */
  if (S.role === 'presetter' && l.status === 'eingereicht') CALL_DAY.done++;
  if (attempt) { l.attempts++; l.nextTry = nextTryText(l.attempts); status = 'eingereicht'; }
  else if (['termin','checks'].includes(status)) l.nextTry = null;
  l.status = status;
  if (reason) { l.reason = reason; l.reasonNote = note || ''; }
  l.hist.unshift([(attempt ? `Nicht erreicht (Versuch ${l.attempts})` : STATUS[status].label) + (reason ? ` – ${reason}` : ''), nowStamp()]);
  if (status === 'verloren') keepWhere(APPTS, a => a.lead !== id || apptEnd(a) <= NOW); /* künftige Termine entfallen, gelaufene bleiben für die Historie */
  pushNotif(l.setter, `${l.kunde}: Status → ${STATUS[status].label}${reason ? ` (${reason})` : ''}`, status);
  if (!silent) toast(attempt ? `${l.kunde}: Versuch ${l.attempts} – nächster ${l.nextTry}` : `${l.kunde}: ${STATUS[status].label} · ${person(l.setter).first} wurde benachrichtigt`);
}
/* =================== ÜBERSICHT =================== */
function viewUebersicht(){
  return ({ setter:overSetter, presetter:overPresetter, closer:overCloser, admin:overAdmin })[S.role]();
}
/* ---------- DailyGoal (Setter) – Hero-Karte ---------- */
function dailyGoal(){
  const today = myLeads().filter(l => l.datum === dkey(NOW).split('-').reverse().join('.')).length;
  const g = DAY_GOAL.goal, done = today >= g, streak = DAY_GOAL.streak + (done ? 1 : 0);
  return `<section class="ee-card ee-card--forest ee-hero ee-daygoal ${done ? 'is-done' : ''}" data-component="DailyGoal">
    <div class="ee-card__head"><span class="eyebrow">Heute</span>${done ? `<span class="ee-daygoal__badge">${ico('check','sm')} Tagesziel erreicht</span>` : `<span class="eyebrow">Ziel ${g} Leads</span>`}</div>
    <div class="ee-daygoal__main">
      <div class="ee-daygoal__num"><b class="num">${today}</b><span>/ ${g} Leads</span></div>
      <div class="ee-daygoal__bar" role="progressbar" aria-valuenow="${today}" aria-valuemax="${g}" aria-label="Tagesziel"><i style="width:${Math.min(100, today/g*100)}%"></i></div>
    </div>
    <div class="ee-week" aria-label="Diese Woche">${DAY_GOAL.week.map(([d,v]) => { const isToday = d === WD[NOW.getDay()]; const val = isToday ? today : v; const hit = val !== null && val >= g;
      return `<div class="ee-week__day ${hit?'is-hit':''} ${isToday?'is-today':''} ${val===null?'is-future':''}"><span>${d}</span><b class="num">${val===null ? '·' : val}</b></div>`; }).join('')}</div>
    <p class="ee-daygoal__streak">${ico('bolt','sm')} Serie: <b>${streak} Tage</b>${done ? '' : ` · noch <b>${g - today}</b> bis zum Ziel`}</p>
  </section>`;
}

/* ---------- MoneyGoal: Monatsziel Verdienst (Setter, Presetter, Closer) ---------- */
function moneyCard(){
  const L = myLeads(), P = PAYOUTS[me()] || [], cur = P[0];
  const rate = S.role === 'presetter' ? PROV.presetter.termin : PROV[S.role].abschluss;
  const per = S.role === 'presetter' ? 'Termine' : 'Verkäufe';
  const goal = MONEY_GOAL[me()] || 3000, earned = cur ? cur.betrag : 0;
  const soonLeads = S.role === 'presetter' ? [] : L.filter(l => ['termin','checks'].includes(l.status));
  const soon = soonLeads.length * rate;
  const pE = Math.min(100, earned / goal * 100), pS = Math.min(100 - pE, soon / goal * 100);
  const missing = Math.max(0, goal - earned - soon);
  const line = earned >= goal ? `${ico('check','sm')} Monatsziel erreicht`
    : !missing ? `Schaffbar: Wenn deine ${soonLeads.length} laufenden Termine verkaufen, kommst du auf <b>${eur(earned + soon)}</b>`
    : `Noch <b>${Math.ceil(missing / rate)} ${per}</b> bis zum Ziel${soon ? ` – zusätzlich zu ${soonLeads.length} laufenden Terminen` : ''}`;
  return `<section class="ee-card ee-goalcard" data-component="MoneyGoal">
    <div class="ee-card__head"><span class="eyebrow">Dein Geld · September</span><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="goal-edit">${ico('edit','sm')} Ziel ändern</button></div>
    ${S.editGoal ? `<form id="goalForm" class="row" style="gap:8px"><label class="sr" for="goalInput">Monatsziel in Euro</label><input class="ee-input num" id="goalInput" type="number" min="100" step="100" value="${goal}" style="max-width:160px"><button class="ee-btn ee-btn--primary ee-btn--sm" type="submit">Speichern</button></form>` : ''}
    <div class="ee-goalcard__num"><b class="num is-money">${eur(earned)}</b><span>von ${eur(goal)} Ziel</span></div>
    <div class="ee-goalbar" role="progressbar" aria-valuenow="${earned}" aria-valuemax="${goal}" aria-label="Monatsziel Verdienst"><i class="is-earned" style="width:${pE}%"></i><i class="is-soon" style="width:${pS}%"></i></div>
    <div class="ee-goalcard__legend"><span><i class="is-earned"></i>verdient</span>${soon ? `<span><i class="is-soon"></i>in Aussicht ${eur(soon)}</span>` : ''}</div>
    <p class="ee-goalcard__line">${line}</p>
    <div class="ee-goalcard__foot"><div><span class="eyebrow">Auszahlung</span><span>${cur ? `am <b>${cur.datum}</b> · ${PAYOUT_STATUS[cur.status].label}` : '–'}</span></div>
      <button class="ee-btn ee-btn--sm" data-act="nav" data-view="auszahlungen">Abrechnung ${ico('right','sm')}</button></div>
  </section>`;
}

/* ---------- SetterRankCard: Setter-Rangliste in Klartext (Startseite Setter) ---------- */
function setterRankCard(){
  const B = SETTER_BOARD, R = ranked(B.rows), my = rankOf(me(), B), n = R.length, top = R[0].val || 1;
  const above = R.filter(r => r.val > my.val).slice(-1)[0];
  return `<section class="ee-card ee-cup" data-component="SetterRankCard">
    <div class="ee-card__head"><span class="eyebrow">Setter-Rangliste · bis ${B.ends.slice(0,6)}</span><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="rangliste">Rangliste ${ico('right','sm')}</button></div>
    <div class="ee-cup__head"><b class="num">Platz ${my.rank}</b><span>von ${n} · ${my.val} ${B.unit}</span></div>
    <div class="ee-ranks">${R.map(r => `<div class="ee-ranks__row ${r.key === me() ? 'is-me' : ''}"><span>${r.rank}.</span><b>${r.key === me() ? 'Du' : esc(person(r.key).first)}</b><div class="ee-ranks__bar"><i style="width:${r.val / top * 100}%"></i></div><span class="num">${r.val}</span></div>`).join('')}</div>
    <p class="ee-cup__list" style="display:block">${above ? `Noch <b>${above.val - my.val + 1} ${B.unit}</b> bis Platz ${above.rank}` : '<b>Du führst die Setter-Rangliste</b>'}</p>
  </section>`;
}

/* ---------- CupCard: Wärmepumpen-Cup in Klartext (Closer) ---------- */
function cupCard(){
  const R = ranked(BOARD.rows), my = rankOf(me()), n = R.length;
  const next = my.val < 5 ? 5 : my.val < 10 ? 10 : null;
  const prize = next === 5 ? '200 € Gutschein' : '500 € Tank-/Reisegutschein';
  const third = R.find(r => r.rank <= 3 && R.filter(x => x.rank <= 3).slice(-1)[0] === r) || R[2];
  const toPodium = my.rank > 3 ? third.val - my.val : 0; /* Gleichstand zählt als Podestplatz */
  const max = 10;
  const total = BOARD.rows.reduce((s,r) => s + r[1], 0);
  return `<section class="ee-card ee-cup" data-component="CupCard">
    <div class="ee-card__head"><span class="eyebrow">Wärmepumpen-Cup · bis ${BOARD.ends.slice(0,6)}</span><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="rangliste">Rangliste ${ico('right','sm')}</button></div>
    <div class="ee-cup__head"><b class="num">Platz ${my.rank}</b><span>von ${n} · ${my.val} Anlagen</span></div>
    <div class="ee-ladder" aria-label="Fortschritt bis zur Prämie">
      <div class="ee-ladder__track"><i style="width:${Math.min(100, my.val / max * 100)}%"></i></div>
      <div class="ee-ladder__marks">${[5,10].map(m => `<span class="${my.val >= m ? 'is-hit' : ''}" style="left:${m / max * 100}%"><b>${m}</b><small>${m === 5 ? '200 €' : '500 €'}</small></span>`).join('')}<span class="is-me" style="left:${Math.min(100, my.val / max * 100)}%"><b>Du</b></span></div>
    </div>
    <ul class="ee-cup__list">
      ${next ? `<li>Noch <b>${next - my.val} Anlagen</b> bis <b class="is-money">${prize}</b></li>` : '<li>Beide Prämienstufen erreicht</li>'}
      ${toPodium > 0 ? `<li>Noch <b>${toPodium} Anlagen</b> bis Platz 3 <b class="is-money">+100 €</b></li>` : my.rank === 1 ? '<li>Du führst – <b class="is-money">+200 €</b></li>' : '<li>Du bist auf dem Podest – <b class="is-money">+100 €</b></li>'}
      <li class="faint">Team: ${total} von ${BOARD.goal} Anlagen</li>
    </ul>
  </section>`;
}
function overSetter(){
  const L = myLeads(), sep = L.filter(l => l.datum.includes('.09.'));
  const q = L.filter(l => hadTermin(l.status)).length;
  const rank = rankOf(me());
  const nextEvent = EVENTS.slice().sort((a,b) => a.date.localeCompare(b.date))[0];
  const m = MB_STATS.find(x => x.key === me()) || { leads:sep.length, termin:q }; const qq = Math.round(m.termin/m.leads*100);
  /* Reihenfolge nach Priorität: Geld · Heute · Eingereicht · Quote · Setter-Rangliste · Letzte Leads · (Event, Verlauf) */
  return pageHead(`Hallo ${person(me()).first}`)
  + `<div class="ee-grid g-hero">${moneyCard()}${dailyGoal()}</div>
    <div class="ee-grid g-setter2">
      <div class="ee-setter-kpis">${kpi('Eingereichte Leads · Sep.', m.leads, vsTeam(m.leads, BENCH.setterLeads), perfTone(m.leads, BENCH.setterLeads))}
      ${kpi('Terminquote', qq + ' %', vsTeam(qq, BENCH.setterTermin, ' %'), perfTone(qq, BENCH.setterTermin))}</div>
      ${setterRankCard()}
    </div>
    <section class="ee-card ee-card--flush"><div class="ee-card__head"><h2>Letzte Leads</h2><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="leads">Alle ${ico('right','sm')}</button></div>
      ${leadTable(activeLeads(L).sort((a,b) => b.id.localeCompare(a.id)).slice(0,5))}</section>
    <div class="ee-grid g-2" style="align-items:start">
      ${nextEvent ? `<section class="ee-card"><div class="ee-card__head"><h2>Nächstes Event</h2></div>${eventCard(nextEvent)}</section>` : ''}
      <section class="ee-card" data-component="StatusFeed"><div class="ee-card__head"><h2>Verlauf</h2>${unread() ? `<span class="ee-chip ee-chip--info">${unread()} neu</span>` : ''}</div>
        <div class="ee-feed">${(NOTIFS[me()]||[]).slice(0,4).map(n => `<div class="ee-feed__row ${n.unread ? 'is-new' : ''}">${n.status ? chip(n.status) : '<span class="ee-chip">Info</span>'}<div class="ee-feed__main"><div class="ee-feed__text">${esc(n.t)}</div><div class="ee-feed__time">${esc(n.time)}</div></div></div>`).join('')}</div>
      </section>
    </div>`;
}
/* ---------- CallQueue: Anrufliste (Presetter) ---------- */
function callQueue(queue){
  if (!queue.length) return `<div class="ee-empty">Alle Leads sind angerufen.</div>`;
  return `<div class="ee-calls">${queue.map(l => `<div class="ee-call ${isOverdue(l) || callbackLate(l) ? 'is-over' : ''}">
      <button class="ee-call__who" data-act="lead" data-id="${l.id}"><b>${esc(l.kunde)}</b><span>${esc(l.ort)} · von ${esc(person(l.setter).first)}</span><span class="mono">${telFull(l)}</span></button>
      <div class="ee-call__meta">${tryChip(l)}<span class="faint">${l.attempts ? `${l.attempts}. Versuch` : 'noch nicht angerufen'}</span></div>
      <div class="ee-call__actions"><button class="ee-btn ee-btn--sm" data-act="set-status" data-id="${l.id}" data-status="nicht_erreicht">Nicht erreicht</button><a class="ee-btn ee-btn--primary ee-btn--sm" href="${telHref(l)}" data-act="call" data-id="${l.id}">${ico('phone','sm')} Anrufen</a></div>
    </div>`).join('')}</div>`;
}
function overPresetter(){
  const L = myLeads();
  const queue = L.filter(l => l.status === 'eingereicht').sort(urgencySort);
  const overdue = queue.filter(l => isOverdue(l) || callbackLate(l)).length;
  const q = L.filter(l => hadTermin(l.status)).length;
  return pageHead(`Hallo ${person(me()).first}`)
  + `<div class="ee-grid g-main" style="align-items:start">
    <div class="stack" style="gap:18px">
      <div class="ee-grid g-kpi4">${kpi('Anrufe heute', `${CALL_DAY.done} <small>von ${CALL_DAY.goal}</small>`, `<span class="ee-kpi__bar"><i style="width:${Math.min(100, CALL_DAY.done / CALL_DAY.goal * 100)}%"></i></span>`, CALL_DAY.done >= CALL_DAY.goal ? 'good' : '')}${kpi('Überfällig', overdue, overdue ? 'Neu > 24 Std. oder Rückruf verpasst' : 'alles im Plan', overdue ? 'bad' : 'good')}${kpi('Ø bis Erstanruf', '3,4 <small>Std.</small>', `<span class="is-bad">▲ 1,4 Std.</span> über Ziel (${BENCH.firstCallH} Std.)`, perfTone(BENCH.firstCallMe, BENCH.firstCallH, false))}${kpi('Terminquote', BENCH.presetterTerminMe + ' %', vsTeam(BENCH.presetterTerminMe, BENCH.presetterTermin, ' %'), perfTone(BENCH.presetterTerminMe, BENCH.presetterTermin))}</div>
      <section class="ee-card ee-card--flush" data-component="CallQueue"><div class="ee-card__head"><h2>Anrufliste</h2><span class="ee-chip ${queue.length ? 'ee-chip--info' : 'ee-chip--pos'}">${queue.length} offen</span></div>${callQueue(queue)}</section>
    </div>
    <div class="stack" style="gap:18px">
      ${moneyCard()}
      <section class="ee-card"><div class="ee-card__head"><h2>Freie Closer-Slots</h2><span class="muted">Leo</span></div>
      <div class="ee-list">${closerPaused('leo') ? `<div class="ee-alert ee-alert--bad">${ico('lock','sm')} Leo ist pausiert – offene Rückmeldungen</div>` : ''}${freeSlots('leo').slice(0,4).map(s => `<div class="ee-list__row"><div class="ee-list__main"><div class="ee-list__title">${fmtDay(s.date)} · ${fmtHour(s.start)} Uhr</div></div><span class="ee-chip ee-chip--pos">frei</span></div>`).join('')}</div></section>
    </div></div>`;
}
/* ---------- CloserMoneyHero: Geld auf einen Blick (Closer-Startseite) ---------- */
function closerMoneyHero(){
  const P = PAYOUTS[me()] || [], cur = P[0], rate = PROV.closer.abschluss;
  const goal = MONEY_GOAL[me()] || 8000, earned = cur ? cur.betrag : 0;
  const open = myLeads().filter(l => ['termin','checks'].includes(l.status)).length, soon = open * rate;
  const pE = Math.min(100, earned / goal * 100), pS = Math.min(100 - pE, soon / goal * 100);
  const toGoal = Math.max(0, Math.ceil((goal - earned) / rate));
  return `<section class="ee-card ee-card--forest ee-hero ee-chero" data-component="CloserMoneyHero">
    <div class="ee-card__head"><span class="eyebrow">Dein Geld · September</span><button class="ee-btn ee-btn--sm" data-act="goal-edit">${ico('edit','sm')} Ziel</button></div>
    ${S.editGoal ? `<form id="goalForm" class="row" style="gap:8px"><label class="sr" for="goalInput">Monatsziel in Euro</label><input class="ee-input num" id="goalInput" type="number" min="100" step="100" value="${goal}" style="max-width:160px"><button class="ee-btn ee-btn--accent ee-btn--sm" type="submit">Speichern</button></form>` : ''}
    <div class="ee-chero__num"><b class="num">${eur(earned)}</b><span>von ${eur(goal)}</span></div>
    <div class="ee-chero__bar" role="progressbar" aria-valuenow="${earned}" aria-valuemax="${goal}" aria-label="Monatsziel"><i class="is-earned" style="width:${pE}%"></i><i class="is-soon" style="width:${pS}%"></i></div>
    <div class="ee-chero__stats">
      <div><b class="num">${toGoal ? toGoal + (toGoal === 1 ? ' Verkauf' : ' Verkäufe') : '✓'}</b><span>${toGoal ? 'bis zum Ziel' : 'Ziel erreicht'}</span></div>
      <div><b class="num">+${eur(soon)}</b><span>in Aussicht · ${open} Kunden</span></div>
      <button data-act="nav" data-view="auszahlungen"><b class="num">${cur ? cur.datum.slice(0,6) : '–'}</b><span>Auszahlung ${ico('right','sm')}</span></button>
    </div>
  </section>`;
}
function overCloser(){
  const up = APPTS.filter(a => a.closer === me() && apptEnd(a) > NOW).sort((a,b) => apptStart(a) - apptStart(b));
  const due = pendingFeedback(me()).sort((a,b) => feedbackDue(a) - feedbackDue(b));
  const inChecks = LEADS.filter(l => l.closer === me() && l.status === 'checks' && !APPTS.some(a => a.lead === l.id && a.kind === 'closing' && !a.feedback));
  const nextWeek = SLOTS.filter(s => s.closer === me() && s.date >= '2026-09-28' && s.date <= '2026-10-04').length;
  const dueChip = a => { const d = feedbackDue(a), h = (d - NOW) / 36e5; return toneChip(h < 0 ? 'überfällig' : `bis ${fmtDue(d)}`, h < 0 ? 'bad' : h < 6 ? 'bad' : 'warn'); };
  /* Aufgaben: nur was jetzt zu tun ist, dringendstes zuerst */
  const todo = [
    ...due.map(a => ({ tone: feedbackDue(a) < NOW || (feedbackDue(a) - NOW) < 216e5 ? 'bad' : 'warn', title:lead(a.lead).kunde, sub:`Ergebnis ${kindLabel(a)} · ${fmtDay(a.date)}`, right:dueChip(a), act:`data-act="feedback" data-id="${a.id}"` })),
    ...inChecks.map(l => ({ tone:'info', title:l.kunde, sub:`Ergebnis aus den Checks`, right:toneChip('offen','info'), act:`data-act="feedback" data-id="LEAD:${l.id}"` })),
    ...(nextWeek < 4 ? [{ tone:'warn', title:'Slots nächste Woche', sub: nextWeek ? `erst ${nextWeek} eingetragen` : 'noch keine eingetragen', right:toneChip(`${nextWeek} / 4`, 'warn'), act:'data-act="nav" data-view="kalender"' }] : []),
  ];
  const week = up.filter(a => a.date <= '2026-09-27');
  return pageHead(`Hallo ${person(me()).first}`)
  + (closerPaused(me()) ? pausedBanner() : '')
  + closerMoneyHero()
  + `<div class="ee-grid g-2" style="align-items:start">
    <section class="ee-card" data-component="CloserTasks"><div class="ee-card__head"><h2>Zu erledigen</h2>${todo.length ? `<span class="ee-count ${todo.some(t => t.tone === 'bad') ? 'is-bad' : ''}">${todo.length}</span>` : ''}</div>
      ${todo.length ? `<div class="ee-todo">${todo.map(t => `<button class="ee-todo__row is-${t.tone}" ${t.act}><div class="ee-list__main"><div class="ee-list__title">${esc(t.title)}</div><div class="ee-list__sub">${esc(t.sub)}</div></div><span class="ee-todo__right">${t.right}</span>${ico('right','sm')}</button>`).join('')}</div>
        ${due.length ? `<p class="ee-rule">${ico('lock','sm')} Ohne Rückmeldung nach 24 Std. keine neuen Leads</p>` : ''}`
      : `<div class="ee-alert ee-alert--ok">${ico('check','sm')} Alles erledigt</div>`}
    </section>
    <section class="ee-card" data-component="CloserWeek"><div class="ee-card__head"><h2>Diese Woche</h2><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="termine">Alle ${ico('right','sm')}</button></div>
      ${week.length ? `<div class="ee-agenda">${week.map(a => { const d = parseKey(a.date); return `<button class="ee-agenda__row" data-act="nav" data-view="termine"><span class="ee-agenda__day"><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b></span><span class="ee-agenda__time num">${fmtHour(a.start)}</span><div class="ee-list__main"><div class="ee-list__title">${esc(lead(a.lead).kunde)}</div><div class="ee-list__sub">${kindLabel(a)} · ${esc(a.ort)}</div></div>${relWhen(a)}</button>`; }).join('')}</div>` : `<div class="ee-empty">Keine Termine mehr diese Woche</div>`}
    </section></div>`;
}
function overAdmin(){
  const openC = CONTRACTS.filter(c => c.status==='open').length;
  const funnel = [['Eingereicht',146],['Termin gelegt',58],['In den Checks',39],['Verkauft',27]];
  const max = Math.max(...WEEKLY.map(w => w[1]));
  const payOpen = Object.values(PAYOUTS).flat().filter(p => p.status !== 'ausgezahlt').reduce((s,p) => s + p.betrag, 0);
  const inactive = MB_STATS.filter(m => m.days >= 3);
  const lossMax = Math.max(...LOSS_STATS.map(x => x[1]));
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const team = MB_STATS.reduce((t,m) => ({ leads:t.leads+m.leads, termin:t.termin+m.termin, checks:t.checks+m.checks, verkauft:t.verkauft+m.verkauft }), { leads:0, termin:0, checks:0, verkauft:0 });
  const quoteCell = (v, avg) => { const t = perfTone(v, avg); return `<div class="ee-quote"><span class="num ${t ? 'is-'+t : ''}">${v} %</span><i><b class="${t ? 'is-'+t : ''}" style="width:${Math.min(100,v)}%"></b></i></div>`; };
  const avgQ = pct(team.termin, team.leads), avgT = pct(team.checks, team.leads), avgA = pct(team.verkauft, team.leads);
  const todo = [
    ...['leo'].filter(k => pendingFeedback(k).length).map(k => ({ tone: closerPaused(k) ? 'bad' : 'warn', chip: closerPaused(k) ? 'Pausiert' : 'Offen', title:`${person(k).first}: ${pendingFeedback(k).length} Rückmeldungen offen`, sub: pendingFeedback(k).map(a => lead(a.lead).kunde).join(', '), act:`data-act="team-row" data-key="${k}"` })),
    ...inactive.map(m => ({ tone: m.days >= 5 ? 'bad' : 'warn', chip:'Inaktiv', title:`${person(m.key).first} seit ${m.days} Tagen ohne Lead`, sub:`Letzter Lead am ${m.last}`, act:`data-act="team-row" data-key="${m.key}"` })),
    ...CONTRACTS.filter(c => c.question).map(c => ({ tone:'warn', chip:'Klären', title:`Rückfrage von ${person(c.who).first}`, sub:c.question, act:'data-act="nav" data-view="vertraege"' })),
    { tone:'warn', chip:'Offen', title:`${openC} Verträge nicht unterschrieben`, sub:'Erinnerung per DocuSign', act:'data-act="nav" data-view="vertraege"' },
    { tone:'info', chip:'Freigeben', title:'2 Abrechnungen in Prüfung', sub:'Auszahlung am 15.10.2026', act:'data-act="nav" data-view="auszahlungen"' },
  ];
  return pageHead('Gesamtübersicht', `<button class="ee-btn ee-btn--primary" data-act="nav" data-view="team">${ico('plus','sm')} Setter anlegen</button><button class="ee-btn" data-act="nav" data-view="events">${ico('flag','sm')} Event posten</button>`)
  + `<div class="ee-grid g-kpi">${kpi('Leads eingereicht', 146, '+12 % ggü. August', perfTone(146, 125))}${kpi('Terminquote', '40 %', 'Ziel 42 %', perfTone(40, 42))}${kpi('In den Checks', 39, '11 diese Woche')}${kpi('Verkauft', 27, 'Soll heute: 50 von 65', perfTone(27, 50))}${kpi('Offene Verträge', openC, 'DocuSign', openC ? 'bad' : 'good')}${kpi('Auszahlungen offen', eur(payOpen), 'zum 15.10.', 'money')}</div>
  <div class="ee-grid g-main" style="align-items:start">
    <section class="ee-card" data-component="Funnel"><div class="ee-card__head"><h2>Pipeline September</h2><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="leads">Board ${ico('right','sm')}</button></div>
      <div class="ee-flow">${[['Eingereicht',146,null,null],['Termin gelegt',58,42,'termin'],['In den Checks',39,65,'checks'],['Verkauf',27,70,'verkauft']].map(([k,n,target,cls],i,arr) => {
        const conv = i ? Math.round(n / arr[i-1][1] * 100) : null, t = conv !== null ? perfTone(conv, target) : '';
        return `${i ? `<div class="ee-flow__arrow ${t ? 'is-' + t : ''}"><b class="num">${conv} %</b><small>Ziel ${target} %</small></div>` : ''}<div class="ee-flow__step ${cls ? 'is-' + cls : ''}"><b class="num">${n}</b><span>${k}</span></div>`; }).join('')}</div>
      <div class="ee-flow__total">Von 146 eingereichten Leads wurden <b class="is-money">27 verkauft (${Math.round(27/146*100)} %)</b></div>
      <hr class="divider">
      <div class="ee-card__head"><h3>Eingereichte Leads je Woche</h3></div>
      <div class="ee-bars" data-component="BarChart">${WEEKLY.map(([k,v],i) => `<div class="ee-bars__col ${i===WEEKLY.length-1?'is-cur':''}"><span class="ee-bars__v">${v}</span><div class="ee-bars__bar" style="height:${v/max*100}%"></div><span class="ee-bars__l">${k}</span></div>`).join('')}</div></section>
    <section class="ee-card" data-component="TodoList"><div class="ee-card__head"><h2>Handlungsbedarf</h2><span class="ee-chip ee-chip--bad">${todo.length}</span></div>
      <div class="ee-todo">${todo.map(t => `<button class="ee-todo__row is-${t.tone}" ${t.act}><div class="ee-list__main"><div class="ee-list__title">${esc(t.title)}</div><div class="ee-list__sub">${esc(t.sub)}</div></div>${toneChip(t.chip, t.tone)}</button>`).join('')}</div></section>
  </div>
  <div class="ee-grid g-main" style="align-items:start">
    <section class="ee-card ee-card--flush" data-component="QuoteTable"><div class="ee-card__head"><h2>Quoten je Setter</h2><span class="muted">September</span></div>
      <div class="ee-table-wrap"><table class="ee-table ee-table--stack"><thead><tr><th>Setter</th><th class="r">Leads</th><th>Termin</th><th>Checks</th><th>Verkauft</th><th>Letzter Lead</th></tr></thead><tbody>
      ${MB_STATS.map(m => `<tr class="is-click" data-act="team-row" data-key="${m.key}" tabindex="0"><td class="who">${esc(person(m.key).first)}</td><td class="r num">${m.leads}</td>
        <td data-hide-sm>${quoteCell(pct(m.termin,m.leads), avgQ)}</td><td data-hide-sm>${quoteCell(pct(m.checks,m.leads), avgT)}</td><td>${quoteCell(pct(m.verkauft,m.leads), avgA)}</td>
        <td class="r-sm">${m.days >= 5 ? toneChip(`seit ${m.days} Tagen`,'bad') : m.days >= 3 ? toneChip(`seit ${m.days} Tagen`,'warn') : `<span class="sub">${m.days ? 'gestern' : 'heute'}</span>`}</td></tr>`).join('')}
      <tr><td class="who">Team</td><td class="r num"><b>${team.leads}</b></td><td data-hide-sm class="num">${avgQ} %</td><td data-hide-sm class="num">${avgT} %</td><td class="num">${avgA} %</td><td data-hide-sm></td></tr>
      </tbody></table></div></section>
    <section class="ee-card" data-component="LossReasons"><div class="ee-card__head"><h2>Verlustgründe</h2><span class="muted">September</span></div>
      <div class="ee-funnel">${LOSS_STATS.map(([k,v]) => `<div class="ee-funnel__row ee-funnel__row--loss"><span>${k}</span><div class="ee-funnel__track"><i style="width:${v/lossMax*100}%"></i></div><b class="num" style="text-align:right">${v}</b></div>`).join('')}</div></section>
  </div>
  <section class="ee-card ee-card--flush"><div class="ee-card__head"><h2>Neueste Leads</h2><button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="nav" data-view="leads">Pipeline ${ico('right','sm')}</button></div>${leadTable(activeLeads(LEADS).sort((a,b) => b.id.localeCompare(a.id)).slice(0,6), {setter:true})}</section>`;
}
/* =================== LEITFADEN (Presetter) =================== */
function freeSlots(closer, ignorePause){ if (!ignorePause && closerPaused(closer)) return []; return SLOTS.filter(s => s.closer===closer && (s.date > dkey(NOW) || (s.date===dkey(NOW) && s.start > NOW.getHours()))).sort((a,b) => (a.date+pad(a.start)).localeCompare(b.date+pad(b.start))); }
/* ---------- Telefonleitfaden (Presetter) ---------- */
const guideQueue = () => LEADS.filter(l => l.presetter === me() && l.status === 'eingereicht').sort(urgencySort);
/* zwei Terminvorschläge an unterschiedlichen Tagen */
function twoSlots(slots){ const a = slots[0], b = slots.find(s => a && s.date !== a.date) || slots[1]; return [a, b]; }
function viewLeitfaden(){
  const queue = guideQueue();
  const l = queue.find(x => x.id === S.guideLead) || queue[0];
  if (!l) return pageHead('Telefonleitfaden') + `<div class="ee-empty" data-component="EmptyState">${ico('check')}<h2>Alle Anrufe erledigt</h2><p>Neue Leads erscheinen hier automatisch.</p></div>`;
  S.guideLead = l.id;
  const g = GUIDES.wp, slots = freeSlots('leo'), [s1, s2] = twoSlots(slots);
  const fill = t => t.replace('{anrede}', l.anrede).replace('{me}', person(me()).first).replace('{setter}', person(l.setter).first)
    .replace('{closer}', 'Leo').replace('{slot1}', s1 ? `${fmtDay(s1.date)} um ${fmtHour(s1.start)} Uhr` : '…').replace('{slot2}', s2 ? `${fmtDay(s2.date)} um ${fmtHour(s2.start)} Uhr` : '…');
  const hi = t => esc(fill(t)).replace(esc(l.anrede), `<em>${esc(l.anrede)}</em>`);
  const vq = l.vq || {}, p = vqProgress(vq);
  const byDay = {}; slots.forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
  const sel = SLOTS.find(s => s.id === S.guideSlot);
  const idx = queue.indexOf(l), next = queue[idx + 1];
  const secCount = s => { const fs = s.fields.filter(f => !f.showIf || vq[f.showIf[0]] === f.showIf[1]); return `${fs.filter(f => vq[f.n] !== undefined && vq[f.n] !== '').length}/${fs.length}`; };
  return pageHead('Telefonleitfaden', `<span class="ee-chip ee-chip--info">${idx + 1} von ${queue.length} in der Anrufliste</span>`)
  + `<section class="ee-callbar" data-component="CallBar">
      <div class="ee-callbar__who"><b>${esc(l.kunde)}</b><span>${esc(l.ort)} · ${l.attempts ? l.attempts + '. Versuch' : 'Erstanruf'}</span></div>
      <a class="ee-btn ee-btn--primary" href="${telHref(l)}">${ico('phone','sm')} ${telFull(l)}</a>
      <div class="ee-callbar__out">
        <button class="ee-btn ee-btn--sm" data-act="set-status" data-id="${l.id}" data-status="nicht_erreicht">Nicht erreicht</button>
        <button class="ee-btn ee-btn--sm" data-act="guide-callback" data-id="${l.id}">${ico('clock','sm')} Rückruf vereinbaren</button>
        <button class="ee-btn ee-btn--sm ee-btn--danger" data-act="set-status" data-id="${l.id}" data-status="abgesagt">Abgesagt</button>
        ${next ? `<button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="guide-pick" data-id="${next.id}">Nächster ${ico('right','sm')}</button>` : ''}
      </div>
    </section>
    <div class="ee-guide" data-component="CallGuide">
    <aside class="stack ee-guide__side" style="gap:14px">
      <section class="ee-card" data-component="CustomerInfo">
        <div class="row">${tryChip(l)}</div>
        <dl class="ee-facts" style="grid-template-columns:1fr 1fr"><div><dt>Erfasst von</dt><dd>${esc(person(l.setter).first)} · ${l.datum.slice(0,6)}</dd></div><div><dt>Versuche</dt><dd>${l.attempts || 'noch keiner'}</dd></div>${l.adresse ? `<div style="grid-column:1/-1"><dt>Adresse</dt><dd>${esc(l.adresse)}</dd></div>` : ''}</dl>
        ${l.setNote ? `<div class="ee-note"><b>Von der Tür:</b> ${esc(l.setNote)}</div>` : ''}
        ${customerBrief(l)}
      </section>
      <details class="ee-card ee-queue" ${S.guideQueueOpen ? 'open' : ''} data-component="QueueList"><summary><h3>Anrufliste</h3><span class="ee-chip">${queue.length}</span></summary>
        <div class="ee-queue__list">${queue.map(x => `<button class="ee-queue__row ${x.id === l.id ? 'is-current' : ''}" data-act="guide-pick" data-id="${x.id}"><span><b>${esc(x.kunde)}</b><small>${esc(x.ort)}</small></span>${tryChip(x, true)}</button>`).join('')}</div>
      </details>
    </aside>
    <section class="ee-card ee-guide__main">
      <div class="stack" style="gap:26px;padding:4px 0 0 14px">
        <div class="ee-phase" data-step="1"><h3>Begrüßung</h3><p class="ee-script">${hi(g.intro)}</p></div>
        <div class="ee-phase" data-step="2"><div class="row row--between"><h3>Vorqualifizierung</h3><div class="ee-vq__stats ee-vq__stats--sm"><div><b class="num" id="pqProgress">${p.done}/${p.total}</b><span>beantwortet</span></div><div><b class="num" id="pqHeat">${heatText(vq)}</b><span>Heizlast (Schätzung)</span></div></div></div>
          ${p.done ? `<div class="ee-alert ee-alert--ok">${ico('check','sm')} ${p.done} Antworten kommen schon von der Tür – nur Offenes fragen</div>` : ''}
          <form id="pqForm" class="stack" style="gap:8px" novalidate data-component="VqForm">${VQ_SECTIONS.map((s,i) => `<details class="ee-vqsec" ${i === 0 && !p.done ? 'open' : ''}><summary><span>${s.title}</span><span class="ee-vqsec__count num">${secCount(s)}</span></summary><div class="ee-form">${s.fields.map(f => wizField(f, 'pq')).join('')}</div></details>`).join('')}</form>
          <div class="ee-field"><label for="guideNote">Notiz für den Closer</label><textarea class="ee-textarea" id="guideNote" placeholder="z. B. Ehefrau entscheidet mit, Heizung tropft, will vor dem Winter umsteigen">${esc(l.preNote || '')}</textarea></div></div>
        <div class="ee-phase" data-step="3"><h3>Einwände</h3>${g.objections.map(([o,a]) => `<details class="ee-objection"><summary>${esc(o)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
        <div class="ee-phase" data-step="4"><h3>Termin legen</h3><p class="ee-script">${hi(g.close)}</p>
          ${closerPaused('leo') ? `<div class="ee-alert ee-alert--bad">${ico('lock','sm')} Leo ist pausiert – offene Rückmeldungen</div>` : ''}
          <div data-component="SlotPicker">${Object.entries(byDay).slice(0,5).map(([k, ss]) => `<div class="ee-slotpick__day"><b>${fmtDay(k)}</b><div class="ee-slotpick">${ss.map(s => `<button class="ee-slotpick__btn" data-act="guide-slot" data-slot="${s.id}" aria-pressed="${S.guideSlot === s.id}">${fmtHour(s.start)}</button>`).join('')}</div></div>`).join('') || '<p class="muted">Keine freien Termine.</p>'}</div>
          <button class="ee-btn ee-btn--primary" data-act="book-slot" data-slot="${sel ? sel.id : ''}" data-id="${l.id}" ${sel ? '' : 'disabled'}>${ico('cal','sm')} ${sel ? `Termin ${fmtDay(sel.date)} ${fmtHour(sel.start)} eintragen` : 'Termin auswählen'}</button></div>
      </div>
    </section></div>`;
}
/* Nach einer Aktion im Leitfaden automatisch zum nächsten Kunden */
function guideAdvance(fromId){
  const nxt = guideQueue().find(x => x.id !== fromId); /* immer der dringendste offene Lead */
  S.guideSlot = null;
  if (nxt) { S.guideLead = nxt.id; toast(`Nächster Anruf: ${nxt.kunde}`, 'phone'); }
}
function openCallback(id){
  const l = lead(id);
  const days = [...Array(10)].map((_,i) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + i)).filter(x => x.getDay() !== 0);
  openDrawer(drawerHead('Rückruf vereinbaren', esc(l.kunde)) + `<div class="ee-drawer__body"><form id="callbackForm" class="stack" data-id="${id}" data-component="CallbackForm">
    <div class="ee-form"><div class="ee-field"><label for="cbDate">Tag</label><select class="ee-select" id="cbDate">${days.map(x => `<option value="${dkey(x)}">${dkey(x) === dkey(NOW) ? 'heute' : fmtDay(dkey(x))}</option>`).join('')}</select></div>
    <div class="ee-field"><label for="cbTime">Uhrzeit</label><select class="ee-select" id="cbTime">${[8,9,10,11,12,13,14,15,16,17,18,19].map(h => `<option ${h === 18 ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></div></div>
    <div class="ee-field"><label for="cbNote">Notiz (optional)</label><input class="ee-input" id="cbNote" placeholder="z. B. Ehemann ist dann zu Hause"></div>
    <button class="ee-btn ee-btn--primary" type="submit">${ico('check','sm')} Rückruf speichern</button></form></div>`);
}
/* =================== KALENDER (Closer) =================== */
const mobileCal = () => matchMedia('(max-width: 900px)').matches;
function weekDays(){
  const mon = new Date(2026, 8, 21 + S.calWeek*7);
  return [...Array(7)].map((_,i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+i));
}
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];
function isPast(k, h){ const d = parseKey(k); d.setHours(h); return d < NOW; }
function slotAt(k,h){ return SLOTS.find(s => s.closer===me() && s.date===k && s.start===h); }
function apptAt(k,h){ return APPTS.find(a => a.closer===me() && a.date===k && Math.floor(a.start)===h); }
function calCell(k, h){
  const a = apptAt(k,h), s = slotAt(k,h), past = isPast(k,h);
  if (a) { const l = lead(a.lead); return `<div class="ee-cal__cell" style="cursor:default"><button class="ee-slot ee-slot--appt ${past?'ee-slot--past':''} ${needsFeedback(a) ? 'is-due' : ''}" style="height:${a.dur*52-6}px" data-act="appt" data-id="${a.id}" title="${esc(l.kunde)} · ${kindLabel(a)}"><b>${fmtHour(a.start)}</b><span>${esc(l.kunde)}</span><small>${kindLabel(a)}</small></button></div>`; }
  if (s) return `<div class="ee-cal__cell" style="cursor:default"><button class="ee-slot ee-slot--free" style="height:46px" data-act="slot-remove" data-id="${s.id}" title="Freier Slot – klicken zum Entfernen" aria-label="Freien Slot ${fmtDay(k)} ${fmtHour(h)} entfernen"><b>${fmtHour(h)}</b><span>frei</span></button></div>`;
  if (past) return `<div class="ee-cal__cell is-past" aria-hidden="true"></div>`;
  return `<button class="ee-cal__cell" data-act="cal-add" data-date="${k}" data-h="${h}" aria-label="Freien Slot ${fmtDay(k)} ${fmtHour(h)} eintragen"></button>`;
}
function viewKalender(){
  const days = weekDays();
  const title = `${pad(days[0].getDate())}.${pad(days[0].getMonth()+1)}. – ${pad(days[6].getDate())}.${pad(days[6].getMonth()+1)}.`;
  const nav = `<div class="row"><button class="ee-iconbtn" data-act="cal-week" data-dir="-1" aria-label="Vorige Woche">${ico('left')}</button><b class="num" style="min-width:120px;text-align:center">${title}</b><button class="ee-iconbtn" data-act="cal-week" data-dir="1" aria-label="Nächste Woche">${ico('right')}</button></div>`;
  const inWeek = x => days.some(d => dkey(d) === x.date);
  let grid;
  if (mobileCal()) {
    const d = days[S.calDay], k = dkey(d);
    grid = `<div class="ee-daypick" data-component="CalendarDayPicker">${days.map((x,i) => { const kk = dkey(x); const has = SLOTS.some(s => s.closer===me() && s.date===kk) || APPTS.some(a => a.closer===me() && a.date===kk); return `<button data-act="cal-day" data-i="${i}" aria-pressed="${i===S.calDay}">${WD[x.getDay()]}<b>${x.getDate()}</b>${has?'<span class="dot"></span>':''}</button>`; }).join('')}</div>
      <section class="ee-card ee-card--flush"><div class="ee-calday" data-component="CalendarDay">${HOURS.map(h => `<div class="ee-calday__row"><div class="ee-cal__time">${fmtHour(h)}</div>${calCell(k,h)}</div>`).join('')}</div></section>`;
  } else {
    grid = `<section class="ee-card ee-card--flush"><div class="ee-cal" data-component="CalendarWeek">
      <div class="ee-cal__corner"></div>${days.map(d => `<div class="ee-cal__dayhead ${dkey(d)===dkey(NOW)?'is-today':''}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b></div>`).join('')}
      ${HOURS.map(h => `<div class="ee-cal__time">${fmtHour(h)}</div>${days.map(d => calCell(dkey(d),h)).join('')}`).join('')}
    </div></section>`;
  }
  const dateOpts = [...Array(21)].map((_,i) => { const d = new Date(2026,8,23+i); return d.getDay()===0 ? '' : `<option value="${dkey(d)}">${fmtDay(dkey(d))}</option>`; }).join('');
  return pageHead('Kalender', nav)
  + `<details class="ee-card ee-slotbar" data-component="SlotForm" ${mobileCal() ? '' : 'open'}><summary class="ee-slotbar__sum">${ico('plus','sm')} Freie Slots eintragen</summary>
      <form id="slotForm" class="ee-slotbar__form">
        <div class="ee-field"><label for="slotDate">Tag</label><select class="ee-select" id="slotDate">${dateOpts}</select></div>
        <div class="ee-field"><label for="slotFrom">Von</label><select class="ee-select" id="slotFrom">${HOURS.map(h => `<option value="${h}" ${h===10?'selected':''}>${fmtHour(h)}</option>`).join('')}</select></div>
        <div class="ee-field"><label for="slotTo">Bis</label><select class="ee-select" id="slotTo">${HOURS.map(h => `<option value="${h+1}" ${h===12?'selected':''}>${fmtHour(h+1)}</option>`).join('')}</select></div>
        <label class="ee-check"><input type="checkbox" id="slotRepeat"><span>4 Wochen wiederholen</span></label>
        <button class="ee-btn ee-btn--primary" type="submit">${ico('plus','sm')} Slots eintragen</button>
      </form>
      <div class="ee-slotbar__stats"><div><b class="num ${SLOTS.filter(s => s.closer===me() && inWeek(s)).length < 4 ? 'is-bad' : 'is-good'}">${SLOTS.filter(s => s.closer===me() && inWeek(s)).length}</b><span>freie Slots</span></div><div><b class="num">${APPTS.filter(a => a.closer===me() && inWeek(a)).length}</b><span>Termine</span></div></div>
    </details>
    ${grid}`;
}
/* ---------- Closer-Rückmeldung (Pflicht nach jedem Termin mit Dashboard-Leads) ---------- */
const apptStart = a => { const d = parseKey(a.date); d.setMinutes(Math.round(a.start * 60)); return d; };
const apptEnd = a => { const d = parseKey(a.date); d.setMinutes(Math.round((a.start + a.dur) * 60)); return d; };
const needsFeedback = a => !a.feedback && apptEnd(a) <= NOW;
const feedbackDue = a => new Date(apptEnd(a).getTime() + FEEDBACK_FRIST_H * 36e5);
const pendingFeedback = k => APPTS.filter(a => a.closer === k && needsFeedback(a));
const closerPaused = k => pendingFeedback(k).some(a => feedbackDue(a) < NOW);
const kindLabel = a => a.kind === 'closing' ? '2. Termin' : 'Ersttermin';
function fmtDue(d){ const same = dkey(d) === dkey(NOW); return `${same ? 'heute' : WD[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.'} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const pausedBanner = () => `<div class="ee-alert ee-alert--bad">${ico('lock','sm')} Deine Slots sind für neue Leads pausiert, bis alle Rückmeldungen erledigt sind.</div>`;

/* ---------- CustomerBrief: Kundeninfos aus Setting + Presetting für den Closer ---------- */
function customerBrief(l){
  const q = l.vq || {};
  const h = typeof heatEstimate === 'function' ? heatEstimate(q) : null;
  const f = [
    ['Wohnfläche', q.wohnflaeche && `${q.wohnflaeche} m²`], ['Baujahr', q.baujahr_haus],
    ['Heizung', q.heizungsart && `${q.heizungsart}${q.heizung_baujahr ? ' · Bj. ' + q.heizung_baujahr : ''}${q.heizungsart_2 && q.heizungsart_2 !== 'Keine' ? ' + ' + q.heizungsart_2 : ''}`],
    ['Verteilung', q.heizverteilung], ['Heizlast', h && `≈ ${h.toLocaleString('de-DE')} kW`], ['Eigentümer', q.eigentuemer],
  ].filter(x => x[1]);
  const ent = l.entscheider ? `<span class="ee-chip ${l.entscheider.startsWith('Ja') ? 'ee-chip--pos' : 'ee-chip--warn'}">${l.entscheider.startsWith('Ja') ? 'Alle Entscheider dabei' : 'Nicht alle Entscheider dabei'}</span>` : '';
  if (!f.length && !ent) return '';
  return `<div class="ee-brief" data-component="CustomerBrief">${ent ? `<div class="row">${ent}</div>` : ''}${f.length ? `<dl class="ee-brief__grid">${f.map(([k,val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` : ''}</div>`;
}

/* ---------- AppointmentCard: kompakt, Steckbrief aufklappbar ---------- */
function relWhen(a){
  const st = apptStart(a), h = (st - NOW) / 36e5;
  if (h < 0 || h > 72) return '';
  const tag = dkey(st) === dkey(NOW) ? 'heute' : dkey(st) === dkey(new Date(NOW.getTime() + 864e5)) ? 'morgen' : '';
  return toneChip(h < 3 ? `in ${Math.max(1, Math.round(h * 60))} Min.` : tag ? tag : `in ${Math.round(h / 24)} Tagen`, 'info');
}
function apptCard(a, open){
  const l = lead(a.lead), d = parseKey(a.date), need = needsFeedback(a);
  const fb = a.feedback ? (FEEDBACK_OPTIONS[a.kind].find(o => o[0] === a.feedback.result) || [0, a.feedback.result]) : null;
  const overdue = need && feedbackDue(a) < NOW, adr = a.adr || l.adresse || a.ort;
  const future = apptEnd(a) > NOW;
  return `<article class="ee-appt ${need ? 'is-due' : ''} ${fb ? 'is-done' : ''}" data-component="AppointmentCard">
    <div class="ee-datebox"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b><small>${fmtHour(a.start)}</small></div>
    <div class="stack" style="gap:10px;min-width:0">
      <div class="ee-appt__head"><div style="min-width:0"><h3>${esc(l.kunde)}</h3><div class="faint ee-appt__adr">${ico('pin','sm')} ${esc(adr)}</div></div>
        <div class="ee-appt__chips"><span class="ee-chip ${a.kind === 'closing' ? 'ee-chip--closing' : ''}">${kindLabel(a)}</span>${future ? relWhen(a) : ''}</div></div>
      ${need ? `<div class="ee-appt__due"><span class="ee-fb-due ${overdue ? 'is-over' : ''}">${ico('clock','sm')} Rückmeldung ${overdue ? 'überfällig seit' : 'bis'} ${fmtDue(feedbackDue(a))}</span><button class="ee-btn ee-btn--primary ee-btn--sm" data-act="feedback" data-id="${a.id}">${ico('check','sm')} Rückmeldung geben</button></div>`
        : fb ? `<div class="ee-fb-done">${ico('check','sm')} ${esc(fb[1])} · ${esc(a.feedback.at)}</div>` : ''}
      ${future ? `<div class="ee-appt__actions"><a class="ee-btn ee-btn--sm" href="${telHref(l)}">${ico('phone','sm')} Anrufen</a><a class="ee-btn ee-btn--sm" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}" target="_blank" rel="noopener">${ico('pin','sm')} Route</a></div>` : ''}
      ${fb ? '' : `<details class="ee-appt__more" ${open ? 'open' : ''}><summary>Steckbrief &amp; Notizen</summary><div class="stack" style="gap:10px;padding-top:10px">
        ${customerBrief(l)}
        <dl class="ee-facts"><div><dt>Telefon</dt><dd class="mono">${telFull(l)}</dd></div><div><dt>Setter / Presetter</dt><dd>${esc(person(l.setter).first)} / ${esc(person(l.presetter).first)}</dd></div><div><dt>Deine Provision</dt><dd>${provCell(l)}</dd></div></dl>
        ${l.setNote ? `<div class="ee-note"><b>Setting:</b> ${esc(l.setNote)}</div>` : ''}
        ${l.preNote ? `<div class="ee-note"><b>Presetting:</b> ${esc(l.preNote)}</div>` : ''}
      </div></details>`}
    </div></article>`;
}
function openFeedback(id){
  const a = APPTS.find(x => x.id === id) || { id, lead:id.replace('LEAD:',''), kind:'closing', date:dkey(NOW), start:NOW.getHours(), dur:0, virtual:true }, l = lead(a.lead);
  const dates = [...Array(21)].map((_,i) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1 + i)).filter(x => x.getDay() !== 0);
  openDrawer(drawerHead(`Rückmeldung ${kindLabel(a)}`, `${esc(l.kunde)} · ${fmtDay(a.date)} ${fmtHour(a.start)}`) + `<div class="ee-drawer__body">
    <form id="feedbackForm" class="stack" data-id="${id}" data-component="FeedbackForm">
      <fieldset class="ee-reasons"><legend class="lbl">Was ist passiert?</legend>
        ${FEEDBACK_OPTIONS[a.kind].map(([k,t],i) => `<label class="ee-reason ee-reason--fb ${k === 'verloren' ? 'is-neg' : ''}"><input type="radio" name="fb" value="${k}" ${i === 0 ? 'required' : ''}><span>${esc(t)}</span></label>`).join('')}
      </fieldset>
      <div class="ee-form" data-fb-show="checks" hidden>
        <div class="ee-field"><label for="fbDate">2. Termin am (falls schon fest)</label><select class="ee-select" id="fbDate"><option value="">noch offen</option>${dates.map(x => `<option value="${dkey(x)}">${fmtDay(dkey(x))}</option>`).join('')}</select></div>
        <div class="ee-field"><label for="fbHour">Uhrzeit</label><select class="ee-select" id="fbHour">${HOURS.map(h => `<option value="${h}" ${h === 17 ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}</select></div>
      </div>
      <div class="ee-field" data-fb-show="verloren" hidden><label for="fbReason">Grund</label><select class="ee-select" id="fbReason"><option value="">Bitte wählen</option>${LOSS_REASONS.verloren.map(r => `<option>${esc(r)}</option>`).join('')}</select></div>
      <div class="ee-field"><label for="fbNote">Notiz (optional)</label><textarea class="ee-textarea" id="fbNote"></textarea></div>
      <button class="ee-btn ee-btn--primary" type="submit">${ico('check','sm')} Rückmeldung speichern</button>
    </form></div>`);
}
function applyFeedback(a, res, o){
  const l = lead(a.lead);
  if (!a.virtual) a.feedback = { result:res, at:nowStamp(), note:o.note || '' };
  if (res === 'checks') {
    if (o.date) APPTS.push({ id:'T-'+Math.random().toString(36).slice(2,6), lead:l.id, closer:a.closer, kind:'closing', date:o.date, start:o.hour, dur:1.5, ort:a.ort, feedback:null });
    setStatus(l.id, 'checks', true);
    l.hist[0][0] = `Ersttermin fand statt – in den Checks${o.date ? `, 2. Termin ${fmtDay(o.date)} ${fmtHour(o.hour)}` : ''}`;
    NOTIFS[l.setter][0].t = `${l.kunde}: Ersttermin fand statt – Kunde ist in den Checks`;
  } else if (res === 'verkauft') setStatus(l.id, 'verkauft', true);
  else if (res === 'verloren') setStatus(l.id, 'verloren', true, o.reason, o.note);
  else if (res === 'nicht_angetroffen') {
    l.status = 'eingereicht'; l.nextTry = 'Neuen Termin legen'; l.hist.unshift(['Kunde nicht angetroffen – neuer Termin wird gelegt', nowStamp()]);
    pushNotif(l.setter, `${l.kunde}: beim Ersttermin nicht angetroffen – neuer Termin wird gelegt`, 'eingereicht');
    if (l.presetter) pushNotif(l.presetter, `${l.kunde}: nicht angetroffen – bitte neuen Termin legen`, 'eingereicht');
  } else if (res === 'entscheidung') {
    l.hist.unshift(['2. Termin fand statt – Kunde entscheidet noch', nowStamp()]);
    pushNotif(l.setter, `${l.kunde}: 2. Termin fand statt – Kunde entscheidet noch`, 'checks');
  }
  if (o.note && res !== 'verloren') l.hist[0][0] += ` – ${o.note}`;
  toast(`Rückmeldung gespeichert · ${person(l.setter).first} informiert`);
}
function viewTermine(){
  const mine = APPTS.filter(a => a.closer === me()).sort((a,b) => apptStart(a) - apptStart(b));
  const due = mine.filter(needsFeedback), up = mine.filter(a => apptEnd(a) > NOW), done = mine.filter(a => a.feedback).reverse();
  const inChecks = LEADS.filter(l => l.closer === me() && l.status === 'checks' && !APPTS.some(a => a.lead === l.id && a.kind === 'closing' && !a.feedback));
  return pageHead('Termine · Eigenleads')
  + (closerPaused(me()) ? pausedBanner() : '')
  + (due.length ? `<div class="stack"><h2 class="is-bad">Rückmeldung offen (${due.length})</h2><div class="ee-grid g-2">${due.map(a => apptCard(a)).join('')}</div></div>` : '')
  + (inChecks.length ? `<section class="ee-card ee-card--flush" data-component="ChecksList"><div class="ee-card__head"><h2>In den Checks (${inChecks.length})</h2></div><div class="ee-table-wrap"><table class="ee-table ee-table--stack"><tbody>${inChecks.map(l => `<tr><td><div class="who">${esc(l.kunde)}</div><div class="sub">${esc(l.ort)} · seit ${esc(l.hist[0][1].split(' ')[0])}</div></td><td class="r" data-span><button class="ee-btn ee-btn--sm" data-act="feedback" data-id="LEAD:${l.id}">${ico('check','sm')} Ergebnis eintragen</button></td></tr>`).join('')}</tbody></table></div></section>` : '')
  + `<div class="stack"><h2>Anstehend (${up.length})</h2><div class="ee-grid g-2">${up.map((a,i) => apptCard(a, i === 0)).join('')}</div></div>`
  + (done.length ? `<div class="stack"><h2>Erledigt</h2><div class="ee-grid g-2">${done.map(a => apptCard(a)).join('')}</div></div>` : '');
}

/* =================== AUSZAHLUNGEN =================== */
function postenState(st){
  if (!st || st === 'fest') return toneChip('Fest','ok');
  if (st === 'offen') return toneChip('Stand offen','');
  if (st === 'storno') return toneChip('Storno','bad');
  if (st.startsWith('vorlaeufig')) return toneChip(`Vorläufig bis ${st.split(':')[1]}`,'info');
  return '';
}
function viewAuszahlungen(){
  if (S.role === 'admin') return adminPayouts();
  const P = PAYOUTS[me()] || [], cur = P[0];
  const paid = P.filter(p => p.status==='ausgezahlt').reduce((s,p) => s+p.betrag, 0);
  const vorl = cur.posten.filter(x => String(x[4]).startsWith('vorlaeufig')).reduce((s,x) => s+x[3], 0);
  const pr = PROFILES[me()];
  return pageHead('Auszahlungen')
  + `<div class="ee-grid g-kpi">${kpi('Aktueller Monat', eur(cur.betrag), PAYOUT_STATUS[cur.status].label, true)}${vorl ? kpi('Davon vorläufig', eur(vorl), 'bis Storno-Frist', 'money') : ''}${kpi('Ausgezahlt 2026', eur(paid), `${P.filter(p => p.status==='ausgezahlt').length} Abrechnungen`, 'money')}${kpi('Nächste Auszahlung', cur.datum, `auf <span class="mono">${maskIban(pr.iban)}</span>`)}</div>
  <section class="ee-card ee-card--flush" data-component="PayoutTable"><div class="ee-card__head"><h2>${cur.periode} · Positionen</h2>${toneChip(PAYOUT_STATUS[cur.status].label, PAYOUT_STATUS[cur.status].tone)}</div>
    <div class="ee-table-wrap"><table class="ee-table ee-table--stack"><thead><tr><th>Datum</th><th>Kunde / Anlass</th><th>Status</th><th class="r">Betrag</th></tr></thead><tbody>
    ${cur.posten.map(([d,k,a,b,st]) => `<tr><td class="sub num" data-hide-sm>${d}</td><td><div class="who">${esc(k)}</div><div class="sub">${esc(a)}</div></td><td>${postenState(st)}</td><td class="r num"><b class="${b<0?'is-neg':'is-money'}">${eur(b)}</b></td></tr>`).join('')}
    <tr><td data-hide-sm></td><td class="who">Summe (vorläufig)</td><td data-hide-sm></td><td class="r num"><b class="is-money">${eur(cur.betrag)}</b></td></tr></tbody></table></div></section>
  <section class="ee-card ee-card--flush"><div class="ee-card__head"><h2>Verlauf</h2></div>
    <div class="ee-table-wrap"><table class="ee-table ee-table--stack"><thead><tr><th>Abrechnung</th><th>Zeitraum</th><th>Auszahlung</th><th>Status</th><th class="r">Betrag</th></tr></thead><tbody>
    ${P.map(p => `<tr><td class="mono faint" data-hide-sm>${p.id}</td><td class="who">${p.periode}</td><td class="sub num">${p.datum}</td><td>${toneChip(PAYOUT_STATUS[p.status].label, PAYOUT_STATUS[p.status].tone)}</td><td class="r num"><b class="is-money">${eur(p.betrag)}</b></td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function adminPayouts(){
  const rows = Object.entries(PAYOUTS).flatMap(([k,ps]) => ps.map(p => ({...p, who:k})));
  const open = rows.filter(r => r.status!=='ausgezahlt');
  return pageHead('Auszahlungen')
  + `<div class="ee-grid g-kpi">${kpi('In Prüfung', open.filter(r => r.status==='pruefung').length)}${kpi('Freigegeben', eur(open.filter(r => r.status==='freigegeben').reduce((s,r) => s+r.betrag,0)), '', 'money')}${kpi('Summe offen', eur(open.reduce((s,r) => s+r.betrag,0)), 'Auszug', true)}</div>
  <section class="ee-card ee-card--flush" data-component="PayoutTable"><div class="ee-card__head"><h2>Abrechnungen</h2></div>
    <div class="ee-table-wrap"><table class="ee-table ee-table--stack"><thead><tr><th>MB</th><th>Zeitraum</th><th>Status</th><th class="r">Betrag</th><th class="r">Aktion</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><div class="who">${esc(person(r.who).name)}</div><div class="sub">${ROLE_LABEL[person(r.who).role]} · <span class="mono">${maskIban(PROFILES[r.who].iban)}</span></div></td><td class="sub">${r.periode}</td><td>${toneChip(PAYOUT_STATUS[r.status].label, PAYOUT_STATUS[r.status].tone)}</td><td class="r num"><b class="is-money">${eur(r.betrag)}</b></td>
      <td class="r" data-span>${r.status==='pruefung' ? `<button class="ee-btn ee-btn--primary ee-btn--sm" data-act="payout-release" data-who="${r.who}" data-id="${r.id}">Freigeben</button>` : '<span class="faint">—</span>'}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}

/* =================== VERTRÄGE =================== */
function contractRow(c, admin){
  const st = c.status==='signed' ? toneChip('Unterschrieben','ok') : toneChip('Offen','warn');
  return `<div class="ee-doc">
    <div class="ee-doc__icon">${ico('doc')}</div>
    <div class="ee-doc__main"><div style="font-weight:650">${esc(c.doc)}</div>
      <div class="faint" style="font-size:.8rem">${admin ? esc(person(c.who).name)+' · ' : ''}gesendet ${c.sent}${c.signed ? ' · unterschrieben '+c.signed : ''} · <span class="mono">${c.id}</span></div>
      ${c.question ? `<div class="ee-note" style="margin-top:8px"><b>Rückfrage:</b> ${esc(c.question)}</div>` : ''}</div>
    ${st}
    <div class="row">${admin
      ? (c.status==='open' ? `<button class="ee-btn ee-btn--sm" data-act="contract-remind" data-id="${c.id}">${ico('send','sm')} Erinnern</button>` : '') + (c.question ? `<button class="ee-btn ee-btn--sm ee-btn--primary" data-act="contract-resolve" data-id="${c.id}">Als geklärt markieren</button>` : '')
      : (c.status==='open' ? `<button class="ee-btn ee-btn--primary ee-btn--sm" data-act="contract-sign" data-id="${c.id}">In DocuSign unterschreiben</button>` : `<button class="ee-btn ee-btn--sm" data-act="toast" data-msg="Würde das PDF aus DocuSign öffnen">PDF ansehen</button>`) + `<button class="ee-btn ee-btn--ghost ee-btn--sm" data-act="contract-ask" data-id="${c.id}">Frage stellen</button>`}</div>
    ${S.ask===c.id ? `<form class="ee-field ee-field--full" id="askForm" data-id="${c.id}" style="flex-basis:100%" data-component="ContractQuestionForm"><label for="askText">Deine Frage an Tim zu diesem Vertrag</label><textarea class="ee-textarea" id="askText" required placeholder="z. B. Ab wann gilt die neue Staffel?"></textarea><div class="row"><button class="ee-btn ee-btn--primary ee-btn--sm" type="submit">Frage senden</button><button class="ee-btn ee-btn--ghost ee-btn--sm" type="button" data-act="contract-ask" data-id="">Abbrechen</button></div></form>` : ''}
  </div>`;
}
function viewVertraege(){
  if (S.role === 'admin') {
    const f = S.contractFilter;
    const list = CONTRACTS.filter(c => f==='alle' || (f==='open' && c.status==='open') || (f==='signed' && c.status==='signed') || (f==='q' && c.question));
    const cnt = k => k==='alle' ? CONTRACTS.length : k==='open' ? CONTRACTS.filter(c => c.status==='open').length : k==='signed' ? CONTRACTS.filter(c => c.status==='signed').length : CONTRACTS.filter(c => c.question).length;
    return pageHead('Verträge verwalten')
    + `<div class="ee-grid g-main" style="align-items:start">
      <section class="ee-card" data-component="ContractList"><div class="ee-filters">${[['alle','Alle'],['open','Offen'],['signed','Unterschrieben'],['q','Rückfragen']].map(([k,l]) => `<button class="ee-filter" data-act="cfilter" data-f="${k}" aria-pressed="${f===k}">${l}<span class="c">${cnt(k)}</span></button>`).join('')}</div>
        <div>${list.map(c => contractRow(c, true)).join('') || '<p class="muted">Keine Verträge.</p>'}</div></section>
      <section class="ee-card"><h2>Vertrag senden</h2>
        <form id="contractForm" class="stack">
          <div class="ee-field"><label for="cWho">An</label><select class="ee-select" id="cWho">${TEAM.map(t => `<option value="${t.key}">${esc(person(t.key).name)}</option>`).join('')}</select></div>
          <div class="ee-field"><label for="cDoc">Vorlage</label><select class="ee-select" id="cDoc">${CONTRACT_TEMPLATES.map(d => `<option>${esc(d)}</option>`).join('')}</select></div>
          <button class="ee-btn ee-btn--primary" type="submit">${ico('send','sm')} Über DocuSign senden</button></form></section></div>`;
  }
  const mine = CONTRACTS.filter(c => c.who===me());
  const open = mine.filter(c => c.status==='open').length;
  return pageHead('Verträge')
  + `<section class="ee-card" data-component="ContractList">${mine.map(c => contractRow(c, false)).join('')}</section>`;
}

/* =================== EVENTS =================== */
function eventCard(e){
  const d = parseKey(e.date), going = e.going.includes(me());
  return `<article class="ee-event ${e.isNew?'is-new':''}" data-component="EventCard">
    <div class="ee-datebox"><span>${MON[d.getMonth()]}</span><b>${d.getDate()}</b><small>${WD[d.getDay()]}</small></div>
    <div class="stack" style="gap:8px;min-width:0">
      <div class="row"><span class="ee-tag">${esc(e.type)}</span><span class="ee-tag">für ${esc(e.target)}</span>${e.isNew?toneChip('Neu','info'):''}</div>
      <h3>${esc(e.title)}</h3>
      <div class="faint" style="font-size:.84rem">${ico('clock','sm')} ${esc(e.time)} &nbsp; ${ico('pin','sm')} ${esc(e.ort)}</div>
      ${e.desc ? `<p class="muted" style="font-size:.9rem">${esc(e.desc)}</p>` : ''}
      <div class="row row--between"><span class="faint" style="font-size:.8rem">${e.going.length} Zusagen</span>
        ${S.role==='admin' ? `<span class="faint" style="font-size:.8rem">gepostet von ${esc(person(e.by).first)}</span>` : `<button class="ee-btn ee-btn--sm ${going?'ee-btn--primary':''}" data-act="event-going" data-id="${e.id}">${going ? ico('check','sm')+' Zugesagt' : 'Zusagen'}</button>`}</div>
    </div></article>`;
}
function viewEvents(){
  const list = EVENTS.slice().sort((a,b) => (b.isNew?1:0)-(a.isNew?1:0) || a.date.localeCompare(b.date));
  if (S.role !== 'admin') return pageHead('Events') + `<div class="ee-grid g-2">${list.map(eventCard).join('')}</div>`;
  return pageHead('Events posten')
  + `<div class="ee-grid g-main" style="align-items:start">
    <div class="ee-grid" style="gap:14px">${list.map(eventCard).join('')}</div>
    <section class="ee-card" data-component="EventForm"><h2>Neues Event</h2>
      <form id="eventForm" class="ee-form">
        <div class="ee-field ee-field--full"><label for="evTitle">Titel</label><input class="ee-input" id="evTitle" required value="Team-Frühstück vor der Tour"></div>
        <div class="ee-field"><label for="evDate">Datum</label><input class="ee-input" type="date" id="evDate" required value="2026-10-03"></div>
        <div class="ee-field"><label for="evTime">Uhrzeit</label><input class="ee-input" id="evTime" value="08:30"></div>
        <div class="ee-field ee-field--full"><label for="evOrt">Ort</label><input class="ee-input" id="evOrt" value="Büro Leipzig, Fabrikstraße 21"></div>
        <div class="ee-field"><label for="evType">Art</label><select class="ee-select" id="evType"><option>Team</option><option>Training</option><option>Schulung</option><option>Onboarding</option></select></div>
        <div class="ee-field"><label for="evTarget">Zielgruppe</label><select class="ee-select" id="evTarget"><option>Alle</option><option>Setter</option><option>Presetter</option><option>Closer</option></select></div>
        <div class="ee-field ee-field--full"><label for="evDesc">Beschreibung</label><textarea class="ee-textarea" id="evDesc">Gemeinsam starten, Gebiete verteilen, dann raus an die Türen.</textarea></div>
        <label class="ee-check ee-field--full"><input type="checkbox" id="evWa" checked><span>Zusätzlich in der WhatsApp-Gruppe ankündigen (über n8n)</span></label>
        <button class="ee-btn ee-btn--primary ee-field--full" type="submit">${ico('send','sm')} Event posten</button>
      </form></section></div>`;
}

/* =================== RANGLISTE =================== */
function ranked(rows){
  const s = rows.slice().sort((a,b) => b[1]-a[1]); let last = null, rank = 0;
  return s.map(([k,v],i) => { if (v !== last) { rank = i+1; last = v; } return { key:k, val:v, rank }; });
}
function rankOf(k, B = BOARD){ return ranked(B.rows).find(r => r.key===k) || { rank:'–', val:0 }; }
/* Setter sehen nur die Setter-Rangliste, Closer nur den Wärmepumpen-Cup, Admin beide */
const boardFor = () => S.role === 'setter' ? 'setter' : S.role === 'closer' ? 'cup' : (S.board || 'cup');
const curBoard = () => boardFor() === 'setter' ? SETTER_BOARD : BOARD;
function leaderboard(B){
  const R = ranked(B.rows), top = R.length ? R[0].val : 0;
  const max = B.marks.length ? Math.max(11, top + 1) : Math.max(5, top + 2);
  const labels = B.marks.length ? [0, ...B.marks] : [0, top];
  const total = B.rows.reduce((s,r) => s+r[1], 0);
  const head = B.goal
    ? `<section class="ee-card ee-card--forest" data-component="TeamGoal">
      <div class="row row--between"><div><span class="eyebrow">Teamziel</span><h2 style="color:#fff;margin-top:4px">${esc(B.title)}</h2></div>
      <div style="text-align:right"><div class="ee-kpi__value" style="color:var(--accent-bright)">${total}<small style="color:rgba(255,255,255,.7)">/ ${B.goal}</small></div><div class="muted" style="font-size:.8rem">${B.unit} · Ende ${B.ends}</div></div></div>
      <div class="ee-goal__bar" role="progressbar" aria-valuenow="${total}" aria-valuemax="${B.goal}" aria-label="Teamziel"><i style="width:${Math.min(100,total/B.goal*100)}%"></i></div>
      <p class="muted" style="font-size:.84rem">Noch ${Math.max(0,B.goal-total)} ${B.unit} bis zum Teamziel · veröffentlicht ${B.published} von ${B.by}</p></section>`
    : `<section class="ee-card ee-card--forest"><span class="eyebrow">Nur Setter · ${esc(B.unit)}</span><h2 style="color:#fff">${esc(B.title)}</h2>
      <p class="muted" style="font-size:.84rem">Team: ${total} · veröffentlicht ${B.published} von ${B.by}</p></section>`;
  return head
    + (B.prizes.length ? `<div class="ee-prizes" data-component="PrizeStrip">${B.prizes.map(([a,b]) => `<div class="ee-prize"><span>${a}</span><b>${b}</b></div>`).join('')}</div>` : '')
    + `<section class="ee-card" data-component="Leaderboard"><div class="ee-card__head"><h2>Rangliste</h2><span class="muted">${esc(B.unit)} je MB</span></div>
      <div class="ee-board">
        <div class="ee-board__scale" aria-hidden="true"><span></span><span></span><div>${labels.map(v => `<span style="left:${v/max*100}%">${v}</span>`).join('')}</div><span></span></div>
        ${R.map(r => `<div class="ee-board__row ${r.key===me()?'is-me':''}"><div class="ee-board__rank">${r.rank}</div>
          <div class="ee-board__name"><span>${esc(person(r.key).first)}</span>${r.key===me()?'<span class="ee-tag">Du</span>':''}${B.marks.length && r.val>=5?`<span class="ee-medal" title="Prämienstufe erreicht">${r.val>=10?'500 €':'200 €'}</span>`:''}</div>
          <div class="ee-board__track"><div class="ee-board__fill" style="width:${r.val/max*100}%"></div>${B.marks.map(m => `<i class="ee-board__mark" style="left:${m/max*100}%"></i>`).join('')}</div>
          <div class="ee-board__val">${r.val}</div></div>`).join('')}
      </div></section>`;
}
function viewRangliste(){
  const B = curBoard();
  const tabs = `<div class="ee-tabs" role="tablist" data-component="BoardTabs">${[['cup','Wärmepumpen-Cup'],['setter','Setter-Rangliste']].map(([k,l]) => `<button role="tab" aria-selected="${boardFor()===k}" data-act="board-tab" data-b="${k}">${l}</button>`).join('')}</div>`;
  const archive = `<section class="ee-card"><h2>Frühere Wettbewerbe</h2><div class="ee-list">${BOARD_ARCHIVE.map(a => `<div class="ee-list__row"><div class="ee-list__main"><div class="ee-list__title">${esc(a.title)}</div><div class="ee-list__sub">Sieger: ${esc(a.winner)} · Team: ${esc(a.total)}</div></div><span class="faint" style="font-size:.8rem">${a.date}</span></div>`).join('')}</div></section>`;
  if (S.role !== 'admin') return pageHead(boardFor() === 'setter' ? 'Setter-Rangliste' : 'Wärmepumpen-Cup') + `<div class="ee-grid g-main" style="align-items:start"><div class="stack" style="gap:18px">${leaderboard(B)}</div><div class="stack">${S.role === 'closer' ? archive : ''}</div></div>`;
  const R = ranked(B.rows);
  return pageHead('Ranglisten posten') + tabs
  + `<div class="ee-grid g-main" style="align-items:start"><div class="stack" style="gap:18px">${leaderboard(B)}</div>
    <div class="stack"><section class="ee-card" data-component="BoardEditor"><h2>Stand bearbeiten</h2>
      <form id="boardForm" class="stack">
        <div class="ee-field"><label for="bTitle">Titel</label><input class="ee-input" id="bTitle" value="${esc(B.title)}"></div>
        <div class="ee-grid g-2" style="gap:10px">
          ${B.goal ? `<div class="ee-field"><label for="bGoal">Teamziel</label><input class="ee-input" type="number" id="bGoal" min="1" value="${B.goal}"></div>` : ''}
          <div class="ee-field"><label for="bEnds">Ende</label><input class="ee-input" id="bEnds" value="${B.ends}"></div></div>
        <div class="stack" style="gap:6px">${R.map(r => `<div class="row" style="gap:10px;flex-wrap:nowrap"><label for="b-${r.key}" style="flex:1;font-weight:600">${esc(person(r.key).name)}</label><input class="ee-input num" type="number" min="0" id="b-${r.key}" data-key="${r.key}" value="${r.val}" style="width:90px"></div>`).join('')}</div>
        <label class="ee-check"><input type="checkbox" id="bWa" checked><span>In der WhatsApp-Gruppe posten (über n8n)</span></label>
        <button class="ee-btn ee-btn--accent" type="submit">${ico('trophy','sm')} Rangliste veröffentlichen</button>
      </form></section>${archive}</div></div>`;
}
/* =================== STAMMDATEN =================== */
function profileForm(key, editable){
  const p = PROFILES[key], ed = editable && S.editProfile;
  const ro = ed ? '' : 'readonly';
  const f = (id, label, val, full, type='text') => `<div class="ee-field ${full?'ee-field--full':''}"><label for="${id}">${label}</label><input class="ee-input" id="${id}" type="${type}" value="${esc(val)}" ${ro}></div>`;
  return `<form id="profileForm" class="stack" style="gap:22px" data-component="ProfileForm" data-key="${key}">
    <section class="ee-card"><div class="ee-card__head"><h2>Persönliche Daten</h2>${editable && !ed ? `<button type="button" class="ee-btn ee-btn--sm" data-act="profile-edit">${ico('edit','sm')} Bearbeiten</button>` : ''}</div>
      <div class="ee-form">${f('pName','Vollständiger Name',p.name,false)}${f('pGeb','Geburtsdatum',p.geb,false)}${f('pTel','Telefon',p.tel,false,'tel')}${f('pMail','E-Mail',p.mail,false,'email')}
      ${f('pStr','Straße und Hausnummer',p.str,true)}${f('pPlz','PLZ',p.plz,false)}${f('pOrt','Ort',p.ort,false)}</div></section>
    <section class="ee-card"><div class="ee-card__head"><h2>Bankverbindung</h2><span class="ee-secure">${ico('shield')} Nur für dich und die Buchhaltung sichtbar</span></div>
      <div class="ee-form">
        <div class="ee-field ee-field--full"><label for="pIban">IBAN</label>
          <div class="ee-masked"><input class="ee-input" id="pIban" value="${ed ? esc(fmtIban(p.iban)) : S.showIban ? esc(fmtIban(p.iban)) : maskIban(p.iban)}" ${ro} autocomplete="off">
          ${!ed ? `<button type="button" class="ee-btn" data-act="iban-toggle" aria-label="${S.showIban?'IBAN verbergen':'IBAN anzeigen'}">${ico(S.showIban?'eyeoff':'eye','sm')} ${S.showIban?'Verbergen':'Anzeigen'}</button>` : ''}</div>
          <span class="ee-hint" id="ibanHint">${ed ? 'Änderung wird per E-Mail bestätigt.' : ''}</span></div>
        ${f('pInh','Kontoinhaber/in',p.inhaber,false)}${f('pBank','Bank',p.bank,false)}</div></section>
    <section class="ee-card"><div class="ee-card__head"><h2>Steuer & Gewerbe</h2></div>
      <div class="ee-form">${f('pSt','Steuernummer',p.steuer,false)}${f('pGew','Gewerbeanmeldung',p.gewerbe,false)}
        <label class="ee-check ee-field--full"><input type="checkbox" id="pKlein" ${p.klein?'checked':''} ${ed?'':'disabled'}><span>Kleinunternehmerregelung (§ 19 UStG) – Abrechnung ohne Umsatzsteuer</span></label></div></section>
    ${ed ? `<div class="row" style="position:sticky;bottom:calc(var(--bottom-h) + 10px);"><button class="ee-btn ee-btn--primary" type="submit">${ico('check','sm')} Speichern</button><button class="ee-btn" type="button" data-act="profile-cancel">Abbrechen</button></div>` : ''}
  </form>`;
}
function viewStammdaten(){
  const p = PROFILES[me()];
  return pageHead('Stammdaten')
  + `<div class="ee-grid g-main" style="align-items:start">${profileForm(me(), true)}
    <div class="stack"><section class="ee-card"><h2>Konto</h2><dl class="ee-facts" style="grid-template-columns:1fr">
      <div><dt>Rolle</dt><dd>${ROLE_LABEL[S.role]}</dd></div><div><dt>MB seit</dt><dd>${p.start}</dd></div>
      </dl></section></div></div>`;
}

/* =================== TEAM (Admin) =================== */
function viewTeam(){
  const ns = S.newSetter;
  const leadsOf = k => LEADS.filter(l => l.setter===k).length;
  const cupOf = k => (BOARD.rows.find(r => r[0]===k) || [0,0])[1];
  return pageHead('Team & Setter')
  + `<div class="ee-grid g-main" style="align-items:start">
    <section class="ee-card ee-card--flush" data-component="TeamTable"><div class="ee-card__head"><h2>Team (${TEAM.length})</h2></div>
      <div class="ee-table-wrap"><table class="ee-table ee-table--stack"><thead><tr><th>Name</th><th>Rolle</th><th class="r">Leads</th><th class="r">Cup</th><th>Status</th></tr></thead><tbody>
      ${TEAM.map(t => { const p = PROFILES[t.key], openC = CONTRACTS.some(c => c.who===t.key && c.status==='open');
        return `<tr class="is-click" data-act="team-row" data-key="${t.key}" tabindex="0"><td><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="ee-avatar">${person(t.key).initials}</div><div><div class="who">${esc(person(t.key).name)}</div><div class="sub">seit ${p.start}</div></div></div></td>
        <td data-hide-sm>${ROLE_LABEL[person(t.key).role]}</td>
        <td class="r num" data-hide-sm>${leadsOf(t.key)}</td><td class="r num" data-hide-sm>${cupOf(t.key)}</td>
        <td class="r-sm">${t.status==='onboarding' ? toneChip('Onboarding','info') : openC ? toneChip('Vertrag offen','warn') : toneChip('Aktiv','ok')}</td></tr>`; }).join('')}
      </tbody></table></div></section>
    <section class="ee-card" data-component="SetterCreateForm"><h2>Neuen MB anlegen</h2>
      ${ns ? `<div class="stack" style="gap:12px"><div class="row">${toneChip('Angelegt','ok')}<b>${esc(ns.name)}</b></div>
        <button class="ee-btn ee-btn--sm" data-act="copy" data-label="Willkommensnachricht kopiert" data-text="Willkommen bei EnergyEngel, ${esc(ns.first)}! Deinen Zugang zum MB-Dashboard hast du gerade per E-Mail an ${esc(ns.mail)} bekommen. Bitte melde dich an und ergänze deine Stammdaten.">${ico('msg','sm')} WhatsApp-Willkommensnachricht kopieren</button>
        <ul class="ee-timeline" style="margin-top:6px"><li>Dashboard-Zugang (Einladung per E-Mail) an ${esc(ns.mail)} gesendet</li><li>Handelsvertretervertrag über DocuSign gesendet</li><li>Stammdaten (IBAN, Adresse) ergänzt ${esc(ns.first)} selbst</li></ul>
        <button class="ee-btn" data-act="ns-reset">${ico('plus','sm')} Weiteren MB anlegen</button></div>`
      : `<form id="setterForm" class="stack">
        <div class="ee-field"><label for="nsName">Vor- und Nachname</label><input class="ee-input" id="nsName" required placeholder="z. B. Jana Lehmann"></div>
        <div class="ee-field"><label for="nsTel">Telefon (WhatsApp)</label><input class="ee-input" id="nsTel" type="tel" placeholder="0170 1234567"></div>
        <div class="ee-field"><label for="nsMail">E-Mail</label><input class="ee-input" id="nsMail" type="email" required placeholder="name@beispiel.de"></div>
        <div class="ee-field"><label for="nsRole">Rolle</label><select class="ee-select" id="nsRole"><option value="setter">Setter</option><option value="presetter">Presetter</option><option value="closer">Closer</option></select></div>
        <label class="ee-check"><input type="checkbox" id="nsContract" checked><span>Handelsvertretervertrag direkt per DocuSign senden</span></label>
        <button class="ee-btn ee-btn--primary" type="submit">${ico('send','sm')} Anlegen & Zugang senden</button></form>`}
    </section></div>`;
}
function openTeamMember(key){
  const p = PROFILES[key];
  const prev = S.showIban;
  openDrawer(drawerHead(esc(person(key).name), `${ROLE_LABEL[person(key).role]} · seit ${p.start}`) + `<div class="ee-drawer__body">
    <dl class="ee-facts">
      <div><dt>Telefon</dt><dd class="mono">${esc(p.tel)}</dd></div><div><dt>E-Mail</dt><dd>${esc(p.mail)}</dd></div>
      <div><dt>Adresse</dt><dd>${esc(p.str)}, ${esc(p.plz)} ${esc(p.ort)}</dd></div><div><dt>Geburtsdatum</dt><dd>${esc(p.geb)}</dd></div>
      <div><dt>IBAN</dt><dd class="mono" id="drawerIban">${maskIban(p.iban)}</dd></div><div><dt>Steuernummer</dt><dd>${esc(p.steuer)}</dd></div>
      <div><dt>Gewerbe</dt><dd>${p.gewerbe==='fehlt' ? toneChip('fehlt','bad') : esc(p.gewerbe)}</dd></div><div><dt>Kleinunternehmer</dt><dd>${p.klein?'Ja':'Nein'}</dd></div>
    </dl>
    <div class="row"><button class="ee-btn ee-btn--sm" data-act="drawer-iban" data-key="${key}">${ico('eye','sm')} IBAN anzeigen</button><span class="ee-secure">${ico('shield')} Zugriff wird protokolliert</span></div>
    <div class="stack" style="gap:8px"><span class="eyebrow">Verträge</span>${CONTRACTS.filter(c => c.who===key).map(c => `<div class="row row--between"><span style="font-size:.9rem">${esc(c.doc)}</span>${c.status==='signed'?toneChip('Unterschrieben','ok'):toneChip('Offen','warn')}</div>`).join('') || '<span class="muted">Keine Verträge.</span>'}</div>
    <div class="stack" style="gap:8px"><span class="eyebrow">Leads (Auszug)</span>${LEADS.filter(l => l.setter===key).slice(0,5).map(l => `<div class="row row--between"><span style="font-size:.9rem">${esc(l.kunde)} · ${esc(l.ort)}</span>${chip(l.status)}</div>`).join('') || '<span class="muted">Keine Leads.</span>'}</div>
  </div>`);
}

/* =================== WEITERE FUNKTION (Platzhalter) =================== */
function viewNeu(){
  return pageHead('Weitere Funktion')
  + `<div class="ee-empty" data-component="EmptyState">${mascot('Maskottchen<br>Chibi-Engel<br>(Platzhalter)')}
    <h2>Platzhalter – Funktion noch offen</h2>
    <span class="ee-tag">Slot-ID: modul-12</span></div>`;
}

const VIEWS = { uebersicht:viewUebersicht, leitfaden:viewLeitfaden, kalender:viewKalender, termine:viewTermine, auszahlungen:viewAuszahlungen, vertraege:viewVertraege, events:viewEvents, rangliste:viewRangliste, stammdaten:viewStammdaten, team:viewTeam, neu:viewNeu };
/* =====================================================================
   LEAD ERFASSEN (Setter) – 1:1 nach dem bestehenden Setting-Formular
   Schritt 1 „Lead anlegen“      → n8n-Webhook  POST /webhook/wp-lead
   Schritt 2 „Vorqualifizieren“  → n8n-Webhook  POST /webhook/wp-vorqual (optional)
   Schritt 3 „Termin legen“      → NEU: bucht einen freien Closer-Slot (optional)
   Feldnamen (name="…") entsprechen den Payload-Feldern der bestehenden Formulare.
   ===================================================================== */
const WIZ_NEW = () => ({ step:1, leadId:null, data:{ thema:['Wärmepumpe'], zeitfenster:[] }, vq:{}, errors:{}, slot:null, vqSent:false, phone:false });
S.wiz = WIZ_NEW();

const ZEITFENSTER = ['Vormittag (8–12 Uhr)','Mittag (12–15 Uhr)','Nachmittag (15–18 Uhr)','Abend (18–20 Uhr)'];
const J_N = ['Ja','Nein'];
const N15 = ['1','2','3','4','5+'];

/* Vorqualifizierung Wärmepumpe – Abschnitte und Fragen wie in waermepumpe-vorqualifizierung.html */
const VQ_SECTIONS = [
  { key:'gebaeude', title:'Gebäude', fields:[
    { n:'haustyp', l:'Ist Ihr Haus ein Ein- oder Mehrfamilienhaus?', t:'radio', o:['EFH','MFH'], cols:true },
    { n:'gebaeudeart', l:'Um welche Gebäudeart handelt es sich?', t:'select', o:['Freistehend','Doppelhaushälfte','Reihenendhaus','Reihenmittelhaus'] },
    { n:'geschosse', l:'Bewohnbare Geschosse', t:'select', o:N15 },
    { n:'wohneinheiten', l:'Anzahl der Wohneinheiten', t:'select', o:N15 },
    { n:'personen_haus', l:'Personen im Haus', t:'number', ph:'z. B. 3' },
    { n:'personen_u18', l:'Davon unter 18 Jahren', t:'select', o:['0','1','2','3','4+'] },
    { n:'baumassnahmen', l:'Baumaßnahmen geplant/laufend?', t:'radio', o:J_N, cols:true },
    { n:'wohnflaeche', l:'Beheizbare Wohnfläche (m²)', t:'number', ph:'z. B. 140', heat:true },
    { n:'baujahr_haus', l:'Baujahr des Hauses', t:'number', ph:'z. B. 1994', heat:true },
  ]},
  { key:'daemmung', title:'Dämmung', fields:[
    { n:'fassade_gedaemmt', l:'Ist die Fassade nachträglich gedämmt worden?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'fassade_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', ph:'z. B. 4cm Styropor', showIf:['fassade_gedaemmt','Ja'] },
    { n:'fassade_daemmung_jahr', l:'Wann aufgebracht (Jahr)', t:'number', ph:'z. B. 1979', showIf:['fassade_gedaemmt','Ja'] },
    { n:'dach_gedaemmt', l:'Ist das Dach oder der Dachboden nachträglich gedämmt?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'dach_daemmung_ort', l:'Wo ist die Dämmung am Dach aufgebracht?', t:'select', o:['Auf der obersten Geschossdecke','Zwischen den Sparren','Unter den Sparren','Aufsparrendämmung'], showIf:['dach_gedaemmt','Ja'] },
    { n:'dach_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', ph:'z. B. 4cm Styropor', showIf:['dach_gedaemmt','Ja'] },
    { n:'dach_daemmung_jahr', l:'Wann aufgebracht (Jahr)', t:'number', ph:'z. B. 1979', showIf:['dach_gedaemmt','Ja'] },
    { n:'fenster', l:'Sind die Fenster isolierverglast?', t:'radio', o:['Einfachverglasung','2 Scheibenglas','2 Scheiben Wärmeschutzglas','3 Scheibenglas oder 3 Scheiben Wärmeschutzglas'], heat:true },
  ]},
  { key:'heizung', title:'Heizung', fields:[
    { n:'heizungsart', l:'Art der Heizung', t:'select', o:['Öl','Gas','Fernwärme','Strom (Nachtspeicher)','Holz/Pellets','Wärmepumpe','Sonstige'] },
    { n:'heizungsart_2', l:'Art der 2. Heizung', t:'select', o:['Keine','Öl','Gas','Fernwärme','Strom (Nachtspeicher)','Holz/Pellets','Sonstige'], hint:'nur Wärmequellen, die die WP ersetzen soll' },
    { n:'oelverbrauch', l:'Ölverbrauch (Liter/Jahr)', t:'number', ph:'z. B. 1800', hint:'1 l = 10 kWh', showIf:['heizungsart','Öl'] },
    { n:'heizung_baujahr', l:'Baujahr der Heizung', t:'number', ph:'z. B. 2020' },
    { n:'heizung_funktionstuechtig', l:'Heizung noch funktionstüchtig?', t:'radio', o:J_N, cols:true },
    { n:'heizraum', l:'Wo befindet sich der Heizraum?', t:'select', o:['Keller','Erdgeschoss','Dachboden','Sonstige'] },
    { n:'heizverteilung', l:'Womit heizen Sie (Verteilung)?', t:'radio', o:['Heizkörper','Fußbodenheizung','Beides','Weder Noch'], cols:true },
    { n:'warmwasser', l:'Wird das Warmwasser auch über die Heizung erwärmt?', t:'radio', o:['Ja','Nein','Nein, aber künftig über die Wärmepumpe'] },
    { n:'solarthermie', l:'Solarthermieanlage vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'wasserg_kamin', l:'Wassergeführter Kamin vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'energiekosten_heizung', l:'Energiekosten für die Heizung (ct/kWh)', t:'number', ph:'z. B. 10', step:'0.1' },
  ]},
  { key:'strom_pv', title:'Strom & PV', fields:[
    { n:'stromkosten', l:'Stromkosten (ct/kWh)', t:'number', ph:'z. B. 25', step:'0.1' },
    { n:'pv_anlage', l:'PV-Anlage auf dem Dach?', t:'radio', o:['Ja, von Enpal','Ja, von einem Drittanbieter','Nein'] },
  ]},
  { key:'eigentum', title:'Eigentum & Haushalt', fields:[
    { n:'eigentuemer', l:'Sind Sie als Privatperson (oder GbR) im Grundbuch eingetragener Eigentümer?', t:'radio', o:['Ja','Nein','Nein, aber verwandt'], hint:'Wichtig: Eigentümer muss im SC1 sein', ko:true },
    { n:'zweiter_eigentuemer', l:'Zweiter Eigentümer vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'selbst_bewohnt', l:'Selbst bewohnt oder Einzug geplant?', t:'radio', o:J_N, cols:true, ko:true },
    { n:'haushaltseinkommen', l:'Jährliches Brutto-Haushaltseinkommen', t:'radio', o:['Unter 30.000 €','30.000–40.000 €','40.000–50.000 €','50.000–60.000 €','Über 60.000 €'], sensitive:true },
    { n:'smartphone', l:'Besitzt Kunde ein Smartphone?', t:'radio', o:J_N, cols:true },
  ]},
];

/* ---------- Grobe Heizlast-Schätzung (ersetzt keine Heizlastberechnung) ---------- */
function heatEstimate(vq){
  const a = +vq.wohnflaeche, bj = +vq.baujahr_haus;
  if (!a || !bj) return null;
  let wpm2 = bj < 1978 ? 120 : bj < 1995 ? 90 : bj < 2002 ? 70 : bj < 2016 ? 50 : 35;
  if (vq.fassade_gedaemmt === 'Ja') wpm2 *= 0.85;
  if (vq.dach_gedaemmt === 'Ja') wpm2 *= 0.9;
  if (String(vq.fenster || '').startsWith('3')) wpm2 *= 0.9;
  if (vq.fenster === 'Einfachverglasung') wpm2 *= 1.15;
  return Math.round(a * wpm2 / 100) / 10;
}
const heatText = vq => { const h = heatEstimate(vq); return h ? `≈ ${h.toLocaleString('de-DE')} kW` : '–'; };
function vqProgress(vq = S.wiz.vq){
  let total = 0, done = 0;
  VQ_SECTIONS.forEach(s => s.fields.forEach(f => {
    if (f.showIf && vq[f.showIf[0]] !== f.showIf[1]) return;
    total++; if (vq[f.n] !== undefined && vq[f.n] !== '') done++;
  }));
  return { total, done };
}

/* ---------- Feld-Bausteine ---------- */
/* Speicherort je Formular: 'd' = Lead-Erfassung, 'vq' = Vorqualifizierung an der Tür, 'pq' = Vorqualifizierung im Telefonleitfaden (direkt am Lead) */
const pqStore = () => { const l = lead(S.guideLead); return l ? (l.vq = l.vq || {}) : {}; };
const storeFor = scope => scope === 'vq' ? S.wiz.vq : scope === 'pq' ? pqStore() : S.wiz.data;
function wizField(f, scope){
  const store = storeFor(scope);
  const v = store[f.n], err = scope === 'pq' ? null : S.wiz.errors[f.n];
  const id = `${scope}-${f.n}`;
  const tags = (f.req ? '<span class="ee-ftag ee-ftag--req">Pflicht</span>' : '')
    + (f.heat ? '<span class="ee-ftag ee-ftag--heat">Heizlast</span>' : '')
    + (f.ko ? '<span class="ee-ftag ee-ftag--ko">K.-o.-Kriterium</span>' : '');
  const hint = (f.hint ? `<span class="ee-hint">${esc(f.hint)}</span>` : '')
    + (f.sensitive ? `<span class="ee-secure">${ico('lock')} vertraulich</span>` : '')
    + (err ? `<span class="ee-hint ee-hint--err">${esc(err)}</span>` : '');
  const cond = f.showIf ? `data-show-if="${f.showIf[0]}=${esc(f.showIf[1])}" ${store[f.showIf[0]] === f.showIf[1] ? '' : 'hidden'}` : '';
  const full = f.half ? '' : 'ee-field--full';
  if (f.t === 'radio' || f.t === 'check') {
    const type = f.t === 'radio' ? 'radio' : 'checkbox';
    const on = o => type === 'radio' ? v === o : (v || []).includes(o);
    return `<fieldset class="ee-field ${full} ${f.showIf ? 'ee-cond' : ''} ${err ? 'is-invalid' : ''}" ${cond} data-field="${f.n}"><legend class="lbl">${esc(f.l)} ${tags}</legend>
      <div class="ee-opts ${f.cols ? 'ee-opts--cols' : ''}">${f.o.map(o => `<label class="ee-opt"><input type="${type}" name="${f.n}" value="${esc(o)}" data-scope="${scope}" ${on(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>${hint}</fieldset>`;
  }
  let ctrl;
  if (f.t === 'select') ctrl = `<select class="ee-select" id="${id}" name="${f.n}" data-scope="${scope}"><option value="">Bitte wählen</option>${f.o.map(o => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.t === 'textarea') ctrl = `<textarea class="ee-textarea" id="${id}" name="${f.n}" data-scope="${scope}" placeholder="${esc(f.ph || '')}">${esc(v || '')}</textarea>`;
  else ctrl = `<input class="ee-input ${err ? 'is-invalid' : ''}" id="${id}" name="${f.n}" data-scope="${scope}" type="${f.t === 'number' ? 'number' : f.t}" ${f.step ? `step="${f.step}"` : ''} ${f.im ? `inputmode="${f.im}"` : ''} ${f.max ? `maxlength="${f.max}"` : ''} ${f.ac ? `autocomplete="${f.ac}"` : ''} placeholder="${esc(f.ph || '')}" value="${esc(v || '')}">`;
  return `<div class="ee-field ${full} ${f.showIf ? 'ee-cond' : ''}" ${cond} data-field="${f.n}"><label for="${id}">${esc(f.l)} ${tags}</label>${ctrl}${hint}</div>`;
}

/* ---------- Stepper ---------- */
function wizStepper(){
  const idx = { 1:0, created:1, 2:1, ko:1, 3:2, done:3 }[S.wiz.step];
  const steps = ['Lead anlegen','Vorqualifizieren','Termin legen'];
  return `<ol class="ee-stepper" data-component="Stepper">${steps.map((s,i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}"><span>${i < idx ? ico('check','sm') : i+1}</span><b>${s}</b>${i ? '<small>optional</small>' : ''}</li>`).join('')}</ol>`;
}
const wizLead = () => lead(S.wiz.leadId);
function wizCustomerBar(){
  const l = wizLead(); if (!l) return '';
  return `<div class="ee-wiz__who"><div class="ee-avatar">${esc(l.kunde.split(' ').map(x => x[0]).join('').slice(0,2))}</div><div><b>${esc(l.kunde)}</b><div class="faint" style="font-size:.82rem">${esc(l.adresse || l.ort)} · <span class="mono">${esc(l.id)}</span></div></div>${chip(l.status)}</div>`;
}

/* ---------- Schritt 1: Lead anlegen ---------- */
const STEP1 = {
  notizen:{ n:'notizen', l:'Alles, was der Innendienst zum Termin wissen sollte', t:'textarea', ph:'z. B. Gastherme 20 Jahre alt, Ehefrau entscheidet mit, Hund im Garten' },
  alle_entscheider:{ n:'alle_entscheider', l:'Sind alle Entscheider beim Termin dabei?', t:'radio', o:['Ja, alle Entscheider sind dabei','Nein, nicht alle dabei'] },
  rueckruf_datum:{ n:'rueckruf_datum', l:'Wann soll der Kunde angerufen werden?', t:'radio', o:['Heute','Morgen','wann anders'], cols:true },
  rueckruf_uhrzeit:{ n:'rueckruf_uhrzeit', l:'Genaue Uhrzeit falls vereinbart', t:'time', half:true },
  zeitfenster:{ n:'zeitfenster', l:'Erreichbarkeit', t:'check', o:ZEITFENSTER, cols:true },
  anrede:{ n:'anrede', l:'Anrede', t:'radio', o:['Frau','Herr'], cols:true },
  vorname:{ n:'vorname', l:'Vorname', t:'text', half:true, ac:'off' },
  nachname:{ n:'nachname', l:'Nachname', t:'text', req:true, half:true, ac:'off' },
  telefon:{ n:'telefon', l:'Telefon', t:'tel', req:true, half:true, im:'tel', ph:'0170 1234567' },
  email:{ n:'email', l:'E-Mail', t:'email', half:true, ph:'name@beispiel.de' },
  strasse:{ n:'strasse', l:'Straße', t:'text', req:true, half:true },
  hausnummer:{ n:'hausnummer', l:'Hausnummer', t:'text', req:true, half:true },
  plz:{ n:'plz', l:'Postleitzahl', t:'text', req:true, half:true, im:'numeric', max:5, ph:'5 Ziffern' },
  stadt:{ n:'stadt', l:'Stadt', t:'text', req:true, half:true },
};
function wizStep1(){
  const F = k => wizField(STEP1[k], 'd');
  return `<form id="wizForm" class="stack" style="gap:18px" novalidate data-component="LeadForm">
    <section class="ee-card"><div class="ee-card__head"><h2>Notizen aus dem Gespräch</h2><span class="muted">optional</span></div>${F('notizen')}</section>
    <section class="ee-card"><div class="ee-card__head"><h2>Terminabsprache</h2><span class="muted">optional</span></div><div class="ee-form">${F('alle_entscheider')}${F('rueckruf_datum')}${F('rueckruf_uhrzeit')}${F('zeitfenster')}</div></section>
    <section class="ee-card"><div class="ee-card__head"><h2>Kontaktdaten</h2><button type="button" class="ee-btn ee-btn--sm" data-act="wiz-geo">${ico('pin','sm')} Adresse per Standort ausfüllen</button></div>
      <div class="ee-form">${F('anrede')}${F('vorname')}${F('nachname')}${F('telefon')}${F('email')}${F('strasse')}${F('hausnummer')}${F('plz')}${F('stadt')}</div></section>
    <div class="ee-wiz__bar" data-component="ActionBar">
      <button type="button" class="ee-btn" data-act="wiz-create" data-next="vq">${ico('check','sm')} Direkt an der Tür vorqualifizieren</button>
      <button type="button" class="ee-btn ee-btn--primary" data-act="wiz-create" data-next="created">${ico('plus','sm')} Lead erstellen</button>
    </div>
  </form>`;
}
function wizValidate(){
  const d = S.wiz.data, e = {};
  ['nachname','telefon','strasse','hausnummer','stadt'].forEach(k => { if (!String(d[k] || '').trim()) e[k] = 'Pflichtfeld'; });
  if (!/^\d{5}$/.test(String(d.plz || '').trim())) e.plz = '5 Ziffern';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'Bitte gültige E-Mail angeben';
  S.wiz.errors = e;
  return !Object.keys(e).length;
}
function wizCreateLead(){
  const d = S.wiz.data;
  const num = 2450 + LEADS.length;
  const tel = String(d.telefon).replace(/\s+/g,' ').trim();
  const telMasked = tel.length > 8 ? tel.slice(0,4) + ' •••• ' + tel.replace(/\s/g,'').slice(-4) : tel;
  const produkt = 'wp';
  const rueck = [d.rueckruf_datum, d.rueckruf_uhrzeit && `${d.rueckruf_uhrzeit} Uhr`].filter(Boolean).join(' ');
  const note = [d.notizen, d.alle_entscheider, rueck && `Rückruf: ${rueck}`, (d.zeitfenster||[]).length && `Erreichbar: ${d.zeitfenster.join(', ')}`].filter(Boolean).join(' · ');
  const l = { id:`L-${num}`, pd:48400 + LEADS.length, kunde:`${d.vorname ? d.vorname.trim() + ' ' : ''}${d.nachname.trim()}`, anrede:`${d.anrede || 'Familie'} ${d.nachname.trim()}`,
    tel:telMasked, ort:d.stadt.trim(), adresse:`${d.strasse.trim()} ${d.hausnummer.trim()}, ${d.plz} ${d.stadt.trim()}`, produkt, entscheider:d.alle_entscheider || '', eigenlead:true, status:'eingereicht', setter:me(), presetter:'inan', datum:'23.09.2026',
    setNote:note, preNote:'', hist:[['Lead eingereicht (an der Tür erfasst)', nowStamp()]], attempts:0, nextTry: rueck || null, reason:null, reasonNote:'', themen:d.thema.slice() };
  LEADS.unshift(l);
  S.wiz.leadId = l.id;
  pushNotif('inan', `Neuer Lead von ${person(me()).first}: ${l.kunde}${rueck ? ' – Rückruf ' + rueck : ''}`, 'eingereicht');
  return l;
}

/* ---------- Zwischenstand nach „Lead erstellen“ ---------- */
function wizCreated(){
  const l = wizLead();
  return `<section class="ee-card ee-wiz__success">
    <div class="ee-wiz__check">${ico('check')}</div>
    <h2>Der neue Kunde wurde erfolgreich in Pipedrive angelegt</h2>
    <p class="muted">${esc(l.kunde)} · ${esc(l.adresse)}</p>
    <div class="row" style="justify-content:center">
      <button class="ee-btn ee-btn--primary" data-act="wiz-goto" data-step="2">${ico('check','sm')} Jetzt vorqualifizieren</button>
      <button class="ee-btn" data-act="wiz-goto" data-step="3">${ico('cal','sm')} Direkt Termin legen</button>
      <button class="ee-btn ee-btn--ghost" data-act="wiz-reset">${ico('plus','sm')} Weiteren Kunden anlegen</button>
    </div></section>`;
}

/* ---------- Schritt 2: Vorqualifizierung ---------- */
function wizStep2(){
  const p = vqProgress();
  return `${wizCustomerBar()}
  <section class="ee-card ee-vq__head" data-component="VqSummary">
    <div><span class="eyebrow">Vorqualifizierung</span></div>
    <div class="ee-vq__stats"><div><b class="num" id="vqProgress">${p.done}/${p.total}</b><span>beantwortet</span></div><div><b class="num" id="vqHeat">${heatText(S.wiz.vq)}</b><span>Heizlast (Schätzung)</span></div></div>
  </section>
  <form id="vqForm" class="stack" style="gap:18px" novalidate data-component="VqForm">
    ${VQ_SECTIONS.map((s,i) => `<section class="ee-card"><div class="ee-card__head"><h2><span class="ee-vq__no">${i+1}</span>${s.title}</h2></div><div class="ee-form">${s.fields.map(f => wizField(f, 'vq')).join('')}</div></section>`).join('')}
    <div class="ee-wiz__bar">
      <button type="button" class="ee-btn" data-act="wiz-phone">${ico('phone','sm')} Rest telefonisch klären</button>
      <button type="button" class="ee-btn ee-btn--primary" data-act="wiz-vq-submit">${ico('send','sm')} Vorqualifizierung abschicken</button>
    </div>
  </form>`;
}
function vqSummary(vq){
  const h = heatEstimate(vq);
  return [vq.wohnflaeche && `${vq.wohnflaeche} m²`, vq.baujahr_haus && `Bj. ${vq.baujahr_haus}`, vq.gebaeudeart, vq.heizungsart && `${vq.heizungsart}${vq.heizung_baujahr ? ' (Bj. ' + vq.heizung_baujahr + ')' : ''}`, vq.oelverbrauch && `${vq.oelverbrauch} l Öl/Jahr`, vq.heizverteilung, vq.pv_anlage && `PV: ${vq.pv_anlage}`, vq.eigentuemer && `Eigentümer: ${vq.eigentuemer}`, h && `Heizlast ≈ ${h.toLocaleString('de-DE')} kW`].filter(Boolean).join(' · ');
}
function wizKo(){
  const vq = S.wiz.vq;
  const why = [vq.eigentuemer && vq.eigentuemer !== 'Ja' && `Eigentümer: „${vq.eigentuemer}“`, vq.selbst_bewohnt === 'Nein' && 'nicht selbst bewohnt'].filter(Boolean).join(', ');
  return `${wizCustomerBar()}<section class="ee-card ee-wiz__ko">
    <h2>K.-o.-Kriterium: ${esc(why)}</h2>
    <div class="row"><button class="ee-btn ee-btn--danger" data-act="wiz-ko-abgesagt">Als „Abgesagt“ markieren</button>
    <button class="ee-btn" data-act="wiz-goto" data-step="3">Trotzdem Termin legen (Eigentümer kommt zum Termin)</button></div></section>`;
}

/* ---------- Schritt 3: Termin legen (neu) ---------- */
function wizStep3(){
  const l = wizLead(), d = S.wiz.data;
  const slots = freeSlots('leo');
  const byDay = {}; slots.forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
  return `${wizCustomerBar()}
  ${d.alle_entscheider === 'Nein, nicht alle dabei' ? `<div class="ee-demo-strip" style="border-style:solid;border-color:var(--warn)">${ico('info','sm')}<span><b>Nicht alle Entscheider dabei.</b></span></div>` : ''}
  <section class="ee-card" data-component="SlotPicker"><div class="ee-card__head"><h2>Freie Termine</h2><span class="muted">Closer: Leo · 90 Min. vor Ort</span></div>
    ${Object.keys(byDay).length ? Object.entries(byDay).map(([k, ss]) => `<div class="ee-slotpick__day"><b>${fmtDay(k)}</b><div class="ee-slotpick">${ss.map(s => `<button class="ee-slotpick__btn" data-act="wiz-slot" data-slot="${s.id}" aria-pressed="${S.wiz.slot === s.id}">${fmtHour(s.start)}</button>`).join('')}</div></div>`).join('') : (closerPaused('leo') ? `<div class="ee-alert ee-alert--bad">${ico('lock','sm')} Leo ist pausiert – offene Rückmeldungen</div>` : '<p class="muted">Keine freien Termine.</p>')}
  </section>
  <div class="ee-wiz__bar">
    <button class="ee-btn" data-act="wiz-skip">Ohne Termin abschließen – Presetting ruft an</button>
    <button class="ee-btn ee-btn--primary" data-act="wiz-book" ${S.wiz.slot ? '' : 'disabled'}>${ico('cal','sm')} ${S.wiz.slot ? (() => { const s = SLOTS.find(x => x.id === S.wiz.slot); return s ? `Termin ${fmtDay(s.date)} ${fmtHour(s.start)} eintragen` : 'Termin eintragen'; })() : 'Termin auswählen'}</button>
  </div>`;
}

/* ---------- Abschluss ---------- */
function wizDone(){
  const l = wizLead(), a = APPTS.find(x => x.lead === l.id);
  const today = myLeads().filter(x => x.datum === '23.09.2026').length;
  const row = (ok, t) => `<li class="${ok ? 'is-ok' : ''}">${ok ? ico('check','sm') : '<span class="ee-dash">–</span>'}<span>${t}</span></li>`;
  return `<section class="ee-card ee-wiz__success">
    <div class="ee-wiz__check">${ico('check')}</div>
    <h2>${esc(l.kunde)} ist erfasst</h2>
    <ul class="ee-donelist">
      ${row(true, `Lead in Pipedrive angelegt (<span class="mono">${l.id}</span>)`)}
      ${row(S.wiz.vqSent, S.wiz.vqSent ? `Vorqualifizierung übertragen${S.wiz.phone ? ' – Rest klärt Inan telefonisch' : ''}` : 'Vorqualifizierung übersprungen – macht das Presetting')}
      ${row(!!a, a ? `Termin: ${fmtDay(a.date)} ${fmtHour(a.start)} mit Leo` : 'Kein Termin – Inan ruft den Kunden an')}
    </ul>
    <p class="muted">Heute: <b class="${today >= DAY_GOAL.goal ? 'is-good' : ''}">${today} von ${DAY_GOAL.goal}</b> Leads${today >= DAY_GOAL.goal ? ' – Tagesziel erreicht!' : ''}</p>
    <div class="row" style="justify-content:center"><button class="ee-btn ee-btn--primary" data-act="wiz-reset">${ico('plus','sm')} Weiteren Kunden anlegen</button><button class="ee-btn" data-act="lead" data-id="${l.id}">Lead ansehen</button><button class="ee-btn ee-btn--ghost" data-act="nav" data-view="uebersicht">Zur Übersicht</button></div>
  </section>`;
}

function viewErfassen(){
  const w = S.wiz;
  const body = w.step === 1 ? wizStep1() : w.step === 'created' ? wizCreated() : w.step === 2 ? wizStep2() : w.step === 'ko' ? wizKo() : w.step === 3 ? wizStep3() : wizDone();
  return pageHead('Lead erfassen')
    + wizStepper() + body;
}
VIEWS.erfassen = viewErfassen;

/* ---------- Termin buchen (auch vom Leitfaden genutzt) ---------- */
function bookSlot(l, s, quiet){
  keepWhere(SLOTS, x => x.id !== s.id);
  APPTS.push({ id:'T-'+Math.random().toString(36).slice(2,6), lead:l.id, closer:s.closer, kind:'erst', date:s.date, start:s.start, dur:1.5, ort:l.ort, feedback:null });
  l.closer = s.closer;
  setStatus(l.id, 'termin', true);
  pushNotif(s.closer, `Neuer Ersttermin: ${l.kunde}, ${fmtDay(s.date)} ${fmtHour(s.start)} (${l.ort})`, 'termin');
  if (!quiet) toast(`Termin gebucht: ${fmtDay(s.date)} ${fmtHour(s.start)} · ${person(s.closer).first} informiert`);
}

/* ---------- Interaktion ---------- */
const wizGo = step => { S.wiz.step = step; render(); window.scrollTo({ top:0 }); };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act^="wiz-"]'); if (!t) return;
  const d = t.dataset, w = S.wiz;
  switch (d.act) {
    case 'wiz-geo':
      Object.assign(w.data, { strasse:'Lützner Straße', hausnummer:'120', plz:'04179', stadt:'Leipzig' });
      render(); toast('Demo: Adresse per Standort gefüllt (im Live-Formular per GPS)', 'pin'); break;
    case 'wiz-create': {
      if (!wizValidate()) { render(); const el = document.querySelector('.is-invalid'); if (el) el.scrollIntoView({ block:'center', behavior:'smooth' }); toast('Bitte die markierten Pflichtfelder ausfüllen', 'info'); return; }
      const l = wizCreateLead();
      toast(`${l.kunde} in Pipedrive angelegt`);
      wizGo(d.next === 'vq' ? 2 : 'created'); break;
    }
    case 'wiz-goto': wizGo(+d.step); break;
    case 'wiz-reset': S.wiz = WIZ_NEW(); wizGo(1); break;
    case 'wiz-vq-submit': case 'wiz-phone': {
      const l = wizLead(), vq = w.vq;
      l.vq = { ...vq }; w.vqSent = true;
      const sum = vqSummary(vq), p = vqProgress();
      if (d.act === 'wiz-phone') {
        w.phone = true;
        l.preNote = `An der Tür vorqualifiziert (${p.done}/${p.total} Fragen): ${sum || '–'}. Rest telefonisch klären.`;
        pushNotif('inan', `${l.kunde}: Vorqualifizierung an der Tür begonnen (${p.done}/${p.total}) – bitte Rest telefonisch klären`, 'eingereicht');
        toast('Teilantworten übertragen – Inan klärt den Rest'); wizGo('done'); break;
      }
      l.preNote = `An der Tür vorqualifiziert: ${sum || '–'}`;
      if ((vq.eigentuemer && vq.eigentuemer !== 'Ja') || vq.selbst_bewohnt === 'Nein') { wizGo('ko'); break; }
      l.hist.unshift(['Vorqualifizierung an der Tür übertragen', nowStamp()]);
      toast('Vorqualifizierung übertragen'); wizGo(3); break;
    }
    case 'wiz-ko-abgesagt': {
      const l = wizLead(), vq = w.vq;
      setStatus(l.id, 'abgesagt', false, vq.selbst_bewohnt === 'Nein' && vq.eigentuemer === 'Ja' ? 'Sonstiges' : 'Kein Eigentümer', 'An der Tür vorqualifiziert');
      wizGo('done'); break;
    }
    case 'wiz-slot': w.slot = d.slot; render(); break;
    case 'wiz-book': { const s = SLOTS.find(x => x.id === w.slot); if (!s) return; bookSlot(wizLead(), s); w.slot = null; wizGo('done'); break; }
    case 'wiz-skip': toast('Lead liegt beim Presetting'); wizGo('done'); break;
  }
});
/* Eingaben im Formular in den Zustand schreiben – ohne Neurendern (Fokus bleibt) */
function wizStore(el){
  const store = storeFor(el.dataset.scope);
  if (el.type === 'checkbox') store[el.name] = [...document.querySelectorAll(`input[name="${el.name}"][data-scope="${el.dataset.scope}"]:checked`)].map(x => x.value);
  else store[el.name] = el.value;
  if (S.wiz.errors[el.name]) { delete S.wiz.errors[el.name]; el.classList.remove('is-invalid'); const box = el.closest('[data-field]'); box && box.classList.remove('is-invalid'); box && box.querySelector('.ee-hint--err')?.remove(); }
  (el.closest('form') || document).querySelectorAll('[data-show-if]').forEach(c => { const [k, v] = c.dataset.showIf.split('='); c.hidden = store[k] !== v; });
  if (el.dataset.scope === 'vq') { const p = vqProgress(); const a = $('#vqProgress'), b = $('#vqHeat'); if (a) a.textContent = `${p.done}/${p.total}`; if (b) b.textContent = heatText(S.wiz.vq); }
  if (el.dataset.scope === 'pq') { const p = vqProgress(store); const a = $('#pqProgress'), b = $('#pqHeat'); if (a) a.textContent = `${p.done}/${p.total}`; if (b) b.textContent = heatText(store); }
}
document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.scope) wizStore(e.target); });
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.scope) wizStore(e.target); });
/* =====================================================================
   AKTIONEN – Event-Delegation (Klicks, Formulare, Eingaben)
   ===================================================================== */
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^a-z]/g,'');
const rnd = () => Math.random().toString(36).slice(2,6);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) {
    if (!$('#notifPanel').hidden && !e.target.closest('#notifPanel')) { $('#notifPanel').hidden = true; $('#bellBtn').setAttribute('aria-expanded','false'); }
    return;
  }
  const d = t.dataset;
  switch (d.act) {
    case 'nav': go(d.view); break;
    case 'role': S.role = d.role; S.leadFilter='alle'; S.leadSearch=''; S.leadSetter='alle'; S.newSetter=null; S.ask=null; go(S.view); toast(`Ansicht: ${ROLE_LABEL[d.role]} (${person(me()).first})`, 'user'); break;
    case 'more': $('#moreSheet').classList.add('is-open'); $('#backdrop').classList.add('is-open'); break;
    case 'close': closeOverlays(); break;
    case 'copy': copyText(d.text, d.label || 'Kopiert'); break;
    case 'toast': toast(d.msg, 'info'); break;
    case 'lead': openLead(d.id); break;
    case 'set-status': {
      if (!d.id) return;
      if (['abgesagt','verloren'].includes(d.status)) { openReason(d.id, d.status); break; }
      setStatus(d.id, d.status);
      if (S.view === 'leitfaden' && d.status === 'nicht_erreicht') guideAdvance(d.id);
      if ($('#drawer').classList.contains('is-open')) openLead(d.id);
      render(); break;
    }
    case 'call': { const l = lead(d.id); S.guideLead = d.id; S.guideProduct = l.produkt; go('leitfaden'); break; } /* href="tel:" wählt parallel die Nummer */
    case 'board-tab': S.board = d.b; render(); break;
    case 'nav-guide': { const l = lead(d.id); S.guideLead = d.id; S.guideProduct = l.produkt; go('leitfaden'); break; }
    case 'feedback': openFeedback(d.id); break;
    case 'goal-edit': S.editGoal = !S.editGoal; render(); if (S.editGoal) setTimeout(() => $('#goalInput')?.focus(), 0); break;
    case 'guide-pick': S.guideLead = d.id; S.guideSlot = null; render(); window.scrollTo({ top:0 }); break;
    case 'guide-slot': S.guideSlot = d.slot; render(); break;
    case 'guide-callback': openCallback(d.id); break;
    case 'book-slot': {
      const s = SLOTS.find(x => x.id === d.slot), l = lead(d.id); if (!s || !l) return;
      const note = $('#guideNote'); if (note && note.value.trim()) l.preNote = note.value.trim();
      bookSlot(l, s, true);
      toast(`Termin gebucht: ${fmtDay(s.date)} ${fmtHour(s.start)} · ${person(s.closer).first} und ${person(l.setter).first} informiert`);
      if (S.view === 'leitfaden') guideAdvance(l.id);
      render(); break;
    }
    case 'cal-add': {
      SLOTS.push({ id:'S-'+rnd(), closer:me(), date:d.date, start:+d.h });
      toast(`Freier Slot eingetragen: ${fmtDay(d.date)} ${fmtHour(+d.h)}`); render(); break;
    }
    case 'slot-remove': keepWhere(SLOTS, s => s.id !== d.id); toast('Slot entfernt', 'close'); render(); break;
    case 'appt': { const a = APPTS.find(x => x.id === d.id); openDrawer(drawerHead('Termin', `${fmtDay(a.date)} · ${fmtHour(a.start)}–${fmtHour(a.start + a.dur)}`) + `<div class="ee-drawer__body">${apptCard(a)}</div>`); break; }
    case 'cal-week': S.calWeek += +d.dir; render(); break;
    case 'cal-day': S.calDay = +d.i; render(); break;
    case 'event-going': { const ev = EVENTS.find(x => x.id === d.id); const i = ev.going.indexOf(me()); if (i >= 0) { ev.going.splice(i,1); toast('Zusage zurückgenommen','close'); } else { ev.going.push(me()); toast('Zugesagt – bis dann!'); } render(); break; }
    case 'contract-sign': { const c = CONTRACTS.find(x => x.id === d.id); c.status = 'signed'; c.signed = '23.09.2026'; pushNotif('tim', `${person(c.who).first} hat „${c.doc}“ unterschrieben`); toast('DocuSign-Demo: Vertrag als unterschrieben markiert'); render(); break; }
    case 'contract-ask': S.ask = d.id || null; render(); if (S.ask) setTimeout(() => $('#askText')?.focus(), 0); break;
    case 'contract-remind': { const c = CONTRACTS.find(x => x.id === d.id); pushNotif(c.who, `Erinnerung: Bitte „${c.doc}“ in DocuSign unterschreiben`); toast(`Erinnerung an ${person(c.who).first} gesendet`, 'send'); break; }
    case 'contract-resolve': { const c = CONTRACTS.find(x => x.id === d.id); delete c.question; pushNotif(c.who, `Deine Rückfrage zu „${c.doc}“ wurde beantwortet`); toast('Rückfrage als geklärt markiert'); render(); break; }
    case 'cfilter': S.contractFilter = d.f; render(); break;
    case 'payout-release': { const p = PAYOUTS[d.who].find(x => x.id === d.id); p.status = 'freigegeben'; pushNotif(d.who, `Deine Abrechnung ${p.periode} wurde freigegeben (${eur(p.betrag)})`); toast(`${p.periode} für ${person(d.who).first} freigegeben`); render(); break; }
    case 'profile-edit': S.editProfile = true; render(); setTimeout(() => $('#pName')?.focus(), 0); break;
    case 'profile-cancel': S.editProfile = false; render(); break;
    case 'iban-toggle': S.showIban = !S.showIban; render(); break;
    case 'drawer-iban': { const el = $('#drawerIban'); el.textContent = fmtIban(PROFILES[d.key].iban); t.disabled = true; toast('IBAN angezeigt – Zugriff protokolliert', 'shield'); break; }
    case 'team-row': openTeamMember(d.key); break;
    case 'ns-reset': S.newSetter = null; render(); break;
    case 'theme': break;
    case 'notif-read': (NOTIFS[me()]||[]).forEach(n => n.unread = false); render(); renderNotif(); break;
    case 'notif-demo': {
      const cand = LEADS.find(l => l.setter===me() && l.status==='eingereicht');
      if (!cand) { toast('Kein passender Lead für die Demo', 'info'); break; }
      const next = 'termin';
      cand.status = next; cand.hist.unshift([STATUS[next].label, nowStamp()]);
      pushNotif(me(), `${cand.kunde}: Status → ${STATUS[next].label}`, next);
      render(); renderNotif(); toast(`Pipedrive: ${cand.kunde} ist jetzt „${STATUS[next].label}“`, 'bolt'); break;
    }
  }
});

$('#themeBtn').addEventListener('click', () => {
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('ee-theme', theme); } catch(e) {}
  applyTheme();
});
$('#bellBtn').addEventListener('click', e => {
  e.stopPropagation();
  const p = $('#notifPanel'); p.hidden = !p.hidden;
  $('#bellBtn').setAttribute('aria-expanded', String(!p.hidden));
  if (!p.hidden) renderNotif();
});
$('#backdrop').addEventListener('click', closeOverlays);
$('#roleSelect').addEventListener('change', e => { const b = document.createElement('button'); b.dataset.act='role'; b.dataset.role=e.target.value; document.body.appendChild(b); b.click(); b.remove(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOverlays();
  if (e.key === 'Enter' && e.target.matches('tr[data-act]')) e.target.click();
});

/* Eingaben ohne Neurendern der ganzen Seite (Fokus bleibt) */
document.addEventListener('input', e => {
  if (e.target.id === 'guideNote') { const l = lead(S.guideLead); if (l) l.preNote = e.target.value; }
});
document.addEventListener('change', e => {
  if (e.target.name === 'fb') document.querySelectorAll('[data-fb-show]').forEach(el => { el.hidden = el.dataset.fbShow !== e.target.value; });
  if (e.target.id === 'guideLead') { S.guideLead = e.target.value; S.guideProduct = lead(e.target.value).produkt; render(); }
});

/* Formulare */
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, v = id => (f.querySelector('#'+id) || {}).value;
  switch (f.id) {
    case 'slotForm': {
      const from = +v('slotFrom'), to = +v('slotTo'), rep = f.querySelector('#slotRepeat').checked;
      if (to <= from) { toast('„Bis“ muss nach „Von“ liegen', 'info'); return; }
      let n = 0;
      for (let w = 0; w < (rep ? 4 : 1); w++) {
        const day = parseKey(v('slotDate')); day.setDate(day.getDate() + w*7);
        for (let h = from; h < to; h++) { const k = dkey(day); if (!slotAt(k,h) && !apptAt(k,h)) { SLOTS.push({ id:'S-'+rnd(), closer:me(), date:k, start:h }); n++; } }
      }
      pushNotif('inan', `${person(me()).first} hat ${n} neue freie Slots eingetragen`);
      toast(`${n} freie Slot${n===1?'':'s'} eingetragen`); render(); break;
    }
    case 'eventForm': {
      const title = v('evTitle').trim(); if (!title) return;
      const ev = { id:'E-'+rnd(), title, date:v('evDate'), time:v('evTime'), ort:v('evOrt'), type:v('evType'), target:v('evTarget'), desc:v('evDesc'), going:[], by:'tim', isNew:true };
      EVENTS.push(ev);
      ['romy','inan','leo'].forEach(k => pushNotif(k, `Neues Event: ${title} am ${fmtDay(ev.date)}`));
      toast(f.querySelector('#evWa').checked ? 'Event gepostet und in WhatsApp angekündigt' : 'Event gepostet', 'send'); render(); break;
    }
    case 'boardForm': {
      const B = curBoard();
      B.title = v('bTitle'); if (B.goal) B.goal = Math.max(1, +v('bGoal') || B.goal); B.ends = v('bEnds');
      B.rows = [...f.querySelectorAll('input[data-key]')].map(i => [i.dataset.key, Math.max(0, +i.value || 0)]);
      B.published = `${pad(NOW.getDate())}.${pad(NOW.getMonth()+1)}.${NOW.getFullYear()}, ${pad(NOW.getHours())}:${pad(NOW.getMinutes())}`; B.by = 'Tim';
      (boardFor() === 'setter' ? ['romy'] : ['leo']).forEach(k => { const r = rankOf(k, B); pushNotif(k, r.rank === '–' ? `Neue Rangliste: ${B.title}` : `Neue Rangliste: ${B.title} – du bist auf Platz ${r.rank}`); });
      toast('Rangliste veröffentlicht', 'trophy'); render(); break;
    }
    case 'setterForm': {
      const name = v('nsName').trim(), mail = v('nsMail').trim(), role = v('nsRole');
      if (!name || !mail) return;
      const first = name.split(' ')[0], key = slug(first) + rnd();
      PEOPLE[key] = { key, name, first, role, initials: name.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() };
      PROFILES[key] = { name, geb:'—', tel:v('nsTel')||'—', mail, str:'—', plz:'', ort:'', iban:'DE00000000000000000000', inhaber:'—', bank:'—', steuer:'—', klein:false, gewerbe:'fehlt', start:'23.09.2026' };
      TEAM.unshift({ key, status:'onboarding' });
      BOARD.rows.push([key, 0]);
      if (f.querySelector('#nsContract').checked) CONTRACTS.unshift({ id:'V-'+rnd().toUpperCase(), who:key, doc:'Handelsvertretervertrag (§ 84 HGB)', status:'open', sent:'23.09.2026', signed:null });
      S.newSetter = { name, first, mail };
      toast(`${first} angelegt – Zugang per E-Mail gesendet`); render(); break;
    }
    case 'goalForm': {
      const val = Math.max(100, Math.round(+v('goalInput') || 0));
      MONEY_GOAL[me()] = val; S.editGoal = false; toast(`Monatsziel: ${eur(val)}`); render(); break;
    }
    case 'feedbackForm': {
      const r = f.querySelector('input[name="fb"]:checked'); if (!r) return;
      const ap = APPTS.find(x => x.id === f.dataset.id) || { id:f.dataset.id, lead:f.dataset.id.replace('LEAD:',''), kind:'closing', virtual:true }; /* Lead in den Checks ohne eingetragenen 2. Termin */
      const o = { note:v('fbNote').trim(), date:v('fbDate'), hour:+v('fbHour'), reason:v('fbReason') };
      if (r.value === 'verloren' && !o.reason) { const s = f.querySelector('#fbReason'); s.classList.add('is-invalid'); s.focus(); toast('Bitte einen Grund wählen', 'info'); return; }
      applyFeedback(ap, r.value, o); closeOverlays(); render(); break;
    }
    case 'callbackForm': {
      const l = lead(f.dataset.id), when = `${dkey(parseKey(v('cbDate'))) === dkey(NOW) ? 'heute' : fmtDay(v('cbDate'))} ${v('cbTime')}`, note = v('cbNote').trim();
      if (S.role === 'presetter') CALL_DAY.done++; l.nextTry = `Rückruf ${when}`; l.hist.unshift([`Rückruf vereinbart: ${when}${note ? ' – ' + note : ''}`, nowStamp()]);
      if (note) l.preNote = [l.preNote, note].filter(Boolean).join(' · ');
      pushNotif(l.setter, `${l.kunde}: Rückruf vereinbart (${when})`, 'eingereicht');
      toast(`Rückruf gespeichert: ${when}`, 'clock'); closeOverlays();
      if (S.view === 'leitfaden') guideAdvance(l.id);
      render(); break;
    }
    case 'reasonForm': {
      const r = f.querySelector('input[name="reason"]:checked'); if (!r) return;
      const id = f.dataset.id;
      setStatus(id, f.dataset.status, false, r.value, v('reasonNote').trim());
      if (S.view === 'leitfaden') guideAdvance(id);
      closeOverlays(); render(); break;
    }
    case 'askForm': {
      const c = CONTRACTS.find(x => x.id === f.dataset.id); const q = v('askText').trim(); if (!q) return;
      c.question = q; S.ask = null; pushNotif('tim', `${person(c.who).first} hat eine Rückfrage zu „${c.doc}“`);
      toast('Frage an Tim gesendet', 'send'); render(); break;
    }
    case 'profileForm': {
      const ibanEl = f.querySelector('#pIban'), iban = ibanEl.value.replace(/\s/g,'').toUpperCase();
      if (!/^DE\d{20}$/.test(iban)) { ibanEl.classList.add('is-invalid'); const h = $('#ibanHint'); h.textContent = 'Bitte eine deutsche IBAN eingeben: DE + 20 Ziffern.'; h.classList.add('ee-hint--err'); ibanEl.focus(); return; }
      const p = PROFILES[f.dataset.key];
      Object.assign(p, { name:v('pName'), geb:v('pGeb'), tel:v('pTel'), mail:v('pMail'), str:v('pStr'), plz:v('pPlz'), ort:v('pOrt'), inhaber:v('pInh'), bank:v('pBank'), steuer:v('pSt'), gewerbe:v('pGew'), klein:f.querySelector('#pKlein').checked });
      const ibanChanged = iban !== p.iban; p.iban = iban;
      S.editProfile = false; S.showIban = false;
      toast(ibanChanged ? 'Gespeichert – neue IBAN bitte per E-Mail bestätigen' : 'Stammdaten gespeichert'); render(); break;
    }
  }
});

matchMedia('(max-width: 900px)').addEventListener('change', () => { if (S.view === 'kalender') render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* Schnittstelle für die React-Ansichten */
store.legacy = { render, openLead };

/* Start */
applyTheme();
render();
}
