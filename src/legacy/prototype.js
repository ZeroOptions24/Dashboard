/* eslint-disable */
import * as DOMAIN from '@/lib/domain';
import { store, notify, REACT_VIEWS } from '@/lib/store';
import { ICONS } from '@/lib/icons';
import { heatEstimate } from '@/lib/vq';
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
  editProfile:false, showIban:false,
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
function kpi(label, value, meta='', tone=''){
  if (tone === true) tone = 'money';
  return `<div class="ee-kpi ${tone ? 'ee-kpi--'+tone : ''}" data-component="KpiTile"><div class="ee-kpi__label">${label}</div><div class="ee-kpi__value">${value}</div>${meta?`<div class="ee-kpi__meta">${meta}</div>`:''}</div>`;
}

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

/* ---------- Helfer Runde 2: Telefon, Eingangsalter, Provision ---------- */
const telFull = l => l.tel.replace('••••','4418');
const telHref = l => 'tel:' + telFull(l).replace(/\s/g,'');
function parseStamp(t){ const m = String(t).match(/(\d{2})\.(\d{2})\.\s+(\d{2}):(\d{2})/); return m ? new Date(2026, +m[2]-1, +m[1], +m[3], +m[4]) : NOW; }
const eingang = l => parseStamp(l.hist[l.hist.length-1][1]);
const ageH = l => (NOW - eingang(l)) / 36e5;
/* Überfällig: eingereicht, noch nie angerufen und älter als 24 Std. */
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
function provCell(l){ const p = provFor(l); return `<span class="ee-prov ${p.amount ? '' : 'is-muted'}">${p.txt}</span>`; }

const isLost = l => !!STATUS[l.status].fail;

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
/* =================== LEITFADEN (Presetter) =================== */
/* ---------- Telefonleitfaden (Presetter) ---------- */
const guideQueue = () => LEADS.filter(l => l.presetter === me() && l.status === 'eingereicht').sort(urgencySort);
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
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];
/* ---------- Closer-Rückmeldung (Pflicht nach jedem Termin mit Dashboard-Leads) ---------- */
const apptStart = a => { const d = parseKey(a.date); d.setMinutes(Math.round(a.start * 60)); return d; };
const apptEnd = a => { const d = parseKey(a.date); d.setMinutes(Math.round((a.start + a.dur) * 60)); return d; };
const needsFeedback = a => !a.feedback && apptEnd(a) <= NOW;
const feedbackDue = a => new Date(apptEnd(a).getTime() + FEEDBACK_FRIST_H * 36e5);
const pendingFeedback = k => APPTS.filter(a => a.closer === k && needsFeedback(a));
const kindLabel = a => a.kind === 'closing' ? '2. Termin' : 'Ersttermin';
function fmtDue(d){ const same = dkey(d) === dkey(NOW); return `${same ? 'heute' : WD[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.'} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/* ---------- CustomerBrief: Kundeninfos aus Setting + Presetting für den Closer ---------- */
function customerBrief(l){
  const q = l.vq || {};
  const h = heatEstimate(q);
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

/* =================== AUSZAHLUNGEN =================== */




/* =================== TEAM (Admin) =================== */
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


const VIEWS = {}; /* alle Ansichten sind nach React umgezogen (src/components) */
/* =====================================================================
   AKTIONEN – Event-Delegation (Klicks, Formulare, Eingaben)
   ===================================================================== */

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) {
    if (!$('#notifPanel').hidden && !e.target.closest('#notifPanel')) { $('#notifPanel').hidden = true; $('#bellBtn').setAttribute('aria-expanded','false'); }
    return;
  }
  handleAct(t.dataset, t);
});
/* Aktionen per data-act – auch von React-Ansichten über store.legacy.act() aufrufbar */
function handleAct(d, t){
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
    case 'nav-guide': { const l = lead(d.id); S.guideLead = d.id; S.guideProduct = l.produkt; go('leitfaden'); break; }
    case 'feedback': openFeedback(d.id); break;
    case 'guide-callback': openCallback(d.id); break;
    case 'appt': { const a = APPTS.find(x => x.id === d.id); openDrawer(drawerHead('Termin', `${fmtDay(a.date)} · ${fmtHour(a.start)}–${fmtHour(a.start + a.dur)}`) + `<div class="ee-drawer__body">${apptCard(a)}</div>`); break; }
    case 'drawer-iban': { const el = $('#drawerIban'); el.textContent = fmtIban(PROFILES[d.key].iban); t.disabled = true; toast('IBAN angezeigt – Zugriff protokolliert', 'shield'); break; }
    case 'team-row': openTeamMember(d.key); break;
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
}

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
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* Schnittstelle für die React-Ansichten */
store.legacy = { render, openLead, toast, setStatus, act: (name, data = {}) => handleAct({ act:name, ...data }, null) };

/* Start */
applyTheme();
render();
}
