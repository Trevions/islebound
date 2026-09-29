// All DOM screens: title, tutorial, nickname, hub tabs, briefing, HUD, level-up,
// pause, results, leaderboard, toasts.
import { Save } from '../core/save.js';
import { L } from '../core/i18n.js';
import { sfx, initAudio, playMusic, stopMusic } from '../core/audio.js';
import { REALMS } from '../data/realms.js';
import { getLevel, getDaily, getEndless, MUTATORS, WAVE_THEMES } from '../data/levels.js';
import { BOSSES } from '../data/bosses.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { WEAPONS, PASSIVES, STARTER_WEAPONS, WEAPON_MAX } from '../data/weapons.js';
import { CREATURES, RARITY, BONUS } from '../data/creatures.js';
import { BUILDINGS, BUILDING_ORDER, BUILDING_MAX, buildingCost, ACHIEVEMENTS, HATS, TRAILS, SCARVES } from '../data/progression.js';
import { LORE } from '../data/lore.js';
import * as B from '../data/balance.js';
import { creatureImage, heroImage } from '../core/draw.js';
import { fmtNum, fmtTime, todayKey } from '../core/util.js';
import { metaBonuses, slotCount } from '../game/meta.js';
import { Well, drawPiece } from '../game/well.js';
import { drawIsland } from '../game/islandView.js';
import { Leaderboard, nickError } from '../core/leaderboard.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starStr = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);

// ── How to Play (shown on first launch, reopen any time from More) ──
const TUTORIAL = [
  { art: 'hero', title: 'Welcome to Islebound', body: [
    'The world broke apart into floating islands above an endless Void.',
    'You are <b>Pip</b>, the first Echo. Every day you dive into the Void to fight its creatures, rescue other Echoes and bring back pieces of land.',
    'Your goal: <b>rebuild your island</b> and reach the Hollow Heart at the bottom of the world — 12 realms, 360 stages.',
  ] },
  { art: '➶', title: '1 · Launch with the slingshot', body: [
    'Every dive starts on a small island with a slingshot.',
    '<b>Drag BACK from Pip and release.</b> The dotted line shows where you will land; the ring shows the impact size. Pull further for a bigger crash.',
    'A group of Void creatures is <b>sleeping</b> nearby (dashed circle). Land on them to wipe them out for bonus points.',
  ] },
  { art: '✦', title: '2 · Move — your Songs fight for you', body: [
    '<b>Phone:</b> put your thumb anywhere and drag. <b>Keyboard:</b> WASD or arrow keys.',
    'You never press an attack button. Your weapons, called <b>Songs</b>, fire on their own.',
    'Defeated enemies drop <b>green crystals</b> (experience) and sometimes <b>gold coins</b>. Walk near them to collect.',
  ] },
  { art: '⬆', title: '3 · Level up and build your power', body: [
    'Enough crystals = <b>level up</b>. The game pauses and you pick 1 of 3 cards:',
    '<b>Songs</b> — new weapons or stronger versions (up to 6 Songs, each max level 6).<br><b>Charms</b> — passive boosts like Might, Haste or Magnet (up to 6).',
    '<b>Resonance:</b> a Song at level 6 + its paired Charm evolves into a super-weapon. Each card tells you which Charm it pairs with.',
  ] },
  { art: '⏱', title: '4 · A dive lasts 30 minutes', body: [
    'Each stage is <b>6 waves of 5 minutes</b>. Every wave has a theme (The Swarm, Heavy Stone, Crossfire…) and gets harder.',
    '<b>Champions</b> (mini-bosses) arrive at 5, 10, 15 and 20 minutes and drop golden chests. On stages 10, 20 and 30 the realm\'s <b>Guardian</b> arrives at 25:00 — defeat it to clear.',
    'Events: <b>Coin Rain</b>, a fleeing <b>Coin Sprite</b>, <b>Echo cages</b> and <b>Memory Stones</b>. Arrows at the screen edge point to them.',
    'Busy? Tap <b>❚❚ → Save &amp; Quit</b>. The dive is saved and you continue later from the same minute.',
  ] },
  { art: '★', title: '5 · Points and stars', body: [
    '<b>Points:</b> every enemy (10–8,000), every coin (5), each rescued Echo (1,000), each Memory Stone (500), 5 per second survived, 2,000 for each wave without getting hit, and a clear bonus.',
    '<b>Combo:</b> keep defeating enemies within 2.5 seconds of each other. Every 25 kills adds ×0.1 to your points, up to ×5. <b>Getting hit resets the combo.</b>',
    'Later stages multiply all points. <b>Stars:</b> ★ survive / beat the Guardian · ★ reach the target score · ★ free all 3 caged Echoes.',
  ] },
  { art: '🏝', title: '6 · Coins, Echoes and your island', body: [
    'Coins you pick up are always yours, even if you lose. Clearing adds a bonus.',
    'You also earn <b>island pieces</b>. Drop them into the <b>Island Well</b> like Tetris: every full row becomes new land. Land unlocks <b>buildings</b> that make you permanently stronger.',
    'Rescued <b>Echoes</b> live in your Nest. Each one gives a bonus to every future dive. There are 60 to collect.',
  ] },
  { art: '🏆', title: '7 · Daily World & Top 100', body: [
    'The <b>Daily World</b> is the same stage for every player today. Share your result and keep your streak going.',
    'The <b>Endless Abyss</b> unlocks after realm 3: no timer, how long can you last?',
    'Pick a unique <b>nickname</b> and climb the <b>Top 100</b>. Your all-time score is the sum of your best score on every stage.',
  ] },
];

