// Peluquería Castro · datos y lógica de disponibilidad compartidos por la web y el panel.
// DEMO: las citas "de ejemplo" (clientes inventados) se generan y las reservas/bloqueos se guardan en localStorage.
// En la versión real, load()/save() y la simulación se sustituyen por llamadas al servidor.
window.Castro = (() => {
  // Servicios, precios y duraciones tal cual están en su web de Square (solo se corrigen erratas)
  const SERVICES = [
    { id: 'fade', cat: 'Cortes', name: 'Corte degradado «Fade»', note: 'Incluye lavado', price: 15, dur: 30 },
    { id: 'fade-diseno', cat: 'Cortes', name: 'Corte degradado «Fade» + diseño', price: 20, dur: 30 },
    { id: 'fade-hilo', cat: 'Cortes', name: 'Corte fade + depilación de hilo', price: 25, dur: 40 },
    { id: 'pack-cejas', cat: 'Packs', name: 'Fade + cejas + lavado', price: 20, dur: 30 },
    { id: 'pack-barba', cat: 'Packs', name: 'Fade + barba + lavado', price: 25, dur: 45 },
    { id: 'completo', cat: 'Packs', name: 'Fade + barba + cejas + lavado', note: 'El completo', price: 30, dur: 60 },
    { id: 'tinte', cat: 'Color y química', name: 'Tintes', price: 20, from: true, dur: 30 },
    { id: 'mechas', cat: 'Color y química', name: 'Mechas plateadas', price: 45, from: true, dur: 90 },
    { id: 'permanente', cat: 'Color y química', name: 'Permanente', price: 50, dur: 90 },
    { id: 'decoloracion', cat: 'Color y química', name: 'Decoloración (todo)', price: 55, dur: 150 },
    { id: 'cejas', cat: 'Depilación con hilo', name: 'Depilación con hilo (cejas)', price: 10, dur: 15 },
    { id: 'hilo', cat: 'Depilación con hilo', name: 'Depilación con hilo', price: 10, dur: 15 },
  ];

  const BARBERS = [
    { id: 'cristian', name: 'Cristian Lin Castro', short: 'Cristian', ini: 'CL' },
    { id: 'samuel', name: 'Samuel Castro', short: 'Samuel', ini: 'SC' },
    { id: 'castro', name: 'Castro Dos Santos', short: 'Castro', ini: 'CD' },
  ];

  // Estilos de la guía de cortes (alturas del degradado). top/bottom: dónde empieza y acaba el degradado en el perfil (oreja ≈ 66–96).
  const STYLES = [
    { id: 'taper', name: 'Taper', desc: 'Degradado solo en patillas y nuca. El más discreto: queda bien a cualquier edad.', top: 96, bottom: 120 },
    { id: 'low', name: 'Low fade', desc: 'Empieza justo por encima de la oreja. Limpio y fácil de llevar.', top: 70, bottom: 98 },
    { id: 'mid', name: 'Mid fade', desc: 'Arranca a media altura, a la altura de la sien. El equilibrio entre clásico y moderno.', top: 56, bottom: 84 },
    { id: 'high', name: 'High fade', desc: 'Sube casi hasta la coronilla. Máximo contraste con la parte de arriba.', top: 40, bottom: 68 },
    { id: 'buzz', name: 'Rapado', desc: 'Todo corto y a la misma altura. Cero mantenimiento.', buzz: true, top: 20, bottom: 120 },
  ];

  // Minutos desde medianoche. 0 = domingo.
  const HOURS = {
    0: [], 1: [[630, 840], [960, 1200]], 2: [[630, 840], [960, 1200]], 3: [[630, 840], [960, 1200]],
    4: [[630, 840], [960, 1200]], 5: [[630, 840], [960, 1230]], 6: [[630, 900]],
  };
  const STEP = 15;
  const KEYS = { bookings: 'castro-demo-reservas', blocks: 'castro-demo-bloqueos' };

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const durTxt = (d) => (d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}`);

  // Idioma: el panel no carga js/i18n.js y se queda en español
  const I = () => window.I18N;
  const tr = (key, fb) => (I() ? I().tr(key, fb) : fb);
  const tf = (key, fb, vars) => { const s = tr(key, fb); return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s; };
  const priceTxt = (s) => `${s.from ? `${tr('from', 'desde')} ` : ''}${s.price} €`;
  const CAT_KEYS = { 'Cortes': 'cortes', 'Packs': 'packs', 'Color y química': 'color', 'Depilación con hilo': 'hilo' };
  const catKey = (cat) => CAT_KEYS[cat] || cat;
  const catName = (cat) => tr(`cat.${catKey(cat)}`, cat);
  const svcName = (s) => tr(`svc.${s.id}`, s.name);
  const svcNote = (s) => (s.note ? tr(`svc.${s.id}.note`, s.note) : '');
  const styleName = (st) => tr(`style.${st.id}`, st.name);
  const styleDesc = (st) => tr(`style.${st.id}.desc`, st.desc);
  const barberRole = () => tr('bk.barber.role', 'Barbero');

  function madridNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { ymd: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
  }
  const toDate = (ymd) => new Date(`${ymd}T12:00:00Z`);
  const addDays = (ymd, n) => { const d = toDate(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (ymd) => toDate(ymd).getUTCDay();
  const fmtDay = (ymd, opts) => new Intl.DateTimeFormat(I() ? I().locale : 'es-ES', { timeZone: 'UTC', ...opts }).format(toDate(ymd));
  const longDate = (ymd) => fmtDay(ymd, { weekday: 'long', day: 'numeric', month: 'long' });

  // Hash determinista → [0,1): la agenda simulada es estable para cada día y barbero
  function rnd(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  // ---------- agenda de ejemplo: clientes y servicios inventados ----------
  // Determinista (mismo día y barbero = misma agenda). Cada día tiene su carga: unos tranquilos y otros llenos.
  const SIM_MIX = [['fade', 30], ['fade-diseno', 10], ['pack-barba', 12], ['completo', 8], ['pack-cejas', 8], ['fade-hilo', 5],
    ['tinte', 7], ['mechas', 4], ['permanente', 2], ['decoloracion', 2], ['cejas', 5], ['hilo', 3]];
  const SIM_FIRST = ['Álex', 'Marc', 'Pau', 'Joan', 'Vicent', 'Hugo', 'Daniel', 'Adrián', 'Sergio', 'Pablo', 'Iván', 'Raúl', 'Jorge', 'Carlos',
    'Nacho', 'Lucas', 'Mateo', 'Rubén', 'Aitor', 'Enzo', 'Biel', 'Samir', 'Andrei', 'Bogdan', 'Yassine', 'Tomás', 'Gonzalo', 'Álvaro', 'Javi',
    'Miguel', 'David', 'Víctor', 'Óscar', 'Eric', 'Nil', 'Jaume', 'Toni', 'Fran', 'Leo', 'Izan', 'Oriol', 'Rafa', 'Santi', 'Manu', 'Gabri', 'Edu',
    'María', 'Laura', 'Carla', 'Lucía', 'Marta', 'Sara', 'Paula', 'Noa', 'Aina', 'Júlia', 'Elena', 'Irene'];
  const SIM_LAST = ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Fernández', 'Moreno', 'Navarro', 'Ferrer', 'Soler', 'Safont',
    'Gil', 'Blasco', 'Climent', 'Mas', 'Vilar', 'Roca', 'Bellver', 'Edo', 'Sales', 'Tormo', 'Beltrán', 'Giner', 'Nebot', 'Pitarch', 'Segarra',
    'Querol', 'Font', 'Ibáñez', 'Rubio', 'Marín', 'Vidal', 'Ortega', 'Serrano', 'Cano', 'Prieto', 'Mora', 'Peña'];
  const SIM_NOTES = ['Trae foto de referencia', 'Primera visita', 'Cliente habitual', 'Viene con su hijo', 'Quiere los laterales más cortos',
    'Prefiere máquina del 1', 'Pide hora para una boda', 'Cambio de look', 'Llegará 5 min tarde', 'Le gusta el flequillo largo'];
  const simPick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
  const simCache = new Map();

  function simAppts(barberId, ymd) {
    const key = `${barberId}|${ymd}`;
    if (simCache.has(key)) return simCache.get(key);
    const out = [];
    const skip = 0.3 + 0.45 * rnd(`${key}|carga`); // probabilidad de dejar libre el siguiente tramo de 30 min
    const total = SIM_MIX.reduce((n, [, w]) => n + w, 0);
    for (const [a, b] of HOURS[dow(ymd)]) {
      let t = a + Math.floor(rnd(`${key}|${a}|ini`) * 3) * STEP;
      while (t < b) {
        if (rnd(`${key}|${t}|libre`) < skip) { t += 30; continue; }
        let r = rnd(`${key}|${t}|svc`) * total;
        let svc = SERVICES.find((x) => x.id === SIM_MIX[0][0]);
        for (const [id, w] of SIM_MIX) { r -= w; if (r < 0) { svc = SERVICES.find((x) => x.id === id); break; } }
        if (t + svc.dur > b) svc = SERVICES.find((x) => x.id === 'cejas');   // lo que cabe antes de cerrar
        if (t + svc.dur > b) break;
        const name = `${simPick(SIM_FIRST, rnd(`${key}|${t}|n`))} ${simPick(SIM_LAST, rnd(`${key}|${t}|a`))}`;
        const isCut = /fade|completo|pack/.test(svc.id);
        out.push({
          id: `s${barberId}${ymd.replace(/-/g, '')}${t}`, sim: true, barber: barberId, date: ymd, time: t, dur: svc.dur, service: svc.id, name,
          style: isCut && rnd(`${key}|${t}|est`) < 0.45 ? simPick(STYLES, rnd(`${key}|${t}|e2`)).id : null,
          notes: rnd(`${key}|${t}|nota`) < 0.2 ? simPick(SIM_NOTES, rnd(`${key}|${t}|n2`)) : '',
        });
        t += Math.ceil(svc.dur / STEP) * STEP + (rnd(`${key}|${t}|pausa`) < 0.5 ? 0 : STEP);
      }
    }
    simCache.set(key, out);
    return out;
  }

  // ---------- almacenamiento (demo) ----------
  const load = (key) => { try { return JSON.parse(localStorage.getItem(KEYS[key])) || []; } catch { return []; } };
  const save = (key, list) => { try { localStorage.setItem(KEYS[key], JSON.stringify(list)); } catch { /* sin almacenamiento */ } };

  // ---------- disponibilidad ----------
  // Motivo por el que el bloque de 15 min que empieza en `m` está ocupado (o null si está libre)
  function busyReason(barberId, ymd, m, data) {
    const b = data.bookings.find((x) => x.barber === barberId && x.date === ymd && m >= x.time && m < x.time + x.dur);
    if (b) return { type: 'booking', item: b };
    const k = data.blocks.find((x) => x.barber === barberId && x.date === ymd && m >= x.from && m < x.to);
    if (k) return { type: 'block', item: k };
    const sim = simAppts(barberId, ymd).find((x) => m >= x.time && m < x.time + x.dur);
    if (sim) return { type: 'sim', item: sim };
    return null;
  }
  const snapshot = () => ({ bookings: load('bookings'), blocks: load('blocks') });

  function barberFree(barberId, ymd, start, dur, data = snapshot()) {
    for (let m = start; m < start + dur; m += STEP) if (busyReason(barberId, ymd, m, data)) return false;
    return true;
  }

  // Huecos libres de un día: [{time, barber}] con el primer barbero libre en cada hora
  function slotsFor(ymd, service, barberChoice, minNotice = 30) {
    const now = madridNow();
    const data = snapshot();
    const pool = barberChoice === 'any'
      ? [...BARBERS].sort((a, b) => rnd(ymd + a.id) - rnd(ymd + b.id))
      : BARBERS.filter((b) => b.id === barberChoice);
    const out = [];
    for (const [a, b] of HOURS[dow(ymd)]) {
      for (let t = a; t + service.dur <= b; t += STEP) {
        if (ymd === now.ymd && t < now.min + minNotice) continue;
        const free = pool.find((br) => barberFree(br.id, ymd, t, service.dur, data));
        if (free) out.push({ time: t, barber: free.id });
      }
    }
    return out;
  }

  // ---------- ilustración de la guía de cortes ----------
  // Perfil lateral: pelo arriba, degradado con textura de rapado y una maquinilla que sube por el degradado (animada por CSS).
  const HEAD = 'M58 30C74 14 112 12 128 32C140 48 140 78 130 96C125 106 118 112 114 118L116 170H72V130C64 128 56 126 52 121C48 117 47 112 49 108C47 106 46 103 48 100C46 98 45 95 47 92L40 86C42 80 45 76 47 70C47 58 50 42 58 30Z';
  const ZONE = 'M50 50C62 44 78 46 88 52L90 86H94C93 72 96 65 102 64C111 64 114 74 112 92L114 122H150V0H30V50Z';
  const VOLUME = 'M49 52C38 34 52 11 80 8C108 5 134 17 137 40C138 48 136 54 132 60L126 34C110 14 74 15 58 30Z';
  function styleSvg(style, uid = style.id) {
    const id = (k) => `${k}-${uid}`;
    const { top, bottom } = style;
    const hairTop = style.buzz ? '' : `
      <g clip-path="url(#${id('t')})">
        <path d="${VOLUME}" fill="var(--hair, #c8a46a)"/>
        <g clip-path="url(#${id('h')})"><rect x="0" y="0" width="160" height="${top}" fill="var(--hair, #c8a46a)" clip-path="url(#${id('z')})"/></g>
        <path d="M60 28C74 18 96 16 112 22M54 40C68 28 92 26 118 34M66 16C84 10 108 12 124 26" fill="none" stroke="var(--skin, #26221e)" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>
      </g>`;
    return `<svg viewBox="0 0 160 170" class="cut-svg" role="img" aria-label="${esc(tf('cut.back', '{name} visto de perfil', { name: styleName(style) }))}">
      <defs>
        <clipPath id="${id('h')}"><path d="${HEAD}"/></clipPath>
        <clipPath id="${id('z')}"><path d="${ZONE}"/></clipPath>
        <clipPath id="${id('t')}"><rect x="0" y="0" width="160" height="${top}"/></clipPath>
        <linearGradient id="${id('g')}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}">
          <stop offset="0" stop-color="var(--hair, #c8a46a)" stop-opacity="${style.buzz ? '.5' : '1'}"/>
          <stop offset="1" stop-color="var(--hair, #c8a46a)" stop-opacity="${style.buzz ? '.4' : '0'}"/>
        </linearGradient>
        <pattern id="${id('p')}" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".7" fill="var(--hair, #c8a46a)"/></pattern>
      </defs>
      <path d="${HEAD}" fill="var(--skin, #26221e)"/>
      <g clip-path="url(#${id('h')})">
        <g clip-path="url(#${id('z')})">
          <rect x="0" y="${top}" width="160" height="${bottom - top}" fill="url(#${id('g')})"/>
          <rect x="0" y="${top}" width="160" height="${Math.max(0, 122 - top)}" fill="url(#${id('p')})" opacity="${style.buzz ? '.9' : '.45'}"/>
        </g>
      </g>
      ${hairTop}
      <path d="${HEAD}" fill="none" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M101 66C108 64 112 72 111 82C110 92 104 97 99 95C96 94 95 90 97 87C99 84 97 80 98 76" fill="var(--skin, #26221e)" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M103 74C106 75 107 80 105 85" fill="none" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1" stroke-linecap="round"/>
      <path d="M50 64C54 61 59 61 63 63" fill="none" stroke="var(--hair, #c8a46a)" stroke-width="2" stroke-linecap="round"/>
      <path d="M52 71C55 69 58 69 61 71" fill="none" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1.2" stroke-linecap="round"/>
      ${style.buzz ? '' : `<line x1="86" x2="140" y1="${top}" y2="${top}" stroke="var(--fg, #ede6da)" stroke-width=".8" stroke-dasharray="2 3" opacity=".55" clip-path="url(#${id('h')})"/>`}
      <g transform="translate(142 0)" aria-hidden="true">
        <g class="cut-clip" style="--b:${bottom}px;--t:${top}px">
          <rect x="0" y="-5" width="24" height="10" rx="4" fill="var(--fg, #ede6da)"/>
          <rect x="-4" y="-6" width="5" height="12" rx="1.5" fill="var(--hair, #c8a46a)"/>
          <path d="M-4 -4H-6M-4 0H-6M-4 4H-6" stroke="var(--hair, #c8a46a)" stroke-width="1.2"/>
        </g>
      </g>
    </svg>`;
  }

  return {
    SERVICES, BARBERS, STYLES, HOURS, STEP, KEYS,
    tr, tf, catKey, catName, svcName, svcNote, styleName, styleDesc, barberRole,
    esc, hhmm, durTxt, priceTxt, madridNow, addDays, dow, fmtDay, longDate, rnd,
    simAppts, load, save, snapshot, busyReason, barberFree, slotsFor, styleSvg,
  };
})();
