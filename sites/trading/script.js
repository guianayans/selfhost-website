(() => {
  'use strict';

  // Cursor glow
  const glow = document.querySelector('.cursor-glow');
  if (glow && window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    });
  } else if (glow) {
    glow.style.display = 'none';
  }

  // Mobile nav
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => revealObserver.observe(el));

  // Counter animation
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const value = target * eased;
      if (decimals > 0) {
        el.textContent = value.toFixed(decimals) + suffix;
      } else if (target >= 1000000) {
        el.textContent = `${(value / 1000000).toFixed(1)}M${suffix}`;
      } else {
        el.textContent = Math.floor(value).toLocaleString('pt-BR') + suffix;
      }
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('[data-count]').forEach((el) => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        animateCount(el);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
  });

  // Mini chart bars
  const miniChart = document.getElementById('mini-chart');
  if (miniChart) {
    const heights = [35, 55, 42, 70, 48, 85, 62, 78, 90, 65, 82, 95, 72, 88, 60, 75, 92, 68, 80, 100];
    heights.forEach((h, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${h}%`;
      bar.style.animationDelay = `${i * 0.04}s`;
      miniChart.appendChild(bar);
    });
  }

  // Live price ticker simulation
  const priceEl = document.getElementById('live-price');
  const changeEl = document.getElementById('live-change');
  let basePrice = 67842.5;

  if (priceEl) {
    setInterval(() => {
      const delta = (Math.random() - 0.48) * 120;
      basePrice = Math.max(67000, Math.min(69000, basePrice + delta));
      const pct = ((basePrice - 67842.5) / 67842.5) * 100;
      priceEl.textContent = `$${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (changeEl) {
        changeEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
        changeEl.className = `change ${pct >= 0 ? 'positive' : 'negative'}`;
      }
    }, 1800);
  }

  // Background chart canvas
  const canvas = document.getElementById('chart-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, points = [], offset = 0;

    function resize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      canvas.style.width = `${canvas.offsetWidth}px`;
      canvas.style.height = `${canvas.offsetHeight}px`;
      points = Array.from({ length: 80 }, (_, i) => ({
        x: (i / 79) * canvas.offsetWidth,
        y: canvas.offsetHeight * 0.5 + Math.sin(i * 0.15) * 40 + Math.random() * 20,
      }));
    }

    function draw() {
      if (!ctx) return;
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);
      offset += 0.3;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const y = p.y + Math.sin(offset * 0.02 + i * 0.2) * 8;
        if (i === 0) ctx.moveTo(p.x, y);
        else ctx.lineTo(p.x, y);
      }
      ctx.stroke();

      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  // Testimonials slider
  const track = document.getElementById('testimonial-track');
  const dotsContainer = document.getElementById('slider-dots');
  if (track && dotsContainer) {
    const slides = track.querySelectorAll('.testimonial');
    let current = 0;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Depoimento ${i + 1}`);
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('button');

    function goTo(index) {
      current = index;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    setInterval(() => goTo((current + 1) % slides.length), 5000);
  }

  // FAQ accordion animation
  document.querySelectorAll('.faq-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        document.querySelectorAll('.faq-item').forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  // CTA form
  document.getElementById('cta-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const btn = e.target.querySelector('button');
    const original = btn.textContent;
    btn.textContent = 'Conta criada! ✓';
    btn.disabled = true;
    input.value = '';
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 3000);
  });

  // Header scroll effect
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    header?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  // Smooth anchor offset for fixed header
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
