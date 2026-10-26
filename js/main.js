// Peluquería Castro · comportamiento general de la web
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const C = window.Castro;
  const { HOURS, esc, hhmm, durTxt } = C;
  const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

  // --- Abierto / cerrado (hora de Madrid)
  function statusText({ ymd, min }) {
    const day = C.dow(ymd);
    const open = HOURS[day].find(([a, b]) => min >= a && min < b);
    if (open) return { open: true, text: `Abierto ahora · hasta las ${fmt(open[1])}` };
    const laterToday = HOURS[day].find(([a]) => a > min);
    if (laterToday) return { open: false, text: `Cerrado · abre hoy a las ${fmt(laterToday[0])}` };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d].length) {
        const when = i === 1 ? 'mañana' : `el ${DAY_NAMES[d]}`;
        return { open: false, text: `Cerrado · abre ${when} a las ${fmt(HOURS[d][0][0])}` };
      }
    }
    return { open: false, text: 'Cerrado' };
  }
  function updateStatus() {
    const now = C.madridNow();
    const s = statusText(now);
    const el = $('[data-status]');
    if (el) {
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
      $('[data-status-text]', el).textContent = s.text;
    }
    document.querySelectorAll('[data-hours] tr').forEach((tr) => {
      tr.classList.toggle('is-today', Number(tr.dataset.day) === C.dow(now.ymd));
    });
  }
  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  // --- Carta de servicios (desde datos.js)
  const menu = $('[data-menu]');
  if (menu) {
    const cats = [...new Set(C.SERVICES.map((s) => s.cat))];
    menu.innerHTML = cats.map((cat, i) => `
      <div class="menu__group reveal">
        <h3 class="menu__title"><span>${String(i + 1).padStart(2, '0')}</span> ${esc(cat)}</h3>
        <ul>${C.SERVICES.filter((s) => s.cat === cat).map((s) => `
          <li><a class="item" href="#reservar" data-book data-service="${s.id}">
            <span class="item__name">${esc(s.name)}${s.id === 'completo' ? ' <b class="tag">Completo</b>' : ''}
              <small>${esc([s.note, durTxt(s.dur)].filter(Boolean).join(' · '))}</small></span>
            <span class="item__dots"></span>
            <span class="item__price">${s.from ? '<i>desde</i> ' : ''}${s.price} €</span>
          </a></li>`).join('')}
        </ul>
        ${cat === 'Depilación con hilo' ? '<p class="menu__note">¿Dudas con el color o un diseño concreto? Escríbenos por WhatsApp con una foto de referencia y te orientamos.</p>' : ''}
      </div>`).join('');
  }

  // --- Guía de cortes (ilustraciones generadas en datos.js)
  const cuts = $('[data-cuts]');
  if (cuts) {
    cuts.innerHTML = C.STYLES.map((s) => `
      <article class="cut reveal">
        <div class="cut__art">${C.styleSvg(s)}</div>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.desc)}</p>
        <a href="#reservar" class="link" data-book data-service="fade" data-style="${s.id}">Reservar ${esc(s.name)} <span aria-hidden="true">→</span></a>
      </article>`).join('');
  }

  // --- Cabecera sólida al hacer scroll + dock móvil
  const header = $('[data-header]');
  const dock = $('.dock');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 40);
    if (dock) dock.classList.toggle('is-visible', y > window.innerHeight * 0.6);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Menú móvil
  const burger = $('[data-burger]');
  const nav = $('[data-nav]');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // --- Animaciones de entrada
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }

  // --- Año del pie
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
