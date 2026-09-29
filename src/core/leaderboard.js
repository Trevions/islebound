// Leaderboard + unique nicknames.
// Backends, in order of preference:
//   1. Supabase (public web release) — configure src/config.js + run docs/supabase.sql
//   2. Claude artifact shared database (when the game runs as a claude.ai artifact)
//   3. Local only (this device) — the game still works, ranks just aren't shared
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { Save } from './save.js';

export const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
export const nickError = (n) => (!n ? 'Pick a nickname' : !NICK_RE.test(n) ? '3–16 letters, numbers or _ only' : '');

const sb = {
  ok: () => !!(SUPABASE_URL && SUPABASE_ANON_KEY),
  async call(path, body, method = 'POST') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!r.ok) throw new Error((data && (data.message || data.hint)) || `HTTP ${r.status}`);
    return data;
  },
};

export const Leaderboard = {
  mode: 'local', db: null, uid: null, ready: null,
  init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (sb.ok()) { this.mode = 'online'; return this.mode; }
      try {
        if (window.claude && typeof window.claude.use === 'function') {
          const db = await window.claude.use('db');
          const user = await window.claude.use('user');
          if (db && user) { this.db = db; this.uid = await user.id(); this.mode = 'shared'; return this.mode; }
        }
      } catch (e) { /* fall through */ }
      this.mode = 'local';
      return this.mode;
    })();
    return this.ready;
  },
  label() { return { online: 'Worldwide', shared: 'Shared with everyone who has this game link', local: 'This device only' }[this.mode]; },

  async claim(nick) {
    const err = nickError(nick);
    if (err) return { ok: false, error: err };
    await this.init();
    const S = Save.state;
    const lc = nick.toLowerCase();
    try {
      if (this.mode === 'online') {
        const rows = await sb.call('rpc/claim_nickname', { p_nick: nick, p_id: S.online?.id || null, p_secret: S.online?.secret || null });
        const row = Array.isArray(rows) ? rows[0] : rows;
        S.online = { id: row.id, secret: row.secret };
      } else if (this.mode === 'shared') {
        const ref = this.db.doc(`nicks/${lc}`);
        const lease = await ref.acquire({ holder: this.uid, ttlMs: 4000 });
        if (!lease.acquired) return { ok: false, error: 'That nickname is being taken right now. Try another.' };
        const cur = await ref.get();
        const owner = cur.exists ? cur.data().uid : null;
        if (owner && owner !== this.uid) return { ok: false, error: 'That nickname is already taken.' };
        await ref.set({ uid: this.uid, nick });
        if (S.nick && S.nick.toLowerCase() !== lc) { try { const old = this.db.doc(`nicks/${S.nick.toLowerCase()}`); const o = await old.get(); if (o.exists && o.data().uid === this.uid) await old.delete(); } catch (e) { /* ignore */ } }
      }
    } catch (e) {
      const m = String(e.message || e);
      return { ok: false, error: /taken|duplicate|unique/i.test(m) ? 'That nickname is already taken.' : `Could not reach the leaderboard (${m}).` };
    }
    S.nick = nick;
    Save.save();
    this.submit().catch(() => {});
    return { ok: true };
  },

  stats() {
    const S = Save.state;
    let total = 0;
    for (const k in S.progress) total += S.progress[k].score || 0;
    for (const k in S.night) total += S.night[k].score || 0;
    const today = S.daily.lastKey;
    const d = today && S.daily.results[today];
    return { total, cleared: S.cleared, stars: S.totalStars, echoes: Object.keys(S.dex).length, dailyKey: today || '', dailyScore: d ? d.score || 0 : 0 };
  },

  async submit() {
    const S = Save.state;
    if (!S.nick) return;
    await this.init();
    const st = this.stats();
    if (this.mode === 'online' && S.online) {
      await sb.call('rpc/submit_score', { p_id: S.online.id, p_secret: S.online.secret, p_total: st.total, p_cleared: st.cleared, p_stars: st.stars, p_echoes: st.echoes, p_daily_key: st.dailyKey, p_daily_score: st.dailyScore });
    } else if (this.mode === 'shared') {
      await this.db.doc(`players/${this.uid}`).set({ nick: S.nick, nickLc: S.nick.toLowerCase(), ...st, updatedAt: Date.now() });
    }
  },

  // board: 'total' | 'daily'
  async top(board = 'total', dayKey = '') {
    await this.init();
    const S = Save.state;
    const me = S.nick || '';
    let rows = [];
    try {
      if (this.mode === 'online') {
        if (board === 'daily') rows = (await sb.call('rpc/daily_top', { p_key: dayKey })) || [];
        else rows = (await sb.call('leaderboard?select=*', null, 'GET')) || [];
        rows = rows.map((r) => ({ nick: r.nickname, score: board === 'daily' ? r.daily_score : r.total_score, cleared: r.cleared, stars: r.stars, echoes: r.echoes }));
      } else if (this.mode === 'shared') {
        let q = this.db.collection('players');
        q = board === 'daily' ? q.where('dailyKey', '==', dayKey).orderBy('dailyScore', 'desc') : q.orderBy('total', 'desc');
        const snap = await q.limit(100).get();
        rows = snap.docs.map((d) => { const x = d.data(); return { nick: x.nick, score: board === 'daily' ? x.dailyScore : x.total, cleared: x.cleared, stars: x.stars, echoes: x.echoes }; });
      }
    } catch (e) { return { rows: [], error: String(e.message || e) }; }
    if (this.mode === 'local' || !rows.some((r) => r.nick === me)) {
      const st = this.stats();
      if (me && this.mode === 'local') rows = [{ nick: me, score: board === 'daily' ? (st.dailyKey === dayKey ? st.dailyScore : 0) : st.total, cleared: st.cleared, stars: st.stars, echoes: st.echoes }];
    }
    rows = rows.filter((r) => r.score > 0 || r.nick === me).slice(0, 100);
    return { rows: rows.map((r, i) => ({ ...r, rank: i + 1, you: r.nick === me })) };
  },

  async available(nick) {
    if (nickError(nick)) return false;
    await this.init();
    try {
      if (this.mode === 'online') return !!(await sb.call('rpc/nickname_available', { p_nick: nick }));
      if (this.mode === 'shared') { const d = await this.db.doc(`nicks/${nick.toLowerCase()}`).get(); return !d.exists || d.data().uid === this.uid; }
    } catch (e) { return true; }
    return true;
  },
};
