// App bootstrap, rendering, and all user actions.
import { PILLARS } from './data.js';
import { load, save, clearAll, defaultState, migrate, dateKey, uid } from './store.js';
import {
  rollover, ensureDay, syncTemplateToDay, computeStats, checkAchievements, dayStats, dayNumber, inProgram,
} from './game.js';
import * as AI from './ai.js';
import * as V from './views.js';

let state = load();
const ui = { view: 'today', busy: {}, errors: {}, testResult: null, lastDate: dateKey() };

const $ = sel => document.querySelector(sel);
const persist = () => {
  if (!save(state)) toast('[SYSTEM] Could not save. Storage is full or blocked.', 'var(--danger)');
};

/* ---------- Rendering ---------- */

function render() {
  const app = $('#app');
  if (!state.startDate) {
    app.innerHTML = V.viewOnboarding(state);
  } else {
    const views = { today: V.viewToday, coach: V.viewCoach, status: V.viewStatus, log: V.viewLog, settings: V.viewSettings };
    app.innerHTML = views[ui.view](state, ui) + V.nav(ui.view);
  }
  window.lucide?.createIcons();
  if (ui.view === 'coach') {
    const chat = $('#chat');
    if (chat) chat.lastElementChild?.scrollIntoView({ block: 'end' });
  }
}

function toast(text, color = 'var(--glow)') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderColor = color;
  el.style.color = color;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function openModal(html, cls = '') {
  $('#modal-root').innerHTML = `<div class="modal-back" id="modal-back"><section class="panel modal ${cls}" role="dialog" aria-modal="true">${html}</section></div>`;
  window.lucide?.createIcons();
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/* ---------- AI helpers ---------- */

async function runAI(key, fn) {
  ui.busy[key] = true;
  ui.errors[key] = null;
  render();
  try {
    await fn();
  } catch (e) {
    ui.errors[key] = e instanceof AI.AIError ? e.message : `Something broke: ${e.message}`;
  }
  ui.busy[key] = false;
  persist();
  render();
}

function today() { return state.days[dateKey()]; }

async function doPlan() {
  await runAI('plan', async () => {
    const plan = await AI.generatePlan(state);
    const day = today();
    day.plan = plan;
    day.quests = day.quests.filter(q => q.kind !== 'bonus' || q.done);
    for (const b of plan.bonus) day.quests.push({ id: `bonus-${uid()}`, kind: 'bonus', pillar: b.pillar, xp: b.xp, title: b.title, done: false });
    toast('[SYSTEM] Daily quest updated');
  });
}

async function sendChat(text) {
  text = text.trim();
  if (!text || ui.busy.chat) return;
  state.chat.push({ role: 'user', content: text, ts: Date.now() });
  await runAI('chat', async () => {
    const reply = await AI.chat(state);
    state.chat.push({ role: 'assistant', content: reply, ts: Date.now() });
    state.chat = state.chat.slice(-60);
  });
}

async function roast() {
  await runAI('roast', async () => { state.lagReport.roast = await AI.roastLag(state); });
}

/* ---------- Game actions ---------- */

function toggleQuest(id) {
  const day = today();
  const q = day?.quests.find(x => x.id === id);
  if (!q) return;
  const before = computeStats(state);
  const beforePct = dayStats(day).pct;
  q.done = !q.done;
  const after = computeStats(state);
  const afterPct = dayStats(day).pct;

  if (q.done) {
    if (q.kind === 'penalty') toast('[SYSTEM] Penalty quest cleared', 'var(--danger)');
    else toast(`+${q.xp} XP · ${PILLARS[q.pillar].tag}`, PILLARS[q.pillar].color);
    if (afterPct === 100 && beforePct < 100) toast('[SYSTEM] ALL DAILY QUESTS CLEARED', 'var(--gold)');
  }
  for (const a of checkAchievements(state)) setTimeout(() => toast(`TITLE UNLOCKED: ${a.name}`, 'var(--gold)'), 400);
  persist();
  render();

  if (after.level > before.level) {
    const rankUp = after.rank.rank !== before.rank.rank;
    openModal(`<div class="center">
      <div class="sys">[SYSTEM]</div>
      <div class="big">${rankUp ? 'RANK UP' : 'LEVEL UP'}</div>
      <p class="lv-change">LV ${before.level} → <b style="color:var(--glow)">LV ${after.level}</b></p>
      ${rankUp ? `<p style="color:var(--gold);font-family:var(--display)">You are now ${V.esc(after.rank.title)}</p>` : ''}
      <button class="btn primary block" data-act="close-modal">Continue</button></div>`);
  }
}

function harvestQuests() {
  return [...document.querySelectorAll('#quest-editor .q-edit')].map(row => {
    const old = state.quests.find(q => q.id === row.dataset.id) || {};
    return {
      ...old,
      id: row.dataset.id,
      title: row.querySelector('[name=title]').value.trim() || 'Untitled quest',
      pillar: row.querySelector('[name=pillar]').value,
      xp: Math.max(5, Math.min(60, Number(row.querySelector('[name=xp]').value) || 10)),
    };
  });
}

function applyQuestTemplate(quests) {
  state.quests = quests;
  if (today()) syncTemplateToDay(state, dateKey());
  persist();
}

function exportData() {
  const copy = { ...state, settings: { ...state.settings, groqKey: '' } };
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ascend90-backup-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('[SYSTEM] Backup exported (API key left out)');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.days || !data.quests) throw new Error('bad file');
      if (!confirm('Replace all current progress with this backup?')) return;
      const key = state.settings.groqKey;
      const base = defaultState();
      state = migrate({ ...base, ...data, profile: { ...base.profile, ...data.profile }, settings: { ...base.settings, ...data.settings } });
      if (!state.settings.groqKey) state.settings.groqKey = key;
      rollover(state);
      persist();
      render();
      toast('[SYSTEM] Backup restored');
    } catch {
      toast('[SYSTEM] That file is not an ASCEND 90 backup', 'var(--danger)');
    }
  };
  reader.readAsText(file);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function profileFrom(data) {
  const keys = Object.keys(defaultState().profile);
  return Object.fromEntries(keys.map(k => [k, (data[k] ?? state.profile[k] ?? '').toString().trim()]));
}

