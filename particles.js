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

// Shape: diamond / flame silhouette drawn on an offscreen canvas
function buildShapeImage(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');

  c.fillStyle = '#fff';

  // Outer diamond flame
  c.beginPath();
  c.moveTo(w * 0.5,  h * 0.02);
  c.bezierCurveTo(w * 0.72, h * 0.18,  w * 0.78, h * 0.38,  w * 0.68, h * 0.52);
  c.bezierCurveTo(w * 0.62, h * 0.60,  w * 0.70, h * 0.68,  w * 0.60, h * 0.75);
  c.bezierCurveTo(w * 0.55, h * 0.80,  w * 0.58, h * 0.88,  w * 0.50, h * 0.98);
  c.bezierCurveTo(w * 0.42, h * 0.88,  w * 0.45, h * 0.80,  w * 0.40, h * 0.75);
  c.bezierCurveTo(w * 0.30, h * 0.68,  w * 0.38, h * 0.60,  w * 0.32, h * 0.52);
  c.bezierCurveTo(w * 0.22, h * 0.38,  w * 0.28, h * 0.18,  w * 0.50, h * 0.02);
  c.closePath();
  c.fill();

  // Inner diamond cutout (for the eye / gem shape)
  c.globalCompositeOperation = 'destination-out';
  const cx = w * 0.5, cy = h * 0.44;
  const rx = w * 0.10, ry = h * 0.08;
  c.beginPath();
  c.moveTo(cx,        cy - ry);
  c.lineTo(cx + rx,   cy);
  c.lineTo(cx,        cy + ry);
  c.lineTo(cx - rx,   cy);
  c.closePath();
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

const SHAPE_W = Math.min(W * 0.36, 320);
const SHAPE_H = SHAPE_W * 1.55;
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
