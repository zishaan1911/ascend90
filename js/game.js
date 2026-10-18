// Game rules: day lifecycle, XP, levels, ranks, streaks, penalties, achievements.
import {
  PILLARS, PENALTY_QUESTS, PENALTY_THRESHOLD, STREAK_THRESHOLD,
  PENALTY_QUEST_FAIL_XP, RANKS, PHASES, GRADES, ACHIEVEMENTS,
} from './data.js';
import { dateKey, addDays, diffDays } from './store.js';

export const PROGRAM_DAYS = 90;

export function endDate(state) {
  return addDays(state.startDate, PROGRAM_DAYS - 1);
}

export function dayNumber(state, key = dateKey()) {
  return diffDays(state.startDate, key) + 1;
}

export function inProgram(state, key) {
  const n = dayNumber(state, key);
  return n >= 1 && n <= PROGRAM_DAYS;
}

export function phaseFor(n) {
  return PHASES.find(p => n >= p.from && n <= p.to) || { name: 'Program Complete', brief: 'You finished. Now set the next 90.' };
}

export function gradeFor(pct) {
  return GRADES.find(g => pct >= g.min).grade;
}

export function ensureDay(state, key) {
  if (!state.days[key]) {
    state.days[key] = {
      quests: state.quests.map(q => ({ ...q, kind: 'core', done: false })),
      log: {},
      plan: null,
      verdict: null,
      finalized: false,
    };
  }
  return state.days[key];
}

// After the player edits their quest template, mirror it into today's list
// while keeping completion flags, AI bonus quests, and penalty quests.
export function syncTemplateToDay(state, key) {
  const day = state.days[key];
  if (!day) return;
  const doneById = Object.fromEntries(day.quests.map(q => [q.id, q.done]));
  const extras = day.quests.filter(q => q.kind !== 'core');
  day.quests = [
    ...state.quests.map(q => ({ ...q, kind: 'core', done: !!doneById[q.id] })),
    ...extras,
  ];
}

export function dayStats(day) {
  const byPillar = {};
  for (const p of Object.keys(PILLARS)) byPillar[p] = { earned: 0, total: 0 };
  let earned = 0, total = 0;
  for (const q of day.quests) {
    if (q.kind === 'penalty') continue;
    const bp = byPillar[q.pillar] || (byPillar[q.pillar] = { earned: 0, total: 0 });
    bp.total += q.xp; total += q.xp;
    if (q.done) { bp.earned += q.xp; earned += q.xp; }
  }
  const pct = total ? Math.round((earned / total) * 100) : 0;
  return { earned, total, pct, byPillar };
}

function finalizeDay(state, key) {
  const day = ensureDay(state, key);
  const s = dayStats(day);
  const penaltyByPillar = {};
  let penaltyTotal = 0;

  if (s.pct < PENALTY_THRESHOLD) {
    // The worse the day, the bigger the hit, split across the pillars you skipped.
    penaltyTotal = Math.round((PENALTY_THRESHOLD - s.pct) * 3);
    const missedTotal = s.total - s.earned || 1;
    for (const [p, v] of Object.entries(s.byPillar)) {
      const share = Math.round(penaltyTotal * ((v.total - v.earned) / missedTotal));
      if (share) penaltyByPillar[p] = share;
    }
  }
  const pq = day.quests.find(q => q.kind === 'penalty');
  if (pq && !pq.done) {
    penaltyByPillar.character = (penaltyByPillar.character || 0) + PENALTY_QUEST_FAIL_XP;
    penaltyTotal += PENALTY_QUEST_FAIL_XP;
  }

  day.pct = s.pct;
  day.grade = gradeFor(s.pct);
  day.penaltyByPillar = penaltyByPillar;
  day.penaltyTotal = penaltyTotal;
  day.finalized = true;
  return {
    key, pct: s.pct, grade: day.grade, penaltyTotal,
    untouched: !day.quests.some(q => q.done),
    failedPenaltyQuest: !!(pq && !pq.done),
    needsPenalty: s.pct < PENALTY_THRESHOLD,
  };
}

function assignPenalty(state, key) {
  if (!inProgram(state, key)) return;
  const day = ensureDay(state, key);
  if (day.quests.some(q => q.kind === 'penalty')) return;
  const title = PENALTY_QUESTS[Math.floor(Math.random() * PENALTY_QUESTS.length)];
  day.quests.unshift({ id: `penalty-${key}`, kind: 'penalty', pillar: 'character', xp: 0, title, done: false });
}

