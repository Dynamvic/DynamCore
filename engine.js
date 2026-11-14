'use strict';
/* DynamCore – planning engine. Pure functions on (profile, state); no DOM. */

/* ---------- dates: day numbers (UTC days), weeks start on Monday ---------- */
const DN = {
  num: (y, m, d) => Math.floor(Date.UTC(y, m, d) / 864e5),
  today: () => { const t = new Date(); return DN.num(t.getFullYear(), t.getMonth(), t.getDate()); },
  parse: s => { const [y, m, d] = s.split('-').map(Number); return DN.num(y, m - 1, d); },
  date: n => new Date(n * 864e5),
  iso: n => DN.date(n).toISOString().slice(0, 10),
  dow: n => (DN.date(n).getUTCDay() + 6) % 7,
  monday: n => n - DN.dow(n),
  fmt: n => { const d = DN.date(n); return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; },
  fmtY: n => `${DN.fmt(n)}-${DN.date(n).getUTCFullYear()}`
};

/* ---------- random (deterministic, so a plan stays the same when reopened) ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = hashStr(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- constants ---------- */
const TYPES = ['CORE', 'LEG', 'MOB', 'ACT', 'REC', 'GROUP'];
const HARD = new Set(['CORE', 'LEG']);
const GYM_EXPANDS = ['db', 'kb', 'band', 'swiss', 'bench', 'roller', 'ball', 'miniband', 'gym'];

/* Which home session types come first per phase; the first N are planned. */
const PRIORITY = {
  base:      ['LEG', 'CORE', 'MOB', 'CORE', 'LEG'],
  inseason:  ['CORE', 'MOB', 'LEG', 'CORE', 'MOB'],
  offseason: ['MOB', 'CORE', 'MOB', 'CORE', 'LEG'],
  taper:     ['CORE', 'MOB', 'MOB', 'CORE', 'MOB'],
  race:      ['ACT', 'MOB', 'MOB', 'ACT', 'MOB']
};

/* Session templates. A slot is "pattern" or "patternA|patternB" (fallbacks); a trailing digit fixes the level. */
const TPL = {
  CORE: { wu: ['mob-spine', 'antirot1', 'bridge1', 'scap1', 'mob-hipflex1'],
          main: ['antiext', 'antilat', 'bridge', 'pull', 'antirot', 'push', 'abd|hinge', 'rot|scap', 'crawl|carry'],
          power: { at: 3, pat: 'power' }, cd: ['mob-hipflex', 'mob-glute|mob-ham', 'mob-chest|mob-lat'] },
  LEG:  { wu: ['mob-hipflex1', 'bridge1', 'abd1', 'balance1', 'mob-hip1'],
          main: ['squat', 'hinge', 'lunge', 'bridge', 'calf', 'abd', 'carry|antilat', 'antiext'],
          power: { at: 2, pat: 'legpower' }, cd: ['mob-hipflex', 'mob-ham', 'mob-calf'] },
  MOB:  { roll: ['roll-legs', 'roll-glute', 'roll-back', 'roll-calf', 'roll-foot', 'roll-chest'],
          mob: ['mob-hipflex', 'mob-tspine', 'mob-ham', 'mob-glute', 'mob-hip', 'mob-chest', 'mob-calf', 'mob-lat', 'mob-neck', 'mob-spine'],
          stab: ['balance', 'breath1', 'antiext1', 'antirot1', 'crawl1'] },
  ACT:  { list: ['breath1', 'mob-hipflex1', 'bridge1', 'antiext1', 'antilat', 'power|crawl', 'balance'] },
  REC:  { list: ['roll-legs', 'roll-glute', 'mob-hipflex', 'mob-ham', 'mob-glute', 'mob-chest|mob-lat', 'breath1'] }
};
const MOB_COUNTS = { 15: [2, 4, 1], 20: [3, 5, 2], 30: [4, 7, 3], 45: [6, 10, 4] };
const STR_START = { 15: { wu: 2, cd: 1, n: 4, r: 2 }, 20: { wu: 3, cd: 1, n: 5, r: 2 }, 30: { wu: 4, cd: 2, n: 6, r: 3 }, 45: { wu: 5, cd: 3, n: 7, r: 3 } };

