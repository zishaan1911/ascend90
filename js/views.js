// Pure HTML builders for every screen. No side effects; main.js wires events.
import { PILLARS, PILLAR_ORDER, ACHIEVEMENTS, PENALTY_THRESHOLD, STREAK_THRESHOLD } from './data.js';
import { dateKey, addDays, diffDays } from './store.js';
import {
  PROGRAM_DAYS, dayNumber, phaseFor, dayStats, computeStats, streaks, pillarLevel, timeline, gradeFor,
} from './game.js';
import { MODELS } from './ai.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = name => `<i data-lucide="${name}"></i>`;

export function fmtAI(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const pct = n => `${Math.round(n * 100)}%`;
const gradeColor = g => ({ S: 'var(--gold)', A: 'var(--good)', B: 'var(--glow)', C: '#a5b8cc', D: '#ff9a3c', F: 'var(--danger)' }[g]);

function ring(value, color = 'var(--glow)') {
  const r = 36, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 84 84" aria-hidden="true">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(58,209,255,0.1)" stroke-width="7"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - value / 100)}" style="filter:drop-shadow(0 0 5px ${color});transition:stroke-dashoffset .5s"/>
  </svg>`;
}

function loading(text) {
  return `<div class="loading">${esc(text)}</div>`;
}

function errorLine(msg) {
  return msg ? `<div class="error">${icon('triangle-alert')} ${esc(msg)}</div>` : '';
}

function needKey(state) {
  return state.settings.groqKey ? '' : `<p class="hint">Add your Groq API key in <a href="#" data-act="nav" data-view="settings">Settings</a> to wake the coach.</p>`;
}

/* ================= HUD ================= */

function hud(state, n) {
  const stats = computeStats(state);
  const st = streaks(state);
  const phase = phaseFor(n);
  return `<section class="panel">
    <div class="hud">
      <div class="rank-badge ${stats.rank.rank}">${stats.rank.rank}</div>
      <div>
        <div class="hud-day">DAY ${Math.min(n, PROGRAM_DAYS)}<small> / ${PROGRAM_DAYS}</small></div>
        <div class="hud-phase">${esc(phase.name)}</div>
      </div>
      <div class="streak">${icon('flame')}<b>${st.current}</b><span>STREAK</span></div>
    </div>
    <div class="xpbar">
      <div class="xpbar-meta"><span><b>LV ${stats.level}</b> · ${esc(stats.rank.title)}</span><span>${stats.total < 0 ? `<b style="color:var(--danger)">${stats.total} XP · IN DEBT</b>` : `${stats.total} XP · ${stats.xpToNext} to next`}</span></div>
      <div class="bar"><i style="width:${pct(stats.levelProgress)}"></i></div>
    </div>
  </section>`;
}

/* ================= TODAY ================= */

function lagPanel(state, ui) {
  const r = state.lagReport;
  if (!r || r.date !== dateKey() || r.dismissed) return '';
  const lost = r.days.reduce((a, d) => a + d.penaltyTotal, 0);
  const rows = r.days.map(d => `<li>Day ${dayNumber(state, d.key)}: ${d.untouched ? 'no quests done' : `${d.pct}% complete`}${d.failedPenaltyQuest ? ', penalty quest skipped' : ''} · <b>-${d.penaltyTotal} XP</b></li>`).join('');
  let body;
  if (r.roast) body = `<div class="ai-text verdict">${fmtAI(r.roast)}</div>`;
  else if (ui.busy.roast) body = loading('THE SYSTEM IS REVIEWING YOUR FAILURE...');
  else if (state.settings.groqKey) body = `<button class="btn danger block" data-act="roast">${icon('skull')} Hear the verdict</button>`;
  else body = needKey(state);
  return `<section class="panel danger">
    <h3 class="panel-title">${icon('triangle-alert')} [SYSTEM] Penalty Zone<span class="spacer"></span>
      <button class="icon-btn" data-act="dismiss-lag" aria-label="Dismiss">${icon('x')}</button></h3>
    <p style="margin:0 0 8px">You fell under ${PENALTY_THRESHOLD}%. The System took <b style="color:var(--danger)">${lost} XP</b> and gave you a penalty quest.</p>
    <ul class="plain-list" style="margin-bottom:12px">${rows}</ul>
    ${body}${errorLine(ui.errors.roast)}
  </section>`;
}

function briefingPanel(state, ui, day) {
  const plan = day.plan;
  let body;
  if (ui.busy.plan) body = loading('THE SYSTEM IS CALCULATING YOUR DAY...');
  else if (!plan) {
    body = `<p class="lead">The System builds your schedule around work, salah and the gym, judges yesterday, and adds bonus quests for your weakest pillar.</p>
      ${needKey(state)}
      <button class="btn primary block" data-act="plan" ${state.settings.groqKey ? '' : 'disabled'}>${icon('sparkles')} Summon today's plan</button>`;
  } else {
    const sched = plan.schedule.map(s => {
      const color = PILLARS[s.pillar]?.color || 'var(--dim)';
      return `<li><time>${esc(s.time)}</time><span class="dot" style="background:${color}"></span><span>${esc(s.task)}</span></li>`;
    }).join('');
    const q = plan.question && !plan.answered ? `<div class="coach-q">
        <p>${icon('message-circle-question')} ${esc(plan.question)}</p>
        <form class="inline-form" data-form="answer"><input name="a" placeholder="Answer the System..." required autocomplete="off"><button class="btn sm">${icon('send')}</button></form>
      </div>` : '';
    body = `${plan.verdict ? `<div class="ai-text verdict">${fmtAI(plan.verdict)}</div>` : ''}
      ${plan.focus ? `<div class="focus">${icon('target')}<span>${esc(plan.focus)}</span></div>` : ''}
      ${sched ? `<ul class="schedule">${sched}</ul>` : ''}
      ${q}`;
  }
  return `<section class="panel">
    <h3 class="panel-title">${icon('scroll-text')} Daily Briefing<span class="spacer"></span>
      ${plan && !ui.busy.plan ? `<button class="btn sm ghost" data-act="plan">${icon('refresh-cw')} Re-roll</button>` : ''}</h3>
    ${body}${errorLine(ui.errors.plan)}
  </section>`;
}

