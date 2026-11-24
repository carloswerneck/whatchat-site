// ── Nav scroll ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile menu ──
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  const button = document.getElementById('menuButton');
  const open = menu.classList.toggle('open');
  if (button) button.setAttribute('aria-expanded', String(open));
}

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
    btn.textContent = 'Mensagem enviada';
    btn.classList.add('is-success');
    form.reset();
  } catch {
    btn.textContent = 'Erro ao enviar, tente novamente';
    btn.classList.add('is-error');
    btn.disabled = false;
  }
}
