// Prayer times from the free Aladhan API, cached per day. Only city + country are sent.
import { PRAYERS } from './data.js';

export async function fetchPrayerTimes(state, key) {
  const { city, country } = state.profile;
  if (!city || !country) return null;
  if (state.prayerTimes[key]) return state.prayerTimes[key];
  const [y, m, d] = key.split('-');
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const t = (await res.json()).data?.timings;
    if (!t) return null;
    const times = Object.fromEntries(PRAYERS.map(p => [p, String(t[p]).slice(0, 5)]));
    // Keep only the last week of cached times.
    const keys = Object.keys(state.prayerTimes).sort();
    while (keys.length > 6) delete state.prayerTimes[keys.shift()];
    state.prayerTimes[key] = times;
    return times;
  } catch {
    return null;
  }
}