/* ---------- Events ---------- */

const actions = {
  nav: el => { ui.view = el.dataset.view; ui.testResult = null; render(); window.scrollTo(0, 0); },
  toggle: el => toggleQuest(el.dataset.id),
  plan: () => doPlan(),
  roast: () => roast(),
  'dismiss-lag': () => { state.lagReport.dismissed = true; persist(); render(); },
  judge: () => runAI('judge', async () => { today().verdict = await AI.judgeDay(state); }),
  boss: () => {
    ui.view = 'coach';
    const week = Math.floor(dayNumber(state) / 7);
    sendChat(`BOSS REVIEW for week ${week}. Grade the week S-F, list where I leaked XP by pillar with numbers, say what I did right, then give 3 measurable targets for next week.`);
  },
  chip: el => sendChat(el.dataset.text),
  'clear-chat': () => { if (confirm('Clear the chat history?')) { state.chat = []; persist(); render(); } },
  blueprint: () => runAI('blueprint', async () => { state.blueprint = await AI.generateBlueprint(state); }),
  day: el => openModal(V.dayDetail(state, el.dataset.key)),
  'close-modal': () => closeModal(),
  'test-key': async () => {
    // Use whatever is typed in the form, even if Save wasn't pressed.
    const form = document.querySelector('[data-form=ai]');
    if (form) {
      state.settings.groqKey = form.elements.groqKey.value.trim();
      state.settings.model = form.elements.model.value || state.settings.model;
    }
    ui.busy.test = true; ui.testResult = null; render();
    try {
      const model = await AI.testKey(state);
      ui.testResult = { ok: true, msg: `[SYSTEM] Online. ${model} is responding. ${state.settings.availableModels.length} models available.` };
    } catch (e) {
      ui.testResult = { ok: false, msg: e.message };
    }
    persist();
    ui.busy.test = false; render();
  },
  'quest-add': () => {
    const qs = harvestQuests();
    qs.push({ id: `q-${uid()}`, title: 'New quest', pillar: 'character', xp: 15 });
    state.quests = qs;
    render();
    const inputs = document.querySelectorAll('#quest-editor [name=title]');
    inputs[inputs.length - 1]?.select();
  },
  'quest-del': el => {
    state.quests = harvestQuests().filter(q => q.id !== el.dataset.id);
    render();
  },
  'quest-save': () => {
    applyQuestTemplate(harvestQuests());
    toast('[SYSTEM] Quests saved');
    render();
  },
  export: () => exportData(),
  import: () => $('#import-file').click(),
  reset: () => {
    if (!confirm('Delete ALL progress, logs and settings on this device? This cannot be undone.')) return;
    if (!confirm('Last chance. Wipe everything?')) return;
    clearAll();
    state = defaultState();
    ui.view = 'today';
    render();
  },
};