/* ---------- dose ---------- */
function parseDose(s) { const m = /^([rtb])(\d+)(s?)$/.exec(s); return { k: m[1], n: +m[2], side: m[3] === 's' }; }
function scaleDose(d, f) {
  if (d.k === 'b' || f === 1) return { ...d };
  const n = d.k === 't' ? Math.max(10, Math.round(d.n * f / 5) * 5) : Math.max(3, Math.round(d.n * f));
  return { ...d, n };
}
function itemSeconds(d) {
  const sides = d.side ? 2 : 1;
  if (d.k === 'r') return d.n * 3.5 * sides + (d.side ? 14 : 10);
  if (d.k === 't') return d.n * sides + (d.side ? 13 : 8);
  return d.n * 10 + 5;
}

/* ---------- profile helpers ---------- */
function equipSet(p, travel) {
  if (travel) return new Set();
  const s = new Set(p.eq || []);
  if (s.has('gym')) GYM_EXPANDS.forEach(x => s.add(x));
  return s;
}
function allowed(e, ctx) {
  if (ctx.blocked.has(e.id)) return false;
  if (e.avoid.some(a => ctx.complaints.has(a))) return false;
  if (ctx.travel && e.space) return false;
  if (e.eq.length && !e.eq.some(x => ctx.eq.has(x))) return false;
  return true;
}
function makeCtx(p, travel) {
  return { eq: equipSet(p, travel), complaints: new Set(p.complaints || []), blocked: new Set(p.blocked || []), travel: !!travel };
}
function candidates(pat, ctx) { return EX.filter(e => e.pat === pat && allowed(e, ctx)); }

/* Pick one exercise for a slot spec at a target level. */
function pickSlot(spec, level, ctx, used, rand) {
  for (const alt of spec.split('|')) {
    const m = /^(.*?)(\d)?$/.exec(alt); const pat = m[1]; const lvl = m[2] ? +m[2] : level;
    const c = candidates(pat, ctx).filter(e => !used.has(e.id));
    if (!c.length) continue;
    const best = Math.min(...c.map(e => Math.abs(e.lvl - lvl) + (e.lvl > lvl ? 0.5 : 0)));
    const pool = c.filter(e => Math.abs(e.lvl - lvl) + (e.lvl > lvl ? 0.5 : 0) === best);
    const e = pool[Math.floor(rand() * pool.length)];
    used.add(e.id);
    return { id: e.id, pat, fixed: !!m[2] };
  }
  return null;
}

/* ---------- phases ---------- */
function phaseFor(p, monday) {
  if (p.phaseOverride && p.phaseOverride !== 'auto') return p.phaseOverride;
  const races = (p.races || []).map(r => DN.parse(r.d)).sort((a, b) => a - b);
  const sunday = monday + 6;
  if (races.some(r => r >= monday && r <= sunday)) return 'race';
  if (races.some(r => r > sunday && r <= sunday + 7)) return 'taper';
  const next = races.find(r => r > sunday), prev = [...races].reverse().find(r => r < monday);
  if (next !== undefined && next - monday <= 70) return 'inseason';
  if (prev !== undefined && monday - prev <= 28 && next !== undefined && next - monday <= 112) return 'inseason';
  if (prev !== undefined && monday - prev <= 28) return 'offseason';
  return 'base';
}
function styleFor(phase, block, p, monday) {
  if (phase === 'inseason' || phase === 'taper' || phase === 'race') return 'power';
  if (phase === 'offseason') return 'control';
  const next = (p.races || []).map(r => DN.parse(r.d)).filter(r => r > monday).sort((a, b) => a - b)[0];
  if (next !== undefined && next - monday <= 112) return 'power';
  return block === 0 ? 'control' : 'strength';
}

/* ---------- weeks ---------- */
const startNum = p => DN.parse(p.start);
const planWeekOf = (p, dayNum) => Math.floor((DN.monday(dayNum) - startNum(p)) / 7) + 1;
const mondayOfWeek = (p, w) => startNum(p) + (w - 1) * 7;
function isRecovery(p, st, w) {
  const k = +p.rk || 0;
  let rec = k > 0 && w % k === 0;
  const ov = st.weekOv[w];
  if (ov && typeof ov.rec === 'boolean') rec = ov.rec;
  return rec;
}
const blockOf = (p, w) => Math.floor((w - 1) / ((+p.rk || 0) > 0 ? +p.rk : 4));
const weekInBlock = (p, w) => (w - 1) % ((+p.rk || 0) > 0 ? +p.rk : 4);

