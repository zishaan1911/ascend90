// Static game content: pillars, default quests, penalties, ranks, achievements.

export const PILLARS = {
  looks:     { name: 'Looksmax',     tag: 'LKS',  color: '#ff5c7a' },
  engineer:  { name: 'Engineermax',  tag: 'ENG',  color: '#3ad1ff' },
  character: { name: 'Charactermax', tag: 'CHR',  color: '#ffb020' },
  appeal:    { name: 'Appealmax',    tag: 'APL',  color: '#c77dff' },
  mind:      { name: 'Mindmax',      tag: 'MND',  color: '#2ee59d' },
  intellect: { name: 'Intellectmax', tag: 'INT',  color: '#6f9bff' },
};

export const PILLAR_ORDER = ['looks', 'engineer', 'character', 'appeal', 'mind', 'intellect'];

export const DEFAULT_QUESTS = [
  { id: 'meditate',   pillar: 'mind', xp: 25, title: '10 min meditation' },
  { id: 'stoic',      pillar: 'mind', xp: 15, title: 'Stoic reflection: 1 passage + 1 takeaway' },
  { id: 'gratitude',  pillar: 'mind', xp: 10, title: 'Write 3 things you are grateful for' },
  { id: 'nocomplain', pillar: 'mind', xp: 20, title: 'Zero complaining, zero excuses today' },
  { id: 'detox',      pillar: 'mind', xp: 20, title: '1 hour fully phone-free' },
  { id: 'visualize',  pillar: 'mind', xp: 10, title: 'Review goals + visualize for 2 min' },

  { id: 'gym',      pillar: 'looks', xp: 40, title: 'Train: gym session or workout' },
  { id: 'protein',  pillar: 'looks', xp: 15, title: 'Hit protein target' },
  { id: 'water',    pillar: 'looks', xp: 10, title: 'Drink 3L of water' },
  { id: 'skin_am',  pillar: 'looks', xp: 10, title: 'AM skincare + grooming' },
  { id: 'skin_pm',  pillar: 'looks', xp: 10, title: 'PM skincare' },
  { id: 'sleep',    pillar: 'looks', xp: 20, title: '7+ hours of sleep' },

  { id: 'dsa',      pillar: 'engineer', xp: 30, title: 'Solve 2 LeetCode problems' },
  { id: 'ship',     pillar: 'engineer', xp: 40, title: '60 min deep work on side project + commit' },
  { id: 'learn',    pillar: 'engineer', xp: 25, title: '30 min CS fundamentals / new stack' },

  { id: 'wake',     pillar: 'character', xp: 20, title: 'Wake up on time, no snooze' },
  { id: 'clean',    pillar: 'character', xp: 25, title: 'Stay clean: no PMO' },
  { id: 'noscroll', pillar: 'character', xp: 20, title: 'Under 1h social media' },
  { id: 'cold',     pillar: 'character', xp: 15, title: 'Cold shower' },

  { id: 'fit',      pillar: 'appeal', xp: 10, title: 'Dressed sharp, posture checked' },
  { id: 'social',   pillar: 'appeal', xp: 25, title: '1 social rep: talk to someone new' },
  { id: 'presence', pillar: 'appeal', xp: 15, title: '10 min voice / eye contact practice' },

  { id: 'read',     pillar: 'intellect', xp: 25, title: 'Read 20 pages of a book' },
  { id: 'journal',  pillar: 'intellect', xp: 15, title: 'Journal: wins, losses, lessons' },
];

export const PENALTY_QUESTS = [
  '100 push-ups + 100 squats before bed',
  'Cold shower (3 min) + 45 min extra deep work',
  'No phone for the first 2 hours after waking',
  'Run or walk 5 km',
  '2 extra LeetCode problems + read 10 extra pages',
  '20 min meditation, then 50 burpees',
];

// Day completion below this % triggers the Penalty Zone.
export const PENALTY_THRESHOLD = 60;
// Day completion at or above this % keeps the streak alive.
export const STREAK_THRESHOLD = 70;
export const PENALTY_QUEST_FAIL_XP = 75;

export const RANKS = [
  { rank: 'E', minLevel: 1,  title: 'E-Rank Hunter' },
  { rank: 'D', minLevel: 5,  title: 'D-Rank Hunter' },
  { rank: 'C', minLevel: 12, title: 'C-Rank Hunter' },
  { rank: 'B', minLevel: 20, title: 'B-Rank Hunter' },
  { rank: 'A', minLevel: 28, title: 'A-Rank Hunter' },
  { rank: 'S', minLevel: 36, title: 'S-Rank Hunter' },
];

export const PHASES = [
  { from: 1,  to: 30, name: 'Phase I: Awakening', brief: 'Build the base. Never miss the non-negotiables.' },
  { from: 31, to: 60, name: 'Phase II: The Forge', brief: 'Raise the volume. Discipline becomes identity.' },
  { from: 61, to: 90, name: 'Phase III: Ascension', brief: 'Peak output. Become the person you planned.' },
];

export const GRADES = [
  { min: 95, grade: 'S' }, { min: 85, grade: 'A' }, { min: 70, grade: 'B' },
  { min: 55, grade: 'C' }, { min: 40, grade: 'D' }, { min: 0, grade: 'F' },
];

export const ACHIEVEMENTS = [
  { id: 'awakened',   name: 'Awakened',            desc: 'Clear your first day at 70%+' },
  { id: 'flawless',   name: 'Flawless',            desc: 'Finish a day at 100%' },
  { id: 'streak3',    name: 'Momentum',            desc: '3-day streak' },
  { id: 'streak7',    name: 'Week of Iron',        desc: '7-day streak' },
  { id: 'streak14',   name: 'Unbreakable',         desc: '14-day streak' },
  { id: 'streak30',   name: "Monarch's Discipline", desc: '30-day streak' },
  { id: 'dawn7',      name: 'Dawn Hunter',         desc: 'Wake on time 7 days straight' },
  { id: 'monk7',      name: 'Monk Mode',           desc: 'Meditate 7 days straight' },
  { id: 'gym20',      name: 'Iron Body',           desc: '20 training sessions' },
  { id: 'dsa30',      name: 'Algorithm Grinder',   desc: 'LeetCode quest done 30 times' },
  { id: 'ship30',     name: 'Shipper',             desc: 'Side project deep work 30 times' },
  { id: 'redemption', name: 'Redemption',          desc: 'Clear a Penalty Quest' },
  { id: 'rankC',      name: 'C-Rank',              desc: 'Reach C-Rank' },
  { id: 'rankA',      name: 'A-Rank',              desc: 'Reach A-Rank' },
  { id: 'day30',      name: 'Phase I Cleared',     desc: 'Survive day 30' },
  { id: 'day60',      name: 'Phase II Cleared',    desc: 'Survive day 60' },
  { id: 'day90',      name: 'Shadow Monarch',      desc: 'Finish all 90 days' },
];
