'use strict';
/* DynamCore – exercise animations (own work, DynamVic). Side-view stick figure, near side dark, far side grey.
   Pose = [tl, tu, hd, nUA, nFA, nTH, nSH, fUA, fFA, fTH, fSH]: absolute segment angles in degrees
   (0 = right, 90 = up): lower trunk, upper trunk, head (relative to upper trunk), near upper arm, forearm, thigh, shin, far ditto.
   The figure is placed on the ground automatically and centred. Props: ball, roller, miniband, db, wall, box, band, pulse. */
const SEG = { tl: 30, tu: 30, ua: 24, fa: 22, th: 46, sh: 44, head: 15, hr: 9 };
const ANIM = {
  // ---- round 1 (20 most used) ----
  M01: { f: [[-10, 10, 30, -90, -90, -90, 180, -90, -90, -90, 180], [22, -22, -70, -90, -90, -90, 180, -90, -90, -90, 180]] },
  M12: { f: [[90, 90, 0, 180, 90, -100, -90, -90, -90, -75, -95], [84, 80, 0, 180, 90, -105, -92, -90, -90, -70, -98]], props: [{ t: 'wall', at: 'ne', dx: -3, fixed: true }] },
  C02: { f: [[0, 0, 0, -90, -90, -90, 180, -90, -90, -90, 180], [0, 0, 5, -90, -90, 180, 180, 8, 8, -90, 180]] },
  H01: { f: [[180, 180, 0, 0, 0, 58, -62, 0, 0, 58, -62], [205, 200, 0, 0, 0, 25, -85, 0, 0, 25, -85]] },
  H11: { f: [[180, 180, 0, 0, 0, 58, -62, 0, 0, 58, -62], [205, 200, 0, 0, 0, 25, -85, 0, 0, 25, -85]], props: [{ t: 'miniband', at: 'nk' }] },
  M13: { f: [[80, 82, 0, -80, -60, -90, 100, -80, -60, -5, -90], [90, 92, 0, -80, -60, -72, 112, -80, -60, 0, -90]], props: [{ t: 'box', at: 'nf', side: 'left', w: 34, fixed: true }] },
  M09: { f: [[180, 180, 0, 40, 20, 60, -40, 40, 20, 45, 0], [180, 180, 0, 55, 30, 80, -20, 55, 30, 62, 10]] },
  M04: { f: [[-15, -5, 0, -90, -90, -15, -90, -90, -90, -140, -140], [-15, -5, 70, -90, -90, -15, -90, 90, 90, -140, -140]] },
  S03: { f: [[180, 180, 0, -5, -30, 90, 0, -5, -30, 90, 0], [180, 180, 0, -5, -30, 90, 0, -5, -30, 90, 0]], props: [{ t: 'box', at: 'nf', side: 'under', w: 30, fixed: true }, { t: 'pulse', at: 'mid', r: [4, 11] }], period: 10 },
  C05: { f: [[90, 90, 0, -60, 0, -95, -85, -60, 0, -85, -95], [90, 90, 0, -5, -5, -95, -85, -5, -5, -85, -95]], props: [{ t: 'band', from: 'sh', dx: -40, dy: 0, to: 'nh' }] },
  M05: { f: [[90, 90, 0, -110, 20, -90, 180, -110, 20, 0, -90], [92, 95, 0, -110, 20, -70, 180, -110, 20, 0, -90]] },
  M18: { f: [[50, 60, 0, -100, -90, -10, 180, -100, -90, 182, 180], [20, 5, -20, -30, 0, -10, 180, -30, 0, 182, 180]] },
  M16: { f: [[75, 75, 0, 10, 10, -110, -110, 10, 10, -70, -95], [72, 72, 0, 10, 10, -100, -125, 10, 10, -70, -95]], props: [{ t: 'wall', at: 'nh', dx: 4, fixed: true }] },
  M06: { f: [[95, 95, 0, -120, -110, 25, -60, -120, -110, 20, -70], [95, 95, 0, -120, -110, 155, -120, -120, -110, 160, -110]] },
  M08: { f: [[85, 90, 0, -90, -90, -20, 180, -90, -90, -20, 180], [-5, -25, -10, -5, 0, -20, 180, -5, 0, -20, 180]] },
  C01: { f: [[180, 180, 0, 90, 90, 90, 0, 90, 90, 90, 0], [180, 180, 0, 90, 90, 5, 0, 170, 175, 90, 0]] },
  F02: { f: [[110, 105, 0, -130, -110, 30, -70, -130, -110, 40, -5], [100, 98, 0, -130, -110, 40, -65, -130, -110, 50, 0]], props: [{ t: 'ball', at: 'hip', r: 6 }] },
  C03: { f: [[9, 9, 0, -90, 0, 189, 189, -90, 0, 189, 189], [9, 9, 0, -90, 0, 189, 189, -90, 0, 189, 189]] },
  F03: { f: [[160, 172, 0, 60, -60, 45, -75, 60, -60, 45, -75], [168, 176, 0, 60, -60, 58, -70, 60, -60, 58, -70]], props: [{ t: 'roller', at: 'mid2', r: 9 }] },
  R01: { f: [[0, 3, 0, 10, 10, 180, 180, 10, 10, 180, 180], [0, 6, 0, 150, 60, 180, 180, 150, 60, 180, 180]] }
};

