// Persistence + date helpers. Everything lives in one localStorage key.
import { DEFAULT_QUESTS } from './data.js';

const KEY = 'ascend90.state.v1';

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function diffDays(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultState() {
  return {
    version: 1,
    startDate: null,
    lastFinalized: null,
    profile: {
      name: '', age: '', heightCm: '', weightKg: '', goalWeightKg: '',
      wakeTime: '06:00', sleepTime: '22:30', workStart: '09:00', workEnd: '17:00',
      gymTime: 'evening', leetcodeSolved: '', goals: '', weaknesses: '',
    },
    settings: { groqKey: '', model: 'openai/gpt-oss-120b', availableModels: [] },
    quests: DEFAULT_QUESTS.map(q => ({ ...q })),
    days: {},
    achievements: {},
    chat: [],
    memory: [],          // Q&A the coach has learned about the player
    blueprint: null,
    lagReport: null,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return migrate({
      ...base, ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      settings: { ...base.settings, ...parsed.settings },
    });
  } catch {
    return defaultState();
  }
}

// Saves from before Religiousmax was replaced by Mindmax: drop the old pillar's quests
// everywhere, give the template the Mindmax quests, and carry old penalties over to Mind.
export function migrate(state) {
  delete state.prayerTimes;
  delete state.profile.city;
  delete state.profile.country;
  delete state.achievements.fajr7;
  delete state.achievements.salah7;
  if (state.quests.some(q => q.pillar === 'deen')) {
    const mind = DEFAULT_QUESTS.filter(q => q.pillar === 'mind').map(q => ({ ...q }));
    state.quests = [...mind, ...state.quests.filter(q => q.pillar !== 'deen')];
    if (state.blueprint?.phases?.some(ph => ph.goals?.deen)) state.blueprint = null;
  }
  for (const day of Object.values(state.days)) {
    day.quests = day.quests.filter(q => q.pillar !== 'deen');
    const pen = day.penaltyByPillar;
    if (pen?.deen) { pen.mind = (pen.mind || 0) + pen.deen; delete pen.deen; }
  }
  return state;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
