// Detailed pixel renderer: jointed skeleton (2-bone IK for arms/legs), outlines, shading, face, sneakers.
// Enabled per fighter with `detail: true` + `pal` in characters.js. Local coords: facing +x, feet at y=0, up is negative.
import { GROUND, ATK } from './fighter.js';
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const L1 = 15, L2 = 15, A1 = 12, A2 = 12;
function ik(x0, y0, x1, y1, l1, l2, mode) {            // returns joint (knee/elbow) and clamped end point
  let dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1; const m = l1 + l2 - .5;
  if (d > m) { x1 = x0 + dx * m / d; y1 = y0 + dy * m / d; dx = x1 - x0; dy = y1 - y0; d = m; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d; let px = -uy, py = ux;
  if (mode === 'x' ? px < 0 : py < 0) { px = -px; py = -py; }   // knees bend forward, elbows bend down
  return { j: [x0 + ux * a + px * h, y0 + uy * a + py * h], e: [x1, y1] };
}
export function drawDetailed(c, f, force) {
  const d = f.def, S = force || f.state, mv = d.moves[S], P = d.pal, t = f.t, atk = ATK.includes(S);
  const crouch = S === 'crouch' || S === 'clight' || S === 'cheavy' || (S === 'block' && f.crouch), air = S === 'jump' || S === 'jlight' || S === 'jheavy';
  const act = mv && t >= mv.s && t < mv.s + (mv.a || 0);
  const e = !mv ? 0 : act ? 1 : t < mv.s ? .3 * t / mv.s : mv.r ? Math.max(0, 1 - (t - mv.s - (mv.a || 0)) / mv.r) : 0;
  const ph = f.anim * .3, sn = Math.sin(ph), lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  let hip = [0, -30], lean = 2, aF = [10, -5], aB = [-10, -5], tilt = 0;
  if (S === 'idle') hip[1] += Math.round(Math.sin(f.anim * .12));
  if (S === 'walk') { aF = [10 + sn * 7, -5 - Math.max(0, Math.cos(ph)) * 4]; aB = [-10 - sn * 7, -5 - Math.max(0, -Math.cos(ph)) * 4]; hip[1] = -30 + Math.abs(sn); }
  if (crouch) { hip = [0, -14]; aF = [11, -5]; aB = [-11, -5]; lean = 3; }
  if (air) { hip = [0, -28]; aF = [8, -16]; aB = [-6, -12]; }
  if (S === 'heavy' || S === 'jheavy') lean = -3; if (S === 'cheavy') lean = -2;
  if (S === 'light' || S === 'special' || S === 'clight' || S === 'jlight') lean += 2 * e;
  if (S === 'hit' || S === 'lose') { lean = -6; hip = [-3, -28]; aB = [-14, -5]; tilt = -2; }
  if (S === 'win') hip[1] -= Math.round(Math.abs(Math.sin(t * .2)) * 4);
  const nx = hip[0] + lean, ny = hip[1] - 18, sx = nx, sy = ny + 3;
  let hF = [sx + 10, sy - 6], hB = [sx + 5, sy - 5]; if (crouch) { hF[1] += 3; hB[1] += 3; }
  if (S === 'light' || S === 'jlight') hF = lerp(hF, [sx + 23, sy + 1], e); if (S === 'clight') hF = lerp(hF, [sx + 23, sy + 4], e);
  if (S === 'special') { hF = lerp(hF, [sx + 23, sy + 2], e); hB = lerp(hB, [sx + 17, sy + 4], e); }
  if (S === 'heavy') aF = lerp(aF, [hip[0] + 27, hip[1] + 3], e); if (S === 'cheavy') aF = lerp(aF, [hip[0] + 27, -5], e); if (S === 'jheavy') aF = lerp(aF, [hip[0] + 22, hip[1] + 17], e);
  if (S === 'block') { hF = [sx + 8, sy - 9]; hB = [sx + 5, sy - 8]; }
  if (S === 'win') { hF = [sx + 9, sy - 25]; hB = [sx - 6, sy - 25]; }
  if (S === 'hit' || S === 'lose') { hF = [sx - 1, sy + 9]; hB = [sx - 7, sy + 8]; }
  const legF = ik(hip[0], hip[1], aF[0], aF[1], L1, L2, 'x'), legB = ik(hip[0], hip[1], aB[0], aB[1], L1, L2, 'x');
  const armF = ik(sx, sy, hF[0], hF[1], A1, A2, 'y'), armB = ik(sx, sy, hB[0], hB[1], A1, A2, 'y');
  const kicking = (S === 'heavy' || S === 'cheavy' || S === 'jheavy') && e > .3, hurt = S === 'hit', shout = atk && act;
  const paint = ol => {
    const r = (x, y, w, h, k) => R(c, x, y, w, h, ol ? P.ol : P[k]);
    const limb = (p, q, w, k) => { const dx = q[0] - p[0], dy = q[1] - p[1], n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
      for (let i = 0; i <= n; i++) R(c, Math.round(p[0] + dx * i / n - w / 2), Math.round(p[1] + dy * i / n - w / 2), w, w, ol ? P.ol : P[k]); };
    const shoe = (a, kick) => { const [x, y] = a.map(Math.round);
      if (kick) { r(x - 2, y - 4, 5, 8, 'red'); r(x + 3, y - 4, 1, 8, 'sole'); r(x + 1, y - 4, 2, 3, 'blk'); }
      else { r(x - 2, y - 3, 5, 4, 'red'); r(x - 2, y - 3, 5, 1, 'blk'); r(x - 3, y + 1, 10, 3, 'red'); r(x + 4, y + 1, 3, 3, 'blk'); r(x - 3, y + 4, 10, 1, 'sole'); r(x, y - 1, 2, 1, 'white'); } };
    const leg = (g, kick) => { limb(hip, g.j, 6, 'jean'); limb(g.j, g.e, 5, 'jean'); if (!ol) { limb([hip[0] + 2, hip[1] + 2], [g.j[0] + 2, g.j[1]], 1, 'jeanH'); r(g.j[0] - 2, g.j[1], 5, 1, 'jeanD'); } shoe(g.e, kick); };
    const arm = (g, k) => { limb([sx, sy], g.j, 5, k); limb(g.j, g.e, 4, k); if (!ol) limb(lerp(g.j, g.e, .7), g.e, 4, 'hoodDD');
      r(g.e[0] - 2, g.e[1] - 2, 4, 4, 'skin'); if (!ol) { r(g.e[0] - 2, g.e[1], 4, 1, 'skinS'); } };
    r(nx - 9, ny - 3, 6, 6, 'hoodD');                              // hood bunched behind the neck
    arm(armB, 'hoodD'); leg(legB, false); leg(legF, kicking);
    limb([hip[0], hip[1] + 2], [hip[0], hip[1] + 5], 12, 'jean');   // pelvis
    limb([hip[0], hip[1] - 2], [nx, ny + 2], 12, 'hood');           // hoodie torso
    if (!ol) { limb([hip[0] - 4, hip[1] - 2], [nx - 4, ny + 2], 4, 'hoodD'); limb([hip[0] + 3, hip[1] - 4], [nx + 3, ny + 5], 2, 'hoodL');
      r(hip[0] - 6, hip[1] - 1, 12, 3, 'hoodD'); r(hip[0] - 4 + lean * .3, hip[1] - 9, 9, 6, 'hoodD'); r(hip[0] - 4 + lean * .3, hip[1] - 9, 9, 1, 'hoodDD');
      r(nx - 1, ny + 4, 1, 6, 'white'); r(nx + 3, ny + 4, 1, 6, 'white'); }
    const hx = nx - 4 + tilt, hy = ny - 10;                         // head
    r(hx, hy, 10, 10, 'skin'); if (!ol) { r(hx, hy + 8, 10, 2, 'skinS'); r(hx + 1, hy + 4, 2, 3, 'skinS'); r(hx + 10, hy + 6, 1, 2, 'skin');
      if (hurt) { r(hx + 5, hy + 5, 4, 1, 'eye'); r(hx + 5, hy + 2, 5, 1, 'hair'); } else { r(hx + 5, hy + 4, 4, 3, 'white'); r(hx + 7, hy + 4, 2, 3, 'eye'); r(hx + 5, hy + 2, 5, 1, 'hair'); r(hx + 8, hy + 3, 2, 1, 'hair'); }
      if (hurt || shout) r(hx + 5, hy + 7, 4, 2, 'mouth'); else r(hx + 6, hy + 8, 3, 1, 'mouth'); }
    r(hx - 1, hy - 3, 12, 5, 'hair'); r(hx + 2, hy - 5, 7, 3, 'hair'); r(hx + 7, hy - 4, 4, 3, 'hair'); r(hx + 5, hy - 1, 6, 3, 'hair'); r(hx - 1, hy, 3, 5, 'hair'); r(hx - 1, hy + 4, 2, 3, 'hair');
    if (!ol) { r(hx + 3, hy - 5, 4, 1, 'hairH'); r(hx + 8, hy - 4, 2, 1, 'hairH'); r(hx + 1, hy - 2, 7, 1, 'hairH'); }
    r(nx - 6, ny, 12, 2, 'hoodD'); if (!ol) r(nx - 6, ny, 12, 1, 'hoodDD');   // collar
    arm(armF, 'hood');
  };
  c.save(); c.translate(Math.round(f.x), Math.round(GROUND - f.y)); c.scale(f.facing, 1);
  if (S === 'lose') { const p = Math.min(1, t / 20); c.translate(-8 * p, -8 * p); c.rotate(-Math.PI / 2 * p); }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { c.save(); c.translate(dx, dy); paint(true); c.restore(); }
  paint(false); c.restore();
}
