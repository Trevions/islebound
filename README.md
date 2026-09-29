# 🏝️ ISLEBOUND

**Fall. Rescue. Rebuild.** · **Падни. Спаси. Построй отново.**

A one-thumb **3D** mobile game for the browser. Slingshot into the Void, survive **30-minute dives** with auto-firing Songs, free caged Echoes, collect coins, chase a high score on the **Top 100**, and bring back pieces of land that you slot into your floating island, Tetris-style.

- **360 stages** in 12 realms (one per month) + **Nightfall** hard mode
- **12 Guardians** in 3 forms each
- **12 Songs**, **10 Charms**, **12 Resonances** (evolutions)
- **60 Echoes** to collect and house on your island
- **Island Well**: a calm Tetris where full rows become land
- **Daily World**: the same world for everyone, with an emoji share card
- **Endless Abyss**, 32 achievements, 36 lore stones, cosmetics
- 30-minute stages: 6 themed waves, Champions, Coin Rain, Coin Sprites, Guardians — with **Save & Quit**
- Full How-to-Play tutorial, per-stage briefings, first-encounter enemy tips
- Score system with combo multiplier, target scores, Top 100 with unique nicknames
- English, installable PWA, works offline, Three.js 3D (vendored in `lib/`)
- Zero image or audio files: every sprite and every note is generated in code

## Play locally

No build step. Any static server works:

```bash
npx http-server -c-1 -p 8080 .
# open http://localhost:8080
```

## Publish with GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
The game will be live at `https://trevions.github.io/islebound/`.

## Online Top 100 (Supabase, free tier)

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste `docs/supabase.sql`, run it once.
3. Copy **Project URL** and **anon public key** (Settings → API) into `src/config.js`.
4. Commit. Nicknames are unique (case-insensitive) and scores go through server functions with sanity checks.

Without keys the leaderboard shows only this device.

## Controls

| | Touch | Keyboard |
|---|---|---|
| Launch | drag back from Pip, release | mouse drag |
| Move | drag anywhere | WASD / arrows |
| Pick upgrade | tap a card | 1 · 2 · 3 · 4 |
| Pause | ❚❚ | Esc / P |
| Island Well | swipe ←→, tap = rotate, swipe up = drop | ←→ move, ↑ rotate, ↓ soft, Space drop |

## Project layout

```
index.html            app shell
css/style.css         all UI styling
src/main.js           app loop, scenes, rewards, achievements
src/core/             rng, input, audio (synth), drawing, save, i18n
src/data/             balance, realms, enemies, bosses, weapons, creatures, progression, lore, level generator
src/game/             run (a dive), weapons, enemy AI, boss AI, fx, island well, island view
src/ui/ui.js          every DOM screen
tools/balance.mjs     balance simulator → docs/BALANCE.md
docs/GDD.md           full game design document (BG)
```

© Trevions