function questButton(q, times) {
  const pillar = PILLARS[q.pillar];
  const sub = q.kind === 'penalty' ? 'PENALTY QUEST · skip it and lose 75 XP'
    : q.kind === 'bonus' ? 'AI BONUS QUEST'
    : q.prayer && times?.[q.prayer] ? `${q.prayer.toUpperCase()} · ${times[q.prayer]}` : '';
  return `<button class="quest ${q.done ? 'done' : ''} ${q.kind}" data-act="toggle" data-id="${esc(q.id)}" aria-pressed="${q.done}">
    <span class="box" style="${q.done && q.kind !== 'penalty' ? `background:${pillar.color};border-color:${pillar.color};box-shadow:0 0 10px ${pillar.color}` : ''}">${icon('check')}</span>
    <span class="q-title">${esc(q.title)}${sub ? `<span class="q-sub">${esc(sub)}</span>` : ''}</span>
    <span class="xp">${q.xp ? `+${q.xp}` : ''}</span>
  </button>`;
}

function questsPanel(state, day) {
  const s = dayStats(day);
  const grade = gradeFor(s.pct);
  const times = state.prayerTimes[dateKey()];
  const penalty = day.quests.filter(q => q.kind === 'penalty');
  const groups = PILLAR_ORDER.map(p => {
    const qs = day.quests.filter(q => q.pillar === p && q.kind !== 'penalty');
    if (!qs.length) return '';
    const bp = s.byPillar[p];
    const P = PILLARS[p];
    return `<div class="pillar-head"><span class="tag" style="color:${P.color}">${P.tag}</span><span class="name">${P.name}</span><span class="count">${bp.earned}/${bp.total}</span></div>
      <div class="mini-bar"><i style="width:${bp.total ? (bp.earned / bp.total) * 100 : 0}%;background:${P.color}"></i></div>
      ${qs.map(q => questButton(q, times)).join('')}`;
  }).join('');
  const status = s.pct >= STREAK_THRESHOLD ? 'Streak secured.'
    : s.pct >= PENALTY_THRESHOLD ? `${STREAK_THRESHOLD}% keeps your streak.`
    : `Under ${PENALTY_THRESHOLD}% at midnight = Penalty Zone.`;
  return `<section class="panel">
    <h3 class="panel-title">${icon('swords')} Daily Quests</h3>
    <div class="today-row" style="margin-bottom:14px">
      <div class="ring">${ring(s.pct, gradeColor(grade))}<div class="val"><div><b>${s.pct}%</b><span>DONE</span></div></div></div>
      <div style="flex:1">
        <div class="sys">CURRENT GRADE</div>
        <div class="grade" style="color:${gradeColor(grade)}">${grade}</div>
        <div class="meta">${s.earned}/${s.total} XP · ${esc(status)}</div>
      </div>
    </div>
    ${penalty.length ? `<div class="pillar-head"><span class="tag" style="color:var(--danger)">PENALTY</span><span class="name" style="color:var(--danger)">Penalty Zone</span></div>${penalty.map(q => questButton(q)).join('')}` : ''}
    ${groups}
  </section>`;
}