export class UI {
  constructor(app) {
    this.app = app;
    this.root = $('#screens');
    this.tab = 'adventure';
    this.realmSel = 0;
    this.nightSel = false;
    this.board = 'total';
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      initAudio();
      this.act(el.dataset.act, el.dataset, el, e);
    });
  }
  get S() { return Save.state; }

  // ── title / onboarding ───────────────────────────
  title() {
    this.app.mode = 'title';
    this.root.innerHTML = `
      <section class="title-screen" data-act="start">
        <div class="logo" aria-label="Islebound"><span>ISLE</span><span>BOUND</span></div>
        <p class="tagline">Fall. Rescue. Rebuild.</p>
        <img class="title-hero" src="${heroImage(160, { hat: this.S.cosmetics.hat, scarf: this.app.scarfColor() })}" alt="Pip">
        <p class="tap">Tap to begin</p>
        <div class="title-foot"><span class="ver">360 stages · 12 Guardians · 60 Echoes · 3D</span></div>
      </section>`;
  }
  tutorial(page = 0, then = 'hub') {
    this.app.mode = 'tutorial';
    this.tutPage = page; this.tutThen = then;
    const p = TUTORIAL[page];
    const art = p.art === 'hero' ? `<img src="${heroImage(140, { hat: this.S.cosmetics.hat, scarf: this.app.scarfColor() })}" alt="">` : `<span>${p.art}</span>`;
    this.root.innerHTML = `
      <section class="tutorial">
        <p class="eyebrow">How to play · ${page + 1} / ${TUTORIAL.length}</p>
        <div class="tut-art">${art}</div>
        <h1>${p.title}</h1>
        <div class="tut-body">${p.body.map((x) => `<p>${x}</p>`).join('')}</div>
        <div class="dots">${TUTORIAL.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</div>
        <div class="row">
          ${page > 0 ? '<button class="btn" data-act="tut-prev">Back</button>' : '<button class="btn ghost" data-act="tut-skip">Skip</button>'}
          <button class="btn primary big" data-act="tut-next">${page === TUTORIAL.length - 1 ? "Let's go!" : 'Next'}</button>
        </div>
      </section>`;
  }
  nickScreen(then = 'hub') {
    this.app.mode = 'nick';
    this.nickThen = then;
    this.root.innerHTML = `
      <section class="tutorial nick">
        <p class="eyebrow">Your name on the Top 100</p>
        <h1>Choose a nickname</h1>
        <p class="sub">3–16 characters: letters, numbers or _. It must be unique — nobody else can take it.</p>
        <form id="nick-form" class="nick-form" autocomplete="off">
          <input id="nick-input" maxlength="16" value="${esc(this.S.nick || '')}" placeholder="e.g. SkyPip_42" spellcheck="false" autocapitalize="off">
          <p class="nick-msg" id="nick-msg" aria-live="polite"></p>
          <button class="btn primary big" type="submit">Claim nickname</button>
        </form>
        <p class="hint">Leaderboard: ${esc(Leaderboard.label())}</p>
        ${then === 'more' ? '<button class="btn ghost" data-act="tab" data-tab="more">Cancel</button>' : '<button class="btn ghost" data-act="nick-later">Later</button>'}
      </section>`;
    const inp = $('#nick-input'), msg = $('#nick-msg');
    let tm;
    inp.addEventListener('input', () => {
      clearTimeout(tm);
      const v = inp.value.trim(), e = nickError(v);
      msg.className = 'nick-msg'; msg.textContent = e;
      if (!e) tm = setTimeout(async () => { const ok = await Leaderboard.available(v); if (inp.value.trim() === v) { msg.textContent = ok ? '✓ Available' : '✕ Already taken'; msg.className = `nick-msg ${ok ? 'good' : 'bad'}`; } }, 350);
    });
    $('#nick-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      msg.textContent = 'Checking…'; msg.className = 'nick-msg';
      const r = await Leaderboard.claim(v);
      if (!r.ok) { msg.textContent = r.error; msg.className = 'nick-msg bad'; sfx('hurt'); return; }
      sfx('levelup'); this.app.toast(`Welcome, ${v}!`);
      this.hub(this.nickThen === 'more' ? 'ranks' : 'adventure');
    });
    setTimeout(() => inp.focus(), 50);
  }

  // ── hub ────────────────────────────────────────
  hub(tab = this.tab) {
    this.app.mode = 'hub';
    this.tab = tab;
    const S = this.S;
    const tabs = [['adventure', '🗺️', 'Adventure'], ['daily', '📅', 'Daily'], ['island', '🏝️', 'Island'], ['echodex', '🐾', 'Echoes'], ['ranks', '🏆', 'Top 100'], ['more', '⚙️', 'More']];
    const pieces = S.island.queue.length;
    this.root.innerHTML = `
      <div class="hub">
        <header class="topbar">
          <div class="res" title="Coins"><b class="coin">◉</b> <span id="coins">${fmtNum(S.coins)}</span></div>
          <div class="res" title="Gems (cosmetics only)"><b class="gem">◆</b> ${fmtNum(S.gems)}</div>
          <div class="res" title="Stars"><b>★</b> ${S.totalStars}</div>
          <div class="res" title="Island lands"><b>🏝️</b> ${S.island.lands}</div>
          ${S.nick ? `<div class="res nickchip" title="Your nickname">@${esc(S.nick)}</div>` : ''}
        </header>
        <main class="tabbody" id="tabbody"></main>
        <nav class="tabbar">
          ${tabs.map(([k, ic, lb]) => `<button class="tabbtn ${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${ic}</span><small>${lb}</small>${k === 'island' && pieces ? `<i class="badge">${pieces}</i>` : ''}${k === 'daily' && S.daily.lastKey !== todayKey() ? '<i class="badge dot"></i>' : ''}</button>`).join('')}
        </nav>
      </div>`;
    const body = $('#tabbody');
    this[`tab_${tab}`](body);
    body.scrollTop = this.scrollMem?.[tab] || 0;
    body.addEventListener('scroll', () => { this.scrollMem = this.scrollMem || {}; this.scrollMem[tab] = body.scrollTop; });
  }
  resumeCard() {
    const a = this.S.activeRun;
    if (!a) return '';
    const lvName = a.level.kind === 'campaign' ? `${L(REALMS[a.level.realm].name)} ${a.level.realm + 1}-${a.level.stage}` : a.level.kind === 'daily' ? 'Daily World' : 'Dive';
    return `<section class="resume-card"><div><p class="eyebrow">Unfinished dive</p><h3>${esc(lvName)}</h3><p class="sub">Saved at ${fmtTime(a.time)} of 30:00 · ${fmtNum(a.score)} points · level ${a.plevel}</p></div>
      <div class="row"><button class="btn small ghost" data-act="discard-run">Discard</button><button class="btn primary" data-act="resume-run">Continue ➶</button></div></section>`;
  }

  // ── Adventure ──────────────────────────────────
  realmOpen(r) { if (r === 0) return true; return !!this.S.progress[`${r - 1}-30`] && this.S.totalStars >= B.realmStarGate(r); }
  stageOpen(r, s, night) {
    const P = night ? this.S.night : this.S.progress;
    if (night) return !!this.S.progress[`${r}-30`] && (s === 1 || !!P[`${r}-${s - 1}`]);
    if (!this.realmOpen(r)) return false;
    return s === 1 || !!P[`${r}-${s - 1}`];
  }
  tab_adventure(el) {
    const S = this.S, r = this.realmSel, R = REALMS[r];
    const P = this.nightSel ? S.night : S.progress;
    let rs = 0; for (let s = 1; s <= 30; s++) rs += P[`${r}-${s}`]?.stars || 0;
    const open = this.realmOpen(r);
    const nightOk = !!S.progress[`${r}-30`];
    const boss = BOSSES[R.boss];
    let nodes = '';
    for (let s = 1; s <= 30; s++) {
      const row = Math.floor((s - 1) / 5), col = (s - 1) % 5;
      const c = row % 2 ? 4 - col : col;
      const rec = P[`${r}-${s}`];
      const can = this.stageOpen(r, s, this.nightSel);
      const isBoss = B.BOSS_STAGES.includes(s);
      nodes += `<button class="node ${isBoss ? 'boss' : ''} ${rec ? 'done' : ''} ${can && !rec ? 'next' : ''}" style="grid-row:${row + 1};grid-column:${c + 1}" ${can ? `data-act="prep" data-s="${s}"` : 'disabled'} aria-label="Stage ${s}">
        <span class="n">${isBoss ? '☠' : s}</span><span class="st">${rec ? starStr(rec.stars) : can ? '' : '🔒'}</span></button>`;
    }
    el.innerHTML = `
      ${this.resumeCard()}
      <div class="realm-strip" role="tablist">${REALMS.map((R2, i) => `<button class="realm-chip ${i === r ? 'on' : ''} ${this.realmOpen(i) ? '' : 'locked'}" style="--c:${R2.ground}" data-act="realm" data-r="${i}"><b>${R2.month}</b><small>${this.realmOpen(i) ? '' : '🔒'}</small></button>`).join('')}</div>
      <section class="realm-card" style="--g1:${R.sky[0]};--g2:${R.sky[1]};--acc:${R.accent};--gr:${R.ground}">
        <div class="realm-head">
          <div><p class="eyebrow">Realm ${r + 1} of 12 · ${R.month}</p><h2>${L(R.name)}</h2><p class="realm-tag">${L(R.tag)}</p></div>
          <div class="realm-stars"><b>${rs}</b><small>/ 90 ★</small></div>
        </div>
        <div class="realm-meta">
          <span>☠ Guardian: <b>${L(boss.name)}</b> (stages 10 · 20 · 30)</span>
          ${nightOk ? `<button class="chip ${this.nightSel ? 'on' : ''}" data-act="night" title="Hard mode: tougher enemies, +50% coins and points">🌙 Nightfall</button>` : ''}
        </div>
        ${open ? `<div class="path">${nodes}</div><p class="hint">Tap a stage to see its briefing. Every stage is a 30-minute dive.</p>` : `<div class="locked-realm">🔒 Clear stage 30 of the previous realm and hold ${B.realmStarGate(r)} ★ in total to enter.</div>`}
      </section>`;
  }
  prep(s) { this.openLevel(getLevel(this.realmSel, s), { night: this.nightSel }); }
  openLevel(lv, opts = {}) {
    const S = this.S;
    const R = REALMS[lv.realm];
    const avail = Object.keys(WEAPONS).filter((id) => STARTER_WEAPONS.includes(id) || S.weaponsUsed[id]);
    const sel = avail.includes(S.lastWeapon) ? S.lastWeapon : 'spark';
    const rec = lv.kind === 'campaign' ? (opts.night ? S.night : S.progress)[`${lv.realm}-${lv.stage}`] : null;
    const boss = lv.boss ? BOSSES[lv.boss.id] : null;
    const brief = S.showBriefing !== false;
    this.pending = { lv, opts, weapon: sel };
    // enemies you have not met yet
    const allowed = new Set([...lv.pool, ...ENEMY_ORDER.slice(0, 3 + Math.floor(lv.g / 8))]);
    const mixes = new Set(lv.waves.flatMap((w) => (WAVE_THEMES[w].mix || []).filter((t) => allowed.has(t))));
    const roster = [...new Set([...lv.pool, ...mixes])];
    const fresh = roster.filter((t) => !(S.seenEnemies || {})[t]);
    const target = lv.target ? Math.round(lv.target * (opts.night ? 1.5 : 1)) : 0;
    const objectives = lv.kind === 'endless'
      ? [['∞', 'Survive as long as you can. No timer, no mercy.'], ['◉', 'Coins and points count even when you fall.']]
      : [
        [rec && rec.stars >= 1 ? '✓' : '★', boss ? `Defeat ${L(boss.name)} (arrives at 25:00)` : 'Survive all 30:00'],
        [rec && rec.stars >= 2 ? '✓' : '★', `Score at least ${fmtNum(target)} points`],
        [rec && rec.stars >= 3 ? '✓' : '★', `Free all ${lv.cages} caged Echoes (they call at 4:00, 13:00 and 22:00)`],
      ];
    this.modal(`
      <div class="sheet prep" style="--acc:${R.accent};--gr:${R.ground}">
        <p class="eyebrow">${lv.kind === 'campaign' ? `${L(R.name)} · Stage ${lv.realm + 1}-${lv.stage}${opts.night ? ' · 🌙 Nightfall' : ''}` : lv.kind === 'daily' ? 'Daily World · same for everyone today' : 'Endless Abyss'}</p>
        <h2>${esc(L(lv.name))}</h2>
        <div class="facts"><span>⏱ ${isFinite(lv.duration) ? '30:00' : '∞'}</span>${lv.cages ? `<span>🐾 ${lv.cages} Echoes</span>` : ''}${rec ? `<span>${starStr(rec.stars)} · best ${fmtNum(rec.score || 0)}</span>` : ''}<span>Difficulty ${lv.g}</span></div>
        ${lv.kind !== 'endless' ? `<p class="label">Objectives</p><ul class="objectives">${objectives.map(([i, t]) => `<li><b>${i}</b>${esc(t)}</li>`).join('')}</ul>` : `<ul class="objectives">${objectives.map(([i, t]) => `<li><b>${i}</b>${esc(t)}</li>`).join('')}</ul>`}
        ${brief && lv.kind !== 'endless' ? `<p class="label">Wave plan</p><ol class="waves">${lv.waves.map((w, i) => `<li><b>${fmtTime(i * 300)}</b><span>${WAVE_THEMES[w].name}</span><small>${WAVE_THEMES[w].desc}</small></li>`).join('')}</ol>
          <p class="hint">⚔ Champions at 5:00, 10:00, 15:00, 20:00 · 💰 Coin Rain at 7:00, 17:00, 27:00 · 💰 Coin Sprites at 3, 11, 19, 26 min</p>` : ''}
        ${boss ? `<div class="boss-callout">☠ ${L(lv.boss.form.title)} <b>${L(boss.name)}</b> — ${lv.boss.form.phases} attack phase${lv.boss.form.phases > 1 ? 's' : ''}. Red shapes on the ground show where it will strike: step out of them.</div>` : ''}
        ${lv.mutators.length ? `<p class="label">Conditions</p><div class="muts">${lv.mutators.map((m) => `<div class="mut"><b>${MUTATORS[m].icon} ${L(MUTATORS[m].name)}</b><small>${L(MUTATORS[m].desc)}</small></div>`).join('')}</div>` : ''}
        ${brief && fresh.length ? `<p class="label">New enemies</p><div class="muts">${fresh.map((t) => `<div class="mut"><b>${L(ENEMIES[t].name)}</b><small>${esc(ENEMIES[t].tip)}</small></div>`).join('')}</div>` : ''}
        <p class="label">Starting Song</p>
        <div class="songs">${avail.map((id) => `<button class="song ${id === sel ? 'on' : ''}" data-act="song" data-id="${id}" style="--c:${WEAPONS[id].color}"><i>${WEAPONS[id].icon}</i><b>${L(WEAPONS[id].name)}</b><small>${L(WEAPONS[id].desc)}</small></button>`).join('')}</div>
        <p class="hint">You can Save &amp; Quit from the pause menu at any time and continue later.</p>
        <div class="row">
          <button class="btn ghost" data-act="close">Close</button>
          <button class="btn primary big" data-act="launch">Launch ➶</button>
        </div>
      </div>`);
  }

  // ── Daily / Endless ────────────────────────────
  tab_daily(el) {
    const S = this.S;
    const d = getDaily();
    const R = REALMS[d.realm];
    const key = todayKey();
    const res = S.daily.results[key];
    const endlessOpen = !!S.progress[`${B.ENDLESS_UNLOCK_REALM}-30`];
    el.innerHTML = `
      ${this.resumeCard()}
      <section class="daily-card" style="--g1:${R.sky[0]};--g2:${R.sky[1]};--acc:${R.accent}">
        <p class="eyebrow">Daily World · #${this.dayNo()}</p>
        <h2>${L(R.name)}</h2>
        <p class="sub">Every player on Earth gets this exact world today. One try per day counts for your streak and the Daily Top 100.</p>
        <div class="muts">${d.mutators.map((m) => `<div class="mut"><b>${MUTATORS[m].icon} ${L(MUTATORS[m].name)}</b><small>${L(MUTATORS[m].desc)}</small></div>`).join('')}</div>
        <div class="streak"><div><b>${S.daily.streak}</b><small>Day streak</small></div><div><b>${S.daily.bestStreak}</b><small>Best streak</small></div><div><b>${S.daily.played}</b><small>Played</small></div></div>
        ${res ? `<div class="daily-res"><p><b>Today: ${fmtNum(res.score || 0)} points.</b> Come back tomorrow for a new world.</p><pre id="share-text">${esc(res.share)}</pre><button class="btn primary" data-act="share">Copy result ⧉</button></div>`
               : `<button class="btn primary big" data-act="daily">Play today's world ➶</button>`}
      </section>
      <section class="endless-card ${endlessOpen ? '' : 'locked'}">
        <p class="eyebrow">Endless Abyss</p>
        <p class="sub">${endlessOpen ? 'No timer. The Void keeps getting stronger. How long can you last?' : '🔒 Clear stage 30 of realm 3 (Ember Wastes) to unlock.'}</p>
        <div class="streak"><div><b>${fmtTime(S.endless.best)}</b><small>Longest fall</small></div><div><b>${S.endless.runs}</b><small>Dives</small></div><div><b>${fmtNum(S.endless.bestScore || 0)}</b><small>Best score</small></div></div>
        ${endlessOpen ? `<button class="btn big" data-act="endless">Enter the Abyss ∞</button>` : ''}
      </section>`;
  }
  dayNo() { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }

  // ── Island ─────────────────────────────────────
  tab_island(el) {
    const S = this.S;
    const mb = metaBonuses(S);
    const slots = slotCount(S.island.lands);
    const garden = this.gardenValue();
    el.innerHTML = `
      <section class="island-view"><canvas id="islecv" aria-label="Your island"></canvas>
        <div class="isle-stats"><span><b>${S.island.lands}</b> lands</span><span>⚔ +${Math.round(mb.dmg * 100)}%</span><span>♥ +${Math.round(mb.hp)}</span></div>
        ${garden > 0 ? `<button class="btn small garden" data-act="garden">🌷 Collect +${garden} ◉</button>` : ''}
      </section>
      <section class="well-card">
        <div class="well-head"><div><h3>Island Well</h3><p class="sub">Drop the pieces you earned. Each full row becomes a new land (+coins). 4 rows at once = big bonus.</p></div><canvas id="queuecv" width="140" height="56" aria-label="next pieces"></canvas></div>
        <div class="well-wrap"><canvas id="wellcv"></canvas>
          <div class="well-empty" ${S.island.queue.length ? 'hidden' : ''}>No pieces left. Every star, Champion and Guardian in a dive gives you more.</div>
        </div>
        <div class="well-ctrl">
          <button class="kbtn" data-act="w-left" aria-label="Move left">◀</button>
          <button class="kbtn" data-act="w-rot" aria-label="Rotate">⟳</button>
          <button class="kbtn" data-act="w-soft" aria-label="Move down">▼</button>
          <button class="kbtn" data-act="w-right" aria-label="Move right">▶</button>
          <button class="kbtn drop" data-act="w-drop">Drop ⤓</button>
        </div>
        <p class="hint">Swipe on the well: ←→ move, tap to rotate, swipe up to drop. Keyboard: arrows + Space.</p>
      </section>
      <section class="build-list">
        <h3>Buildings <small>${slots}/${BUILDING_ORDER.length} plots unlocked</small></h3>
        <p class="sub">Buildings are permanent upgrades. More lands unlock more plots.</p>
        ${BUILDING_ORDER.map((id, i) => {
          const d = BUILDINGS[id], lvl = S.island.buildings[id] || 0;
          const unlocked = i < slots;
          const cost = buildingCost(id, lvl);
          return `<div class="bld ${unlocked ? '' : 'locked'}">
            <div class="bld-ico">${unlocked ? d.icon : '🔒'}</div>
            <div class="bld-txt"><b>${L(d.name)} <small>Lv ${lvl}/${BUILDING_MAX}</small></b><small>${unlocked ? L(d.desc) : `Unlocks at ${B.BUILDING_SLOT_LANDS[i]} lands`}</small><small class="eff">${unlocked ? d.fmt(lvl) + (lvl < BUILDING_MAX ? ` → ${d.fmt(lvl + 1)}` : '') : ''}</small></div>
            ${unlocked ? (lvl >= BUILDING_MAX ? '<span class="maxed">MAX</span>' : `<button class="btn small ${S.coins >= cost ? 'primary' : ''}" data-act="build" data-id="${id}" ${S.coins >= cost ? '' : 'disabled'}>◉ ${fmtNum(cost)}</button>`) : ''}
          </div>`;
        }).join('')}
      </section>`;
    this.well = new Well((res) => {
      if (res.settled) this.app.toast(`🏝️ The well settled: +${res.lands} lands`);
      else if (res.lines) this.app.toast(`${['', 'Line!', 'Double!', 'Triple!', '🌟 ISLEBOUND! 🌟'][Math.min(4, res.lines)]} +${res.lines} land · +${res.coins} ◉`);
      this.app.checkAchievements();
      this.refreshTop();
      const empty = $('.well-empty'); if (empty) empty.hidden = !!this.S.island.queue.length;
    });
    this.islandCanvases();
  }
  islandCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = (cv, h) => { const w = cv.clientWidth; cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, w, h }; };
    const ic = $('#islecv'), wc = $('#wellcv'), qc = $('#queuecv');
    if (!ic) return;
    const A = size(ic, 210);
    const wellW = Math.min(wc.parentElement.clientWidth, 250);
    wc.style.width = wellW + 'px';
    const Wd = size(wc, Math.round(wellW * 1.5));
    const q = qc.getContext('2d');
    const loop = (ts) => {
      if (!document.body.contains(ic)) return;
      const tt = ts / 1000;
      drawIsland(A.c, A.w, A.h, tt, this.S, { scarf: this.app.scarfColor() });
      this.well.draw(Wd.c, Wd.w, Wd.h, tt);
      q.clearRect(0, 0, 140, 56);
      this.S.island.queue.slice(1, 4).forEach((p, i) => drawPiece(q, p, 26 + i * 44, 28, 9));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    let sx = 0, sy = 0, moved = false;
    wc.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; initAudio(); });
    wc.addEventListener('pointermove', (e) => {
      if (!e.buttons && e.pointerType === 'mouse') return;
      const dx = e.clientX - sx, cell = this.well.layout?.s || 30;
      if (Math.abs(dx) > cell * 0.8) { this.well.move(Math.sign(dx)); sx = e.clientX; moved = true; }
      if (e.clientY - sy > cell * 1.2) { this.well.soft(); sy = e.clientY; moved = true; }
    });
    wc.addEventListener('pointerup', (e) => { if (!moved) { if (e.clientY - sy < -30) this.well.drop(); else this.well.rotate(); } });
  }
  gardenValue() {
    const g = metaBonuses(this.S).garden || 0;
    if (!g) return 0;
    const hrs = Math.min(12, (Date.now() - (this.S.island.gardenAt || Date.now())) / 3600000);
    return Math.floor(g * hrs);
  }

  // ── Echodex ────────────────────────────────────
  tab_echodex(el) {
    const S = this.S;
    const mb = metaBonuses(S);
    const found = Object.keys(S.dex).length;
    el.innerHTML = `
      <section class="dex-head"><div><h3>Echodex</h3><p class="sub">${found}/60 discovered · ${Math.min(S.housed.length, mb.nestCap)}/${mb.nestCap} living in your Nest. Every Echo in the Nest gives its bonus in every dive. Tap one to move it in or out; upgrade the Echo Nest for more room.</p></div></section>
      ${REALMS.map((R, ri) => `
        <section class="dex-realm"><p class="eyebrow" style="color:${R.accent}">${R.month} · ${L(R.name)}</p>
          <div class="dex-grid">${CREATURES.filter((c) => c.realm === ri).map((c) => {
            const has = S.dex[c.id];
            const housed = S.housed.includes(c.id);
            return `<button class="dex ${has ? '' : 'unknown'} ${housed ? 'housed' : ''}" style="--r:${RARITY[c.rarity].color}" ${has ? `data-act="echo" data-id="${c.id}"` : 'disabled'}>
              <img src="${creatureImage(c.look, 72, !has)}" alt="${has ? esc(c.name) : 'Undiscovered'}">
              <b>${has ? esc(c.name) : '???'}</b>
              <small>${has ? BONUS[c.bonus].fmt(c.value) : L(RARITY[c.rarity].label)}</small>
              ${housed ? '<i class="home">🪺</i>' : ''}${has > 1 ? `<i class="cnt">×${has}</i>` : ''}
            </button>`;
          }).join('')}</div>
        </section>`).join('')}`;
  }
  echoDetail(id) {
    const c = CREATURES[id], S = this.S;
    const housed = S.housed.includes(id);
    const cap = metaBonuses(S).nestCap;
    this.modal(`<div class="sheet echo" style="--r:${RARITY[c.rarity].color}">
      <img class="echo-big" src="${creatureImage(c.look, 180)}" alt="${esc(c.name)}">
      <p class="eyebrow" style="color:${RARITY[c.rarity].color}">${L(RARITY[c.rarity].label)} · ${L(REALMS[c.realm].name)}</p>
      <h2>${esc(c.name)}</h2>
      <p class="bonus">${BONUS[c.bonus].fmt(c.value)}</p>
      <p class="sub">Rescued ×${S.dex[id]}. ${housed ? 'Living in your Nest — its bonus is active.' : 'Move it into your Nest to activate its bonus.'}</p>
      <div class="row"><button class="btn ghost" data-act="close">Close</button>
      ${housed ? `<button class="btn" data-act="unhouse" data-id="${id}">Move out</button>` : `<button class="btn primary" data-act="house" data-id="${id}" ${S.housed.length >= cap ? 'disabled' : ''}>🪺 ${S.housed.length >= cap ? 'Nest is full' : 'Move into Nest'}</button>`}</div>
    </div>`);
  }

  // ── Top 100 ────────────────────────────────────
  tab_ranks(el) {
    const S = this.S;
    el.innerHTML = `
      <section class="panel ranks">
        <div class="rank-head"><div><h3>Top 100</h3><p class="sub" id="lb-mode">Connecting…</p></div>
          ${S.nick ? `<button class="chip" data-act="nick">@${esc(S.nick)} ✎</button>` : '<button class="btn small primary" data-act="nick">Choose nickname</button>'}</div>
        <div class="seg"><button class="${this.board === 'total' ? 'on' : ''}" data-act="board" data-b="total">All-time score</button><button class="${this.board === 'daily' ? 'on' : ''}" data-act="board" data-b="daily">Today's Daily</button></div>
        <p class="hint">${this.board === 'total' ? 'All-time score = your best score on every stage, added together. Replay stages to raise it.' : "Today's Daily World score. Everyone plays the same world."}</p>
        <ol class="lb" id="lb-list"><li class="lb-empty">Loading…</li></ol>
      </section>`;
    Leaderboard.top(this.board, todayKey()).then((res) => {
      const list = $('#lb-list'); if (!list) return;
      const m = $('#lb-mode'); if (m) m.textContent = `Leaderboard: ${Leaderboard.label()}`;
      if (res.error) { list.innerHTML = `<li class="lb-empty">Could not load the leaderboard: ${esc(res.error)}</li>`; return; }
      if (!res.rows.length) { list.innerHTML = `<li class="lb-empty">${S.nick ? 'No scores yet. Finish a dive to get on the board!' : 'Choose a nickname and finish a dive to appear here.'}</li>`; return; }
      list.innerHTML = res.rows.map((r) => `<li class="${r.you ? 'you' : ''} ${r.rank <= 3 ? 'top' : ''}"><span class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span><span class="nm">${esc(r.nick)}${r.you ? ' <em>you</em>' : ''}</span><span class="meta">${r.cleared ?? 0} stages · ${r.stars ?? 0}★</span><span class="sc">${fmtNum(r.score)}</span></li>`).join('');
    });
  }

  // ── More ───────────────────────────────────────
  tab_more(el) {
    const S = this.S;
    const st = S.stats;
    el.innerHTML = `
      <section class="panel"><h3>Help</h3><p class="sub">Everything about controls, waves, points, stars and your island.</p>
        <div class="row wrap"><button class="btn primary" data-act="howto">📖 How to play</button><button class="btn" data-act="points">★ Points & stars table</button></div></section>
      <section class="panel"><h3>Wardrobe</h3><p class="sub">Cosmetics only — they never change your power. Buy them with ◆ gems from achievements.</p>
        <div class="wardrobe"><img src="${heroImage(120, { hat: S.cosmetics.hat, scarf: this.app.scarfColor() })}" alt="Pip">
          <div class="scarves">${SCARVES.map((c, i) => `<button class="sw ${S.cosmetics.scarf === i ? 'on' : ''}" style="background:${c}" data-act="scarf" data-i="${i}" aria-label="Scarf colour ${i + 1}"></button>`).join('')}</div>
        </div>
        <p class="label">Hats</p><div class="cos">${HATS.map((h) => this.cosBtn('hat', h, S.cosmetics.hats)).join('')}</div>
        <p class="label">Trails</p><div class="cos">${TRAILS.map((h) => this.cosBtn('trail', h, S.cosmetics.trails)).join('')}</div>
      </section>
      <section class="panel"><h3>Achievements <small>${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</small></h3>
        <div class="ach">${ACHIEVEMENTS.map((a) => `<div class="ach-i ${S.achievements[a.id] ? 'got' : ''}"><b>${S.achievements[a.id] ? '🏆' : '○'} ${L(a.name)}</b><small>${L(a.desc)}</small><i>◆ ${a.gems}</i></div>`).join('')}</div>
      </section>
      <section class="panel"><h3>Memory Stones <small>${Object.keys(S.lore).length}/36</small></h3>
        <p class="sub">Glowing stones appear during dives. Each tells a piece of the story.</p>
        <div class="lore">${LORE.map((l, i) => S.lore[i] ? `<blockquote><small>${REALMS[Math.floor(i / 3)].month}</small>${esc(L(l))}</blockquote>` : `<blockquote class="missing"><small>${REALMS[Math.floor(i / 3)].month}</small>Not found yet · look for it in ${L(REALMS[Math.floor(i / 3)].name)}</blockquote>`).join('')}</div>
      </section>
      <section class="panel"><h3>Stats</h3>
        <div class="stats">
          <div><b>${fmtNum(st.dives)}</b><small>Dives</small></div><div><b>${fmtNum(st.kills)}</b><small>Enemies defeated</small></div>
          <div><b>${S.cleared}/360</b><small>Stages cleared</small></div><div><b>${st.bosses}</b><small>Guardians</small></div>
          <div><b>${st.lines}</b><small>Well lines</small></div><div><b>${Math.floor(st.seconds / 3600)}h ${Math.floor(st.seconds / 60) % 60}m</b><small>Time in the Void</small></div>
        </div>
      </section>
      <section class="panel"><h3>Settings</h3>
        <div class="settings">
          <label><input type="checkbox" id="set-music" data-act="set-music" ${S.sound.music ? 'checked' : ''}> Music</label>
          <label><input type="checkbox" id="set-sfx" data-act="set-sfx" ${S.sound.sfx ? 'checked' : ''}> Sound effects</label>
          <label><input type="checkbox" id="set-brief" data-act="set-brief" ${S.showBriefing !== false ? 'checked' : ''}> Show stage briefings</label>
          <label><input type="checkbox" id="set-tips" data-act="set-tips" ${S.showTips !== false ? 'checked' : ''}> Show enemy tips</label>
        </div>
        <p class="label">Save</p>
        <p class="sub">Your progress is saved on this device. Copy the save code to move it to another device.</p>
        <div class="row wrap">
          <button class="btn small" data-act="export">Copy save code</button>
          <button class="btn small" data-act="import">Load save code</button>
          <button class="btn small danger" data-act="reset">Erase progress</button>
        </div>
        <textarea id="save-code" rows="3" placeholder="Paste a save code here, then press Load save code again" hidden></textarea>
        <div id="reset-confirm" hidden><p>This erases everything on this device. Sure?</p><button class="btn small danger" data-act="reset-yes">Yes, erase</button></div>
      </section>
      <p class="credits">ISLEBOUND · Trevions · ${new Date().getFullYear()}</p>`;
  }
  cosBtn(kind, item, owned) {
    const S = this.S;
    const has = owned.includes(item.id);
    const on = S.cosmetics[kind] === item.id;
    return `<button class="cosi ${on ? 'on' : ''}" data-act="cos" data-kind="${kind}" data-id="${item.id}" data-cost="${item.cost}">${L(item.name)}<small>${on ? 'Equipped' : has ? 'Equip' : `◆ ${item.cost}`}</small></button>`;
  }
  pointsTable() {
    const k = B.SCORE.kill;
    this.modal(`<div class="sheet"><p class="eyebrow">Reference</p><h2>Points & stars</h2>
      <table class="pts"><tbody>
        <tr><td>Small enemy</td><td>${k.small}</td></tr><tr><td>Tough enemy</td><td>${k.mid}</td></tr><tr><td>Crowned elite</td><td>${k.elite}</td></tr>
        <tr><td>Champion (5/10/15/20 min)</td><td>${fmtNum(k.champion)}</td></tr><tr><td>Guardian</td><td>${fmtNum(k.guardian)}</td></tr>
        <tr><td>Each coin picked up</td><td>${B.SCORE.coin}</td></tr><tr><td>Rescued Echo</td><td>${fmtNum(B.SCORE.echo)}</td></tr><tr><td>Memory Stone</td><td>${B.SCORE.stone}</td></tr>
        <tr><td>Each second survived</td><td>${B.SCORE.perSecond}</td></tr><tr><td>Wave without being hit</td><td>${fmtNum(B.SCORE.cleanWave)}</td></tr>
        <tr><td>Stage cleared</td><td>${fmtNum(B.SCORE.clear)}</td></tr><tr><td>Health left at the end</td><td>up to ${fmtNum(B.SCORE.hpBonus)}</td></tr>
        <tr><td>Perfect slingshot landing</td><td>200 per enemy hit</td></tr>
      </tbody></table>
      <p class="sub"><b>Combo:</b> kills less than ${B.COMBO_WINDOW}s apart chain together. Every 25 in a row adds ×0.1 (max ×5) to kill points. Getting hit resets it.</p>
      <p class="sub"><b>Stage multiplier:</b> all points × (1 + difficulty ÷ 100). Nightfall adds ×1.5.</p>
      <p class="sub"><b>Stars:</b> ★ survive 30:00 (or defeat the Guardian) · ★ reach the stage's target score · ★ free all 3 Echoes.</p>
      <div class="row"><button class="btn primary" data-act="close">Got it</button></div></div>`);
  }

  // ── modal helpers ──────────────────────────────
  modal(html) {
    this.closeModal();
    const m = document.createElement('div');
    m.className = 'modal'; m.innerHTML = html;
    m.addEventListener('click', (e) => { if (e.target === m && !m.dataset.locked) this.closeModal(); });
    this.root.appendChild(m);
    this.cur = m;
    return m;
  }
  closeModal() { document.querySelectorAll('#screens .modal').forEach((m) => m.remove()); this.cur = null; }
  refreshTop() { const c = $('#coins'); if (c) c.textContent = fmtNum(this.S.coins); }

  // ── in-run UI ──────────────────────────────────
  runScreen(run) {
    this.app.mode = 'run';
    this.root.innerHTML = `
      <div class="hud" id="hud">
        <div class="hud-top">
          <div class="hud-time"><b id="h-time">30:00</b><div class="hud-wave"><small id="h-wave">Get ready</small><div class="bar"><i id="h-prog"></i></div></div></div>
          <button class="pause" data-act="pause" aria-label="Pause">❚❚</button>
        </div>
        <div class="hud-hp"><div class="bar hp"><i id="h-hp"></i><span id="h-hpt"></span></div></div>
        <div class="hud-xp"><span id="h-lvl" title="Level">1</span><div class="bar xp"><i id="h-xp"></i></div></div>
        <div class="hud-row"><span class="score" title="Points">★ <b id="h-score">0</b>${run.level.target ? `<em id="h-target"> / ${fmtNum(run.level.target)}</em>` : ''}</span><span title="Coins">◉ <b id="h-coins">0</b></span><span title="Enemies defeated">💀 <b id="h-kills">0</b></span>${run.level.cages ? '<span title="Echoes freed">🐾 <b id="h-cages">0/3</b></span>' : ''}</div>
        <div class="hud-weps" id="h-weps"></div>
        <div class="boss-bar" id="h-boss" hidden><b id="h-bname"></b><div class="bar boss"><i id="h-bhp"></i></div></div>
      </div>`;
    this.hud(run, true);
  }
  hud(run, full = false) {
    if (this.app.mode !== 'run') return;
    const d = run.hudData();
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
    set('h-time', d.time); set('h-lvl', String(d.lvl)); set('h-kills', String(d.kills)); set('h-hpt', d.hpText); set('h-score', d.score); set('h-coins', d.coins); set('h-cages', d.cages);
    set('h-wave', run.phase === 'launch' ? 'Launch to begin' : d.wave);
    const w = (id, v) => { const e = document.getElementById(id); if (e) e.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; };
    w('h-prog', d.prog); w('h-hp', d.hp); w('h-xp', d.xp);
    const tg = document.getElementById('h-target'); if (tg) tg.classList.toggle('met', d.scoreRatio >= 1);
    const bb = document.getElementById('h-boss');
    if (bb) { bb.hidden = !d.boss; if (d.boss) { set('h-bname', d.boss.name); w('h-bhp', d.boss.hp); } }
    if (full) {
      const wp = document.getElementById('h-weps');
      if (wp) wp.innerHTML = run.weapons.map((x) => `<i style="--c:${WEAPONS[x.id].color}" class="${x.evo ? 'evo' : ''}" title="${L(WEAPONS[x.id].name)}">${WEAPONS[x.id].icon}<sub>${x.evo ? '★' : x.lvl}</sub></i>`).join('') + Object.entries(run.passives).map(([k, v]) => `<i class="pas" title="${L(PASSIVES[k].name)}">${PASSIVES[k].icon}<sub>${v}</sub></i>`).join('');
    }
  }
  levelUp(run, choices, cb, fromChest) {
    const render = () => {
      const hasEvo = choices.some((c) => c.kind === 'evo');
      const m = this.modal(`<div class="levelup">
        <p class="eyebrow">${fromChest ? 'Treasure chest' : `Level ${run.plevel}`}</p><h2>${hasEvo ? 'Resonance!' : fromChest ? 'Chest opened!' : 'Level up!'}</h2>
        <p class="sub">Choose one upgrade${this.S.showTips !== false ? ' · keys 1–4 work too' : ''}</p>
        <div class="cards">${choices.map((c, i) => this.choiceCard(run, c, i)).join('')}</div>
        ${run.rerolls > 0 ? `<button class="btn small" data-act="reroll">↻ New choices (${run.rerolls} left)</button>` : ''}
      </div>`);
      m.dataset.locked = '1';
      m.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { this.closeModal(); cb(choices[+b.dataset.pick]); }));
      const rr = m.querySelector('[data-act="reroll"]');
      if (rr) rr.onclick = (e) => { e.stopPropagation(); run.rerolls--; choices = run.buildChoices(); render(); sfx('ui'); };
    };
    render();
  }
  choiceCard(run, c, i) {
    let icon, name, desc, tag = '', color = '#fff6e8', lvl = '', kind = '';
    if (c.kind === 'wup' || c.kind === 'wnew' || c.kind === 'evo') {
      const d = WEAPONS[c.id];
      icon = d.icon; color = d.color; kind = 'Song · weapon';
      if (c.kind === 'evo') { name = L(d.evo.name); desc = L(d.evo.desc); tag = 'RESONANCE'; kind = 'Evolution'; }
      else {
        name = L(d.name);
        const cur = run.weapons.find((w) => w.id === c.id);
        lvl = cur ? `Level ${cur.lvl} → ${cur.lvl + 1}` : '';
        desc = cur ? this.upDesc(d.lvl[cur.lvl - 1]) : L(d.desc);
        tag = cur ? '' : 'NEW';
        desc += ` · Pairs with ${PASSIVES[d.pair].icon} ${L(PASSIVES[d.pair].name)}`;
        if (cur && cur.lvl + 1 === WEAPON_MAX) desc += ' → can evolve!';
      }
    } else if (c.kind === 'pup' || c.kind === 'pnew') {
      const d = PASSIVES[c.id];
      icon = d.icon; name = L(d.name); desc = L(d.desc); tag = c.kind === 'pnew' ? 'NEW' : ''; kind = 'Charm · passive';
      lvl = run.passives[c.id] ? `Level ${run.passives[c.id]} → ${run.passives[c.id] + 1}` : '';
      color = '#b5a1ff';
      const pairs = Object.entries(WEAPONS).filter(([, w]) => w.pair === c.id && run.weapons.find((x) => x.id === w.id)).map(([, w]) => `${w.icon} ${L(w.name)}`);
      if (pairs.length) desc += ` · Evolves ${pairs.join(', ')}`;
    } else if (c.kind === 'heal') { icon = '♥'; name = 'Heal 40 HP'; desc = 'Everything is maxed — patch yourself up.'; color = '#ff6b8a'; }
    else { icon = '◉'; name = '+25 coins'; desc = 'Everything is maxed — take some gold.'; color = '#ffd166'; }
    return `<button class="card ${c.kind === 'evo' ? 'evo' : ''}" data-pick="${i}" style="--c:${color}">
      <i class="ci">${icon}</i><div><small class="kind">${i + 1} · ${kind}</small><b>${esc(name)} ${tag ? `<em>${tag}</em>` : ''}</b>${lvl ? `<small class="lv">${lvl}</small>` : ''}<small>${esc(desc)}</small></div></button>`;
  }
  upDesc(u) {
    const names = { dmg: 'damage', cd: 'cooldown', count: 'projectiles', pierce: 'pierce', radius: 'radius', range: 'range', speed: 'speed', jumps: 'jumps', slow: 'slow', life: 'duration', arc: 'bite width', push: 'push' };
    return Object.entries(u).map(([k, v]) => `${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(2)} ${names[k] || k}`).join(', ');
  }
  pause(run) {
    run.paused = true;
    const lv = run.level;
    const canSave = lv.kind !== 'endless' && run.phase === 'play';
    const m = this.modal(`<div class="sheet pause-sheet"><p class="eyebrow">Paused · ${fmtTime(run.time)} played</p><h2>${esc(L(lv.name))}</h2>
      <div class="facts center"><span>★ ${fmtNum(run.score)}${lv.target ? ` / ${fmtNum(lv.target)}` : ''}</span><span>◉ ${fmtNum(run.coinsGot)}</span><span>🐾 ${run.rescued.length}/${lv.cages || 0}</span><span>Combo best ${run.bestCombo}</span></div>
      <div class="hud-weps big">${run.weapons.map((x) => `<i style="--c:${WEAPONS[x.id].color}">${WEAPONS[x.id].icon}<sub>${x.evo ? '★' : x.lvl}</sub></i>`).join('')}${Object.entries(run.passives).map(([k, v]) => `<i class="pas">${PASSIVES[k].icon}<sub>${v}</sub></i>`).join('')}</div>
      <p class="sub">Next: ${this.nextEvent(run)}</p>
      <div class="col">
        <button class="btn primary big" data-act="resume">Resume</button>
        ${canSave ? '<button class="btn" data-act="save-quit">💾 Save & Quit — continue later</button>' : ''}
        <button class="btn danger" data-act="quit">Give up (keep coins collected)</button>
      </div></div>`);
    m.dataset.locked = '1';
  }
  nextEvent(run) {
    const t = run.time, ev = [];
    B.CHAMPION_AT.forEach((x) => x > t && ev.push([x, 'Champion']));
    if (run.level.cages) B.CAGE_AT.forEach((x) => x > t && ev.push([x, 'Echo cage']));
    B.COIN_RAIN_AT.forEach((x) => x > t && ev.push([x, 'Coin Rain']));
    if (run.level.boss && !run.bossSpawned) ev.push([B.GUARDIAN_AT, 'Guardian']);
    const w = Math.floor(t / B.WAVE_LEN) + 1; if (w < B.WAVES) ev.push([w * B.WAVE_LEN, `Wave ${w + 1}`]);
    ev.sort((a, b) => a[0] - b[0]);
    return ev.length ? ev.slice(0, 3).map(([x, n]) => `${n} at ${fmtTime(x)}`).join(' · ') : 'the finish line!';
  }
  results(res, rewards) {
    this.app.mode = 'results';
    const lv = res.level;
    const win = res.win;
    const bd = res.breakdown;
    const rows = [['Enemies (with combo)', bd.kills], ['Coins', bd.coins], ['Echoes rescued', bd.echoes], ['Memory Stones', bd.stones], ['Time survived', bd.time], ['Clean waves', bd.waves], ['Stage clear', bd.clear], ['Health bonus', bd.hp]].filter(([, v]) => v > 0);
    const starReasons = lv.kind === 'endless' ? [] : [
      [res.stars >= 1 && win, lv.boss ? 'Guardian defeated' : 'Survived 30:00'],
      [win && res.score >= res.target, `Score ≥ ${fmtNum(res.target)}`],
      [win && res.rescued.length >= (lv.cages || 3), `All ${lv.cages || 3} Echoes freed (${res.rescued.length})`],
    ];
    const rescuedHtml = res.rescued.map((id) => { const c = CREATURES[id]; return `<div class="resc ${rewards.newEchoes.includes(id) ? 'new' : ''}"><img src="${creatureImage(c.look, 64)}" alt=""><small>${esc(c.name)}</small></div>`; }).join('');
    const nextOk = lv.kind === 'campaign' && win && lv.stage < 30;
    this.root.innerHTML = `
      <section class="results ${win ? 'win' : 'lose'}">
        <p class="eyebrow">${esc(L(lv.name))}</p>
        <h1>${lv.kind === 'endless' ? `Fell for ${fmtTime(res.time)}` : win ? 'Island reached!' : 'Lost to the Void'}</h1>
        ${lv.kind !== 'endless' ? `<div class="bigstars">${[0, 1, 2].map((i) => `<span class="${i < res.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>
          <ul class="star-why">${starReasons.map(([ok, t]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '✕'} ${esc(t)}</li>`).join('')}</ul>` : ''}
        <div class="score-card">
          <p class="eyebrow">Score${rewards.newBest ? ' · <b class="newbest">NEW BEST!</b>' : ''}</p>
          <p class="big-score">${fmtNum(res.score)}</p>
          <table class="pts"><tbody>${rows.map(([n, v]) => `<tr><td>${n}</td><td>${fmtNum(v)}</td></tr>`).join('')}</tbody></table>
          <p class="sub">Best combo ${res.bestCombo} · ${res.cleanWaves} clean wave${res.cleanWaves === 1 ? '' : 's'} · level ${res.plevel} · ${res.kills} defeated</p>
        </div>
        <div class="res-grid">
          <div><b>◉ ${fmtNum(rewards.coins)}</b><small>Coins (${fmtNum(res.coinsCollected)} picked up${res.clearCoins ? ` + ${fmtNum(res.clearCoins)} clear bonus` : ''})</small></div>
          <div><b>▦ ${res.pieces}</b><small>Island pieces</small></div>
          <div><b>⏱ ${fmtTime(res.time)}</b><small>Time</small></div>
          ${rewards.gems ? `<div><b>◆ ${rewards.gems}</b><small>Gems</small></div>` : ''}
        </div>
        ${res.rescued.length ? `<p class="label">Echoes rescued</p><div class="rescued">${rescuedHtml}</div>` : ''}
        ${rewards.lore !== null && rewards.lore !== undefined ? `<blockquote class="lore-found"><small>📜 Memory Stone</small>${esc(L(LORE[rewards.lore]))}</blockquote>` : ''}
        ${rewards.unlocks.length ? `<div class="unlocks">${rewards.unlocks.map((u) => `<span>🔓 ${esc(u)}</span>`).join('')}</div>` : ''}
        ${rewards.share ? `<pre id="share-text">${esc(rewards.share)}</pre><button class="btn" data-act="share">Copy result ⧉</button>` : ''}
        ${!this.S.nick ? '<p class="hint">Want to be on the Top 100? <button class="linkbtn" data-act="nick">Choose a nickname</button></p>' : ''}
        <div class="row wrap">
          <button class="btn" data-act="retry">Retry</button>
          ${res.pieces > 0 ? '<button class="btn" data-act="to-island">▦ Build island</button>' : ''}
          ${nextOk ? '<button class="btn primary big" data-act="next">Next stage ➶</button>' : '<button class="btn primary" data-act="to-map">Continue</button>'}
        </div>
      </section>`;
  }

  // ── actions ────────────────────────────────────
  act(a, d, el, ev) {
    const S = this.S, app = this.app;
    if (a !== 'start' && !a.startsWith('w-')) sfx('ui');
    switch (a) {
      case 'start': playMusic(null, 0.2); if (!S.tutorialSeen) this.tutorial(0, 'nick'); else { this.hub('adventure'); app.checkGarden(); } break;
      case 'tut-next': if (this.tutPage < TUTORIAL.length - 1) this.tutorial(this.tutPage + 1, this.tutThen); else this.finishTutorial(); break;
      case 'tut-prev': this.tutorial(Math.max(0, this.tutPage - 1), this.tutThen); break;
      case 'tut-skip': this.finishTutorial(); break;
      case 'howto': this.tutorial(0, 'more'); break;
      case 'points': this.pointsTable(); break;
      case 'nick': this.closeModal(); this.nickScreen(app.mode === 'results' ? 'hub' : 'more'); break;
      case 'nick-later': this.hub('adventure'); break;
      case 'tab': this.hub(d.tab); break;
      case 'board': this.board = d.b; this.hub('ranks'); break;
      case 'realm': this.realmSel = +d.r; this.nightSel = false; this.hub('adventure'); break;
      case 'night': this.nightSel = !this.nightSel; this.hub('adventure'); break;
      case 'prep': this.prep(+d.s); break;
      case 'song': this.pending.weapon = d.id; this.cur.querySelectorAll('.song').forEach((b) => b.classList.toggle('on', b.dataset.id === d.id)); break;
      case 'close': this.closeModal(); break;
      case 'launch': { const p = this.pending; S.lastWeapon = p.weapon; this.closeModal(); if (S.activeRun) S.activeRun = null; app.startRun(p.lv, { ...p.opts, weapon: p.weapon }); break; }
      case 'resume-run': app.resumeRun(); break;
      case 'discard-run': S.activeRun = null; Save.save(); this.hub(this.tab); break;
      case 'daily': this.openLevel(getDaily(), {}); break;
      case 'endless': this.openLevel(getEndless(Math.floor(Math.random() * 12)), {}); break;
      case 'share': {
        const txt = $('#share-text')?.textContent || '';
        try { navigator.clipboard.writeText(txt).then(() => app.toast('Copied!'), () => this.selectText('#share-text')); } catch (e) { this.selectText('#share-text'); }
        break;
      }
      case 'garden': { const v = this.gardenValue(); S.coins += v; S.island.gardenAt = Date.now(); Save.save(); sfx('coin'); app.toast(`🌷 +${v} ◉`); this.hub('island'); break; }
      case 'build': {
        const id = d.id, lvl = S.island.buildings[id] || 0, cost = buildingCost(id, lvl);
        if (S.coins >= cost && lvl < BUILDING_MAX) { S.coins -= cost; S.island.buildings[id] = lvl + 1; if (id === 'garden' && lvl === 0) S.island.gardenAt = Date.now(); Save.save(); sfx('levelup'); app.toast(`${BUILDINGS[id].icon} ${L(BUILDINGS[id].name)} → level ${lvl + 1}`); app.checkAchievements(); this.hub('island'); }
        break;
      }
      case 'w-left': this.well?.move(-1); break;
      case 'w-right': this.well?.move(1); break;
      case 'w-rot': this.well?.rotate(); break;
      case 'w-soft': this.well?.soft(); break;
      case 'w-drop': this.well?.drop(); break;
      case 'echo': this.echoDetail(+d.id); break;
      case 'house': { const cap = metaBonuses(S).nestCap; if (S.housed.length < cap && !S.housed.includes(+d.id)) { S.housed.push(+d.id); Save.save(); } this.closeModal(); this.hub('echodex'); break; }
      case 'unhouse': S.housed = S.housed.filter((x) => x !== +d.id); Save.save(); this.closeModal(); this.hub('echodex'); break;
      case 'scarf': S.cosmetics.scarf = +d.i; Save.save(); this.hub('more'); break;
      case 'cos': {
        const kind = d.kind, list = kind === 'hat' ? S.cosmetics.hats : S.cosmetics.trails;
        if (!list.includes(d.id)) { const cost = +d.cost; if (S.gems < cost) { app.toast(`You need ◆ ${cost} gems (earn them from achievements)`); return; } S.gems -= cost; list.push(d.id); }
        S.cosmetics[kind] = d.id; Save.save(); this.hub('more'); break;
      }
      case 'set-music': S.sound.music = el.checked; Save.save(); S.sound.music ? playMusic(null, 0.2) : stopMusic(); break;
      case 'set-sfx': S.sound.sfx = el.checked; Save.save(); break;
      case 'set-brief': S.showBriefing = el.checked; Save.save(); break;
      case 'set-tips': S.showTips = el.checked; Save.save(); break;
      case 'export': { const ta = $('#save-code'); ta.hidden = false; ta.value = Save.exportCode(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => app.toast('Save code copied'), () => {}); } catch (e) { /* select fallback */ } break; }
      case 'import': { const ta = $('#save-code'); if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ''; ta.focus(); return; } try { Save.importCode(ta.value); app.toast('Save loaded'); this.hub('more'); } catch (e) { app.toast('That save code is not valid'); } break; }
      case 'reset': $('#reset-confirm').hidden = false; break;
      case 'reset-yes': Save.reset(); this.title(); break;
      case 'pause': if (app.run) this.pause(app.run); break;
      case 'resume': this.closeModal(); if (app.run) app.run.paused = false; break;
      case 'save-quit': this.closeModal(); app.saveAndQuit(); break;
      case 'quit': this.closeModal(); if (app.run) { app.run.paused = false; app.run.end(false); } break;
      case 'retry': app.startRun(app.lastLevel, app.lastOpts); break;
      case 'next': { const lv = app.lastLevel; this.realmSel = lv.realm; this.openLevel(getLevel(lv.realm, lv.stage + 1), { night: app.lastOpts.night }); break; }
      case 'to-island': this.hub('island'); break;
      case 'to-map': { const lv = app.lastLevel; this.hub(lv.kind === 'campaign' ? 'adventure' : 'daily'); break; }
    }
  }
  finishTutorial() {
    const S = this.S;
    const first = !S.tutorialSeen;
    S.tutorialSeen = true; Save.save();
    if (this.tutThen === 'more') this.hub('more');
    else if (first && !S.nick) this.nickScreen('hub');
    else this.hub('adventure');
  }
  selectText(sel) { const el = $(sel); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}