function groupTypeOf(focus) {
  const f = new Set(focus || []);
  if (f.has('legs') || f.has('strength')) return 'LEG';
  if (f.has('core') || f.has('back')) return 'CORE';
  if (f.has('mobility')) return 'MOB';
  return 'LEG';
}
const groupIsHard = focus => groupTypeOf(focus) !== 'MOB';

/* Assign session types to days with simple scoring (spacing of hard sessions, hard bike days). */
function assignDays(types, days, groupDay, groupHard, hardBike) {
  const hb = new Set(hardBike || []);
  const freeDays = days.filter(d => d !== groupDay).sort((a, b) => a - b);
  const n = Math.min(types.length, freeDays.length);
  const use = types.slice(0, n);
  let best = null, bestScore = Infinity;
  const perm = (arr, k, chosen) => {
    if (chosen.length === k) { score(chosen); return; }
    for (const d of arr) if (!chosen.includes(d)) perm(arr, k, [...chosen, d]);
  };
  const gap = (a, b) => { const g = Math.abs(a - b); return Math.min(g, 7 - g); };
  const score = chosen => {
    let s = 0;
    const hard = [];
    chosen.forEach((d, i) => { if (HARD.has(use[i]) || use[i] === 'ACT') hard.push(d); });
    if (groupDay != null && groupHard) hard.push(groupDay);
    for (let i = 0; i < hard.length; i++) for (let j = i + 1; j < hard.length; j++) { const g = gap(hard[i], hard[j]); if (g === 0) s += 20; else if (g === 1) s += 8; }
    chosen.forEach((d, i) => {
      const t = use[i];
      if (t === 'LEG' && hb.has((d + 1) % 7)) s += 3;
      if (t === 'CORE' && hb.has((d + 1) % 7)) s += 2;
      if (t === 'LEG' && hb.has(d)) s -= 1;
      if (t === 'MOB' && !hb.has(d)) s -= 0.5;
    });
    // keep the same type order through the week as the priority list (stable feel)
    for (let i = 1; i < chosen.length; i++) if (use[i] === use[i - 1] && chosen[i] < chosen[i - 1]) s += 0.1;
    if (s < bestScore) { bestScore = s; best = chosen; }
  };
  perm(freeDays, n, []);
  return { slots: use.map((t, i) => ({ type: t, day: best ? best[i] : freeDays[i] })), dropped: types.length - n };
}

function weekPlan(p, st, w) {
  const monday = mondayOfWeek(p, w);
  const phase = phaseFor(p, monday);
  const rec = isRecovery(p, st, w);
  const ov = st.weekOv[w] || {};
  const N = Math.max(2, Math.min(5, +p.perWeek || 3));
  let types = PRIORITY[phase].slice(0, N);
  const g = p.group && p.group.on && !ov.groupOff ? { day: +p.group.day, focus: ov.groupFocus || p.group.focus || [] } : null;
  if (g) {
    const gt = groupTypeOf(g.focus);
    const i = types.indexOf(gt);
    if (i >= 0) types.splice(i, 1); else types.pop();
  }
  const travel = !!(ov.travel ?? p.travelAlways);
  const { slots, dropped } = assignDays(types, (p.days || []).map(Number), g ? g.day : null, g ? groupIsHard(g.focus) : false, p.hardBike);
  const counts = {};
  const out = slots.map(s => { counts[s.type] = (counts[s.type] || 0) + 1; return { ...s, key: `${s.type}-${counts[s.type]}`, idx: counts[s.type] }; });
  out.forEach(s => {
    const mv = ov.moves && ov.moves[s.key];
    if (mv != null) s.day = +mv;
    s.skipped = !!(ov.skips && ov.skips[s.key]);
  });
  const firstHard = out.filter(s => HARD.has(s.type)).sort((a, b) => a.day - b.day)[0];
  if (firstHard && (w === 1 || rec) && !(ov.noTest)) firstHard.test = true;
  if (g) out.push({ type: 'GROUP', day: g.day, key: 'GROUP', focus: g.focus, skipped: !!(ov.skips && ov.skips.GROUP) });
  out.sort((a, b) => a.day - b.day);
  return { w, monday, phase, rec, travel, slots: out, dropped, block: blockOf(p, w) };
}

/* ---------- level ---------- */
function effLevel(p, type) {
  const base = +p.level || 1;
  const adj = (p.adj && p.adj[type]) || 0;
  return Math.max(1, Math.min(3, base + adj));
}

