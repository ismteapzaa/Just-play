const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width = window.innerWidth;
const H = canvas.height = window.innerHeight;

// --- Config ---
const PARTICLE_SIZE = 3;
const PARTICLE_GAP = 6;       // spacing between particles
const REPULSION_RADIUS = 120; // how far the push reaches
const REPULSION_FORCE = 6;    // how hard particles get pushed
const SPRING = 0.08;          // return-to-origin spring strength
const FRICTION = 0.82;        // velocity damping (lower = more bouncy)

// Rounded rect helper
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

// Shape: Among Us crewmate silhouette
function buildShapeImage(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');

  c.fillStyle = '#fff';

  // --- Body (main bean shape) ---
  // Head region: full-width rounded top
  // Body narrows slightly, ends in two legs
  const bx = w * 0.18;  // body left edge
  const bw = w * 0.62;  // body width
  const headTop = h * 0.02;
  const headBot = h * 0.52;
  const bodyBot = h * 0.78;
  const br = bw * 0.5;  // head radius

  // Full body silhouette via bezier
  c.beginPath();
  // top-left of head
  c.moveTo(bx + br, headTop);
  // top arc
  c.arc(bx + br, headTop + br, br, -Math.PI / 2, Math.PI, true);
  // left side down
  c.lineTo(bx, bodyBot);
  // left leg bottom
  c.quadraticCurveTo(bx,        bodyBot + h * 0.12, bx + w * 0.08,  bodyBot + h * 0.12);
  c.lineTo(bx + w * 0.30, bodyBot + h * 0.12);
  c.quadraticCurveTo(bx + w * 0.36, bodyBot + h * 0.12, bx + w * 0.36, bodyBot);
  // gap between legs
  c.lineTo(bx + w * 0.36, bodyBot - h * 0.04);
  c.lineTo(bx + w * 0.44, bodyBot - h * 0.04);
  c.lineTo(bx + w * 0.44, bodyBot);
  // right leg bottom
  c.quadraticCurveTo(bx + w * 0.44, bodyBot + h * 0.12, bx + w * 0.52, bodyBot + h * 0.12);
  c.lineTo(bx + bw - w * 0.08, bodyBot + h * 0.12);
  c.quadraticCurveTo(bx + bw, bodyBot + h * 0.12, bx + bw, bodyBot);
  // right side up
  c.lineTo(bx + bw, headTop + br);
  // close top-right arc handled by moveTo logic
  c.arc(bx + br, headTop + br, br, 0, -Math.PI / 2, true);
  c.closePath();
  c.fill();

  // --- Backpack (right side) ---
  c.fillStyle = '#fff';
  const pkX = bx + bw - w * 0.01;
  const pkY = h * 0.40;
  const pkW = w * 0.18;
  const pkH = h * 0.28;
  roundRect(c, pkX, pkY, pkW, pkH, pkW * 0.3);
  c.fill();

  // --- Visor cutout ---
  c.globalCompositeOperation = 'destination-out';
  const vx = bx + w * 0.06;
  const vy = h * 0.10;
  const vw = bw * 0.72;
  const vh = h * 0.22;
  roundRect(c, vx, vy, vw, vh, vh * 0.45);
  c.fill();
  c.globalCompositeOperation = 'source-over';

  return off;
}

// Sample the shape image and create particles where pixels are filled
function createParticles(shapeW, shapeH, offsetX, offsetY) {
  const shape = buildShapeImage(shapeW, shapeH);
  const sc = shape.getContext('2d');
  const data = sc.getImageData(0, 0, shapeW, shapeH).data;
  const particles = [];

  for (let y = 0; y < shapeH; y += PARTICLE_GAP) {
    for (let x = 0; x < shapeW; x += PARTICLE_GAP) {
      const i = (y * shapeW + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 128) {
        const px = offsetX + x;
        const py = offsetY + y;
        particles.push({
          ox: px, oy: py,   // origin
          x: px,  y: py,   // current
          vx: 0,  vy: 0,   // velocity
          // subtle brightness variation based on position in shape
          brightness: 160 + Math.random() * 90,
        });
      }
    }
  }
  return particles;
}

const SHAPE_W = Math.min(W * 0.38, 340);
const SHAPE_H = SHAPE_W * 1.35;
const OX = (W - SHAPE_W) / 2;
const OY = (H - SHAPE_H) / 2;

const particles = createParticles(SHAPE_W, SHAPE_H, OX, OY);

// --- Pointer tracking ---
const pointer = { x: -9999, y: -9999, down: false };

canvas.addEventListener('mousemove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
}, { passive: false });
canvas.addEventListener('touchstart', e => {
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
  pointer.down = true;
}, { passive: true });
canvas.addEventListener('touchend', () => {
  pointer.down = false;
  pointer.x = -9999;
  pointer.y = -9999;
});
canvas.addEventListener('mouseleave', () => {
  pointer.x = -9999;
  pointer.y = -9999;
});

// --- Cursor glow ---
function drawCursor(x, y) {
  if (x < 0) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 24);
  grad.addColorStop(0,   'rgba(255,255,255,0.35)');
  grad.addColorStop(0.4, 'rgba(160,200,255,0.12)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fill();
}

// --- Animation loop ---
function tick() {
  ctx.clearRect(0, 0, W, H);

  const px = pointer.x;
  const py = pointer.y;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Repulsion from pointer
    const dx = p.x - px;
    const dy = p.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPULSION_RADIUS && dist > 0) {
      const strength = (1 - dist / REPULSION_RADIUS);
      const force = strength * strength * REPULSION_FORCE;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }

    // Spring back to origin
    p.vx += (p.ox - p.x) * SPRING;
    p.vy += (p.oy - p.y) * SPRING;

    // Friction
    p.vx *= FRICTION;
    p.vy *= FRICTION;

    p.x += p.vx;
    p.y += p.vy;

    // Displacement magnitude for colour/size variation
    const disp = Math.sqrt((p.x - p.ox) ** 2 + (p.y - p.oy) ** 2);
    const boost = Math.min(disp / 18, 1);

    const b = Math.floor(p.brightness + boost * 60);
    const size = PARTICLE_SIZE + boost * 1.5;

    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }

  drawCursor(px, py);
  requestAnimationFrame(tick);
}

tick();