// Close out every past day that hasn't been judged yet. Returns the days just judged.
export function rollover(state) {
  if (!state.startDate) return [];
  const today = dateKey();
  const last = endDate(state);
  let cursor = state.lastFinalized ? addDays(state.lastFinalized, 1) : state.startDate;
  const results = [];
  while (diffDays(cursor, today) > 0 && diffDays(cursor, last) >= 0) {
    const r = finalizeDay(state, cursor);
    if (r.needsPenalty) assignPenalty(state, addDays(cursor, 1));
    results.push(r);
    state.lastFinalized = cursor;
    cursor = addDays(cursor, 1);
  }
  if (inProgram(state, today)) ensureDay(state, today);
  const bad = results.filter(r => r.needsPenalty || r.failedPenaltyQuest);
  if (bad.length) state.lagReport = { date: today, days: bad, seen: false, roast: null };
  return results;
}

export function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
}
export function xpForLevel(level) {
  return 25 * (level - 1) ** 2;
}
export function pillarLevel(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 10)) + 1;
}
export function rankFor(level) {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.minLevel) r = x;
  return r;
}

export function computeStats(state) {
  const pillarXp = Object.fromEntries(Object.keys(PILLARS).map(p => [p, 0]));
  let penalties = 0;
  for (const day of Object.values(state.days)) {
    for (const q of day.quests) if (q.done && q.xp) pillarXp[q.pillar] = (pillarXp[q.pillar] || 0) + q.xp;
    if (day.finalized && day.penaltyByPillar) {
      for (const [p, v] of Object.entries(day.penaltyByPillar)) { pillarXp[p] -= v; penalties += v; }
    }
  }
  const total = Object.values(pillarXp).reduce((a, b) => a + b, 0);
  const level = levelFromXp(total);
  const cur = xpForLevel(level), next = xpForLevel(level + 1);
  return {
    pillarXp, total, penalties, level,
    rank: rankFor(level),
    levelProgress: Math.max(0, Math.min(1, (total - cur) / (next - cur))),
    xpToNext: next - Math.max(total, 0),
  };
}

// Ordered list of [key, day] from program start through today.
export function timeline(state) {
  if (!state.startDate) return [];
  const today = dateKey();
  const out = [];
  for (let i = 0; i < PROGRAM_DAYS; i++) {
    const k = addDays(state.startDate, i);
    if (diffDays(k, today) < 0) break;
    out.push([k, state.days[k]]);
  }
  return out;
}

function pctOf(day) {
  return day ? (day.finalized ? day.pct : dayStats(day).pct) : 0;
}

export function streaks(state) {
  const tl = timeline(state);
  const today = dateKey();
  let best = 0, run = 0;
  for (const [k, day] of tl) {
    const isToday = k === today;
    if (pctOf(day) >= STREAK_THRESHOLD) { run++; best = Math.max(best, run); }
    else if (!isToday) run = 0;
  }
  return { current: run, best };
}

export function checkAchievements(state) {
  const tl = timeline(state);
  const stats = computeStats(state);
  const { best } = streaks(state);
  const has = id => tl.some(([, d]) => d && d.quests.some(q => q.id === id && q.done));
  const count = id => tl.filter(([, d]) => d && d.quests.some(q => q.id === id && q.done)).length;
  const runOf = pred => {
    let r = 0, m = 0;
    for (const [, d] of tl) { if (d && pred(d)) { r++; m = Math.max(m, r); } else r = 0; }
    return m;
  };
  const did = (d, id) => d.quests.some(q => q.id === id && q.done);
  const judged = state.lastFinalized ? dayNumber(state, state.lastFinalized) : 0;

  const met = {
    awakened: tl.some(([, d]) => pctOf(d) >= 70),
    flawless: tl.some(([, d]) => d && pctOf(d) === 100),
    streak3: best >= 3, streak7: best >= 7, streak14: best >= 14, streak30: best >= 30,
    dawn7: runOf(d => did(d, 'wake')) >= 7,
    monk7: runOf(d => did(d, 'meditate')) >= 7,
    gym20: count('gym') >= 20,
    dsa30: count('dsa') >= 30,
    ship30: count('ship') >= 30,
    redemption: tl.some(([, d]) => d && d.quests.some(q => q.kind === 'penalty' && q.done)),
    rankC: stats.level >= 12, rankA: stats.level >= 28,
    day30: judged >= 30, day60: judged >= 60, day90: judged >= 90,
  };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (met[a.id] && !state.achievements[a.id]) {
      state.achievements[a.id] = dateKey();
      unlocked.push(a);
    }
  }
  return unlocked;
}

export function weakestPillars(state, lookback = 7) {
  const tl = timeline(state).slice(-lookback);
  const agg = {};
  for (const [, d] of tl) {
    if (!d) continue;
    for (const [p, v] of Object.entries(dayStats(d).byPillar)) {
      agg[p] = agg[p] || { earned: 0, total: 0 };
      agg[p].earned += v.earned; agg[p].total += v.total;
    }
  }
  return Object.entries(agg)
    .filter(([, v]) => v.total)
    .map(([p, v]) => ({ pillar: p, pct: Math.round((v.earned / v.total) * 100) }))
    .sort((a, b) => a.pct - b.pct);
}