const ANIMV = (() => {
  const d2r = Math.PI / 180, dir = (a, L) => [Math.cos(a * d2r) * L, Math.sin(a * d2r) * L];
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
  function joints(q) {
    const [tl, tu, hd, nua, nfa, nth, nsh, fua, ffa, fth, fsh] = q, hip = [0, 0];
    const mid = add(hip, dir(tl, SEG.tl)), sh = add(mid, dir(tu, SEG.tu));
    const mid2 = add(mid, dir(tu, SEG.tu * 0.45));
    const head = add(sh, dir(tu + hd, SEG.head));
    const ne = add(sh, dir(nua, SEG.ua)), nh = add(ne, dir(nfa, SEG.fa)), fe = add(sh, dir(fua, SEG.ua)), fh = add(fe, dir(ffa, SEG.fa));
    const nk = add(hip, dir(nth, SEG.th)), nf = add(nk, dir(nsh, SEG.sh)), fk = add(hip, dir(fth, SEG.th)), ff = add(fk, dir(fsh, SEG.sh));
    return { hip, mid, mid2, sh, head, ne, nh, fe, fh, nk, nf, fk, ff };
  }
  const G = 152;
  // to screen: flip y, ground the lowest point (including props under the body) on G
  function place(j, props) {
    const s = {}; for (const k in j) s[k] = [j[k][0], -j[k][1]];
    let low = -Infinity;
    for (const k in s) { const r = k === 'head' ? SEG.hr : 4; low = Math.max(low, s[k][1] + r); }
    (props || []).forEach(p => { if ((p.t === 'ball' || p.t === 'roller') && s[p.at]) low = Math.max(low, s[p.at][1] + 5 + 2 * p.r); });
    const dy = G - low; for (const k in s) s[k] = [s[k][0], s[k][1] + dy];
    return s;
  }
  const cache = {};
  function prep(id) {
    if (cache[id]) return cache[id];
    const a = ANIM[id]; if (!a) return null;
    const fr = a.f.map(q => place(joints(q), a.props));
    let minx = Infinity, maxx = -Infinity;
    fr.forEach(s => { for (const k in s) { minx = Math.min(minx, s[k][0] - 10); maxx = Math.max(maxx, s[k][0] + 10); } });
    (a.props || []).forEach(p => { if (p.t === 'band') minx = Math.min(minx, fr[0][p.from][0] + p.dx - 6); if (p.t === 'box') { const x = fr[0][p.at][0]; minx = Math.min(minx, x - p.w); maxx = Math.max(maxx, x + p.w / 2); } });
    const ox = 120 - (minx + maxx) / 2;
    let miny = Infinity; fr.forEach(s2 => { for (const k in s2) miny = Math.min(miny, s2[k][1] - (k === 'head' ? SEG.hr : 6)); });
    (a.props || []).forEach(p => { if (p.t === 'wall') miny = Math.min(miny, G - 120); });
    const top = Math.floor(Math.min(miny - 8, G - 90));
    return (cache[id] = { a, ox, f0: fr[0], vb: `0 ${top} 240 ${G + 8 - top}` });
  }
  let colors = null;
  const readColors = () => { const cs = getComputedStyle(document.documentElement); colors = { fg: cs.getPropertyValue('--fg').trim() || '#111', far: cs.getPropertyValue('--far').trim() || '#A7ACB6', gr: cs.getPropertyValue('--line').trim() || '#ccc', ac: cs.getPropertyValue('--accent').trim() || '#2448C8' }; };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors = null; }); } catch (e) { }
  function render(id, t) {
    const P = prep(id); if (!P) return '';
    if (!colors) readColors();
    const { a, ox, f0 } = P, f = a.f;
    const q = f[0].map((v, i) => v + (f[1][i] - v) * t);
    const s = place(joints(q), a.props); for (const k in s) s[k][0] += ox;
    const z = {}; for (const k in f0) z[k] = [f0[k][0] + ox, f0[k][1]];
    const c = colors, L = (p, q2, col, w) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q2[0].toFixed(1)}" y2="${q2[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    let back = '', front = '';
    (a.props || []).forEach(p => {
      const at = p.fixed ? z[p.at] : s[p.at];
      if (p.t === 'wall') back += `<line x1="${at[0] + p.dx}" y1="${G}" x2="${at[0] + p.dx}" y2="${G - 120}" stroke="${c.far}" stroke-width="4" stroke-linecap="round"/>`;
      if (p.t === 'box') { const top = at[1] + 4, x = p.side === 'left' ? at[0] - p.w + 4 : at[0] - p.w / 2; back += `<rect x="${x}" y="${top}" width="${p.w}" height="${Math.max(4, G - top)}" rx="3" fill="none" stroke="${c.far}" stroke-width="3"/>`; }
      if (p.t === 'ball') back += `<circle cx="${at[0]}" cy="${at[1] + 5 + p.r}" r="${p.r}" fill="${c.ac}"/>`;
      if (p.t === 'roller') back += `<circle cx="${at[0]}" cy="${at[1] + 5 + p.r}" r="${p.r}" fill="none" stroke="${c.ac}" stroke-width="3"/><circle cx="${at[0]}" cy="${at[1] + 5 + p.r}" r="3" fill="${c.ac}"/>`;
      if (p.t === 'band') { const fr = z[p.from], to = s[p.to]; back += `<line x1="${fr[0] + p.dx}" y1="${G}" x2="${fr[0] + p.dx}" y2="${fr[1] + p.dy - 10}" stroke="${c.far}" stroke-width="4" stroke-linecap="round"/>`; front += `<line x1="${fr[0] + p.dx}" y1="${fr[1] + p.dy}" x2="${to[0]}" y2="${to[1]}" stroke="${c.ac}" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>`; }
      if (p.t === 'miniband') front += `<ellipse cx="${at[0]}" cy="${at[1]}" rx="9" ry="5" fill="none" stroke="${c.ac}" stroke-width="3"/>`;
      if (p.t === 'db') front += `<rect x="${at[0] - 9}" y="${at[1] - 4}" width="18" height="8" rx="3" fill="${c.ac}"/>`;
      if (p.t === 'pulse') { const r = p.r[0] + (p.r[1] - p.r[0]) * t; front += `<circle cx="${at[0]}" cy="${at[1] - 10}" r="${r.toFixed(1)}" fill="${c.ac}" fill-opacity=".35"/>`; }
    });
    return `<line x1="6" y1="${G + 2}" x2="234" y2="${G + 2}" stroke="${c.gr}" stroke-width="2"/>` + back
      + L(s.sh, s.fe, c.far, 7) + L(s.fe, s.fh, c.far, 7) + L(s.hip, s.fk, c.far, 8) + L(s.fk, s.ff, c.far, 8)
      + L(s.hip, s.mid, c.fg, 11) + L(s.mid, s.sh, c.fg, 11)
      + L(s.hip, s.nk, c.fg, 8) + L(s.nk, s.nf, c.fg, 8) + L(s.sh, s.ne, c.fg, 7) + L(s.ne, s.nh, c.fg, 7)
      + `<circle cx="${s.head[0].toFixed(1)}" cy="${s.head[1].toFixed(1)}" r="${SEG.hr}" fill="${c.fg}"/>` + front;
  }
  const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  function phase(ts, period) { const c = (ts / (period * 1000)) % 1; const x = c < .35 ? c / .35 : c < .5 ? 1 : c < .85 ? 1 - (c - .5) / .35 : 0; return ease(x); }
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const visible = new Set();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); })) : null;
  const seen = new WeakSet();
  function loop(ts) {
    document.querySelectorAll('svg.anim').forEach(el => { if (!seen.has(el)) { seen.add(el); if (io) io.observe(el); else visible.add(el); el.innerHTML = render(el.dataset.anim, 1); } });
    if (!reduce) visible.forEach(el => { if (!el.isConnected) { visible.delete(el); return; } const a = ANIM[el.dataset.anim]; el.innerHTML = render(el.dataset.anim, phase(ts, (a && a.period) || 3.2)); });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { has: id => !!ANIM[id], svg: (id, cls = '') => ANIM[id] ? `<svg class="anim ${cls}" data-anim="${id}" viewBox="${prep(id).vb}" aria-hidden="true"></svg>` : '', render, prep };
})();
