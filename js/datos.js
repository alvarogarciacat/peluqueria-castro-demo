// Peluquería Castro · datos y lógica de disponibilidad compartidos por la web y el panel.
// DEMO: las citas "de ejemplo" se simulan y las reservas/bloqueos se guardan en localStorage.
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

  // Estilos de la guía de cortes (alturas del degradado). top/bottom: dónde empieza y acaba el degradado en la ilustración.
  const STYLES = [
    { id: 'taper', name: 'Taper', desc: 'Degradado solo en patillas y nuca. El más discreto: queda bien a cualquier edad.', top: 86, bottom: 106 },
    { id: 'low', name: 'Low fade', desc: 'Empieza justo por encima de la oreja. Limpio y fácil de llevar.', top: 72, bottom: 94 },
    { id: 'mid', name: 'Mid fade', desc: 'Arranca a media altura, a la altura de la sien. El equilibrio entre clásico y moderno.', top: 56, bottom: 80 },
    { id: 'high', name: 'High fade', desc: 'Sube casi hasta la coronilla. Máximo contraste con la parte de arriba.', top: 40, bottom: 64 },
    { id: 'buzz', name: 'Rapado', desc: 'Todo corto y a la misma altura. Cero mantenimiento.', buzz: true },
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
  const priceTxt = (s) => `${s.from ? 'desde ' : ''}${s.price} €`;

  function madridNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { ymd: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
  }
  const toDate = (ymd) => new Date(`${ymd}T12:00:00Z`);
  const addDays = (ymd, n) => { const d = toDate(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (ymd) => toDate(ymd).getUTCDay();
  const fmtDay = (ymd, opts) => new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...opts }).format(toDate(ymd));
  const longDate = (ymd) => fmtDay(ymd, { weekday: 'long', day: 'numeric', month: 'long' });

  // Hash determinista → [0,1): la agenda simulada es estable para cada día y barbero
  function rnd(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  // ---------- almacenamiento (demo) ----------
  const load = (key) => { try { return JSON.parse(localStorage.getItem(KEYS[key])) || []; } catch { return []; } };
  const save = (key, list) => { try { localStorage.setItem(KEYS[key], JSON.stringify(list)); } catch { /* sin almacenamiento */ } };

  // ---------- disponibilidad ----------
  const simBusy = (barberId, ymd, m) => rnd(`${ymd}|${barberId}|${Math.floor(m / 30)}`) < 0.28;

  // Motivo por el que el bloque de 15 min que empieza en `m` está ocupado (o null si está libre)
  function busyReason(barberId, ymd, m, data) {
    const b = data.bookings.find((x) => x.barber === barberId && x.date === ymd && m >= x.time && m < x.time + x.dur);
    if (b) return { type: 'booking', item: b };
    const k = data.blocks.find((x) => x.barber === barberId && x.date === ymd && m >= x.from && m < x.to);
    if (k) return { type: 'block', item: k };
    if (simBusy(barberId, ymd, m)) return { type: 'sim' };
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
  function styleSvg(style, uid = style.id) {
    const g = `g-${uid}`, c = `c-${uid}`;
    const hair = style.buzz
      ? `<rect x="0" y="0" width="120" height="140" fill="var(--hair, #c8a46a)" opacity=".42" clip-path="url(#${c})"/>`
      : `<defs><linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="140">
           <stop offset="${style.top / 140}" stop-color="var(--hair, #c8a46a)"/>
           <stop offset="${style.bottom / 140}" stop-color="var(--hair, #c8a46a)" stop-opacity="0"/>
         </linearGradient></defs>
         <path d="M23 50 C 22 2, 98 2, 97 50 C 90 28, 30 28, 23 50 Z" fill="var(--hair, #c8a46a)"/>
         <rect x="0" y="0" width="120" height="140" fill="url(#${g})" clip-path="url(#${c})"/>
         <line x1="16" x2="104" y1="${style.top}" y2="${style.top}" stroke="var(--fg, #ede6da)" stroke-width=".8" stroke-dasharray="2 3" opacity=".55" clip-path="url(#${c})"/>`;
    return `<svg viewBox="0 0 120 140" class="cut-svg" role="img" aria-label="${esc(style.name)} visto desde atrás">
      <defs><clipPath id="${c}"><ellipse cx="60" cy="64" rx="38" ry="46"/></clipPath></defs>
      <path d="M44 100 L44 140 L76 140 L76 100 Z" fill="var(--skin, #26221e)" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1"/>
      <ellipse cx="22" cy="74" rx="7" ry="12" fill="var(--skin, #26221e)" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1"/>
      <ellipse cx="98" cy="74" rx="7" ry="12" fill="var(--skin, #26221e)" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1"/>
      <ellipse cx="60" cy="64" rx="38" ry="46" fill="var(--skin, #26221e)" stroke="var(--outline, rgba(237,230,218,.35))" stroke-width="1"/>
      ${hair}
    </svg>`;
  }

  return {
    SERVICES, BARBERS, STYLES, HOURS, STEP, KEYS,
    esc, hhmm, durTxt, priceTxt, madridNow, addDays, dow, fmtDay, longDate, rnd,
    load, save, snapshot, busyReason, barberFree, slotsFor, styleSvg,
  };
})();
