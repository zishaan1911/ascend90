# ASCEND 90

A Solo Leveling style 90-day transformation app across six pillars: Looksmax, Engineermax, Charactermax, Appealmax, Mindmax and Intellectmax. A Groq-powered drill sergeant coach called "The System" plans your day and roasts you when you lag.

It's a plain static web app with no build step and no backend. All data stays in your browser's localStorage. Your Groq key is sent only to `api.groq.com`.

## Run locally

```
python -m http.server 5190 --directory ascend90
```

Then open http://localhost:5190.

## Put it on your phone

To install it as a home-screen app, it needs to be served over HTTPS. Two easy ways:

- **Netlify Drop:** drag the `ascend90` folder onto https://app.netlify.com/drop.
- **GitHub Pages:** push the folder to a repo and enable Pages.

Then open the URL on your phone. On Android Chrome, use "Add to Home screen" or "Install app". On iOS Safari, use Share, then "Add to Home Screen".

## Game rules

- Each quest gives XP to its pillar. Total XP sets your level, and your level sets your rank: E (LV 1), D (LV 5), C (LV 12), B (LV 20), A (LV 28), S (LV 36).
- Finish a day at 70% or more to keep your streak going.
- Finish under 60% and you hit the **Penalty Zone**. You lose XP, scaled by how badly you missed and split across the pillars you skipped, and you get a penalty quest for the next day. Skip the penalty quest and you lose another 75 XP.
- Every 7th day unlocks a Boss Review with the coach.
- Use Settings to edit the quests, export or import a backup, and switch the Groq model.

## Files

- `js/data.js`: pillars, default quests, penalties, ranks, achievements
- `js/game.js`: day rollover, XP, levels, streaks, penalties
- `js/ai.js`: Groq prompts (plan, judgment, lag roast, chat, blueprint)
- `js/views.js`: screen markup
- `js/main.js`: app wiring and actions