const forms = {
  onboard: data => {
    state.profile = profileFrom(data);
    state.settings.groqKey = (data.groqKey || '').trim();
    state.startDate = data.startDate || dateKey();
    state.lastFinalized = null;
    state.days = {};
    if (inProgram(state, dateKey())) ensureDay(state, dateKey());
    persist();
    ui.view = 'today';
    render();
    openModal(`<div class="center">
      <div class="sys">[SYSTEM] NOTIFICATION</div>
      <div class="big">YOU HAVE BEEN CHOSEN</div>
      <p>${V.esc(state.profile.name)}, you are now a Player. Daily quests reset at midnight. Finish under 60% and you enter the Penalty Zone: you lose XP and get a penalty quest.</p>
      <p style="color:var(--muted)">Refusing the quest is not an option.</p>
      <button class="btn primary block" data-act="close-modal">${V.icon('zap')} Accept</button></div>`);
  },
  answer: (data, form) => {
    const day = today();
    const q = day.plan.question;
    const a = data.a.trim();
    if (!a) return;
    state.memory.push({ q, a, date: dateKey() });
    state.memory = state.memory.slice(-40);
    day.plan.answered = a;
    persist();
    render();
    toast('[SYSTEM] Noted. Check the Coach tab.');
    sendChat(`Answering your question "${q}": ${a}`);
  },
  chat: (data, form) => sendChat(data.msg),
  log: data => {
    const day = today();
    if (!day) return;
    day.log = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
    persist();
    toast('[SYSTEM] Log saved');
    render();
  },
  ai: data => {
    state.settings.groqKey = (data.groqKey || '').trim();
    state.settings.model = (data.model || '').trim() || AI.MODELS[0];
    persist();
    toast('[SYSTEM] Coach settings saved');
    render();
  },
  profile: data => {
    state.profile = profileFrom(data);
    persist();
    toast('[SYSTEM] Profile saved');
    render();
  },
};

document.addEventListener('click', e => {
  if (e.target.id === 'modal-back') return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', e => {
  const form = e.target;
  const fn = forms[form.dataset.form];
  if (!fn) return;
  e.preventDefault();
  fn(formData(form), form);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  // Enter sends in the chat box; Shift+Enter adds a new line.
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.composer textarea')) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'import-file' && e.target.files[0]) importData(e.target.files[0]);
});

/* ---------- Day rollover ---------- */

function tick() {
  if (!state.startDate) return;
  const now = dateKey();
  if (now === ui.lastDate) return;
  ui.lastDate = now;
  boot();
}
setInterval(tick, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

function boot() {
  if (AI.RETIRED_MODELS.includes(state.settings.model)) {
    state.settings.model = AI.MODELS[0];
    persist();
  }
  if (state.startDate) {
    rollover(state);
    // Pick up template changes (e.g. migrated pillars) in today's list; ticks are kept.
    if (today()) syncTemplateToDay(state, dateKey());
    checkAchievements(state);
    persist();
  }
  render();
  if (!state.startDate) return;
  const r = state.lagReport;
  if (r && r.date === dateKey() && !r.roast && !r.dismissed && state.settings.groqKey) roast();
}

boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
