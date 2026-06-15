// ── Nav scroll ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile menu ──
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ── Hero canvas — animated dot grid ──
(function () {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dots = [];
  const SPACING = 48;
  const ACCENT = [163, 230, 53]; // lime
  const CYAN = [34, 211, 238];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
    buildDots();
  }

  function buildDots() {
    dots = [];
    const cols = Math.ceil(w / SPACING) + 1;
    const rows = Math.ceil(h / SPACING) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          x: c * SPACING,
          y: r * SPACING,
          phase: Math.random() * Math.PI * 2,
          speed: 0.004 + Math.random() * 0.006,
          color: Math.random() < 0.15 ? ACCENT : CYAN,
          active: Math.random() < 0.25,
        });
      }
    }
  }

  let mx = -9999, my = -9999;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  });

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    frame++;
    for (const d of dots) {
      if (!d.active) continue;
      d.phase += d.speed;
      const pulse = (Math.sin(d.phase) + 1) / 2;
      const dist = Math.hypot(d.x - mx, d.y - my);
      const proximity = Math.max(0, 1 - dist / 220);
      const alpha = 0.08 + pulse * 0.18 + proximity * 0.55;
      const size = 1.5 + pulse * 1 + proximity * 2.5;
      const [r, g, b] = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
    }
    // draw subtle flowing lines between nearby dots
    if (frame % 2 === 0) {
      ctx.lineWidth = 0.5;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (!a.active) continue;
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          if (!b.active) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          if (Math.abs(dx) > SPACING * 1.5 || Math.abs(dy) > SPACING * 1.5) continue;
          const dist = Math.hypot(dx, dy);
          if (dist > SPACING * 1.5) continue;
          const alpha = 0.04 * (1 - dist / (SPACING * 1.5));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(163,230,53,${alpha})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── Scroll reveal ──
const revealEls = document.querySelectorAll(
  '.sol-card, .diff-item, .step, .stat-card, .skill-group, .faq-item'
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = `opacity .5s ease ${(i % 6) * 60}ms, transform .5s ease ${(i % 6) * 60}ms`;
  observer.observe(el);
});

// ── Form ──
async function handleForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Enviando…';
  btn.disabled = true;

  const payload = {
    nome: form.name.value,
    email: form.email.value,
    empresa: form.company.value,
    mensagem: form.message.value,
  };

  try {
    await fetch('https://webhook.whatchat.app.br/webhook/form-whatchat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    btn.textContent = 'Mensagem enviada! ✓';
    btn.style.background = '#22d3ee';
    form.reset();
  } catch {
    btn.textContent = 'Erro ao enviar. Tente novamente.';
    btn.style.background = '#ef4444';
    btn.disabled = false;
  }
}
