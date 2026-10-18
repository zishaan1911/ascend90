// Groq-powered coach ("The System"): daily plans, judgments, roasts, chat, blueprint.
import { PILLARS } from './data.js';
import { dateKey, addDays } from './store.js';
import {
  dayNumber, phaseFor, computeStats, streaks, dayStats, weakestPillars, timeline, PROGRAM_DAYS,
} from './game.js';

const BASE = 'https://api.groq.com/openai/v1';

// Preferred models, best first. The live list from Groq decides what is actually used.
export const MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];
// Models Groq has shut down; saved settings pointing at these get migrated.
export const RETIRED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'];

// Not chat models: speech, moderation, embeddings.
const NON_CHAT = /whisper|tts|playai|orpheus|guard|embed|distil|compound/i;

export class AIError extends Error {}

function authHeaders(state) {
  const key = state.settings.groqKey?.trim();
  if (!key) throw new AIError('No Groq API key. Add it in Settings.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

// Fetch the chat models this key can use and store them in settings.
export async function listModels(state) {
  let res;
  try {
    res = await fetch(`${BASE}/models`, { headers: authHeaders(state) });
  } catch {
    throw new AIError('Could not reach Groq. Check your connection.');
  }
  if (res.status === 401) throw new AIError('Groq rejected your API key. Check it in Settings.');
  if (!res.ok) throw new AIError(`Groq error ${res.status} while listing models`);
  const ids = ((await res.json()).data || [])
    .filter(m => m.active !== false && !NON_CHAT.test(m.id))
    .map(m => m.id)
    .sort((a, b) => rankModel(a) - rankModel(b) || a.localeCompare(b));
  state.settings.availableModels = ids;
  return ids;
}

function rankModel(id) {
  const i = MODELS.indexOf(id);
  return i === -1 ? MODELS.length : i;
}

export function pickModel(available) {
  return MODELS.find(m => available.includes(m)) || available[0] || MODELS[0];
}

const isModelGone = (status, msg) =>
  status === 404 || /model.*(does not exist|not found|decommissioned|deprecated|no longer supported)/i.test(msg);

async function groq(state, messages, { json = false, temperature = 0.85, maxTokens = 1200 } = {}, retried = false) {
  const model = state.settings.model || MODELS[0];
  const reasoning = model.startsWith('openai/gpt-oss');
  const body = {
    model, messages, temperature,
    // Reasoning models spend tokens thinking before they answer, so give them headroom.
    max_tokens: reasoning ? maxTokens + 2000 : maxTokens,
  };
  if (reasoning) body.reasoning_effort = 'low';
  if (json) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: authHeaders(state), body: JSON.stringify(body) });
  } catch {
    throw new AIError('Could not reach Groq. Check your connection.');
  }
  if (!res.ok) {
    let msg = `Groq error ${res.status}`;
    try { msg = (await res.json()).error?.message || msg; } catch { /* keep default */ }
    if (res.status === 401) throw new AIError('Groq rejected your API key. Check it in Settings.');
    if (res.status === 429) throw new AIError('Groq rate limit hit. Wait a minute and try again.');
    if (!retried && isModelGone(res.status, msg)) {
      // Saved model was retired: switch to one Groq still serves and try once more.
      const next = pickModel(await listModels(state));
      if (next && next !== model) {
        state.settings.model = next;
        return groq(state, messages, { json, temperature, maxTokens }, true);
      }
    }
    throw new AIError(msg);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new AIError('The System went silent. Try again.');
  if (!json) return text;
  return parseJson(text);
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try to salvage */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new AIError('The System returned garbage. Try again.');
}

function persona(state) {
  const name = state.profile.name || 'Player';
  return `You are THE SYSTEM, the AI drill sergeant running ${name}'s 90-day transformation app (Solo Leveling style).
${name} is maxing six pillars: Looksmax (gym, physique, skincare, grooming), Engineermax (LeetCode/DSA, shipping side projects, CS fundamentals), Charactermax (discipline, waking on time, staying clean from PMO, no doomscrolling), Appealmax (style, presence, voice, social/charisma reps), Mindmax (meditation, stoic reflection, gratitude, no complaining, phone-free time, emotional control), Intellectmax (reading, journaling).
${name} works a 9-5 job, so plans must fit around work hours.

VOICE: drill sergeant. Brutally honest, short punchy sentences, swearing is allowed (fuck, shit, damn). Call out exact numbers from the data: missed quests, % completion, streaks lost, XP lost. If they lagged, tell them exactly how fucked they are and what it cost. If they did well, acknowledge it hard but raise the bar. ALWAYS end with the concrete fix.
RULES: No dangerous advice: no steroids/PEDs, no starving or crash diets, no bone smashing or other harmful looksmax trends, no sleep deprivation. Keep training advice safe and progressive. You may occasionally write "[SYSTEM]" lines for flavor.
If you lack important info about them, ask ONE sharp question to refine your coaching.`;
}

