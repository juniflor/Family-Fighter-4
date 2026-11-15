import { CHARACTERS, ROSTER } from './characters.js';
import { Fighter, GROUND } from './fighter.js';
import { drawFighter, drawStage, shadow } from './sprites.js';
import { poll, pressed, held, hit, endFrame, padCount, padStatus, takeEvents } from './input.js';
import { makeAI, aiThink } from './ai.js';
import { audio } from './audio.js';

const cv = document.getElementById('c'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
const saved = (() => { try { return JSON.parse(localStorage.getItem('pixelfighter')) || {}; } catch { return {}; } })();
const S = { sound: saved.sound ?? true, mode: saved.mode ?? 'pvp', sel: saved.sel ?? [0, 1] };
const save = () => { try { localStorage.setItem('pixelfighter', JSON.stringify(S)); } catch {} };
audio.setOn(S.sound);
addEventListener('pointerdown', () => audio.init(), { once: true });
addEventListener('keydown', () => audio.init(), { once: true });

let scene = 'menu', sel = 0, M = null, lock = [false, false], goT = 0, paused = false;
const txt = (s, x, y, size = 8, col = '#fff', al = 'center') => { c.font = `bold ${size}px monospace`; c.textAlign = al; c.fillStyle = '#000'; c.fillText(s, x + 1, y + 1); c.fillStyle = col; c.fillText(s, x, y); };
const LISTS = {
  menu: () => ['VERSUS MODE', 'CONTROLS', 'SOUND: ' + (S.sound ? 'ON' : 'OFF')],
  versus: () => ['PLAYER vs PLAYER', 'PLAYER vs CPU', 'BACK'],
  results: () => ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'],
};
const go = s => { scene = s; sel = 0; };
function activate(i) {
  audio.sfx('beep');
  if (scene === 'menu') { if (i === 0) go('versus'); else if (i === 1) go('controls'); else { S.sound = !S.sound; audio.setOn(S.sound); save(); } }
  else if (scene === 'versus') { if (i === 2) go('menu'); else { S.mode = i ? 'cpu' : 'pvp'; save(); lock = [false, false]; goT = 0; go('select'); } }
  else if (scene === 'results') { if (i === 0) startMatch(); else if (i === 1) { lock = [false, false]; goT = 0; go('select'); } else go('menu'); }
}
cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), y = (e.clientY - r.top) * 270 / r.height;
  if (scene === 'controls') return go('menu'); const l = LISTS[scene]?.(); if (!l) return;
  const i = Math.floor((y - (scene === 'results' ? 168 : 128)) / 22); if (i >= 0 && i < l.length) activate(i); });
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(), y = (e.clientY - r.top) * 270 / r.height, l = LISTS[scene]?.();
  if (l) { const i = Math.floor((y - (scene === 'results' ? 168 : 128)) / 22); if (i >= 0 && i < l.length) sel = i; } });

const any = a => pressed(0, a) || pressed(1, a);
function startMatch() {
  const ids = [ROSTER[S.sel[0]], ROSTER[S.sel[1]]];
  M = { cpu: S.mode === 'cpu', ids, wins: [0, 0], round: 1, phase: 'intro', pt: 0, timer: 7200, fx_: [], projs: [], ai: makeAI(), msg: '', winner: -1, over: false,
    sfx: n => audio.sfx(n),
    fx(x, y, col, snd) { audio.sfx(snd); for (let i = 0; i < 8; i++) this.fx_.push({ x, y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .7) * 3, l: 14, col }); },
    shoot(o, mv) { this.projs.push({ x: o.x + o.facing * 14, y: GROUND - o.y - o.def.h * .6, vx: o.facing * mv.speed, facing: o.facing, o, mv }); } };
  newRound(); scene = 'match'; paused = false;
}
function newRound() {
  M.f = [new Fighter('p1', CHARACTERS[M.ids[0]], 150, 1), new Fighter('p2', CHARACTERS[M.ids[1]], 330, -1)];
  M.f.forEach(f => f.def.id = f.def.id || null); M.timer = 7200; M.phase = 'intro'; M.pt = 0; M.projs = []; M.msg = 'ROUND ' + M.round;
}
const intent = p => ({ left: held(p, 'left'), right: held(p, 'right'), up: held(p, 'up'), down: held(p, 'down'), block: held(p, 'block'),
  lightP: pressed(p, 'light'), heavyP: pressed(p, 'heavy'), specialP: pressed(p, 'special') });