/* ---------- session builder ---------- */
function doseFactor(p, plan, type) {
  let f = 1;
  if (type === 'CORE' || type === 'LEG') {
    const wib = weekInBlock(p, plan.w);
    f = [1, 1.15, 1.3, 1.4, 1.5][Math.min(4, wib)];
  }
  if (plan.rec) f = 0.85;
  if (plan.phase === 'offseason') f *= 0.9;
  if (plan.phase === 'inseason') f *= 0.95;
  if (plan.phase === 'taper') f *= 0.75;
  if (plan.phase === 'race') f *= 0.6;
  return f;
}
const restFor = (style, level) => style === 'control' && level < 2 ? 30 : 45;

function buildSession(p, st, plan, slot, opts = {}) {
  const type = slot.type;
  const ov = (st.weekOv[plan.w] || {});
  const dur = +(opts.dur || (ov.dur && ov.dur[slot.key]) || capDur(p.dur || 30, plan.phase, type));
  const travel = opts.travel ?? plan.travel;
  const ctx = makeCtx(p, travel);
  const used = new Set();
  const rand = rng(`${plan.block}|${type}|${slot.idx || 1}|${travel ? 't' : ''}|${p.level}|${(p.adj || {})[type] || 0}`);
  const level = effLevel(p, type);
  const style = styleFor(plan.phase, plan.block, p, plan.monday);
  const f = doseFactor(p, plan, type);
  const swaps = (ov.swaps && ov.swaps[slot.key]) || {};
  const mk = (pick, factor) => {
    if (!pick) return null;
    let id = pick.id;
    if (swaps[id] && EXMAP[swaps[id]]) id = swaps[id];
    const e = EXMAP[id];
    return { id, orig: pick.id, pat: pick.pat, dose: scaleDose(parseDose(e.dose), factor) };
  };
  const blocks = [];

  if (type === 'CORE' || type === 'LEG') {
    const t = TPL[type];
    let main = [...t.main];
    if (style === 'power') main.splice(t.power.at, 0, t.power.pat);
    const start = STR_START[dur] || STR_START[30];
    let cfg = { ...start };
    if (plan.rec || plan.phase === 'taper' || plan.phase === 'race') cfg.r = Math.max(1, cfg.r - 1);
    const rest = restFor(style, level);
    // pick a full ordered list once, then trim to fit time
    const wuAll = t.wu.map(s => mk(pickSlot(s, 1, ctx, used, rand), 1)).filter(Boolean);
    const mainAll = main.map(s => mk(pickSlot(s, level, ctx, used, rand), f)).filter(Boolean);
    const cdAll = t.cd.map(s => mk(pickSlot(s, Math.min(level, 2), ctx, used, rand), 1)).filter(Boolean);
    const est = c => {
      const wu = wuAll.slice(0, c.wu), mn = mainAll.slice(0, c.n), cd = cdAll.slice(0, c.cd);
      const s = wu.reduce((a, i) => a + itemSeconds(i.dose) + 5, 0)
        + c.r * mn.reduce((a, i) => a + itemSeconds(i.dose), 0) + (c.r * mn.length - 1) * rest + (c.r - 1) * 30
        + cd.reduce((a, i) => a + itemSeconds(i.dose) + 5, 0);
      return s / 60;
    };
    for (let k = 0; k < 8; k++) {
      const e = est(cfg);
      if (e > dur + 2) { if (cfg.n > 4) cfg.n--; else if (cfg.r > 1) cfg.r--; else if (cfg.wu > 2) cfg.wu--; else break; }
      else if (e < dur - 3) { if (cfg.n < mainAll.length && cfg.n < 8) cfg.n++; else if (cfg.r < 4) cfg.r++; else break; }
      else break;
    }
    cfg.n = Math.min(cfg.n, mainAll.length);
    blocks.push({ k: 'wu', rounds: 1, rest: 0, items: wuAll.slice(0, cfg.wu) });
    blocks.push({ k: 'main', rounds: cfg.r, rest, roundRest: rest + 30, items: mainAll.slice(0, cfg.n) });
    blocks.push({ k: 'cd', rounds: 1, rest: 0, items: cdAll.slice(0, cfg.cd) });
    return finish({ type, dur, style, level, blocks, key: slot.key, test: !!slot.test, travel });
  }
  if (type === 'MOB') {
    const [nr0, nm0, ns0] = MOB_COUNTS[dur] || MOB_COUNTS[30];
    const lvl = Math.min(level, 2);
    const rollAll = TPL.MOB.roll.map(s => mk(pickSlot(s, 1, ctx, used, rand), 1)).filter(Boolean);
    const mobAll = TPL.MOB.mob.map(s => mk(pickSlot(s, lvl, ctx, used, rand), 1)).filter(Boolean);
    const stabAll = TPL.MOB.stab.map(s => mk(pickSlot(s, lvl, ctx, used, rand), 1)).filter(Boolean);
    let c = { r: Math.min(nr0, rollAll.length), m: Math.min(mobAll.length, nm0 + Math.max(0, nr0 - rollAll.length)), s: Math.min(ns0, stabAll.length), f: 1, mr: 1 };
    const sc = (arr, n, f) => arr.slice(0, n).map(i => ({ ...i, dose: scaleDose(i.dose, f) }));
    const est = c => (sc(rollAll, c.r, c.f).concat(sc(stabAll, c.s, 1)).reduce((a, i) => a + itemSeconds(i.dose) + 5, 0)
      + c.mr * sc(mobAll, c.m, c.f).reduce((a, i) => a + itemSeconds(i.dose) + 5, 0)) / 60;
    for (let k = 0; k < 40; k++) {
      const e = est(c);
      if (e < dur - 2) {
        if (c.f < 1.35) c.f = Math.round((c.f + 0.15) * 100) / 100;
        else if (c.m < mobAll.length) c.m++;
        else if (c.r < rollAll.length) c.r++;
        else if (c.s < stabAll.length) c.s++;
        else if (c.f < 1.6) c.f = Math.round((c.f + 0.25) * 100) / 100;
        else if (c.mr < 2) { c.mr = 2; c.f = 1; }
        else break;
      } else if (e > dur + 2) {
        if (c.m > 3) c.m--; else if (c.mr > 1) c.mr = 1; else if (c.r > 1) c.r--; else if (c.s > 1) c.s--; else break;
      } else break;
    }
    if (c.r) blocks.push({ k: 'roll', rounds: 1, rest: 0, items: sc(rollAll, c.r, c.f) });
    blocks.push({ k: 'mob', rounds: c.mr, rest: 0, items: sc(mobAll, c.m, c.f) });
    blocks.push({ k: 'stab', rounds: 1, rest: 0, items: sc(stabAll, c.s, 1) });
    return finish({ type, dur, style: 'recovery', level, blocks, key: slot.key, test: false, travel });
  }
  // ACT (pre-race activation) and REC (post-ride recovery): fixed short lists
  const list = TPL[type].list.map(s => mk(pickSlot(s, Math.min(level, 2), ctx, used, rand), type === 'ACT' ? 0.8 : 1)).filter(Boolean);
  blocks.push({ k: type === 'ACT' ? 'act' : 'rec', rounds: type === 'ACT' ? 2 : 1, rest: 0, items: list });
  return finish({ type, dur: type === 'ACT' ? 12 : 15, style: type === 'ACT' ? 'power' : 'recovery', level, blocks, key: slot.key, test: false, travel });
}
function capDur(d, phase, type) {
  d = +d;
  if (phase === 'race') return Math.min(d, 15);
  if (phase === 'taper' && type !== 'MOB') return Math.min(d, 20);
  return d;
}
function finish(s) {
  let sec = 0;
  s.blocks.forEach(b => {
    const one = b.items.reduce((a, i) => a + itemSeconds(i.dose) + (b.rest ? 0 : 5), 0);
    sec += one * b.rounds + (b.rest ? (b.rounds * b.items.length - 1) * b.rest + (b.rounds - 1) * 30 : 0);
  });
  s.est = Math.max(5, Math.round(sec / 60));
  return s;
}