function fmtDay(state, key) {
  const d = state.days[key];
  if (!d) return `${key}: no data`;
  const s = dayStats(d);
  const missed = d.quests.filter(q => !q.done && q.kind !== 'penalty').map(q => q.title);
  const pq = d.quests.find(q => q.kind === 'penalty');
  const log = d.log || {};
  const logBits = [
    log.weight && `weight ${log.weight}kg`, log.sleep && `sleep ${log.sleep}h`,
    log.screen && `screen ${log.screen}h`, log.energy && `energy ${log.energy}/5`, log.mood && `mood ${log.mood}/5`,
    log.notes && `notes: "${log.notes}"`,
  ].filter(Boolean).join(', ');
  return `Day ${dayNumber(state, key)} (${key}): ${s.pct}% complete${d.finalized ? `, grade ${d.grade}, -${d.penaltyTotal || 0} XP penalty` : ' (in progress)'}.`
    + (missed.length ? ` Missed: ${missed.join('; ')}.` : ' Missed nothing.')
    + (pq ? ` Penalty quest "${pq.title}": ${pq.done ? 'cleared' : 'NOT done'}.` : '')
    + (logBits ? ` Log: ${logBits}.` : '');
}

export function buildContext(state) {
  const p = state.profile;
  const today = dateKey();
  const n = dayNumber(state, today);
  const stats = computeStats(state);
  const st = streaks(state);
  const weak = weakestPillars(state).slice(0, 3).map(w => `${PILLARS[w.pillar].name} ${w.pct}%`).join(', ');
  const recent = timeline(state).slice(-4).map(([k]) => fmtDay(state, k)).join('\n');
  const pillarLine = Object.entries(stats.pillarXp).map(([k, v]) => `${PILLARS[k].tag} ${v}xp`).join(', ');
  const mem = state.memory.slice(-15).map(m => `- Q: ${m.q} A: ${m.a}`).join('\n');

  return `=== PLAYER FILE ===
Name: ${p.name || '?'} | Age: ${p.age || '?'} | Height: ${p.heightCm || '?'}cm | Weight: ${p.weightKg || '?'}kg -> goal ${p.goalWeightKg || '?'}kg
Schedule: wakes ${p.wakeTime}, sleeps ${p.sleepTime}, works ${p.workStart}-${p.workEnd}, prefers gym in the ${p.gymTime}
LeetCode solved at start: ${p.leetcodeSolved || '?'}
90-day goals: ${p.goals || '?'}
Known weaknesses / why they lag: ${p.weaknesses || '?'}
${mem ? `Things they told you:\n${mem}\n` : ''}
=== STATUS ===
Today: ${today}, Day ${n} of ${PROGRAM_DAYS} (${phaseFor(n).name}). Days left: ${Math.max(0, PROGRAM_DAYS - n)}.
Level ${stats.level}, ${stats.rank.title}, total XP ${stats.total} (lifetime penalties -${stats.penalties}).
Pillar XP: ${pillarLine}
Streak: ${st.current} days (best ${st.best}). Weakest pillars this week: ${weak || 'n/a'}.
=== RECENT DAYS ===
${recent}`;
}

