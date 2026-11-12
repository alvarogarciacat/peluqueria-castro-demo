// Peluquería Castro · comportamiento general de la web
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const C = window.Castro;
  const { HOURS, esc, hhmm, durTxt } = C;
  const t = (key, fb, vars) => C.tf(key, fb, vars);
  const DAY_FB = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

  // --- Abierto / cerrado (hora de Madrid)
  function statusText({ ymd, min }) {
    const day = C.dow(ymd);
    const open = HOURS[day].find(([a, b]) => min >= a && min < b);
    if (open) return { open: true, text: t('status.open', 'Abierto ahora · hasta las {time}', { time: fmt(open[1]) }) };
    const laterToday = HOURS[day].find(([a]) => a > min);
    if (laterToday) return { open: false, text: t('status.today', 'Cerrado · abre hoy a las {time}', { time: fmt(laterToday[0]) }) };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d].length) {
        const time = fmt(HOURS[d][0][0]);
        return { open: false, text: i === 1
          ? t('status.tomorrow', 'Cerrado · abre mañana a las {time}', { time })
          : t('status.day', 'Cerrado · abre el {day} a las {time}', { day: t(`day.${d}`, DAY_FB[d]), time }) };
      }
    }
    return { open: false, text: t('closed', 'Cerrado') };
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
  let revealed = false; // tras el primer pintado, lo que se vuelve a dibujar al cambiar de idioma ya entra visible
  const rv = () => `reveal${revealed ? ' is-in' : ''}`;
  const menu = $('[data-menu]');
  function renderMenu() {
    const cats = [...new Set(C.SERVICES.map((s) => s.cat))];
    menu.innerHTML = cats.map((cat, i) => `
      <div class="menu__group ${rv()}">
        <h3 class="menu__title"><span>${String(i + 1).padStart(2, '0')}</span> ${esc(C.catName(cat))}</h3>
        <ul>${C.SERVICES.filter((s) => s.cat === cat).map((s) => `
          <li><a class="item" href="#reservar" data-book data-service="${s.id}">
            <span class="item__name">${esc(C.svcName(s))}${s.id === 'completo' ? ` <b class="tag">${esc(t('tag.complete', 'Completo'))}</b>` : ''}
              <small>${esc([C.svcNote(s), durTxt(s.dur)].filter(Boolean).join(' · '))}</small></span>
            <span class="item__dots"></span>
            <span class="item__price">${s.from ? `<i>${esc(t('from', 'desde'))}</i> ` : ''}${s.price} €</span>
          </a></li>`).join('')}
        </ul>
        ${C.catKey(cat) === 'hilo' ? `<p class="menu__note">${esc(t('menu.note', '¿Dudas con el color o un diseño concreto? Escríbenos por WhatsApp con una foto de referencia y te orientamos.'))}</p>` : ''}
      </div>`).join('');
  }

  // --- Guía de cortes (ilustraciones generadas en datos.js)
  const cuts = $('[data-cuts]');
  function renderCuts() {
    cuts.innerHTML = C.STYLES.map((s) => `
      <article class="cut ${rv()}">
        <div class="cut__art">${C.styleSvg(s)}</div>
        <h3>${esc(C.styleName(s))}</h3>
        <p>${esc(C.styleDesc(s))}</p>
        <a href="#reservar" class="link" data-book data-service="fade" data-style="${s.id}">${esc(t('cut.book', 'Reservar {name}', { name: C.styleName(s) }))} <span aria-hidden="true">→</span></a>
      </article>`).join('');
  }

  if (menu) renderMenu();
  if (cuts) renderCuts();

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
    burger.setAttribute('aria-label', open ? t('burger.close', 'Cerrar menú') : t('burger.open', 'Abrir menú'));
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

  revealed = true;

  // --- Cambio de idioma
  const renderLang = () => { if (menu) renderMenu(); if (cuts) renderCuts(); updateStatus(); setMenu(burger.getAttribute('aria-expanded') === 'true'); };
  window.addEventListener('castro:lang', renderLang);

  // --- Año del pie
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