/* Alternatives for the swap button: same pattern, allowed, sorted by closeness in level. */
function swapOptions(p, id, level, travel) {
  const e = EXMAP[id]; const ctx = makeCtx(p, travel);
  return EX.filter(x => x.pat === e.pat && x.id !== id && allowed(x, ctx)).sort((a, b) => Math.abs(a.lvl - level) - Math.abs(b.lvl - level) || a.lvl - b.lvl);
}

/* ---------- baseline test → level (FIRST ESTIMATE thresholds; adjust after the test group) ---------- */
const TEST_THRESHOLDS = {
  T1: [15, 35],   // single-leg balance eyes closed, seconds (mean L/R): <15 → 1, 15–35 → 2, >35 → 3
  T3: [12, 25],   // single-leg bridge reps (mean L/R)
  T4: [60, 120],  // forearm plank, seconds
  T5: [30, 75]    // side plank, seconds (mean L/R)
};
function levelFromTest(t) {
  const v = {
    T1: avg(t.T1L, t.T1R), T3: avg(t.T3L, t.T3R), T4: num(t.T4), T5: avg(t.T5L, t.T5R)
  };
  const scores = Object.keys(TEST_THRESHOLDS).filter(k => v[k] != null).map(k => {
    const [a, b] = TEST_THRESHOLDS[k]; return v[k] < a ? 1 : v[k] <= b ? 2 : 3;
  });
  if (scores.length < 3) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
function num(x) { return x === undefined || x === null || x === '' ? null : +x; }
function avg(a, b) { a = num(a); b = num(b); if (a == null && b == null) return null; if (a == null) return b; if (b == null) return a; return (a + b) / 2; }

/* ---------- RPE → automatic adjustment ---------- */
function applyRpe(p, logs, type, rpe) {
  p.adj = p.adj || {};
  const cur = p.adj[type] || 0;
  if (type === 'MOB' || type === 'REC' || type === 'ACT') {
    if (rpe >= 7 && cur > -1) { p.adj[type] = cur - 1; return 'easier'; }
    return null;
  }
  if (rpe >= 9 && cur > -1) { p.adj[type] = cur - 1; return 'easier'; }
  if (rpe <= 4) {
    const prev = logs.filter(l => l.type === type).slice(-2, -1)[0];
    if (prev && prev.rpe <= 4 && cur < 1 && effLevel(p, type) < 3) { p.adj[type] = cur + 1; return 'harder'; }
  }
  return null;
}

/* ---------- calendar file ---------- */
function buildIcs(p, st, fromWeek, weeks, title, labelOf) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DynamCore//NL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const [hh, mm] = (p.icsTime || '19:00').split(':').map(Number);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  for (let w = Math.max(1, fromWeek); w < fromWeek + weeks; w++) {
    const plan = weekPlan(p, st, w);
    plan.slots.forEach(s => {
      if (s.skipped) return;
      const day = plan.monday + s.day; const d = DN.date(day);
      const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
      const dur = s.type === 'GROUP' ? 60 : buildSession(p, st, plan, s).est;
      const pad = x => String(x).padStart(2, '0');
      const endMin = hh * 60 + mm + dur;
      L.push('BEGIN:VEVENT', `UID:dynamcore-${p.start}-w${w}-${s.key}@dynamcore`, `DTSTAMP:${stamp}`,
        `DTSTART:${ymd}T${pad(hh)}${pad(mm)}00`, `DTEND:${ymd}T${pad(Math.floor(endMin / 60) % 24)}${pad(endMin % 60)}00`,
        `SUMMARY:${labelOf(s, w)}`, 'DESCRIPTION:DynamCore', 'END:VEVENT');
    });
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

/* ---------- equipment per session ---------- */
function sessionEquip(p, ses) {
  const ctx = makeCtx(p, ses.travel), out = [];
  ses.blocks.forEach(b => b.items.forEach(i => {
    const ex = EXMAP[i.id]; if (!ex.eq.length) return;
    const pick = ex.eq.find(x => x !== 'gym' && ctx.eq.has(x) && (p.eq || []).includes(x)) || ex.eq.find(x => ctx.eq.has(x)) || ex.eq[0];
    if (!out.includes(pick)) out.push(pick);
  }));
  const order = ['db', 'kb', 'band', 'miniband', 'roller', 'ball', 'swiss', 'bench', 'gym'];
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/* ---------- training load for Intervals.icu ----------
   load = load-per-hour x duration. Defaults follow the TSS logic (hours x IF^2 x 100) with an assumed
   intensity factor per session type: mobility 0,55 -> 30/h, activation 0,60 -> 36/h, core/legs 0,70 -> 49/h,
   group strength 0,75 -> 56/h, post-ride recovery 0,45 -> 20/h. FIRST ESTIMATE: the coach can change these in Settings. */
const LOAD_PER_HOUR = { CORE: 49, LEG: 49, MOB: 30, ACT: 36, REC: 20, GROUP: 56 };
function sessionLoad(p, type, minutes) {
  const per = (p.loadPerHour && +p.loadPerHour[type]) || LOAD_PER_HOUR[type] || 40;
  return Math.round(per * minutes / 60);
}
