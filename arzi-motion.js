/* Arzi — shared motion layer: ink-dust canvas, page transitions, ink-stamp clicks */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- entrance ---------- */
  document.body.classList.add('arzi-enter');

  /* ---------- page transition (exit) ---------- */
  function goTo(href) {
    if (reduceMotion) { window.location.href = href; return; }
    document.body.classList.remove('arzi-enter');
    document.body.classList.add('arzi-leaving');
    setTimeout(function () { window.location.href = href; }, 240);
  }
  window.arziGoTo = goTo;

  document.querySelectorAll('a[data-arzi-nav]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href || href === '#' || link.target === '_blank') return;
      e.preventDefault();
      goTo(href);
    });
  });

  /* ---------- ink-stamp click feedback ---------- */
  document.querySelectorAll('.arzi-stamp').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('stamping');
      void btn.offsetWidth; /* restart animation */
      btn.classList.add('stamping');
      setTimeout(function () { btn.classList.remove('stamping'); }, 520);
    });
  });

  /* ---------- ink-dust particle canvas ---------- */
  var canvas = document.getElementById('arzi-ink-canvas');
  if (!canvas || reduceMotion) return;

  var ctx = canvas.getContext('2d');
  var w, h, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var COUNT = 46;
  var colors = [
    'rgba(122,35,49,ALPHA)',   /* maroon */
    'rgba(184,137,74,ALPHA)',  /* brass */
    'rgba(37,66,120,ALPHA)',   /* deep ink blue */
    'rgba(43,102,71,ALPHA)',   /* forest green ink */
    'rgba(107,58,110,ALPHA)'   /* plum */
  ];

  function resize() {
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      speed: 0.12 + Math.random() * 0.28,
      drift: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.18 + Math.random() * 0.3
    };
  }

  function init() {
    resize();
    particles = [];
    for (var i = 0; i < COUNT; i++) particles.push(makeParticle());
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    mouse.tx += (mouse.x - mouse.tx) * 0.03;
    mouse.ty += (mouse.y - mouse.ty) * 0.03;
    var parX = (mouse.tx - w / 2) * 0.012;
    var parY = (mouse.ty - h / 2) * 0.012;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y -= p.speed;
      p.phase += 0.01;
      p.x += Math.sin(p.phase) * p.drift * 0.4;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      ctx.beginPath();
      ctx.fillStyle = p.color.replace('ALPHA', p.alpha.toFixed(2));
      ctx.arc(p.x + parX, p.y + parY, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(step);
  }

  init();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
  mouse.x = mouse.tx = w / 2;
  mouse.y = mouse.ty = h / 2;
  requestAnimationFrame(step);
})();
