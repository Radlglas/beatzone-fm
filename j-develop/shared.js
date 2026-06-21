// ── Cursor ──────────────────────────────────────────
const cur = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = -100, ry = -100, visible = false;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (!visible) {
    visible = true; rx = mx; ry = my;
    cur.style.opacity = '1'; ring.style.opacity = '0.5';
  }
});
(function animCursor() {
  if (cur && ring) {
    cur.style.left = mx + 'px'; cur.style.top = my + 'px';
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  }
  requestAnimationFrame(animCursor);
})();
document.querySelectorAll('a, button, .bot-card, .price-card, .teaser-card, .step, .tl-body, .info-card, .faq-q').forEach(el => {
  el.addEventListener('mouseenter', () => { cur.style.width='18px';cur.style.height='18px';ring.style.width='56px';ring.style.height='56px';ring.style.opacity='0.8'; });
  el.addEventListener('mouseleave', () => { cur.style.width='10px';cur.style.height='10px';ring.style.width='36px';ring.style.height='36px';ring.style.opacity='0.5'; });
});

// ── Scroll reveal ────────────────────────────────────
const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }), { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ── Stagger grids ────────────────────────────────────
document.querySelectorAll('.bots-grid .bot-card, .pricing-grid .price-card, .teaser-grid .teaser-card, .status-grid .status-card').forEach((el, i) => {
  el.style.transitionDelay = (i * 0.07) + 's';
});

// ── Animated counters ────────────────────────────────
function animateCount(el, target, suffix, duration = 1600) {
  let start = null;
  const step = ts => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    counterObs.unobserve(e.target);
    const el  = e.target;
    const raw = el.dataset.count;
    const suffix = el.dataset.suffix || '';
    animateCount(el, parseInt(raw), suffix);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => counterObs.observe(el));

// ── Active nav link ──────────────────────────────────
const path = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === path) a.classList.add('active');
});

// ── Pricing toggle ───────────────────────────────────
document.querySelectorAll('.ptoggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptoggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    const abo = document.getElementById('tab-abo');
    const ein = document.getElementById('tab-einmalig');
    if (abo) abo.classList.toggle('hidden', tab !== 'abo');
    if (ein) ein.classList.toggle('hidden', tab !== 'einmalig');
  });
});

// ── Smooth page transitions ──────────────────────────
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.35s ease';
window.addEventListener('load', () => { document.body.style.opacity = '1'; });
document.querySelectorAll('a[href]').forEach(a => {
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('http') || a.target === '_blank') return;
  a.addEventListener('click', e => {
    e.preventDefault();
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = href; }, 320);
  });
});
