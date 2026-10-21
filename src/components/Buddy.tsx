'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Muñeco que vive en la página: corre y salta sobre los bordes de 2px (hr, separadores),
 * y si haces clic en un enlace o botón salta hasta él y lo "presiona".
 * Todo es SVG + requestAnimationFrame, sin librerías.
 */
export function Buddy({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const q$ = (k: string) => svg.querySelector(`[data-p="${k}"]`)!;
    const legB = q$('legB'), armB = q$('armB'), torso = q$('torso'), legF = q$('legF'), armF = q$('armF');
    const head = q$('head'), ground = q$('ground'), g = q$('g');

    let lastPtr = 'mouse';
    let passing = false;
    type Seg = { x1: number; x2: number; y: number; floor?: boolean; temp?: boolean };
    const floor: Seg = { floor: true, x1: 24, get x2() { return innerWidth - 24; }, get y() { return scrollY + innerHeight - 10; } };
    let segs: Seg[] = [];
    type Pose = Record<'tL' | 'sL' | 'tR' | 'sR' | 'uL' | 'fL' | 'uR' | 'fR' | 'lean', number>;
    const s = {
      x: innerWidth * 0.7, y: 0, seg: floor, mode: 'run' as 'run' | 'idle' | 'jump' | 'press', tx: innerWidth * 0.4, face: -1, ph: 0, timer: 0, landK: 0,
      jump: null as null | { x0: number; y0: number; x1: number; sg: Seg; t: number; dur: number; h: number },
      task: null as null | { el: HTMLElement; fired: boolean },
      pose: { tL: 0, sL: 0, tR: 0, sR: 0, uL: 0, fL: 0, uR: 0, fR: 0, lean: 0 } as Pose,
      prev: performance.now(),
    };
    const vis = (sg: Seg) => { if (sg.floor) return true; const vy = sg.y - scrollY; return vy > 78 && vy < innerHeight - 14; };

    const scan = () => {
      const out: Seg[] = [], seen = new Set<string>(), sy = scrollY;
      root.querySelectorAll('*').forEach((el) => {
        if (el.closest('nav,[data-nobuddy]')) return;
        const r = el.getBoundingClientRect(); if (r.width < 80) return;
        const cs = getComputedStyle(el);
        const add = (y: number) => { const k = Math.round(y / 3) + '|' + Math.round(r.left / 12) + '|' + Math.round(r.right / 12); if (!seen.has(k)) { seen.add(k); out.push({ x1: r.left + 10, x2: r.right - 10, y: y + sy }); } };
        if (el.tagName === 'HR') return add(r.top);
        if (parseFloat(cs.borderTopWidth) >= 2 && cs.borderTopStyle !== 'none') add(r.top);
        if (parseFloat(cs.borderBottomWidth) >= 2 && cs.borderBottomStyle !== 'none') add(r.bottom - 1);
      });
      segs = out;
      if (s.seg && !s.seg.floor && !s.seg.temp && s.mode !== 'jump') {
        let best: Seg | null = null, bd = 8;
        for (const sg of segs) { const d = Math.abs(sg.y - s.y); if (d < bd && s.x >= sg.x1 - 4 && s.x <= sg.x2 + 4) { bd = d; best = sg; } }
        if (best) { s.seg = best; s.y = best.y; }
      }
    };
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const pickSeg = () => {
      const c = segs.filter((sg) => sg !== s.seg && vis(sg)); if (!c.length) return null;
      const w = c.map((sg) => { const cx = Math.max(sg.x1, Math.min(sg.x2, s.x)); return 1 / (1 + Math.hypot(cx - s.x, sg.y - s.y) / 220); });
      let r = Math.random() * w.reduce((p, q) => p + q, 0);
      for (let i = 0; i < c.length; i++) { r -= w[i]; if (r <= 0) return c[i]; }
      return c[0];
    };
    const startJump = (x1: number, sg: Seg, fast = false) => {
      const d = Math.hypot(x1 - s.x, sg.y - s.y);
      s.jump = { x0: s.x, y0: s.y, x1, sg, t: 0, dur: Math.min(fast ? 0.55 : 0.75, Math.max(0.3, 0.3 + d / 1500)), h: 26 + Math.min(50, d * 0.08) };
      if (Math.abs(x1 - s.x) > 2) s.face = x1 > s.x ? 1 : -1;
      s.mode = 'jump';
    };
    const nextMove = () => {
      const r = Math.random(), sg = r < 0.55 ? pickSeg() : null;
      if (sg) return startJump(rnd(sg.x1, sg.x2), sg);
      if (r < 0.88 || s.seg.temp) {
        const { x1, x2 } = s.seg; let tx = rnd(x1, x2);
        if (Math.abs(tx - s.x) < 80) tx = s.x < (x1 + x2) / 2 ? x2 - rnd(0, 40) : x1 + rnd(0, 40);
        s.tx = tx; s.mode = 'run'; return;
      }
      s.mode = 'idle'; s.timer = rnd(0.3, 0.9);
    };
    const goTask = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      s.task = { el, fired: false };
      startJump(r.left + r.width / 2, { temp: true, x1: r.left + 4, x2: r.right - 4, y: r.top + scrollY }, true);
    };
    const goPoint = (cx: number, cy: number) => {
      let best = floor, bd = Infinity;
      for (const sg of segs) { if (!vis(sg)) continue; const d = Math.abs(sg.y - scrollY - cy) + Math.max(0, sg.x1 - cx, cx - sg.x2) * 2; if (d < bd) { bd = d; best = sg; } }
      const x = Math.max(best.x1, Math.min(best.x2, cx));
      if (best === s.seg && s.mode !== 'jump') { s.tx = x; s.mode = 'run'; } else startJump(x, best, true);
    };

    const onPtr = (e: PointerEvent) => { lastPtr = e.pointerType; };
    const onClick = (e: MouseEvent) => {
      if (passing || e.detail === 0) return;
      const target = e.target as Element;
      if (!root.contains(target) || target.closest('[data-nobuddy],nav')) return;
      const el = target.closest<HTMLElement>('a,button');
      if (lastPtr === 'touch') return goPoint(e.clientX, e.clientY);
      // Enlaces que abren otra pestaña: se respeta el clic real (los navegadores bloquean popups diferidos).
      if (el && !(el instanceof HTMLAnchorElement && el.target === '_blank')) { e.preventDefault(); e.stopPropagation(); goTask(el); }
      else goPoint(e.clientX, e.clientY);
    };
    addEventListener('pointerdown', onPtr, true);
    addEventListener('click', onClick, true);
    addEventListener('resize', scan);
    scan();
    const t1 = setTimeout(scan, 400);
    const scanInt = setInterval(scan, 2500);
    { const sg = pickSeg(); if (sg) { s.seg = sg; s.x = rnd(sg.x1, sg.x2); } s.y = s.seg.y; s.tx = rnd(s.seg.x1, s.seg.x2); }

    const set = (el: Element, pts: number[][]) => el.setAttribute('points', pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    const pt = (o: number[], a: number, l: number) => [o[0] + Math.sin(a) * l, o[1] + Math.cos(a) * l];
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - s.prev) / 1000); s.prev = now;
      const T = {} as Pose;
      if (s.mode === 'run' || s.mode === 'idle') {
        if (s.seg.floor) s.y = floor.y;
        if (!vis(s.seg) && !s.seg.temp) { const sg = pickSeg(); if (sg) startJump(Math.max(sg.x1, Math.min(sg.x2, s.x)), sg); else { s.seg = floor; s.y = floor.y; } }
        else if (s.seg.temp && s.mode === 'run') { const sg = pickSeg() || floor; startJump(rnd(sg.x1, sg.x2), sg); }
        else if (s.seg.floor && segs.some(vis) && Math.random() < dt * 1.5) { const sg = pickSeg(); if (sg) startJump(rnd(sg.x1, sg.x2), sg); }
      }
      if (s.mode === 'run') {
        s.tx = Math.max(s.seg.x1, Math.min(s.seg.x2, s.tx));
        const dx = s.tx - s.x;
        if (Math.abs(dx) < 2) nextMove(); else { s.face = dx > 0 ? 1 : -1; s.x += Math.sign(dx) * Math.min(Math.abs(dx), 240 * dt); s.ph += dt * 15; }
        const sn = Math.sin(s.ph), cs = Math.cos(s.ph);
        Object.assign(T, { tL: sn * 0.85, tR: -sn * 0.85, uL: -sn * 0.9, uR: sn * 0.9, lean: 0.28 });
        T.sL = T.tL - (0.3 + Math.max(0, -cs)); T.sR = T.tR - (0.3 + Math.max(0, cs)); T.fL = T.uL + 1.3; T.fR = T.uR + 1.3;
      } else if (s.mode === 'idle') {
        s.timer -= dt; if (s.timer <= 0) nextMove(); else if (Math.random() < dt * 0.8) s.face *= -1;
        const br = Math.sin(now / 400) * 0.05;
        Object.assign(T, { tL: 0.12, sL: 0.08, tR: -0.1, sR: -0.14, uL: 0.18 + br, fL: 0.55 + br, uR: -0.15 - br, fR: 0.25, lean: 0.04 });
      } else if (s.mode === 'jump' && s.jump) {
        const j = s.jump; j.t += dt / j.dur; const k = Math.min(1, j.t);
        s.x = j.x0 + (j.x1 - j.x0) * k; s.y = j.y0 + (j.sg.y - j.y0) * k - j.h * 4 * k * (1 - k);
        if (k < 0.5) Object.assign(T, { tL: 1.15, sL: -0.25, tR: -0.45, sR: -1.5, uL: 2.5, fL: 2.7, uR: 2.9, fR: 3.1, lean: 0.35 });
        else Object.assign(T, { tL: 0.5, sL: 0.15, tR: 0.15, sR: -0.35, uL: 1.9, fL: 1.7, uR: -1.5, fR: -1.2, lean: 0.12 });
        if (k >= 1) {
          s.seg = j.sg; s.y = j.sg.y; s.x = j.x1; s.jump = null; s.landK = 1;
          if (s.task) { s.mode = 'press'; s.timer = 0; } else nextMove();
        }
      } else if (s.mode === 'press' && s.task) {
        s.timer += dt; const k = Math.sin(Math.PI * Math.min(1, s.timer / 0.32));
        Object.assign(T, { tL: 1.1 * k, sL: -1.1 * k, tR: 0.9 * k, sR: -1.2 * k, uL: 1.0 + 0.4 * k, fL: 0.2, uR: 0.9 + 0.4 * k, fR: 0.1, lean: 0.4 * k });
        if (s.timer > 0.14 && !s.task.fired) { s.task.fired = true; passing = true; try { s.task.el.click(); } finally { passing = false; } }
        if (s.timer >= 0.32) { s.task = null; s.mode = 'idle'; s.timer = 0.3; }
      }
      s.landK *= Math.exp(-dt * 9);
      if (s.landK > 0.02 && s.mode !== 'jump') { T.tL += 0.9 * s.landK; T.sL -= 0.9 * s.landK; T.tR += 0.8 * s.landK; T.sR -= 0.9 * s.landK; T.lean += 0.3 * s.landK; }
      const q = s.pose, lr = 1 - Math.exp(-dt * 28);
      for (const k in q) q[k as keyof Pose] += ((T[k as keyof Pose] ?? 0) - q[k as keyof Pose]) * lr;
      const legH = (t: number, sh: number) => Math.cos(t) * 9 + Math.cos(sh) * 9;
      const hy = s.mode === 'jump' ? -16 : -Math.max(legH(q.tL, q.sL), legH(q.tR, q.sR));
      const hip = [0, hy], neck = [Math.sin(q.lean) * 15, hy - Math.cos(q.lean) * 15];
      const kL = pt(hip, q.tL, 9), kR = pt(hip, q.tR, 9), eL = pt(neck, q.uL, 7.5), eR = pt(neck, q.uR, 7.5);
      set(legF, [hip, kL, pt(kL, q.sL, 9)]); set(legB, [hip, kR, pt(kR, q.sR, 9)]);
      set(armF, [neck, eL, pt(eL, q.fL, 7.5)]); set(armB, [neck, eR, pt(eR, q.fR, 7.5)]);
      set(torso, [hip, neck]);
      head.setAttribute('cx', (Math.sin(q.lean) * 21.5).toFixed(1)); head.setAttribute('cy', (hy - Math.cos(q.lean) * 21.5).toFixed(1));
      g.setAttribute('transform', `scale(${s.face} 1)`);
      ground.setAttribute('opacity', s.mode === 'jump' ? '0' : '0.18');
      svg.style.transform = `translate(${(s.x - 40).toFixed(1)}px,${(s.y - scrollY - 66).toFixed(1)}px)`;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); clearTimeout(t1); clearInterval(scanInt);
      removeEventListener('pointerdown', onPtr, true); removeEventListener('click', onClick, true); removeEventListener('resize', scan);
    };
  }, [rootRef]);

  return (
    <svg
      ref={svgRef}
      width={80}
      height={80}
      viewBox="-40 -66 80 80"
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 overflow-visible will-change-transform print:hidden"
    >
      <ellipse data-p="ground" cx={0} cy={1} rx={8} ry={1.6} fill="var(--fk-text)" opacity={0.18} />
      <g data-p="g" stroke="var(--fk-text)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline data-p="legB" />
        <polyline data-p="armB" />
        <polyline data-p="torso" />
        <polyline data-p="legF" />
        <polyline data-p="armF" />
        <circle data-p="head" r={5.5} fill="var(--fk-text)" stroke="none" />
      </g>
    </svg>
  );
}