function bossPanel(n) {
  if (n % 7 !== 0) return '';
  return `<section class="panel" style="border-color:rgba(255,204,77,.5)">
    <h3 class="panel-title" style="color:var(--gold)">${icon('crown')} Boss Review: Week ${n / 7}</h3>
    <p class="lead">Week ${n / 7} of 13 is done. The System grades the week, finds where you leaked, and sets next week's targets.</p>
    <button class="btn block" style="color:var(--gold);border-color:var(--gold)" data-act="boss">${icon('crown')} Face the boss review</button>
  </section>`;
}

function judgmentPanel(state, ui, day) {
  let body;
  if (ui.busy.judge) body = loading('JUDGMENT IN PROGRESS...');
  else body = `${day.verdict ? `<div class="ai-text">${fmtAI(day.verdict)}</div>` : '<p class="lead">Before you sleep, let the System grade your day and set tomorrow\'s fixes.</p>'}
    ${needKey(state)}
    <button class="btn block" data-act="judge" ${state.settings.groqKey ? '' : 'disabled'}>${icon('gavel')} ${day.verdict ? 'Judge again' : 'Judge my day'}</button>`;
  return `<section class="panel"><h3 class="panel-title">${icon('gavel')} End-of-Day Judgment</h3>${body}${errorLine(ui.errors.judge)}</section>`;
}

export function viewToday(state, ui) {
  const today = dateKey();
  const n = dayNumber(state, today);
  if (n < 1) {
    return `<section class="panel"><h3 class="panel-title">${icon('hourglass')} Awaiting Start</h3>
      <div class="big">T-${1 - n} DAY${1 - n === 1 ? '' : 'S'}</div>
      <p class="center meta">Your 90 days start on ${esc(state.startDate)}. Use the time to set up your quests in Settings and chat with the coach.</p></section>`;
  }
  if (n > PROGRAM_DAYS) {
    const stats = computeStats(state);
    return `${hud(state, n)}<section class="panel"><h3 class="panel-title" style="color:var(--gold)">${icon('crown')} Program Complete</h3>
      <p>You finished 90 days at <b>LV ${stats.level}</b> (${esc(stats.rank.title)}) with ${stats.total} XP. Check Status for the full picture, then go to Settings to start your next 90 days.</p></section>`;
  }
  const day = state.days[today];
  return hud(state, n) + lagPanel(state, ui) + briefingPanel(state, ui, day) + questsPanel(state, day) + bossPanel(n) + judgmentPanel(state, ui, day);
}

/* ================= COACH ================= */

export const CHIPS = [
  'Roast my last 3 days',
  "I'm about to slack. Stop me.",
  'Build my gym split around a 9-5',
  'Give me a LeetCode roadmap for 90 days',
  'How do I never miss Fajr?',
  'Upgrade my style on a budget',
  'Skincare routine for my face',
  'What should I build as a side project?',
];

