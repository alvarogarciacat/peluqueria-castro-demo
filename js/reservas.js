// Peluquería Castro · flujo de reserva propio
// Pasos: servicio → barbero → día y hora → datos (+ estilo opcional) → confirmación.
// Depende de js/datos.js (window.Castro).
(() => {
  const C = window.Castro;
  const { SERVICES, BARBERS, STYLES, esc, hhmm, durTxt, priceTxt, madridNow, addDays, dow, fmtDay, longDate } = C;
  const DAYS_AHEAD = 21;
  const STEPS = ['Servicio', 'Barbero', 'Día y hora', 'Tus datos'];
  const $ = (s, el = document) => el.querySelector(s);

  // ---------- estado ----------
  let st;
  function reset(pre = {}) {
    st = { step: 0, service: null, barber: null, date: null, slot: null, style: null, form: null, done: null, ...pre };
    if (st.service) st.step = st.barber ? 2 : 1;
  }
  reset();

  // ---------- diálogo ----------
  const dlg = document.createElement('dialog');
  dlg.className = 'booking';
  dlg.setAttribute('aria-labelledby', 'bk-title');
  dlg.innerHTML = `
    <div class="bk-head">
      <div class="bk-top">
        <h2 class="bk-title" id="bk-title">Reserva tu cita</h2>
        <button class="bk-close" type="button" aria-label="Cerrar" data-close>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="bk-progress" aria-hidden="true">${STEPS.map(() => '<span></span>').join('')}</div>
      <p class="bk-steplabel" data-steplabel></p>
    </div>
    <div class="bk-body" data-body></div>
    <div class="bk-foot" data-foot>
      <button class="btn btn--ghost btn--sm bk-back" type="button" data-back>Atrás</button>
      <div class="bk-summary" data-summary></div>
      <button class="btn btn--brass btn--sm" type="button" data-next>Continuar</button>
    </div>`;
  document.body.appendChild(dlg);
  const body = $('[data-body]', dlg);

  function render() {
    const done = !!st.done;
    dlg.classList.toggle('is-done', done);
    dlg.querySelectorAll('.bk-progress span').forEach((s, i) => s.classList.toggle('is-on', done || i <= st.step));
    $('[data-steplabel]', dlg).textContent = done ? 'Reserva confirmada' : `Paso ${st.step + 1} de ${STEPS.length} · ${STEPS[st.step]}`;

    body.innerHTML = done ? viewDone() : [viewService, viewBarber, viewWhen, viewForm][st.step]();
    body.scrollTop = 0;

    const back = $('[data-back]', dlg);
    const next = $('[data-next]', dlg);
    back.hidden = done || st.step === 0;
    next.hidden = done;
    next.textContent = st.step === 3 ? 'Confirmar reserva' : 'Continuar';
    next.disabled = ![!!st.service, !!st.barber, !!st.slot, true][st.step];
    $('[data-summary]', dlg).innerHTML = done ? '' : summary();

    const sel = $('.bk-day[aria-pressed="true"]', body);
    if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function summary() {
    if (!st.service) return '<span>Elige un servicio</span>';
    const bid = st.slot ? st.slot.barber : st.barber !== 'any' ? st.barber : null;
    const b = BARBERS.find((x) => x.id === bid);
    const parts = [priceTxt(st.service), durTxt(st.service.dur)];
    if (b) parts.push(b.short);
    if (st.slot) parts.push(`${fmtDay(st.date, { weekday: 'short', day: 'numeric' })} · ${hhmm(st.slot.time)}`);
    return `<strong>${esc(st.service.name)}</strong><span>${esc(parts.join(' · '))}</span>`;
  }

  // Paso 1 · servicio
  function viewService() {
    const cats = [...new Set(SERVICES.map((s) => s.cat))];
    return cats.map((c) => `
      <h3 class="bk-cat">${esc(c)}</h3>
      ${SERVICES.filter((s) => s.cat === c).map((s) => `
        <button type="button" class="bk-option" data-pick-service="${s.id}" aria-pressed="${st.service?.id === s.id}">
          <span class="bk-option__main">
            <span class="bk-option__name">${esc(s.name)}</span>
            <span class="bk-option__meta">${esc([s.note, durTxt(s.dur)].filter(Boolean).join(' · '))}</span>
          </span>
          <span class="bk-option__price">${s.from ? '<i>desde</i> ' : ''}${s.price} €</span>
        </button>`).join('')}`).join('');
  }

  // Paso 2 · barbero
  function viewBarber() {
    const opt = (id, name, meta, avatar) => `
      <button type="button" class="bk-option" data-pick-barber="${id}" aria-pressed="${st.barber === id}">
        <span class="bk-avatar" aria-hidden="true">${avatar}</span>
        <span class="bk-option__main">
          <span class="bk-option__name">${esc(name)}</span>
          <span class="bk-option__meta">${esc(meta)}</span>
        </span>
      </button>`;
    return `
      <p class="bk-hint">¿Con quién quieres la cita?</p>
      ${opt('any', 'Sin preferencia', 'Te damos el primer hueco libre', '<svg viewBox="0 0 24 24"><path d="M8 12h8M12 8v8"/></svg>')}
      ${BARBERS.map((b) => opt(b.id, b.name, 'Barbero', b.ini)).join('')}`;
  }

  // Paso 3 · día y hora (solo se ofrecen huecos donde el barbero está libre toda la duración del servicio)
  function viewWhen() {
    const now = madridNow();
    const days = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const ymd = addDays(now.ymd, i);
      const slots = C.HOURS[dow(ymd)].length ? C.slotsFor(ymd, st.service, st.barber) : [];
      days.push({ ymd, slots });
    }
    if (!st.date || !days.find((d) => d.ymd === st.date && d.slots.length)) {
      const first = days.find((d) => d.slots.length);
      st.date = first ? first.ymd : null;
      st.slot = null;
    }
    const cur = days.find((d) => d.ymd === st.date);
    const label = (ymd) => (ymd === now.ymd ? 'Hoy' : ymd === addDays(now.ymd, 1) ? 'Mañana' : fmtDay(ymd, { weekday: 'short' }));

    const daysHtml = days.map((d) => `
      <button type="button" class="bk-day" data-pick-day="${d.ymd}" aria-pressed="${d.ymd === st.date}" ${d.slots.length ? '' : 'disabled'}
        aria-label="${esc(longDate(d.ymd))}${d.slots.length ? '' : ', sin huecos'}">
        <small>${esc(label(d.ymd))}</small>
        <strong>${fmtDay(d.ymd, { day: 'numeric' })}</strong>
        <small>${esc(fmtDay(d.ymd, { month: 'short' }).replace('.', ''))}</small>
      </button>`).join('');

    let slotsHtml = '<p class="bk-empty">No quedan huecos en los próximos días con esta combinación. Prueba con «Sin preferencia».</p>';
    if (cur) {
      const groups = [['Mañana', cur.slots.filter((s) => s.time < 900)], ['Tarde', cur.slots.filter((s) => s.time >= 900)]];
      slotsHtml = `<p class="bk-when">${esc(longDate(cur.ymd))} · ${durTxt(st.service.dur)}</p>` + groups.filter(([, l]) => l.length).map(([g, l]) => `
        <h3 class="bk-cat">${g}</h3>
        <div class="bk-slots">${l.map((s) => `
          <button type="button" class="bk-slot" data-pick-slot="${s.time}" data-barber="${s.barber}"
            aria-pressed="${!!st.slot && st.slot.time === s.time}">${hhmm(s.time)}</button>`).join('')}
        </div>`).join('');
    }
    return `<div class="bk-days" role="group" aria-label="Elige día">${daysHtml}</div>${slotsHtml}`;
  }

  // Paso 4 · datos + estilo opcional
  function viewForm() {
    const v = st.form || {};
    const isCut = /fade|completo|pack/.test(st.service.id);
    const styles = isCut ? `
      <fieldset class="bk-styles">
        <legend>¿Qué estilo buscas? <span>(opcional)</span></legend>
        <div class="bk-styles__row">
          ${STYLES.map((s) => `
            <button type="button" class="bk-style" data-pick-style="${s.id}" aria-pressed="${st.style === s.id}">
              ${C.styleSvg(s, `bk-${s.id}`)}<span>${esc(s.name)}</span>
            </button>`).join('')}
        </div>
        <a class="bk-styles__link" href="#cortes" data-close-to="#cortes">Ver la guía de cortes</a>
      </fieldset>` : '';
    return `
      <form class="bk-form" data-form novalidate>
        ${styles}
        <label>Nombre y apellido
          <input name="name" autocomplete="name" required minlength="2" value="${esc(v.name)}">
        </label>
        <label>Teléfono móvil
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="600 000 000" value="${esc(v.phone)}">
        </label>
        <label>Email <span>(opcional, para recibir la confirmación)</span>
          <input name="email" type="email" autocomplete="email" value="${esc(v.email)}">
        </label>
        <label>¿Algo que debamos saber? <span>(opcional)</span>
          <textarea name="notes" rows="2" placeholder="Ej.: degradado bajo, diseño en el lateral…">${esc(v.notes)}</textarea>
        </label>
        <label class="bk-check">
          <input type="checkbox" name="privacy" required ${v.privacy ? 'checked' : ''}>
          <span>Acepto que Peluquería Castro use mis datos para gestionar la cita.</span>
        </label>
        <p class="bk-error" data-error role="alert"></p>
        <p class="bk-demo">Demo: no se envía nada. La reserva se guarda solo en este navegador y aparece en el <a href="panel.html" target="_blank">panel del equipo</a>.</p>
      </form>`;
  }

  function viewDone() {
    const b = st.done;
    const s = SERVICES.find((x) => x.id === b.service);
    const br = BARBERS.find((x) => x.id === b.barber);
    const style = STYLES.find((x) => x.id === b.style);
    return `
      <div class="bk-done">
        <div class="bk-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h3>¡Te esperamos, ${esc(b.name.split(' ')[0])}!</h3>
        <p>Tu cita está reservada.</p>
        <dl class="bk-ticket">
          <div><dt>Servicio</dt><dd>${esc(s.name)}${style ? ` · ${esc(style.name)}` : ''}</dd></div>
          <div><dt>Barbero</dt><dd>${esc(br.name)}</dd></div>
          <div><dt>Cuándo</dt><dd>${esc(longDate(b.date))}, ${hhmm(b.time)}</dd></div>
          <div><dt>Precio</dt><dd>${priceTxt(s)} · ${durTxt(s.dur)}</dd></div>
          <div><dt>Dónde</dt><dd>Calle Clara Campoamor, 1 · Castellón</dd></div>
        </dl>
        <div class="bk-done__ctas">
          <button type="button" class="btn btn--brass" data-ics>Añadir a mi calendario</button>
          <button type="button" class="btn btn--ghost" data-close>Volver a la web</button>
        </div>
        <p class="bk-demo">En la versión real recibirías la confirmación y un recordatorio el día antes, con un enlace para cambiar o cancelar.</p>
      </div>`;
  }

  // ---------- acciones ----------
  const go = (step) => { st.step = step; render(); };
  const later = (fn, ms = 140) => setTimeout(fn, ms);

  function markPressed(el) {
    el.parentElement.querySelectorAll('[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    el.setAttribute('aria-pressed', 'true');
  }

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) return close(); // clic fuera del panel
    const link = e.target.closest('[data-close-to]');
    if (link) { e.preventDefault(); close(); document.querySelector(link.dataset.closeTo)?.scrollIntoView(); return; }
    const el = e.target.closest('button');
    if (!el) return;

    if (el.matches('[data-close]')) return close();
    if (el.matches('[data-back]')) { saveForm(); return go(st.step - 1); }
    if (el.matches('[data-next]')) return next();
    if (el.matches('[data-ics]')) return downloadIcs(st.done);

    if (el.dataset.pickService) {
      st.service = SERVICES.find((s) => s.id === el.dataset.pickService);
      st.slot = null;
      markPressed(el);
      return later(() => go(st.barber ? 2 : 1));
    }
    if (el.dataset.pickBarber) {
      st.barber = el.dataset.pickBarber;
      st.slot = null;
      markPressed(el);
      return later(() => go(2));
    }
    if (el.dataset.pickDay) { st.date = el.dataset.pickDay; st.slot = null; return render(); }
    if (el.dataset.pickSlot) {
      st.slot = { time: Number(el.dataset.pickSlot), barber: el.dataset.barber };
      markPressed(el);
      return later(() => go(3), 180);
    }
    if (el.dataset.pickStyle) {
      const same = st.style === el.dataset.pickStyle;
      st.style = same ? null : el.dataset.pickStyle;
      if (same) el.setAttribute('aria-pressed', 'false'); else markPressed(el);
    }
  });

  function saveForm() {
    const f = $('[data-form]', dlg);
    if (!f) return;
    st.form = {
      name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(),
      notes: f.notes.value.trim(), privacy: f.privacy.checked,
    };
  }

  function next() {
    if (st.step < 3) return go(st.step + 1);
    saveForm();
    const v = st.form;
    const f = $('[data-form]', dlg);
    const digits = v.phone.replace(/[\s.()-]/g, '').replace(/^(\+34|0034)/, '');
    let msg = '';
    if (v.name.length < 2) msg = 'Escribe tu nombre.';
    else if (!/^[6789]\d{8}$/.test(digits)) msg = 'Revisa el teléfono: deben ser 9 cifras.';
    else if (v.email && !f.email.checkValidity()) msg = 'Revisa el email.';
    else if (!v.privacy) msg = 'Necesitamos tu permiso para gestionar la cita.';
    if (msg) { $('[data-error]', dlg).textContent = msg; return; }

    // Volver a comprobar que el hueco sigue libre justo antes de guardar
    // (en la versión real lo hace el servidor, para que dos personas no reserven lo mismo)
    if (!C.barberFree(st.slot.barber, st.date, st.slot.time, st.service.dur)) {
      st.slot = null;
      go(2);
      body.insertAdjacentHTML('afterbegin', '<p class="bk-error">Ese hueco se acaba de ocupar. Elige otra hora.</p>');
      return;
    }
    const booking = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      service: st.service.id, barber: st.slot.barber, date: st.date, time: st.slot.time, dur: st.service.dur,
      style: st.style, name: v.name, phone: digits, email: v.email, notes: v.notes, created: new Date().toISOString(),
    };
    C.save('bookings', [...C.load('bookings'), booking]);
    st.done = booking;
    render();
  }

  function downloadIcs(b) {
    const s = SERVICES.find((x) => x.id === b.service);
    const br = BARBERS.find((x) => x.id === b.barber);
    const stamp = (ymd, m) => `${ymd.replace(/-/g, '')}T${hhmm(m).replace(':', '')}00`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peluqueria Castro//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${b.id}@peluqueriacastro`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;TZID=Europe/Madrid:${stamp(b.date, b.time)}`,
      `DTEND;TZID=Europe/Madrid:${stamp(b.date, b.time + b.dur)}`,
      `SUMMARY:${s.name} · Peluquería Castro`,
      `DESCRIPTION:Con ${br.name}. Tel. 667 00 57 50`,
      'LOCATION:Calle Clara Campoamor\\, 1\\, 12003 Castellón de la Plana',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Cita en Peluquería Castro', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'cita-peluqueria-castro.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- abrir / cerrar ----------
  function open(pre) {
    reset(pre);
    render();
    if (!dlg.open) dlg.showModal();
    if (location.hash !== '#reservar') history.pushState(null, '', '#reservar');
  }
  function close() { if (dlg.open) dlg.close(); }

  dlg.addEventListener('close', () => {
    if (location.hash === '#reservar') history.replaceState(null, '', location.pathname + location.search);
  });
  window.addEventListener('popstate', () => { if (location.hash !== '#reservar') close(); });

  // Si en otra pestaña (o en el panel) cambian las reservas, refrescar los huecos al momento
  window.addEventListener('storage', (e) => {
    if (dlg.open && !st.done && st.step === 2 && Object.values(C.KEYS).includes(e.key)) render();
  });

  // Cualquier enlace con data-book abre la reserva (data-service / data-barber / data-style la precargan)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-book]');
    if (!a) return;
    e.preventDefault();
    const pre = {};
    if (a.dataset.service) pre.service = SERVICES.find((s) => s.id === a.dataset.service) || null;
    if (a.dataset.barber) pre.barber = a.dataset.barber;
    if (a.dataset.style) pre.style = a.dataset.style;
    open(pre);
  });
  if (location.hash === '#reservar') open();
})();
