// Peluquería Castro · panel del equipo (DEMO)
// Vistas: día (lista o columnas por barbero), semana (calendario por horas) y mes.
// Usa la misma lógica de disponibilidad que la web (datos.js): lo que se ve aquí es lo que bloquea huecos al reservar.
(() => {
  const C = window.Castro;
  const { BARBERS, SERVICES, STYLES, HOURS, STEP, esc, hhmm, durTxt, madridNow, addDays, dow, fmtDay, longDate } = C;
  const $ = (s) => document.querySelector(s);
  const PREF = 'castro-demo-panel';
  const START = 630; // 10:30
  const END = 1230;  // 20:30
  const VIEWS = { day: 'Día', week: 'Semana', month: 'Mes' };

  // ---------- estado ----------
  const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch { return {}; } })();
  let barber = pref.barber === 'all' || BARBERS.some((b) => b.id === pref.barber) ? pref.barber : 'all';
  let view = VIEWS[pref.view] ? pref.view : 'day';
  let day = madridNow().ymd;
  const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify({ barber, view })); } catch { /* */ } };

  // ---------- fechas ----------
  const weekStart = (ymd) => addDays(ymd, -((dow(ymd) + 6) % 7));
  const monthStart = (ymd) => `${ymd.slice(0, 8)}01`;
  function addMonths(ymd, n) {
    const d = new Date(`${monthStart(ymd)}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- agenda ----------
  // Agrupa los bloques de 15 min del día en tramos: reserva / bloqueo / cita de ejemplo / libre / descanso
  function segments(barberId, ymd, data = C.snapshot()) {
    const out = [];
    const ints = HOURS[dow(ymd)];
    ints.forEach(([a, b], i) => {
      if (i > 0) out.push({ type: 'break', from: ints[i - 1][1], to: a });
      for (let m = a; m < b; m += STEP) {
        const r = C.busyReason(barberId, ymd, m, data);
        const type = r ? r.type : 'free';
        const key = r && r.item ? r.item.id : type;
        const last = out[out.length - 1];
        if (last && last.key === key && last.to === m) last.to = m + STEP;
        else out.push({ type, key, from: m, to: m + STEP, item: r && r.item, barber: barberId });
      }
    });
    out.forEach((s) => { if (s.type === 'booking') s.to = Math.max(s.to, s.item.time + s.item.dur); });
    return out;
  }

  function stats(barberIds, days, data) {
    let web = 0, total = 0, free = 0;
    for (const ymd of days) for (const id of barberIds) {
      for (const s of segments(id, ymd, data)) {
        if (s.type === 'break') continue;
        total += s.to - s.from;
        if (s.type === 'free') free += s.to - s.from;
        if (s.type === 'booking') web++;
      }
    }
    return { web, total, free, occ: total ? Math.round(((total - free) / total) * 100) : 0 };
  }

  const ids = () => (barber === 'all' ? BARBERS.map((b) => b.id) : [barber]);
  const bName = (id) => BARBERS.find((b) => b.id === id);

  // ---------- render ----------
  function render() {
    const now = madridNow();
    const data = C.snapshot();

    $('[data-barbers]').innerHTML = [['all', 'Todos', '★'], ...BARBERS.map((b) => [b.id, b.short, b.ini])].map(([id, name, ini]) => `
      <button type="button" role="tab" aria-selected="${id === barber}" data-barber="${id}"><span class="p-ini">${ini}</span>${esc(name)}</button>`).join('');
    $('[data-views]').innerHTML = Object.entries(VIEWS).map(([id, name]) => `
      <button type="button" role="tab" aria-selected="${id === view}" data-view-btn="${id}">${name}</button>`).join('');

    // Etiqueta de fecha
    let label = '';
    let days = [day];
    if (view === 'day') {
      const rel = day === now.ymd ? 'Hoy · ' : day === addDays(now.ymd, 1) ? 'Mañana · ' : '';
      label = rel + cap(longDate(day));
    } else if (view === 'week') {
      const s = weekStart(day);
      days = [...Array(7)].map((_, i) => addDays(s, i));
      label = `${fmtDay(s, { day: 'numeric', month: 'short' })} – ${fmtDay(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      const s = monthStart(day);
      const e = addDays(addMonths(day, 1), -1);
      days = [];
      for (let d = s; d <= e; d = addDays(d, 1)) days.push(d);
      label = cap(fmtDay(s, { month: 'long', year: 'numeric' }));
    }
    $('[data-date-label]').textContent = label;
    $('[data-pick]').value = day;
    const inRange = view === 'day' ? day === now.ymd : days.includes(now.ymd);
    $('[data-today]').classList.toggle('is-on', inRange);

    // Estadísticas
    const st = stats(ids(), days.filter((d) => HOURS[dow(d)].length), data);
    const per = { day: 'hoy', week: 'esta semana', month: 'este mes' }[view];
    $('[data-stats]').innerHTML = `
      <div><dt>Reservas web</dt><dd>${st.web}</dd></div>
      <div><dt>Ocupación</dt><dd>${st.occ}%</dd></div>
      <div><dt>Tiempo libre</dt><dd>${st.free ? durTxt(st.free) : '—'}</dd></div>`;
    $('[data-stats]').setAttribute('aria-label', `Resumen ${per}`);

    // Vista
    const box = $('[data-view]');
    if (view === 'month') box.innerHTML = monthHtml(now, data);
    else if (view === 'week') box.innerHTML = gridHtml(days.map((d) => ({ ymd: d, lanes: ids(), head: 'day' })), now, data);
    else if (barber === 'all') box.innerHTML = gridHtml(BARBERS.map((b) => ({ ymd: day, lanes: [b.id], head: 'barber' })), now, data);
    else box.innerHTML = listHtml(barber, day, now, data);

    $('[data-actions]').innerHTML = `
      ${view === 'day' && barber !== 'all' && day >= now.ymd ? '<button type="button" class="btn btn--ghost btn--sm" data-block-day>Bloquear lo que queda libre del día</button>' : ''}
      <button type="button" class="btn btn--ghost btn--sm" data-reset>Borrar datos de la demo</button>`;
  }

  // Día, un barbero: lista detallada
  function listHtml(id, ymd, now, data) {
    if (!HOURS[dow(ymd)].length) return '<p class="p-closed">Cerrado. Los domingos no se puede reservar.</p>';
    return `<ol class="p-agenda">${segments(id, ymd, data).map((s) => {
      const past = ymd < now.ymd || (ymd === now.ymd && s.to <= now.min);
      const time = `<span class="p-time">${hhmm(s.from)}<small>${hhmm(s.to)}</small></span>`;
      const cls = `p-item p-item--${s.type}${past ? ' is-past' : ''}`;
      if (s.type === 'break') return `<li class="${cls}">${time}<div class="p-body"><span class="p-tag">Descanso</span></div></li>`;
      if (s.type === 'free') {
        return `<li class="${cls}">${time}<div class="p-body"><span class="p-tag">Libre · ${durTxt(s.to - s.from)}</span>
          ${past ? '' : `<button type="button" class="p-btn" data-block="${s.from}-${s.to}">Bloquear</button>`}</div></li>`;
      }
      if (s.type === 'sim') return `<li class="${cls}">${time}<div class="p-body"><span class="p-tag">Cita (ejemplo)</span></div></li>`;
      if (s.type === 'block') {
        return `<li class="${cls}">${time}<div class="p-body"><span class="p-tag">Bloqueado${s.item.reason ? ` · ${esc(s.item.reason)}` : ''}</span>
          <button type="button" class="p-btn" data-unblock="${s.item.id}">Desbloquear</button></div></li>`;
      }
      const b = s.item;
      const sv = SERVICES.find((x) => x.id === b.service) || { name: b.service, price: '' };
      const sty = STYLES.find((x) => x.id === b.style);
      return `<li class="${cls}">${time}<div class="p-body">
        <div class="p-booking">
          <p class="p-svc">${esc(sv.name)} <span>· ${durTxt(b.dur)} · ${sv.from ? 'desde ' : ''}${sv.price} €</span></p>
          <p class="p-client">${esc(b.name)}</p>
          <p class="p-contact">
            <a href="tel:+34${esc(b.phone)}">${esc(b.phone.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4'))}</a>
            <a href="https://wa.me/34${esc(b.phone)}" target="_blank" rel="noopener">WhatsApp</a>
          </p>
          ${sty ? `<p class="p-style">${C.styleSvg(sty, `p-${b.id}`)}<span>${esc(sty.name)}</span></p>` : ''}
          ${b.notes ? `<p class="p-notes">«${esc(b.notes)}»</p>` : ''}
        </div>
        <button type="button" class="p-btn p-btn--danger" data-cancel="${b.id}">Cancelar</button>
      </div></li>`;
    }).join('')}</ol>`;
  }

  // Calendario por horas: columnas (días o barberos) con carriles (barberos)
  const pct = (m) => `${((m - START) / (END - START)) * 100}%`;
  function gridHtml(cols, now, data) {
    const hours = [];
    for (let h = 11; h <= 20; h++) hours.push(h * 60);
    const axis = `<div class="cal-axis">${hours.map((m) => `<span style="top:${pct(m)}">${hhmm(m)}</span>`).join('')}</div>`;
    const colsHtml = cols.map((c) => {
      const ints = HOURS[dow(c.ymd)];
      const isToday = c.ymd === now.ymd;
      const head = c.head === 'barber'
        ? `<button type="button" class="cal-head" data-go-day="${c.ymd}" data-go-barber="${c.lanes[0]}"><strong>${esc(bName(c.lanes[0]).short)}</strong><small>${esc(bName(c.lanes[0]).ini)}</small></button>`
        : `<button type="button" class="cal-head${isToday ? ' is-today' : ''}" data-go-day="${c.ymd}"><small>${esc(fmtDay(c.ymd, { weekday: 'short' }))}</small><strong>${fmtDay(c.ymd, { day: 'numeric' })}</strong></button>`;

      // Zonas cerradas (antes, entre y después de los tramos abiertos)
      let closed = '';
      if (!ints.length) closed = `<div class="cal-closed" style="top:0;height:100%"><span>Cerrado</span></div>`;
      else {
        let prev = START;
        [...ints, [END, END]].forEach(([a, b]) => {
          if (a > prev) closed += `<div class="cal-closed" style="top:${pct(prev)};height:${((a - prev) / (END - START)) * 100}%"></div>`;
          prev = Math.max(prev, b);
        });
      }

      const lanes = c.lanes.map((id, i) => {
        if (!ints.length) return '';
        const n = c.lanes.length;
        const blocks = segments(id, c.ymd, data).filter((s) => ['booking', 'sim', 'block'].includes(s.type)).map((s) => {
          const h = ((s.to - s.from) / (END - START)) * 100;
          let txt = '';
          if (s.type === 'booking') {
            const sv = SERVICES.find((x) => x.id === s.item.service);
            txt = n > 1 ? esc(bName(id).ini) : `<b>${hhmm(s.from)}</b> ${esc(s.item.name)}<br><span>${esc(sv ? sv.name : '')}</span>`;
          } else if (s.type === 'block') txt = n > 1 ? '' : 'Bloqueado';
          const go = s.type === 'booking' ? ` data-go-day="${c.ymd}" data-go-barber="${id}"` : '';
          return `<div class="cal-ev cal-ev--${s.type}" style="top:${pct(s.from)};height:${h}%"${go} title="${hhmm(s.from)}–${hhmm(s.to)} · ${esc(bName(id).short)}">${txt}</div>`;
        }).join('');
        return `<div class="cal-lane" style="left:${(i / n) * 100}%;width:${100 / n}%">${blocks}</div>`;
      }).join('');

      const nowLine = isToday && now.min > START && now.min < END ? `<div class="cal-now" style="top:${pct(now.min)}"></div>` : '';
      return `<div class="cal-col">${head}<div class="cal-body">${hours.map((m) => `<i class="cal-line" style="top:${pct(m)}"></i>`).join('')}${closed}${lanes}${nowLine}</div></div>`;
    }).join('');
    const wide = cols.length > 3 && cols[0].lanes.length > 1 ? ' cal--wide' : '';
    return `<div class="cal${wide}" style="--cols:${cols.length}"><div class="cal-scroll"><div class="cal-grid"><div class="cal-axis-wrap"><div class="cal-head cal-head--empty"></div>${axis}</div>${colsHtml}</div></div></div>`;
  }

  // Mes
  function monthHtml(now, data) {
    const first = monthStart(day);
    const start = weekStart(first);
    const month = first.slice(0, 7);
    const names = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const ymd = addDays(start, i);
      if (i === 35 && ymd.slice(0, 7) !== month) break; // 5 semanas si sobra la sexta
      const open = HOURS[dow(ymd)].length > 0;
      const out = ymd.slice(0, 7) !== month;
      const st = open ? stats(ids(), [ymd], data) : null;
      const level = st ? (st.occ >= 75 ? 'high' : st.occ >= 45 ? 'mid' : 'low') : '';
      cells.push(`
        <button type="button" class="m-day${out ? ' is-out' : ''}${ymd === now.ymd ? ' is-today' : ''}${open ? '' : ' is-closed'}" data-go-day="${ymd}"
          aria-label="${esc(longDate(ymd))}${st ? `, ocupación ${st.occ}%, ${st.web} reservas web` : ', cerrado'}">
          <span class="m-num">${fmtDay(ymd, { day: 'numeric' })}</span>
          ${st ? `<span class="m-bar m-bar--${level}"><i style="width:${st.occ}%"></i></span>
                  <span class="m-occ">${st.occ}%</span>
                  ${st.web ? `<span class="m-web">${st.web} web</span>` : ''}` : '<span class="m-closed">Cerrado</span>'}
        </button>`);
    }
    return `<div class="month"><div class="m-names">${names.map((n) => `<span>${n}</span>`).join('')}</div><div class="m-grid">${cells.join('')}</div></div>`;
  }

  // ---------- acciones ----------
  function addBlock(id, ymd, from, to, reason) {
    C.save('blocks', [...C.load('blocks'), { id: `k${Date.now().toString(36)}${from}${id}`, barber: id, date: ymd, from, to, reason }]);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, .cal-ev[data-go-day]');
    if (!el || el.closest('.aj, .aj-fab')) return;
    const d = el.dataset;
    if (d.barber) barber = d.barber;
    else if (d.viewBtn) view = d.viewBtn;
    else if (d.move) {
      const n = Number(d.move);
      day = view === 'day' ? addDays(day, n) : view === 'week' ? addDays(day, 7 * n) : addMonths(day, n);
    } else if ('today' in d) day = madridNow().ymd;
    else if (d.goDay) { day = d.goDay; view = 'day'; if (d.goBarber) barber = d.goBarber; }
    else if (d.block) { const [f, t] = d.block.split('-').map(Number); addBlock(barber, day, f, t, 'Descanso / personal'); }
    else if (d.unblock) C.save('blocks', C.load('blocks').filter((k) => k.id !== d.unblock));
    else if (d.cancel) C.save('bookings', C.load('bookings').filter((b) => b.id !== d.cancel));
    else if ('blockDay' in d) {
      const now = madridNow();
      segments(barber, day).filter((s) => s.type === 'free' && !(day === now.ymd && s.to <= now.min))
        .forEach((s) => addBlock(barber, day, day === now.ymd ? Math.max(s.from, now.min - (now.min % STEP)) : s.from, s.to, 'Día bloqueado'));
    } else if ('reset' in d) { C.save('bookings', []); C.save('blocks', []); }
    else return;
    savePref();
    render();
  });

  $('[data-pick]').addEventListener('change', (e) => { if (e.target.value) { day = e.target.value; render(); } });

  // Tiempo real: cuando la web (otra pestaña) guarda una reserva, el panel se actualiza solo
  window.addEventListener('storage', (e) => { if (Object.values(C.KEYS).includes(e.key)) render(); });
  setInterval(render, 60 * 1000);
  render();
})();