export function viewCoach(state, ui) {
  const msgs = state.chat.length ? state.chat.map(m => `<div class="msg ${m.role}"><div class="ai-text">${m.role === 'assistant' ? fmtAI(m.content) : esc(m.content).replace(/\n/g, '<br>')}</div></div>`).join('')
    : `<div class="msg assistant"><div class="ai-text"><p>Talk to me. Ask for a gym split, a LeetCode plan, a style overhaul, or confess why you're lagging. I see every quest you skip.</p></div></div>`;
  return `<section class="panel"><h3 class="panel-title">${icon('bot')} The System<span class="spacer"></span>
      ${state.chat.length ? `<button class="btn sm ghost" data-act="clear-chat">${icon('trash-2')} Clear</button>` : ''}</h3>
    ${needKey(state)}
    <div class="chat" id="chat">${msgs}${ui.busy.chat ? `<div class="msg assistant">${loading('TYPING...')}</div>` : ''}</div>
    ${errorLine(ui.errors.chat)}
  </section>
  <div class="composer">
    <div class="chips">${CHIPS.map(c => `<button class="chip" data-act="chip" data-text="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <form class="inline-form" data-form="chat">
      <textarea name="msg" rows="1" placeholder="Speak to the System..." required></textarea>
      <button class="btn primary" aria-label="Send" ${ui.busy.chat ? 'disabled' : ''}>${icon('send')}</button>
    </form>
  </div>`;
}

/* ================= STATUS ================= */

function radar(levels) {
  const cx = 150, cy = 140, R = 100;
  const max = Math.max(10, ...Object.values(levels));
  const pt = (i, f) => {
    const a = (-90 + i * 60) * Math.PI / 180;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = f => PILLAR_ORDER.map((_, i) => pt(i, f).join(',')).join(' ');
  const shape = PILLAR_ORDER.map((p, i) => pt(i, Math.max(0.04, levels[p] / max)).join(',')).join(' ');
  const labels = PILLAR_ORDER.map((p, i) => {
    const [x, y] = pt(i, 1.2);
    return `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="${PILLARS[p].color}" font-family="Orbitron" font-size="12.5" font-weight="700">${PILLARS[p].tag} ${levels[p]}</text>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 300 280" role="img" aria-label="Stat radar">
    ${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${poly(f)}" fill="none" stroke="rgba(58,209,255,0.15)"/>`).join('')}
    ${PILLAR_ORDER.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}" stroke="rgba(58,209,255,0.12)"/>`).join('')}
    <polygon points="${shape}" fill="rgba(58,209,255,0.22)" stroke="#3ad1ff" stroke-width="2" style="filter:drop-shadow(0 0 6px #3ad1ff)"/>
    ${labels}
  </svg>`;
}

function blueprintPanel(state, ui) {
  const bp = state.blueprint;
  let body;
  if (ui.busy.blueprint) body = loading('FORGING YOUR 90-DAY BLUEPRINT...');
  else if (!bp) body = `<p class="lead">Let the System write measurable goals for every pillar across the three phases, using your profile.</p>${needKey(state)}
    <button class="btn primary block" data-act="blueprint" ${state.settings.groqKey ? '' : 'disabled'}>${icon('map')} Forge my blueprint</button>`;
  else {
    const phases = (bp.phases || []).map(ph => `<div class="bp-phase"><h4>${esc(ph.name)}</h4><ul>
      ${PILLAR_ORDER.filter(p => ph.goals?.[p]).map(p => `<li><span class="tag" style="color:${PILLARS[p].color}">${PILLARS[p].tag}</span> ${esc(ph.goals[p])}</li>`).join('')}
    </ul></div>`).join('');
    body = `${bp.headline ? `<p class="focus">${icon('target')}<span>${esc(bp.headline)}</span></p>` : ''}
      ${phases}
      ${bp.nonNegotiables?.length ? `<div class="bp-phase"><h4>Non-negotiables</h4><ul>${bp.nonNegotiables.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${bp.warning ? `<div class="verdict ai-text"><p><strong>Warning:</strong> ${esc(bp.warning)}</p></div>` : ''}
      <button class="btn sm ghost" data-act="blueprint">${icon('refresh-cw')} Re-forge</button>`;
  }
  return `<section class="panel"><h3 class="panel-title">${icon('map')} 90-Day Blueprint</h3>${body}${errorLine(ui.errors.blueprint)}</section>`;
}

export function viewStatus(state, ui) {
  const stats = computeStats(state);
  const st = streaks(state);
  const levels = Object.fromEntries(PILLAR_ORDER.map(p => [p, pillarLevel(stats.pillarXp[p])]));
  const lastAch = ACHIEVEMENTS.filter(a => state.achievements[a.id]).sort((a, b) => state.achievements[b.id].localeCompare(state.achievements[a.id]))[0];
  const statCards = PILLAR_ORDER.map(p => {
    const xp = stats.pillarXp[p], L = levels[p];
    const cur = 10 * (L - 1) ** 2, next = 10 * L ** 2;
    const prog = Math.max(0, Math.min(1, (xp - cur) / (next - cur)));
    return `<div class="stat"><div class="top"><span class="tag" style="color:${PILLARS[p].color}">${PILLARS[p].tag}</span><span class="lv" style="color:${PILLARS[p].color}">${L}</span></div>
      <div class="nm">${PILLARS[p].name} · ${xp} XP</div>
      <div class="bar"><i style="width:${pct(prog)};background:${PILLARS[p].color};box-shadow:0 0 8px ${PILLARS[p].color}"></i></div></div>`;
  }).join('');
  const ach = ACHIEVEMENTS.map(a => {
    const on = state.achievements[a.id];
    return `<div class="ach ${on ? 'on' : ''}"><b>${icon(on ? 'trophy' : 'lock')} ${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`;
  }).join('');
  return `<section class="panel">
    <h3 class="panel-title">${icon('user-round')} Status Window</h3>
    <div class="player">
      <div class="rank-badge ${stats.rank.rank}">${stats.rank.rank}</div>
      <div><h2>${esc(state.profile.name || 'Player')}</h2>
        <div class="title">${lastAch ? `Title: ${esc(lastAch.name)}` : 'Title: none yet'}</div>
        <div class="meta">LV ${stats.level} · ${stats.total} XP · best streak ${st.best} · penalties -${stats.penalties}</div></div>
    </div>
    ${radar(levels)}
    <div class="stat-grid">${statCards}</div>
  </section>
  ${blueprintPanel(state, ui)}
  <section class="panel"><h3 class="panel-title">${icon('trophy')} Titles · ${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length}</h3><div class="ach-grid">${ach}</div></section>`;
}

/* ================= LOG ================= */

function heatColor(p) {
  if (p >= 95) return 'rgba(255,204,77,0.85)';
  if (p >= STREAK_THRESHOLD) return `rgba(58,209,255,${0.25 + (p / 100) * 0.6})`;
  if (p >= PENALTY_THRESHOLD) return 'rgba(255,154,60,0.55)';
  return `rgba(255,59,92,${0.25 + (p / 100) * 0.6})`;
}

function weightChart(state) {
  const pts = timeline(state).filter(([, d]) => d?.log?.weight).map(([k, d]) => [dayNumber(state, k), Number(d.log.weight)]);
  if (pts.length < 2) return `<div class="empty">Log your weight on 2+ days to see the trend.</div>`;
  const ws = pts.map(p => p[1]);
  const min = Math.min(...ws), max = Math.max(...ws), span = max - min || 1;
  const W = 300, H = 90;
  const xy = pts.map(([n, w]) => `${((n - 1) / (PROGRAM_DAYS - 1)) * W},${H - 8 - ((w - min) / span) * (H - 16)}`).join(' ');
  const goal = Number(state.profile.goalWeightKg);
  const first = ws[0], last = ws[ws.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Weight trend">
      <polyline points="${xy}" fill="none" stroke="#3ad1ff" stroke-width="2" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 4px #3ad1ff)"/>
    </svg>
    <div class="legend"><span>Start ${first}kg</span><span>Now <b style="color:var(--text)">${last}kg</b> (${last - first >= 0 ? '+' : ''}${(last - first).toFixed(1)})</span>${goal ? `<span>Goal ${goal}kg</span>` : ''}</div>`;
}

export function viewLog(state) {
  const today = dateKey();
  const day = state.days[today];
  const log = day?.log || {};
  const opt = (v, sel) => [1, 2, 3, 4, 5].map(i => `<option value="${i}" ${String(sel) === String(i) ? 'selected' : ''}>${i}</option>`).join('');
  const form = day ? `<section class="panel"><h3 class="panel-title">${icon('notebook-pen')} Today's Log</h3>
    <form data-form="log">
      <div class="grid3">
        <label class="field"><span>Weight (kg)</span><input name="weight" type="number" step="0.1" inputmode="decimal" value="${esc(log.weight)}"></label>
        <label class="field"><span>Sleep (h)</span><input name="sleep" type="number" step="0.25" inputmode="decimal" value="${esc(log.sleep)}"></label>
        <label class="field"><span>Screen (h)</span><input name="screen" type="number" step="0.25" inputmode="decimal" value="${esc(log.screen)}"></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Energy (1-5)</span><select name="energy"><option value="">-</option>${opt(5, log.energy)}</select></label>
        <label class="field"><span>Mood (1-5)</span><select name="mood"><option value="">-</option>${opt(5, log.mood)}</select></label>
      </div>
      <label class="field"><span>Notes for the System</span><textarea name="notes" placeholder="What happened today? Why did you slip?">${esc(log.notes)}</textarea></label>
      <button class="btn primary block">${icon('save')} Save log</button>
    </form></section>` : '';

  const cells = [];
  for (let i = 0; i < PROGRAM_DAYS; i++) {
    const k = addDays(state.startDate, i);
    const d = state.days[k];
    const future = diffDays(k, today) < 0;
    const p = d ? (d.finalized ? d.pct : dayStats(d).pct) : 0;
    const style = future ? '' : `background:${heatColor(p)};color:${p >= 70 ? '#021019' : 'var(--text)'}`;
    cells.push(`<button class="${future ? 'future' : ''} ${k === today ? 'today' : ''}" style="${style}" ${future ? 'disabled' : `data-act="day" data-key="${k}"`} aria-label="Day ${i + 1}${future ? '' : `, ${p}%`}">${i + 1}</button>`);
  }
  return `${form}
  <section class="panel"><h3 class="panel-title">${icon('calendar-days')} 90-Day Map</h3>
    <div class="heat">${cells.join('')}</div>
    <div class="legend"><span><i style="background:rgba(255,204,77,.85)"></i>95%+</span><span><i style="background:rgba(58,209,255,.7)"></i>${STREAK_THRESHOLD}%+</span><span><i style="background:rgba(255,154,60,.55)"></i>${PENALTY_THRESHOLD}-${STREAK_THRESHOLD - 1}%</span><span><i style="background:rgba(255,59,92,.6)"></i>Penalty</span></div>
  </section>
  <section class="panel"><h3 class="panel-title">${icon('trending-down')} Weight Trend</h3>${weightChart(state)}</section>`;
}

export function dayDetail(state, key) {
  const d = state.days[key];
  if (!d) return `<p>No data.</p>`;
  const s = dayStats(d);
  const p = d.finalized ? d.pct : s.pct;
  const g = gradeFor(p);
  const done = d.quests.filter(q => q.done), missed = d.quests.filter(q => !q.done);
  const log = d.log || {};
  const logLine = [log.weight && `${log.weight}kg`, log.sleep && `${log.sleep}h sleep`, log.screen && `${log.screen}h screen`, log.energy && `energy ${log.energy}/5`, log.mood && `mood ${log.mood}/5`].filter(Boolean).join(' · ');
  return `<h3 class="panel-title">${icon('calendar')} Day ${dayNumber(state, key)} · ${esc(key)}<span class="spacer"></span><button class="icon-btn" data-act="close-modal" aria-label="Close">${icon('x')}</button></h3>
    <div class="today-row" style="margin-bottom:12px"><div class="grade" style="color:${gradeColor(g)}">${g}</div>
      <div>${p}% complete${d.finalized ? '' : ' (in progress)'}${d.penaltyTotal ? `<br><span style="color:var(--danger)">-${d.penaltyTotal} XP penalty</span>` : ''}</div></div>
    ${logLine ? `<p style="color:var(--muted)">${esc(logLine)}</p>` : ''}
    ${log.notes ? `<p>"${esc(log.notes)}"</p>` : ''}
    ${done.length ? `<div class="sys" style="margin:8px 0 4px">CLEARED</div><ul class="plain-list">${done.map(q => `<li>${esc(q.title)}</li>`).join('')}</ul>` : ''}
    ${missed.length ? `<div class="sys" style="margin:8px 0 4px;color:var(--danger)">MISSED</div><ul class="plain-list">${missed.map(q => `<li>${esc(q.title)}</li>`).join('')}</ul>` : ''}
    ${d.verdict ? `<div class="sys" style="margin:12px 0 4px">JUDGMENT</div><div class="ai-text">${fmtAI(d.verdict)}</div>` : ''}`;
}

/* ================= SETTINGS / ONBOARDING ================= */

function profileFields(p) {
  const f = (name, label, type = 'text', extra = '') =>
    `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(p[name])}" ${extra}></label>`;
  return `
    ${f('name', 'Name', 'text', 'required autocomplete="given-name"')}
    <div class="grid2">${f('age', 'Age', 'number', 'inputmode="numeric"')}${f('heightCm', 'Height (cm)', 'number', 'inputmode="decimal"')}</div>
    <div class="grid2">${f('weightKg', 'Weight (kg)', 'number', 'step="0.1" inputmode="decimal"')}${f('goalWeightKg', 'Goal (kg)', 'number', 'step="0.1" inputmode="decimal"')}</div>
    ${f('leetcodeSolved', 'LeetCode problems solved so far', 'number', 'inputmode="numeric"')}
    <div class="grid2">${f('city', 'City')}${f('country', 'Country')}</div>
    <p class="hint">City and country are sent only to aladhan.com to get accurate salah times.</p>
    <div class="grid2">${f('wakeTime', 'Wake time', 'time')}${f('sleepTime', 'Sleep time', 'time')}</div>
    <div class="grid2">${f('workStart', 'Work starts', 'time')}${f('workEnd', 'Work ends', 'time')}</div>
    <label class="field"><span>Gym time</span><select name="gymTime">
      ${['morning (before work)', 'lunch', 'evening (after work)', 'night'].map(o => `<option ${p.gymTime === o || (p.gymTime && o.startsWith(p.gymTime)) ? 'selected' : ''}>${o}</option>`).join('')}
    </select></label>
    <label class="field"><span>Your 90-day goals</span><textarea name="goals" placeholder="e.g. Drop to 75kg with visible abs, solve 250 LeetCode, ship 2 apps, pray all 5 on time, read 8 books">${esc(p.goals)}</textarea></label>
    <label class="field"><span>Why you lag (be honest, the System uses this against you)</span><textarea name="weaknesses" placeholder="e.g. Doomscroll at night, skip gym when tired after work, miss Fajr when I sleep late">${esc(p.weaknesses)}</textarea></label>`;
}

export function viewOnboarding(state) {
  return `<div class="awaken">
      <div class="sys">[SYSTEM] A NEW PLAYER HAS BEEN DETECTED</div>
      <h1>ASCEND 90</h1>
      <p>90 days. Six pillars. One version of you that doesn't lag.</p>
    </div>
    <section class="panel"><h3 class="panel-title">${icon('scan-face')} Player Registration</h3>
    <form data-form="onboard">
      ${profileFields(state.profile)}
      <label class="field"><span>Groq API key</span><input name="groqKey" type="password" autocomplete="off" placeholder="gsk_..." value="${esc(state.settings.groqKey)}"></label>
      <p class="hint">Stored only on this device and sent only to Groq. Get one free at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>. You can add it later.</p>
      <label class="field"><span>Day 1 starts</span><input name="startDate" type="date" value="${dateKey()}" min="${dateKey()}" required></label>
      <button class="btn primary block">${icon('zap')} Accept the quest</button>
    </form></section>`;
}

export function viewSettings(state, ui) {
  const qrows = state.quests.map(q => `<div class="q-edit" data-id="${esc(q.id)}">
      <input name="title" value="${esc(q.title)}" aria-label="Quest title">
      <select name="pillar" aria-label="Pillar">${PILLAR_ORDER.map(p => `<option value="${p}" ${q.pillar === p ? 'selected' : ''}>${PILLARS[p].tag}</option>`).join('')}</select>
      <input name="xp" type="number" min="5" max="60" value="${q.xp}" aria-label="XP">
      <button type="button" class="icon-btn" data-act="quest-del" data-id="${esc(q.id)}" aria-label="Delete quest">${icon('trash-2')}</button>
    </div>`).join('');
  return `<section class="panel"><h3 class="panel-title">${icon('key-round')} Groq Coach</h3>
    <form data-form="ai">
      <label class="field"><span>API key</span><input name="groqKey" type="password" autocomplete="off" placeholder="gsk_..." value="${esc(state.settings.groqKey)}"></label>
      <p class="hint">Stored only on this device. Get one at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>.</p>
      <label class="field"><span>Model</span><input name="model" list="models" value="${esc(state.settings.model)}"><datalist id="models">${MODELS.map(m => `<option value="${m}">`).join('')}</datalist></label>
      <div class="btn-row"><button class="btn primary">${icon('save')} Save</button><button type="button" class="btn" data-act="test-key" ${ui.busy.test ? 'disabled' : ''}>${icon('plug-zap')} ${ui.busy.test ? 'Testing...' : 'Test'}</button></div>
      ${ui.testResult ? `<p class="hint" style="margin-top:10px;color:${ui.testResult.ok ? 'var(--good)' : 'var(--danger)'}">${esc(ui.testResult.msg)}</p>` : ''}
    </form></section>

  <section class="panel"><h3 class="panel-title">${icon('swords')} Daily Quests</h3>
    <p class="hint">Changes apply to today and every day after. Past days keep their quests.</p>
    <div id="quest-editor">${qrows}</div>
    <div class="btn-row" style="margin-top:10px"><button class="btn" data-act="quest-add">${icon('plus')} Add quest</button><button class="btn primary" data-act="quest-save">${icon('save')} Save quests</button></div>
  </section>

  <section class="panel"><h3 class="panel-title">${icon('user-round')} Player Profile</h3>
    <form data-form="profile">${profileFields(state.profile)}<button class="btn primary block">${icon('save')} Save profile</button></form></section>

  <section class="panel"><h3 class="panel-title">${icon('database')} Data</h3>
    <p class="hint">Everything is stored in this browser only. Export a backup now and then so you don't lose your run.</p>
    <div class="btn-row">
      <button class="btn" data-act="export">${icon('download')} Export</button>
      <button class="btn" data-act="import">${icon('upload')} Import</button>
    </div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <button class="btn danger block" style="margin-top:10px" data-act="reset">${icon('skull')} Reset everything</button>
  </section>`;
}

export function nav(view) {
  const items = [['today', 'swords', 'Quests'], ['coach', 'bot', 'Coach'], ['status', 'user-round', 'Status'], ['log', 'calendar-days', 'Log'], ['settings', 'settings', 'Settings']];
  return `<nav class="nav"><div class="nav-inner">${items.map(([v, ic, label]) =>
    `<button class="${view === v ? 'on' : ''}" data-act="nav" data-view="${v}" aria-current="${view === v ? 'page' : 'false'}">${icon(ic)}${label}</button>`).join('')}</div></nav>`;
}