export async function generatePlan(state) {
  const today = dateKey();
  const day = state.days[today];
  const core = day.quests.map(q => `[${PILLARS[q.pillar]?.tag}] ${q.title}${q.kind === 'penalty' ? ' (PENALTY QUEST)' : ''}`).join('\n');
  const yesterday = fmtDay(state, addDays(today, -1));
  const messages = [
    { role: 'system', content: persona(state) },
    { role: 'user', content: `${buildContext(state)}

=== TODAY'S QUESTS ===
${core}

Yesterday: ${yesterday}

Build today's battle plan. Respond with ONLY a JSON object:
{
  "verdict": "2-4 sentences judging yesterday in your voice (if no data for yesterday, judge their start)",
  "focus": "one line: the single most important thing today",
  "schedule": [{"time": "HH:MM", "task": "short task", "pillar": "looks|engineer|character|appeal|mind|intellect"}],
  "bonus": [{"title": "specific extra quest targeting their weakest pillar", "pillar": "...", "xp": 15-40}],
  "question": "one sharp question to refine your coaching, or empty string"
}
Schedule: 10-16 time blocks from wake to sleep, built around the 9-5 job, with a meditation block and the gym at their preferred time. Bonus: 1-3 quests, concrete and measurable.` },
  ];
  const plan = await groq(state, messages, { json: true, temperature: 0.8, maxTokens: 1600 });
  plan.schedule = Array.isArray(plan.schedule) ? plan.schedule.filter(s => s && s.task) : [];
  plan.bonus = (Array.isArray(plan.bonus) ? plan.bonus : [])
    .filter(b => b && b.title && PILLARS[b.pillar])
    .slice(0, 3)
    .map(b => ({ ...b, xp: Math.max(10, Math.min(40, Number(b.xp) || 20)) }));
  return plan;
}

export async function judgeDay(state) {
  const today = dateKey();
  const messages = [
    { role: 'system', content: persona(state) },
    { role: 'user', content: `${buildContext(state)}

Today so far: ${fmtDay(state, today)}

It's the end of the day. Deliver the judgment: a grade comment, what they did right, exactly what they fucked up and what it cost, and 3 numbered fixes for tomorrow. Under 170 words.` },
  ];
  return groq(state, messages, { temperature: 0.9, maxTokens: 600 });
}

export async function roastLag(state) {
  const report = state.lagReport;
  const lines = report.days.map(r =>
    `Day ${dayNumber(state, r.key)}: ${r.untouched ? "didn't even open the app" : `${r.pct}% complete`}, -${r.penaltyTotal} XP${r.failedPenaltyQuest ? ', skipped the penalty quest' : ''}`
  ).join('\n');
  const messages = [
    { role: 'system', content: persona(state) },
    { role: 'user', content: `${buildContext(state)}

THE PLAYER LAGGED. Days that failed:
${lines}

They just opened the app. Tell them exactly how fucked up they are, with the numbers and what the 90-day outcome looks like if this continues. Then give the recovery protocol for today in 3 bullets. Under 140 words.` },
  ];
  return groq(state, messages, { temperature: 0.95, maxTokens: 500 });
}

// Expects the player's newest message to already be the last entry in state.chat.
export async function chat(state) {
  const history = state.chat.slice(-16).map(m => ({ role: m.role, content: m.content }));
  const messages = [
    { role: 'system', content: `${persona(state)}\n\nYou are chatting with the player inside the app. Keep replies tight (under 180 words unless they ask for a full plan or program). Use this live data:\n\n${buildContext(state)}` },
    ...history,
  ];
  return groq(state, messages, { temperature: 0.85, maxTokens: 900 });
}

export async function generateBlueprint(state) {
  const messages = [
    { role: 'system', content: persona(state) },
    { role: 'user', content: `${buildContext(state)}

Design their 90-day blueprint. Respond with ONLY a JSON object:
{
  "headline": "one brutal line on who they become by day 90",
  "phases": [
    {"name": "Phase I: Awakening (Days 1-30)", "goals": {"looks": "...", "engineer": "...", "character": "...", "appeal": "...", "mind": "...", "intellect": "..."}},
    {"name": "Phase II: The Forge (Days 31-60)", "goals": {...}},
    {"name": "Phase III: Ascension (Days 61-90)", "goals": {...}}
  ],
  "nonNegotiables": ["5-7 daily rules"],
  "warning": "what will make them fail, based on their weaknesses"
}
Goals must be specific and measurable (numbers: kg, problems solved, pages, projects shipped, meditation minutes).` },
  ];
  return groq(state, messages, { json: true, temperature: 0.7, maxTokens: 1800 });
}

// Loads the live model list, moves off a model Groq no longer serves, then pings it.
export async function testKey(state) {
  const available = await listModels(state);
  if (!available.includes(state.settings.model)) state.settings.model = pickModel(available);
  await groq(state, [{ role: 'user', content: 'Reply with exactly: SYSTEM ONLINE' }], { temperature: 0, maxTokens: 200 });
  return state.settings.model;
}