function endRound(ko) {
  const [a, b] = M.f; M.phase = 'end'; M.pt = 0; audio.sfx('ko');
  const w = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1; M.rw = w; M.msg = w < 0 ? 'DRAW' : ko ? 'K.O.' : 'TIME UP';
  if (w >= 0) { M.wins[w]++; M.f[w].set('win'); M.f[1 - w].set('lose'); }
}
function matchUpdate() {
  if (hit('KeyP')) paused = !paused; if (hit('Escape')) return go('menu');
  if (paused) return; const m = M, [a, b] = m.f; m.pt++;
  if (m.phase === 'intro' && m.pt > 100) { m.phase = 'fight'; m.pt = 0; m.msg = 'FIGHT!'; audio.sfx('beep'); }
  if (m.phase === 'fight' && m.pt > 50) m.msg = '';
  const ia = intent(0), ib = m.cpu ? aiThink(m.ai, b, a) : intent(1);
  a.update(ia, b, m); b.update(ib, a, m);
  const dx = b.x - a.x, ov = (a.def.w + b.def.w) / 2 - Math.abs(dx);
  if (ov > 0 && a.y < 30 && b.y < 30) { const s = dx >= 0 ? 1 : -1; a.x -= s * ov / 2; b.x += s * ov / 2; }
  for (const p of m.projs) { p.x += p.vx; const t = p.o === a ? b : a, h = t.hurt(), hs = (p.mv.size || 10) / 2;
    if (p.x + hs > h.l && p.x - hs < h.r && p.y + hs > h.t && p.y - hs < h.b) { p.dead = true; t.receive(p, p.mv, m); } if (p.x < -10 || p.x > 490) p.dead = true; }
  m.projs = m.projs.filter(p => !p.dead);
  m.fx_.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .15; p.l--; }); m.fx_ = m.fx_.filter(p => p.l > 0);
  if (m.phase === 'fight') { m.timer--; if (a.hp <= 0 || b.hp <= 0) endRound(true); else if (m.timer <= 0) endRound(false); }
  else if (m.phase === 'end' && m.pt > 150) {
    const w = m.wins.findIndex(x => x >= 2);
    if (w >= 0) { m.winner = w; m.phase = 'over'; scene = 'results'; sel = 0; } else { if (m.rw >= 0 || true) m.round++; newRound(); } }
}
function drawHUD() {
  const m = M;
  m.f.forEach((f, i) => { const x = i ? 262 : 18, w = 200; c.fillStyle = '#000'; c.fillRect(x - 2, 14, w + 4, 12);
    c.fillStyle = '#a22'; const sw = w * Math.max(0, f.shown) / f.def.hp; c.fillStyle = '#a22'; c.fillRect(i ? x + w - sw : x, 16, sw, 8);
    c.fillStyle = f.hp / f.def.hp > .3 ? '#3d6' : '#ee3'; const hw = w * Math.max(0, f.hp) / f.def.hp; c.fillRect(i ? x + w - hw : x, 16, hw, 8);
    txt((i ? (m.cpu ? 'CPU ' : 'P2 ') : 'P1 ') + f.def.name, i ? x + w : x, 38, 8, '#fff', i ? 'right' : 'left');
    for (let k = 0; k < 2; k++) { c.fillStyle = k < m.wins[i] ? '#fc3' : '#333'; c.fillRect(i ? x + k * 10 : x + w - 8 - k * 10, 42, 8, 5); } });
  txt(String(Math.ceil(m.timer / 60)).padStart(2, '0'), 240, 28, 16, '#fff');
  if (m.msg) txt(m.msg, 240, 110, 24, '#fc3');
  if (paused) txt('PAUSED  (P resume, Esc quit)', 240, 140, 10);
}
function drawMatch() {
  drawStage(c); M.f.forEach(f => shadow(c, f));
  const order = M.f[0].state === 'lose' ? [0, 1] : [1, 0]; order.forEach(i => drawFighter(c, M.f[i]));
  M.projs.forEach(p => { const z = p.mv.size || 10; c.globalAlpha = z > 10 ? .75 : 1; c.fillStyle = p.mv.col; c.fillRect(p.x - z / 2, p.y - z * .4, z, z * .8); c.fillStyle = '#fff'; c.fillRect(p.x - 2, p.y - 2, 4, 4); c.globalAlpha = 1; });
  M.fx_.forEach(p => { c.fillStyle = p.col; c.fillRect(p.x, p.y, 3, 3); }); drawHUD();
}
function drawList(y) { LISTS[scene]().forEach((s, i) => txt((i === sel ? '> ' : '  ') + s + (i === sel ? ' <' : '  '), 240, y + i * 22 + 12, 12, i === sel ? '#fc3' : '#fff')); }
function menuNav() {
  const l = LISTS[scene]?.(); if (!l) return;
  if (any('up')) sel = (sel + l.length - 1) % l.length; if (any('down')) sel = (sel + 1) % l.length;
  if (any('light') || hit('Enter') || hit('Space')) activate(sel);
  if (hit('Escape') && scene !== 'results') go(scene === 'versus' ? 'menu' : 'menu');
}
function selectUpdate() {
  if (hit('Escape')) return go('versus');
  for (let p = 0; p < 2; p++) { if (p === 1 && S.mode === 'cpu') continue; if (lock[p]) { if (pressed(p, 'heavy')) lock[p] = false; continue; }
    if (pressed(p, 'left')) S.sel[p] = (S.sel[p] + ROSTER.length - 1) % ROSTER.length; if (pressed(p, 'right')) S.sel[p] = (S.sel[p] + 1) % ROSTER.length;
    if (pressed(p, 'light') || (p === 0 && (hit('Enter') || hit('Space')))) { lock[p] = true; audio.sfx('beep'); }
    if (p === 0 && pressed(0, 'heavy') && false) go('versus'); }
  if (S.mode === 'cpu') { if (lock[0] && !lock[1]) { S.sel[1] = Math.floor(Math.random() * ROSTER.length); lock[1] = true; } if (!lock[0]) lock[1] = false; }
  if (lock[0] && lock[1]) { if (++goT > 45) { save(); startMatch(); } } else goT = 0;
}
function drawSelect() {
  drawStage(c); txt('SELECT YOUR FIGHTER', 240, 34, 16, '#fc3');
  for (let p = 0; p < 2; p++) { const cx = p ? 360 : 120, id = ROSTER[S.sel[p]], def = CHARACTERS[id];
    txt(p ? (S.mode === 'cpu' ? 'CPU' : 'PLAYER 2') : 'PLAYER 1', cx, 60, 10, p ? '#f77' : '#7ef');
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(cx - 50, 70, 100, 130); const f = { def, x: cx, y: 0, facing: p ? -1 : 1, state: 'idle', t: 0, anim: performance.now() / 16 | 0 };
    c.save(); c.translate(0, -GROUND + 190); drawFighter(c, f); c.restore();
    txt((lock[p] ? '' : '< ') + def.name + (lock[p] ? ' READY' : ' >'), cx, 218, 10, lock[p] ? '#3f6' : '#fff'); }
  for (let p = 0; p < 2; p++) { const st = CHARACTERS[ROSTER[S.sel[p]]].stats, cx = p ? 360 : 120; txt('SPD ' + st.spd + '  ATK ' + st.atk + '  HP ' + st.hp, cx, 228, 7, '#fc3'); }
  const tw = 18, x0 = 240 - ROSTER.length * tw / 2;
  ROSTER.forEach((id, i) => { const d = CHARACTERS[id], x = x0 + i * tw; c.fillStyle = '#000'; c.fillRect(x, 233, 16, 16);
    c.fillStyle = d.top; c.fillRect(x + 2, 241, 12, 6); c.fillStyle = d.skin; c.fillRect(x + 4, 236, 8, 6); c.fillStyle = d.hair; c.fillRect(x + 3, 235, 10, 3);
    if (S.sel[0] === i) { c.strokeStyle = '#7ef'; c.strokeRect(x + .5, 233.5, 15, 15); } if (S.sel[1] === i) { c.strokeStyle = '#f77'; c.strokeRect(x + 2.5, 235.5, 11, 11); } });
  txt('MOVE: left/right   CONFIRM: Light   CANCEL: Heavy   ESC: back', 240, 262, 7, '#ccc'); txt(padStatus(), 240, 12, 7, '#8f8');
}
function drawControls() {
  drawStage(c); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(30, 20, 420, 230); txt('CONTROLS', 240, 44, 16, '#fc3');
  ['P1: A/D move  W jump  S crouch  F light  G heavy  R special  LShift block', 'P2: Arrows move/jump/crouch  Num1 light  Num2 heavy  Num3 special  Num0 block',
   'Gamepads auto-assign (pad1=P1, pad2=P2); Back/Select swaps; mix with keyboard', 'D-pad/stick move, A light, X heavy, Y special, B jump, bumpers block', 'P pause   M sound   Esc back', 'Win 2 of 3 rounds. 2 min per round.', '', 'Press any key / click to return']
    .forEach((s, i) => txt(s, 240, 76 + i * 20, 8));
  if (hit('Escape') || hit('Enter') || hit('Space') || any('light')) go('menu');
}
const toasts = [];
function frame() {
  poll(); for (const e of takeEvents()) { toasts.push({ s: e.text, t: 240 }); if (e.type === 'off' && scene === 'match') paused = true; } if (hit('KeyM')) { S.sound = !S.sound; audio.setOn(S.sound); save(); }
  if (scene === 'match') { matchUpdate(); if (scene === 'match') drawMatch(); }
  if (scene === 'menu') { drawStage(c); txt('PIXEL FIGHTER', 240, 70, 28, '#fc3'); txt('JUNIOR vs MARTY', 240, 92, 10, '#7ef'); drawList(128); menuNav(); }
  else if (scene === 'versus') { drawStage(c); txt('VERSUS MODE', 240, 70, 20, '#fc3'); drawList(128); menuNav(); }
  else if (scene === 'select') { selectUpdate(); if (scene === 'select') drawSelect(); }
  else if (scene === 'controls') drawControls();
  else if (scene === 'results') { matchUpdate_results(); }
  if (scene === 'menu' || scene === 'versus') txt(padStatus(), 240, 262, 7, '#8f8');
  if (toasts.length) { const k = toasts[0]; c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(60, 252, 360, 14); txt(k.s, 240, 262, 8, '#fc3'); if (--k.t <= 0) toasts.shift(); }
  endFrame();
}
function matchUpdate_results() {
  const m = M, [a, b] = m.f; m.phase = 'over'; a.update({}, b, m); b.update({}, a, m); m.fx_ = [];
  drawStage(c); m.f.forEach(f => shadow(c, f)); m.f.forEach(f => drawFighter(c, f));
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(120, 40, 240, 190);
  txt(m.winner === 0 ? 'PLAYER 1 WINS!' : m.cpu ? 'CPU WINS!' : 'PLAYER 2 WINS!', 240, 78, 16, '#fc3');
  txt(m.f[m.winner].def.name + '  ' + m.wins[0] + ' - ' + m.wins[1], 240, 100, 10, '#fff'); drawList(168); menuNav();
}
let last = performance.now(), acc = 0;
function loop(t) { acc += Math.min(100, t - last); last = t; while (acc >= 1000 / 60) { frame(); acc -= 1000 / 60; } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
