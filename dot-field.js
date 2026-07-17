/**
 * DotField – Vanilla JS port of the React Bits DotField component.
 * Integrates as the interactive dot-grid background for the website.
 */
(function () {
  'use strict';

  // Config matching props table
  const CFG = {
    dotRadius     : 1.5,
    dotSpacing    : 14,
    cursorRadius  : 500,
    cursorForce   : 0.1,
    bulgeOnly     : true,
    bulgeStrength : 67,
    glowRadius    : 160,
    sparkle       : false,
    waveAmplitude : 0,
    gradientFrom  : 'rgba(0, 212, 255, 0.22)',  // Matches user's cyan color palette
    gradientTo    : 'rgba(0, 153, 255, 0.10)',  // Matches user's blue color palette
    glowColor     : 'rgba(0, 212, 255, 0.12)',  // Radial glow color that follows the cursor
  };

  const TWO_PI = Math.PI * 2;

  // Insert or reuse full viewport canvas as background
  let canvas = document.getElementById('dot-field-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'dot-field-canvas';
    // Style as fixed background behind everything (z-index: -3)
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '-3',
      pointerEvents: 'none',
      display: 'block'
    });
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let w = 0, h = 0;
  let dots = [];
  let frameCount = 0;
  let glowOpacity = 0;
  let engagement = 0;
  let rafId = null;

  const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };

  // Set up Page resize response
  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDots();
  }

  // Populate dots grid
  function buildDots() {
    const step = CFG.dotRadius + CFG.dotSpacing;
    const cols = Math.floor(w / step);
    const rows = Math.floor(h / step);
    const padX = (w % step) / 2;
    const padY = (h % step) / 2;
    dots = new Array(rows * cols);
    let idx = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ax = padX + col * step + step / 2;
        const ay = padY + row * step + step / 2;
        dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
      }
    }
  }

  // Mouse speed updater
  setInterval(function () {
    const dx = mouse.prevX - mouse.x;
    const dy = mouse.prevY - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    mouse.speed += (dist - mouse.speed) * 0.5;
    if (mouse.speed < 0.001) mouse.speed = 0;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }, 20);

  // Document mousemove handler
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  // Create SVGGlow overlay following cursor
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  const glowId = 'dot-field-glow-svg';

  Object.assign(svg.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-2',
    pointerEvents: 'none',
    overflow: 'visible'
  });

  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'radialGradient');
  grad.setAttribute('id', glowId);

  const stop0 = document.createElementNS(svgNS, 'stop');
  stop0.setAttribute('offset', '0%');
  stop0.setAttribute('stop-color', CFG.glowColor);

  const stop1 = document.createElementNS(svgNS, 'stop');
  stop1.setAttribute('offset', '100%');
  stop1.setAttribute('stop-color', 'transparent');

  grad.appendChild(stop0);
  grad.appendChild(stop1);
  defs.appendChild(grad);

  const glowCircle = document.createElementNS(svgNS, 'circle');
  glowCircle.setAttribute('cx', '-9999');
  glowCircle.setAttribute('cy', '-9999');
  glowCircle.setAttribute('r', String(CFG.glowRadius));
  glowCircle.setAttribute('fill', `url(#${glowId})`);
  glowCircle.style.opacity = '0';
  glowCircle.style.willChange = 'opacity';

  svg.appendChild(defs);
  svg.appendChild(glowCircle);
  document.body.prepend(svg);

  // Main canvas rendering tick
  function tick() {
    frameCount++;
    const len = dots.length;
    const t = frameCount * 0.02;

    const targetEngagement = Math.min(mouse.speed / 5, 1);
    engagement += (targetEngagement - engagement) * 0.06;
    if (engagement < 0.001) engagement = 0;

    glowOpacity += (engagement - glowOpacity) * 0.08;
    glowCircle.setAttribute('cx', mouse.x);
    glowCircle.setAttribute('cy', mouse.y);
    glowCircle.style.opacity = glowOpacity;

    ctx.clearRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, CFG.gradientFrom);
    gradient.addColorStop(1, CFG.gradientTo);
    ctx.fillStyle = gradient;

    const cr = CFG.cursorRadius;
    const crSq = cr * cr;
    const rad = CFG.dotRadius / 2;
    const isBulge = CFG.bulgeOnly;

    ctx.beginPath();

    for (let i = 0; i < len; i++) {
      const d = dots[i];
      if (!d) continue;
      const dx = mouse.x - d.ax;
      const dy = mouse.y - d.ay;
      const distSq = dx * dx + dy * dy;

      if (distSq < crSq && engagement > 0.01) {
        const dist = Math.sqrt(distSq);
        if (isBulge) {
          const tVal = 1 - dist / cr;
          const push = tVal * tVal * CFG.bulgeStrength * engagement;
          const angle = Math.atan2(dy, dx);
          d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
          d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
        } else {
          const angle = Math.atan2(dy, dx);
          const move = (500 / dist) * (mouse.speed * CFG.cursorForce);
          d.vx += Math.cos(angle) * -move;
          d.vy += Math.sin(angle) * -move;
        }
      } else if (isBulge) {
        d.sx += (d.ax - d.sx) * 0.1;
        d.sy += (d.ay - d.sy) * 0.1;
      }

      if (!isBulge) {
        d.vx *= 0.9;
        d.vy *= 0.9;
        d.x = d.ax + d.vx;
        d.y = d.ay + d.vy;
        d.sx += (d.x - d.sx) * 0.1;
        d.sy += (d.y - d.sy) * 0.1;
      }

      let drawX = d.sx;
      let drawY = d.sy;

      if (CFG.waveAmplitude > 0) {
        drawY += Math.sin(d.ax * 0.03 + t) * CFG.waveAmplitude;
        drawX += Math.cos(d.ay * 0.03 + t * 0.7) * CFG.waveAmplitude * 0.5;
      }

      if (CFG.sparkle) {
        const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
        if ((hash % 100) < 3) {
          ctx.moveTo(drawX + rad * 1.8, drawY);
          ctx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
        } else {
          ctx.moveTo(drawX + rad, drawY);
          ctx.arc(drawX, drawY, rad, 0, TWO_PI);
        }
      } else {
        ctx.moveTo(drawX + rad, drawY);
        ctx.arc(drawX, drawY, rad, 0, TWO_PI);
      }
    }

    ctx.fill();
    rafId = requestAnimationFrame(tick);
  }

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });

  resize();
  rafId = requestAnimationFrame(tick);
})();
