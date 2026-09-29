// All DOM screens: title, hub tabs, prep, HUD, level-up, pause, results, toasts.
import { Save } from '../core/save.js';
import { t, L, lang } from '../core/i18n.js';
import { sfx, initAudio, playMusic, stopMusic } from '../core/audio.js';
import { REALMS } from '../data/realms.js';
import { getLevel, getDaily, getEndless, MUTATORS } from '../data/levels.js';
import { BOSSES } from '../data/bosses.js';
import { WEAPONS, PASSIVES, STARTER_WEAPONS, WEAPON_MAX } from '../data/weapons.js';
import { CREATURES, RARITY, BONUS } from '../data/creatures.js';
import { BUILDINGS, BUILDING_ORDER, BUILDING_MAX, buildingCost, ACHIEVEMENTS, HATS, TRAILS, SCARVES } from '../data/progression.js';
import { LORE } from '../data/lore.js';
import * as B from '../data/balance.js';
import { creatureImage, heroImage } from '../core/draw.js';
import { fmtNum, fmtTime, todayKey } from '../core/util.js';
import { metaBonuses, slotCount, unlockedBuildings } from '../game/meta.js';
import { Well, drawPiece } from '../game/well.js';
import { drawIsland } from '../game/islandView.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starStr = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);

export class UI {
  constructor(app) {
    this.app = app;
    this.root = $('#screens');
    this.tab = 'adventure';
    this.realmSel = 0;
    this.nightSel = false;
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      initAudio();
      this.act(el.dataset.act, el.dataset, el, e);
    });
  }
  get S() { return Save.state; }

  // ── top-level screens ────────────────────────────────
  title() {
    this.app.mode = 'title';
    this.root.innerHTML = `
      <section class="title-screen" data-act="start">
        <div class="logo" aria-label="Islebound"><span>ISLE</span><span>BOUND</span></div>
        <p class="tagline">${t('tagline')}</p>
        <img class="title-hero" src="${heroImage(160, { hat: this.S.cosmetics.hat, scarf: this.app.scarfColor() })}" alt="Pip">
        <p class="tap">${t('tapToStart')}</p>
        <div class="title-foot">
          <button class="chip" data-act="lang">${lang() === 'bg' ? 'EN' : 'БГ'}</button>
          <span class="ver">v1.0 · 360 ${t('stage').toLowerCase()}s · 60 Echoes</span>
        </div>
      </section>`;
  }

  hub(tab = this.tab) {
    this.app.mode = 'hub';
    this.tab = tab;
    const S = this.S;
    const tabs = ['adventure', 'daily', 'island', 'echodex', 'more'];
    const icons = { adventure: '🗺️', daily: '📅', island: '🏝️', echodex: '🐾', more: '⚙️' };
    const pieces = S.island.queue.length;
    this.root.innerHTML = `
      <div class="hub">
        <header class="topbar">
          <div class="res"><b class="coin">◉</b> <span id="coins">${fmtNum(S.coins)}</span></div>
          <div class="res"><b class="gem">◆</b> ${fmtNum(S.gems)}</div>
          <div class="res"><b>★</b> ${S.totalStars}</div>
          <div class="res"><b>🏝️</b> ${S.island.lands}</div>
        </header>
        <main class="tabbody" id="tabbody"></main>
        <nav class="tabbar">
          ${tabs.map((k) => `<button class="tabbtn ${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${icons[k]}</span><small>${t(k)}</small>${k === 'island' && pieces ? `<i class="badge">${pieces}</i>` : ''}${k === 'daily' && S.daily.lastKey !== todayKey() ? '<i class="badge dot"></i>' : ''}</button>`).join('')}
        </nav>
      </div>`;
    const body = $('#tabbody');
    this[`tab_${tab}`](body);
    body.scrollTop = this.scrollMem?.[tab] || 0;
    body.addEventListener('scroll', () => { this.scrollMem = this.scrollMem || {}; this.scrollMem[tab] = body.scrollTop; });
  }

  // ── Adventure ───────────────────────────────────────
  realmOpen(r) {
    if (r === 0) return true;
    const S = this.S;
    return !!S.progress[`${r - 1}-30`] && S.totalStars >= B.realmStarGate(r);
  }
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
    // snake path: rows of 5
    let nodes = '';
    for (let s = 1; s <= 30; s++) {
      const row = Math.floor((s - 1) / 5), col = (s - 1) % 5;
      const c = row % 2 ? 4 - col : col;
      const rec = P[`${r}-${s}`];
      const can = this.stageOpen(r, s, this.nightSel);
      const isBoss = B.BOSS_STAGES.includes(s);
      nodes += `<button class="node ${isBoss ? 'boss' : ''} ${rec ? 'done' : ''} ${can && !rec ? 'next' : ''}" style="grid-row:${row + 1};grid-column:${c + 1}" ${can ? `data-act="prep" data-s="${s}"` : 'disabled'} aria-label="${t('stage')} ${s}">
        <span class="n">${isBoss ? '☠' : s}</span>
        <span class="st">${rec ? starStr(rec.stars) : can ? '' : '🔒'}</span>
      </button>`;
    }
    el.innerHTML = `
      <div class="realm-strip" role="tablist">${REALMS.map((R2, i) => `<button class="realm-chip ${i === r ? 'on' : ''} ${this.realmOpen(i) ? '' : 'locked'}" style="--c:${R2.ground}" data-act="realm" data-r="${i}"><b>${R2.month}</b><small>${this.realmOpen(i) ? '' : '🔒'}</small></button>`).join('')}</div>
      <section class="realm-card" style="--g1:${R.sky[0]};--g2:${R.sky[1]};--acc:${R.accent};--gr:${R.ground}">
        <div class="realm-head">
          <div>
            <p class="eyebrow">${t('realm')} ${r + 1} / 12 · ${R.month}</p>
            <h2>${L(R.name)}</h2>
            <p class="realm-tag">${L(R.tag)}</p>
          </div>
          <div class="realm-stars"><b>${rs}</b><small>/ 90 ★</small></div>
        </div>
        <div class="realm-meta">
          <span>☠ ${t('guardian')}: <b>${L(boss.name)}</b></span>
          ${nightOk ? `<button class="chip ${this.nightSel ? 'on' : ''}" data-act="night">🌙 ${t('nightfall')}</button>` : ''}
        </div>
        ${open ? `<div class="path">${nodes}</div>` : `<div class="locked-realm">🔒 ${t('realmLocked', { n: B.realmStarGate(r) })}</div>`}
      </section>`;
  }
  prep(s) {
    const r = this.realmSel, night = this.nightSel;
    const lv = getLevel(r, s);
    this.openLevel(lv, { night });
  }
  openLevel(lv, opts = {}) {
    const S = this.S;
    const R = REALMS[lv.realm];
    const avail = Object.keys(WEAPONS).filter((id) => STARTER_WEAPONS.includes(id) || S.weaponsUsed[id]);
    const sel = avail.includes(S.lastWeapon) ? S.lastWeapon : 'spark';
    const rec = lv.kind === 'campaign' ? (opts.night ? S.night : S.progress)[`${lv.realm}-${lv.stage}`] : null;
    const boss = lv.boss ? BOSSES[lv.boss.id] : null;
    this.pending = { lv, opts, weapon: sel };
    this.modal(`
      <div class="sheet prep" style="--acc:${R.accent};--gr:${R.ground}">
        <p class="eyebrow">${lv.kind === 'campaign' ? `${L(R.name)} · ${lv.realm + 1}-${lv.stage}${opts.night ? ' · 🌙' : ''}` : lv.kind === 'daily' ? t('dailyTitle') : t('endless')}</p>
        <h2>${esc(L(lv.name))}</h2>
        <div class="facts">
          <span>⏱ ${isFinite(lv.duration) ? fmtTime(lv.duration) : '∞'}</span>
          ${lv.cages ? `<span>🐾 ${lv.cages}</span>` : ''}
          ${rec ? `<span>${starStr(rec.stars)}</span>` : ''}
          <span>Lv ${lv.g}</span>
        </div>
        ${boss ? `<div class="boss-callout">☠ ${L(lv.boss.form.title)} <b>${L(boss.name)}</b></div>` : ''}
        ${lv.mutators.length ? `<div class="muts">${lv.mutators.map((m) => `<div class="mut"><b>${MUTATORS[m].icon} ${L(MUTATORS[m].name)}</b><small>${L(MUTATORS[m].desc)}</small></div>`).join('')}</div>` : ''}
        <p class="label">${t('chooseSong')}</p>
        <div class="songs">${avail.map((id) => `<button class="song ${id === sel ? 'on' : ''}" data-act="song" data-id="${id}" style="--c:${WEAPONS[id].color}"><i>${WEAPONS[id].icon}</i><b>${L(WEAPONS[id].name)}</b><small>${L(WEAPONS[id].desc)}</small></button>`).join('')}</div>
        <p class="hint">${!S.tutorialDone ? t('howTo') : t('cageHint')}</p>
        <div class="row">
          <button class="btn ghost" data-act="close">✕</button>
          <button class="btn primary big" data-act="launch">${t('launch')} ➶</button>
        </div>
      </div>`);
  }

  // ── Daily / Endless ─────────────────────────────────
  tab_daily(el) {
    const S = this.S;
    const d = getDaily();
    const R = REALMS[d.realm];
    const key = todayKey();
    const res = S.daily.results[key];
    const endlessOpen = !!S.progress[`${B.ENDLESS_UNLOCK_REALM}-30`];
    el.innerHTML = `
      <section class="daily-card" style="--g1:${R.sky[0]};--g2:${R.sky[1]};--acc:${R.accent}">
        <p class="eyebrow">${t('dailyTitle')} · #${this.dayNo()}</p>
        <h2>${L(R.name)}</h2>
        <p class="sub">${t('dailyDesc')}</p>
        <div class="muts">${d.mutators.map((m) => `<div class="mut"><b>${MUTATORS[m].icon} ${L(MUTATORS[m].name)}</b><small>${L(MUTATORS[m].desc)}</small></div>`).join('')}</div>
        <div class="streak"><div><b>${S.daily.streak}</b><small>${t('streak')}</small></div><div><b>${S.daily.bestStreak}</b><small>${t('best')}</small></div><div><b>${S.daily.played}</b><small>${t('dive')}s</small></div></div>
        ${res ? `<div class="daily-res"><p>${t('playedToday')}</p><pre id="share-text">${esc(res.share)}</pre><button class="btn primary" data-act="share">${t('share')} ⧉</button></div>`
               : `<button class="btn primary big" data-act="daily">${t('launch')} ➶</button>`}
      </section>
      <section class="endless-card ${endlessOpen ? '' : 'locked'}">
        <p class="eyebrow">${t('endless')}</p>
        <p class="sub">${endlessOpen ? t('endlessDesc') : '🔒 ' + t('endlessLocked')}</p>
        <div class="streak"><div><b>${fmtTime(S.endless.best)}</b><small>${t('abyssBest')}</small></div><div><b>${S.endless.runs}</b><small>${t('dive')}s</small></div></div>
        ${endlessOpen ? `<button class="btn big" data-act="endless">${t('launch')} ∞</button>` : ''}
      </section>`;
  }
  dayNo() { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }

  // ── Island ──────────────────────────────────────────
  tab_island(el) {
    const S = this.S;
    const mb = metaBonuses(S);
    const slots = slotCount(S.island.lands);
    const garden = this.gardenValue();
    el.innerHTML = `
      <section class="island-view"><canvas id="islecv" aria-label="${t('island')}"></canvas>
        <div class="isle-stats"><span><b>${S.island.lands}</b> ${t('lands')}</span><span>⚔ +${Math.round(mb.dmg * 100)}%</span><span>♥ +${Math.round(mb.hp)}</span></div>
        ${garden > 0 ? `<button class="btn small garden" data-act="garden">🌷 +${garden} ◉</button>` : ''}
      </section>
      <section class="well-card">
        <div class="well-head"><div><h3>${t('wellTitle')}</h3><p class="sub">${t('wellHint')}</p></div><canvas id="queuecv" width="140" height="56" aria-label="queue"></canvas></div>
        <div class="well-wrap"><canvas id="wellcv"></canvas>
          <div class="well-empty" ${S.island.queue.length ? 'hidden' : ''}>${t('noPieces')}</div>
        </div>
        <div class="well-ctrl">
          <button class="kbtn" data-act="w-left" aria-label="left">◀</button>
          <button class="kbtn" data-act="w-rot" aria-label="${t('rotate')}">⟳</button>
          <button class="kbtn" data-act="w-soft" aria-label="down">▼</button>
          <button class="kbtn" data-act="w-right" aria-label="right">▶</button>
          <button class="kbtn drop" data-act="w-drop">${t('drop')} ⤓</button>
        </div>
      </section>
      <section class="build-list">
        <h3>${t('buildings')} <small>${slots}/${BUILDING_ORDER.length} ${t('slot')}</small></h3>
        ${BUILDING_ORDER.map((id, i) => {
          const d = BUILDINGS[id], lvl = S.island.buildings[id] || 0;
          const unlocked = i < slots;
          const cost = buildingCost(id, lvl);
          return `<div class="bld ${unlocked ? '' : 'locked'}">
            <div class="bld-ico">${unlocked ? d.icon : '🔒'}</div>
            <div class="bld-txt"><b>${L(d.name)} <small>${t('level')} ${lvl}/${BUILDING_MAX}</small></b><small>${unlocked ? L(d.desc) : t('unlocksAt', { n: B.BUILDING_SLOT_LANDS[i] })}</small><small class="eff">${unlocked ? d.fmt(lvl) + (lvl < BUILDING_MAX ? ` → ${d.fmt(lvl + 1)}` : '') : ''}</small></div>
            ${unlocked ? (lvl >= BUILDING_MAX ? `<span class="maxed">${t('max')}</span>` : `<button class="btn small ${S.coins >= cost ? 'primary' : ''}" data-act="build" data-id="${id}" ${S.coins >= cost ? '' : 'disabled'}>◉ ${fmtNum(cost)}</button>`) : ''}
          </div>`;
        }).join('')}
      </section>`;
    this.well = new Well((res) => {
      if (res.settled) this.app.toast(`🏝️ +${res.lands} ${t('lands')}`);
      else if (res.lines) this.app.toast(`${['', '🟩', '🟩🟩', '🟩🟩🟩', '🌟 ISLEBOUND! 🌟'][Math.min(4, res.lines)]} +${res.lines} ${t('lands')} · +${res.coins} ◉`);
      this.app.checkAchievements();
      this.refreshTop();
      const empty = $('.well-empty'); if (empty) empty.hidden = !!this.S.island.queue.length;
      const badge = document.querySelector('.tabbtn .badge:not(.dot)'); if (badge) { badge.textContent = this.S.island.queue.length || ''; if (!this.S.island.queue.length) badge.remove(); }
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
    // swipe controls on the well
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

  // ── Echodex ─────────────────────────────────────────
  tab_echodex(el) {
    const S = this.S;
    const mb = metaBonuses(S);
    const found = Object.keys(S.dex).length;
    el.innerHTML = `
      <section class="dex-head">
        <div><h3>${t('echodex')}</h3><p class="sub">${found}/60 ${t('found')} · ${t('housed')} ${Math.min(S.housed.length, mb.nestCap)}/${mb.nestCap}</p></div>
      </section>
      ${REALMS.map((R, ri) => `
        <section class="dex-realm"><p class="eyebrow" style="color:${R.accent}">${R.month} · ${L(R.name)}</p>
          <div class="dex-grid">${CREATURES.filter((c) => c.realm === ri).map((c) => {
            const has = S.dex[c.id];
            const housed = S.housed.includes(c.id);
            return `<button class="dex ${has ? '' : 'unknown'} ${housed ? 'housed' : ''}" style="--r:${RARITY[c.rarity].color}" ${has ? `data-act="echo" data-id="${c.id}"` : 'disabled'}>
              <img src="${creatureImage(c.look, 72, !has)}" alt="${has ? esc(c.name) : '?'}">
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
      <p class="sub">${t('found')}: ×${S.dex[id]}</p>
      <div class="row"><button class="btn ghost" data-act="close">✕</button>
      ${housed ? `<button class="btn" data-act="unhouse" data-id="${id}">${t('unhouse')}</button>` : `<button class="btn primary" data-act="house" data-id="${id}" ${S.housed.length >= cap ? 'disabled' : ''}>🪺 ${S.housed.length >= cap ? t('nestFull') : t('house')}</button>`}</div>
    </div>`);
  }

  // ── More ────────────────────────────────────────────
  tab_more(el) {
    const S = this.S;
    const st = S.stats;
    el.innerHTML = `
      <section class="panel"><h3>${t('wardrobe')}</h3>
        <div class="wardrobe"><img id="wr-hero" src="${heroImage(120, { hat: S.cosmetics.hat, scarf: this.app.scarfColor() })}" alt="Pip">
          <div class="scarves">${SCARVES.map((c, i) => `<button class="sw ${S.cosmetics.scarf === i ? 'on' : ''}" style="background:${c}" data-act="scarf" data-i="${i}" aria-label="scarf ${i + 1}"></button>`).join('')}</div>
        </div>
        <p class="label">Hats</p>
        <div class="cos">${HATS.map((h) => this.cosBtn('hat', h, S.cosmetics.hats)).join('')}</div>
        <p class="label">Trails</p>
        <div class="cos">${TRAILS.map((h) => this.cosBtn('trail', h, S.cosmetics.trails)).join('')}</div>
      </section>
      <section class="panel"><h3>${t('achievements')} <small>${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</small></h3>
        <div class="ach">${ACHIEVEMENTS.map((a) => `<div class="ach-i ${S.achievements[a.id] ? 'got' : ''}"><b>${S.achievements[a.id] ? '🏆' : '○'} ${L(a.name)}</b><small>${L(a.desc)}</small><i>◆ ${a.gems}</i></div>`).join('')}</div>
      </section>
      <section class="panel"><h3>${t('journal')} <small>${Object.keys(S.lore).length}/36</small></h3>
        <div class="lore">${LORE.map((l, i) => S.lore[i] ? `<blockquote><small>${REALMS[Math.floor(i / 3)].month}</small>${esc(L(l))}</blockquote>` : `<blockquote class="missing"><small>${REALMS[Math.floor(i / 3)].month}</small>· · ·</blockquote>`).join('')}</div>
      </section>
      <section class="panel"><h3>${t('stats')}</h3>
        <div class="stats">
          <div><b>${fmtNum(st.dives)}</b><small>${t('dive')}s</small></div><div><b>${fmtNum(st.kills)}</b><small>${t('kills')}</small></div>
          <div><b>${S.cleared}/360</b><small>${t('stage')}</small></div><div><b>${st.bosses}</b><small>${t('guardian')}</small></div>
          <div><b>${st.lines}</b><small>${t('lands')}</small></div><div><b>${Math.floor(st.seconds / 3600)}h ${Math.floor(st.seconds / 60) % 60}m</b><small>${t('time')}</small></div>
        </div>
      </section>
      <section class="panel"><h3>${t('settings')}</h3>
        <div class="settings">
          <label><input type="checkbox" id="set-music" data-act="set-music" ${S.sound.music ? 'checked' : ''}> ${t('music')}</label>
          <label><input type="checkbox" id="set-sfx" data-act="set-sfx" ${S.sound.sfx ? 'checked' : ''}> ${t('sfx')}</label>
          <button class="chip" data-act="lang">${t('language')}: ${lang() === 'bg' ? 'Български' : 'English'}</button>
        </div>
        <div class="row wrap">
          <button class="btn small" data-act="export">${t('exportSave')}</button>
          <button class="btn small" data-act="import">${t('importSave')}</button>
          <button class="btn small danger" data-act="reset">${t('resetSave')}</button>
        </div>
        <textarea id="save-code" rows="3" placeholder="…" hidden></textarea>
        <div id="reset-confirm" hidden><p>${t('confirmReset')}</p><button class="btn small danger" data-act="reset-yes">✓</button></div>
      </section>
      <p class="credits">ISLEBOUND · Trevions · ${new Date().getFullYear()}</p>`;
  }
  cosBtn(kind, item, owned) {
    const S = this.S;
    const has = owned.includes(item.id);
    const on = S.cosmetics[kind] === item.id;
    return `<button class="cosi ${on ? 'on' : ''}" data-act="cos" data-kind="${kind}" data-id="${item.id}" data-cost="${item.cost}">${L(item.name)}<small>${on ? t('equipped') : has ? t('equip') : `◆ ${item.cost}`}</small></button>`;
  }

  // ── modals / overlays ───────────────────────────────
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

  // ── in-run UI ───────────────────────────────────────
  runScreen(run) {
    this.app.mode = 'run';
    this.root.innerHTML = `
      <div class="hud" id="hud">
        <div class="hud-top">
          <div class="hud-time"><b id="h-time">0:00</b><div class="bar"><i id="h-prog"></i></div></div>
          <button class="pause" data-act="pause" aria-label="${t('paused')}">❚❚</button>
        </div>
        <div class="hud-hp"><div class="bar hp"><i id="h-hp"></i><span id="h-hpt"></span></div></div>
        <div class="hud-xp"><span id="h-lvl">1</span><div class="bar xp"><i id="h-xp"></i></div></div>
        <div class="hud-row"><span id="h-kills">💀 0</span><span id="h-cages">🐾 0/3</span></div>
        <div class="hud-weps" id="h-weps"></div>
        <div class="boss-bar" id="h-boss" hidden><b id="h-bname"></b><div class="bar boss"><i id="h-bhp"></i></div></div>
      </div>`;
    this.hud(run, true);
  }
  hud(run, full = false) {
    if (this.app.mode !== 'run') return;
    const d = run.hudData();
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
    set('h-time', d.time); set('h-lvl', String(d.lvl)); set('h-kills', `💀 ${d.kills}`); set('h-hpt', d.hpText);
    if (run.level.cages) set('h-cages', `🐾 ${d.cages}`); else set('h-cages', '');
    const w = (id, v) => { const e = document.getElementById(id); if (e) e.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`; };
    w('h-prog', d.prog); w('h-hp', d.hp); w('h-xp', d.xp);
    const bb = document.getElementById('h-boss');
    if (bb) { bb.hidden = !d.boss; if (d.boss) { set('h-bname', d.boss.name); w('h-bhp', d.boss.hp); } }
    if (full) {
      const wp = document.getElementById('h-weps');
      if (wp) wp.innerHTML = run.weapons.map((x) => `<i style="--c:${WEAPONS[x.id].color}" class="${x.evo ? 'evo' : ''}">${WEAPONS[x.id].icon}<sub>${x.evo ? '★' : x.lvl}</sub></i>`).join('') + Object.entries(run.passives).map(([k, v]) => `<i class="pas">${PASSIVES[k].icon}<sub>${v}</sub></i>`).join('');
    }
  }
  levelUp(run, choices, cb) {
    const render = () => {
      const m = this.modal(`<div class="levelup">
        <p class="eyebrow">${t('level')} ${run.plevel}</p><h2>${run.pendingLevels >= 0 && choices.some((c) => c.kind === 'evo') ? t('resonance') + '!' : t('levelUp')}</h2>
        <div class="cards">${choices.map((c, i) => this.choiceCard(run, c, i)).join('')}</div>
        ${run.rerolls > 0 ? `<button class="btn small" data-act="reroll">↻ ${t('reroll')} (${run.rerolls})</button>` : ''}
      </div>`);
      m.dataset.locked = '1';
      m.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { this.closeModal(); cb(choices[+b.dataset.pick]); }));
      const rr = m.querySelector('[data-act="reroll"]');
      if (rr) rr.onclick = (e) => { e.stopPropagation(); run.rerolls--; choices = run.buildChoices(); render(); sfx('ui'); };
    };
    render();
  }
  choiceCard(run, c, i) {
    let icon, name, desc, tag = '', color = '#fff6e8', lvl = '';
    if (c.kind === 'wup' || c.kind === 'wnew' || c.kind === 'evo') {
      const d = WEAPONS[c.id];
      icon = d.icon; color = d.color;
      if (c.kind === 'evo') { name = L(d.evo.name); desc = L(d.evo.desc); tag = t('resonance'); }
      else {
        name = L(d.name);
        const cur = run.weapons.find((w) => w.id === c.id);
        lvl = cur ? `${cur.lvl} → ${cur.lvl + 1}` : '';
        desc = cur ? this.upDesc(d.lvl[cur.lvl - 1]) : L(d.desc);
        tag = cur ? '' : t('new');
        if (cur && cur.lvl + 1 === WEAPON_MAX) desc += ` · ${PASSIVES[d.pair].icon} → ${t('resonance')}`;
      }
    } else if (c.kind === 'pup' || c.kind === 'pnew') {
      const d = PASSIVES[c.id];
      icon = d.icon; name = L(d.name); desc = L(d.desc); tag = c.kind === 'pnew' ? t('new') : ''; lvl = run.passives[c.id] ? `${run.passives[c.id]} → ${run.passives[c.id] + 1}` : '';
      color = '#b5a1ff';
      const pairs = Object.entries(WEAPONS).filter(([, w]) => w.pair === c.id && run.weapons.find((x) => x.id === w.id)).map(([, w]) => w.icon);
      if (pairs.length) desc += ` · ⇄ ${pairs.join(' ')}`;
    } else if (c.kind === 'heal') { icon = '♥'; name = '+40 ♥'; desc = ''; color = '#ff6b8a'; }
    else { icon = '◉'; name = '+40 ◉'; desc = ''; color = '#ffd166'; }
    return `<button class="card ${c.kind === 'evo' ? 'evo' : ''}" data-pick="${i}" style="--c:${color}">
      <i class="ci">${icon}</i><div><b>${esc(name)} ${tag ? `<em>${tag}</em>` : ''}</b>${lvl ? `<small class="lv">${lvl}</small>` : ''}<small>${esc(desc)}</small></div></button>`;
  }
  upDesc(u) {
    const names = { dmg: '⚔', cd: '⌛', count: '#', pierce: '➹', radius: '◌', range: '↔', speed: '»', jumps: 'ϟ', slow: '❄', life: '◷', arc: '◖', push: '≋' };
    return Object.entries(u).map(([k, v]) => `${names[k] || k} ${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(2)}`).join('  ');
  }
  pause(run) {
    run.paused = true;
    const m = this.modal(`<div class="sheet pause-sheet"><h2>${t('paused')}</h2>
      <p class="sub">${esc(L(run.level.name))}</p>
      <div class="hud-weps big">${run.weapons.map((x) => `<i style="--c:${WEAPONS[x.id].color}">${WEAPONS[x.id].icon}<sub>${x.evo ? '★' : x.lvl}</sub></i>`).join('')}</div>
      <div class="row"><button class="btn danger" data-act="quit">${t('quit')}</button><button class="btn primary" data-act="resume">${t('resume')}</button></div></div>`);
    m.dataset.locked = '1';
  }
  results(res, rewards) {
    this.app.mode = 'results';
    const lv = res.level;
    const win = res.win;
    const rescuedHtml = res.rescued.map((id) => { const c = CREATURES[id]; return `<div class="resc ${rewards.newEchoes.includes(id) ? 'new' : ''}"><img src="${creatureImage(c.look, 64)}" alt=""><small>${esc(c.name)}</small></div>`; }).join('');
    const nextOk = lv.kind === 'campaign' && win && lv.stage < 30;
    this.root.innerHTML = `
      <section class="results ${win ? 'win' : 'lose'}">
        <p class="eyebrow">${esc(L(lv.name))}</p>
        <h1>${lv.kind === 'endless' ? fmtTime(res.time) : win ? t('victory') : t('defeat')}</h1>
        ${lv.kind !== 'endless' ? `<div class="bigstars">${[0, 1, 2].map((i) => `<span class="${i < res.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>` : ''}
        ${res.flawless ? `<p class="flawless">✨ ${t('flawless')}</p>` : ''}
        <div class="res-grid">
          <div><b>◉ ${fmtNum(rewards.coins)}</b><small>${t('coins')}</small></div>
          <div><b>▦ ${res.pieces}</b><small>${t('pieces')}</small></div>
          <div><b>💀 ${res.kills}</b><small>${t('kills')}</small></div>
          <div><b>⏱ ${fmtTime(res.time)}</b><small>${t('time')}</small></div>
          ${rewards.gems ? `<div><b>◆ ${rewards.gems}</b><small>${t('gems')}</small></div>` : ''}
        </div>
        ${res.rescued.length ? `<p class="label">${t('rescued')}</p><div class="rescued">${rescuedHtml}</div>` : ''}
        ${rewards.lore !== null && rewards.lore !== undefined ? `<blockquote class="lore-found"><small>📜 ${t('memoryFound')}</small>${esc(L(LORE[rewards.lore]))}</blockquote>` : ''}
        ${rewards.unlocks.length ? `<div class="unlocks">${rewards.unlocks.map((u) => `<span>🔓 ${esc(u)}</span>`).join('')}</div>` : ''}
        ${rewards.share ? `<pre id="share-text">${esc(rewards.share)}</pre><button class="btn" data-act="share">${t('share')} ⧉</button>` : ''}
        <div class="row wrap">
          <button class="btn" data-act="retry">${t('retry')}</button>
          ${res.pieces > 0 ? `<button class="btn" data-act="to-island">▦ ${t('toIsland')}</button>` : ''}
          ${nextOk ? `<button class="btn primary big" data-act="next">${t('next')} ➶</button>` : `<button class="btn primary" data-act="to-map">${t('continue')}</button>`}
        </div>
      </section>`;
  }

  // ── action dispatcher ───────────────────────────────
  act(a, d, el, ev) {
    const S = this.S, app = this.app;
    if (a !== 'start' && !a.startsWith('w-')) sfx('ui');
    switch (a) {
      case 'start': if (ev.target.closest('[data-act="lang"]')) return; playMusic(null, 0.2); this.hub('adventure'); app.checkGarden(); break;
      case 'lang': S.lang = lang() === 'bg' ? 'en' : 'bg'; Save.save(); app.mode === 'title' ? this.title() : this.hub(); break;
      case 'tab': this.hub(d.tab); break;
      case 'realm': this.realmSel = +d.r; this.nightSel = false; this.hub('adventure'); break;
      case 'night': this.nightSel = !this.nightSel; this.hub('adventure'); break;
      case 'prep': this.prep(+d.s); break;
      case 'song': this.pending.weapon = d.id; this.cur.querySelectorAll('.song').forEach((b) => b.classList.toggle('on', b.dataset.id === d.id)); break;
      case 'close': this.closeModal(); break;
      case 'launch': { const p = this.pending; S.lastWeapon = p.weapon; this.closeModal(); app.startRun(p.lv, { ...p.opts, weapon: p.weapon }); break; }
      case 'daily': this.openLevel(getDaily(), {}); break;
      case 'endless': this.openLevel(getEndless(Math.floor(Math.random() * 12)), {}); break;
      case 'share': {
        const txt = $('#share-text')?.textContent || '';
        const done = () => app.toast(t('copied'));
        try { navigator.clipboard.writeText(txt).then(done, () => this.selectText('#share-text')); } catch (e) { this.selectText('#share-text'); }
        break;
      }
      case 'garden': { const v = this.gardenValue(); S.coins += v; S.island.gardenAt = Date.now(); Save.save(); sfx('coin'); app.toast(`🌷 +${v} ◉`); this.hub('island'); break; }
      case 'build': {
        const id = d.id, lvl = S.island.buildings[id] || 0, cost = buildingCost(id, lvl);
        if (S.coins >= cost && lvl < BUILDING_MAX) { S.coins -= cost; S.island.buildings[id] = lvl + 1; if (id === 'garden' && lvl === 0) S.island.gardenAt = Date.now(); Save.save(); sfx('levelup'); app.checkAchievements(); this.hub('island'); }
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
        if (!list.includes(d.id)) { const cost = +d.cost; if (S.gems < cost) { app.toast(`◆ ${cost}`); return; } S.gems -= cost; list.push(d.id); }
        S.cosmetics[kind] = d.id; Save.save(); this.hub('more'); break;
      }
      case 'set-music': S.sound.music = el.checked; Save.save(); S.sound.music ? playMusic(null, 0.2) : stopMusic(); break;
      case 'set-sfx': S.sound.sfx = el.checked; Save.save(); break;
      case 'export': { const ta = $('#save-code'); ta.hidden = false; ta.value = Save.exportCode(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => app.toast(t('copied')), () => {}); } catch (e) { /* select fallback */ } break; }
      case 'import': { const ta = $('#save-code'); if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ''; ta.focus(); return; } try { Save.importCode(ta.value); app.toast('✓'); this.hub('more'); } catch (e) { app.toast('✕ code'); } break; }
      case 'reset': $('#reset-confirm').hidden = false; break;
      case 'reset-yes': Save.reset(); this.title(); break;
      case 'pause': if (app.run) this.pause(app.run); break;
      case 'resume': this.closeModal(); if (app.run) app.run.paused = false; break;
      case 'quit': this.closeModal(); if (app.run) { app.run.paused = false; app.run.end(false); } break;
      case 'retry': app.startRun(app.lastLevel, app.lastOpts); break;
      case 'next': { const lv = app.lastLevel; this.realmSel = lv.realm; this.openLevel(getLevel(lv.realm, lv.stage + 1), { night: app.lastOpts.night }); break; }
      case 'to-island': this.hub('island'); break;
      case 'to-map': { const lv = app.lastLevel; this.hub(lv.kind === 'campaign' ? 'adventure' : 'daily'); break; }
    }
  }
  selectText(sel) { const el = $(sel); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}
