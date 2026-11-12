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

  // Estilos de la guía de cortes. top/bottom: dónde empieza y acaba el degradado en la lámina de perfil (oreja ≈ 164–257).
  const STYLES = [
    { id: 'taper', name: 'Taper', desc: 'Degradado solo en patillas y nuca. El más discreto: queda bien a cualquier edad.', top: 228, bottom: 300 },
    { id: 'low', name: 'Low fade', desc: 'Empieza justo por encima de la oreja. Limpio y fácil de llevar.', top: 170, bottom: 238 },
    { id: 'mid', name: 'Mid fade', desc: 'Arranca a media altura, a la altura de la sien. El equilibrio entre clásico y moderno.', top: 132, bottom: 198 },
    { id: 'high', name: 'High fade', desc: 'Sube casi hasta la coronilla. Máximo contraste con la parte de arriba.', top: 96, bottom: 154 },
    { id: 'buzz', name: 'Rapado', desc: 'Todo corto y a la misma altura. Cero mantenimiento.', buzz: true, top: 0, bottom: 340 },
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
  // Lámina de perfil a línea con la piel rellena (calcada de la referencia elegida, coordenadas 402×437).
  // Pelo arriba, degradado suave según el corte y una maquinilla que sube por el degradado (animada por CSS).
  const LT = {"SKULL": "M78.5 88.0C78.2 87.7 76.2 87.7 77.0 86.0C77.8 84.3 81.0 80.3 83.0 78.0C85.0 75.7 87.0 74.0 89.0 72.0C91.0 70.0 93.0 67.8 95.0 66.0C97.0 64.2 99.0 62.7 101.0 61.0C103.0 59.3 105.0 57.5 107.0 56.0C109.0 54.5 111.0 53.3 113.0 52.0C115.0 50.7 117.0 49.2 119.0 48.0C121.0 46.8 123.0 46.2 125.0 45.0C127.0 43.8 129.0 42.2 131.0 41.0C133.0 39.8 135.0 38.8 137.0 38.0C139.0 37.2 141.0 36.8 143.0 36.0C145.0 35.2 147.0 33.8 149.0 33.0C151.0 32.2 153.0 31.5 155.0 31.0C157.0 30.5 159.0 30.5 161.0 30.0C163.0 29.5 165.0 28.5 167.0 28.0C169.0 27.5 171.0 27.3 173.0 27.0C175.0 26.7 177.0 26.3 179.0 26.0C181.0 25.7 183.0 25.3 185.0 25.0C187.0 24.7 189.0 24.2 191.0 24.0C193.0 23.8 195.0 24.2 197.0 24.0C199.0 23.8 201.0 23.2 203.0 23.0C205.0 22.8 207.0 23.0 209.0 23.0C211.0 23.0 213.0 22.8 215.0 23.0C217.0 23.2 219.0 23.8 221.0 24.0C223.0 24.2 225.0 24.0 227.0 24.0C229.0 24.0 231.0 23.8 233.0 24.0C235.0 24.2 237.0 24.7 239.0 25.0C241.0 25.3 243.0 25.7 245.0 26.0C247.0 26.3 249.0 26.7 251.0 27.0C253.0 27.3 255.0 27.5 257.0 28.0C259.0 28.5 261.0 29.3 263.0 30.0C265.0 30.7 267.0 31.3 269.0 32.0C271.0 32.7 273.0 33.3 275.0 34.0C277.0 34.7 279.0 35.2 281.0 36.0C283.0 36.8 285.0 38.0 287.0 39.0C289.0 40.0 291.0 41.0 293.0 42.0C295.0 43.0 297.0 43.8 299.0 45.0C301.0 46.2 303.0 47.5 305.0 49.0C307.0 50.5 309.0 52.3 311.0 54.0C313.0 55.7 315.0 57.2 317.0 59.0C319.0 60.8 321.0 62.7 323.0 65.0C325.0 67.3 327.0 70.2 329.0 73.0C331.0 75.8 333.3 79.2 335.0 82.0C336.7 84.8 337.8 87.7 339.0 90.0C340.2 92.3 341.2 94.0 342.0 96.0C342.8 98.0 343.2 100.0 344.0 102.0C344.8 104.0 346.2 106.0 347.0 108.0C347.8 110.0 348.5 112.0 349.0 114.0C349.5 116.0 349.5 118.0 350.0 120.0C350.5 122.0 351.7 124.0 352.0 126.0C352.3 128.0 351.8 130.0 352.0 132.0C352.2 134.0 352.7 136.0 353.0 138.0C353.3 140.0 353.6 142.0 354.0 144.0C354.4 146.0 355.2 148.0 355.5 150.0C355.8 152.0 355.8 154.0 356.0 156.0C356.2 158.0 356.4 160.0 356.5 162.0C356.6 164.0 356.5 166.0 356.5 168.0C356.5 170.0 356.5 172.0 356.5 174.0C356.5 176.0 356.7 178.0 356.5 180.0C356.3 182.0 355.8 184.0 355.5 186.0C355.2 188.0 354.8 190.0 354.5 192.0C354.2 194.0 354.0 196.0 353.5 198.0C353.0 200.0 352.2 202.0 351.5 204.0C350.8 206.0 350.2 208.0 349.5 210.0C348.8 212.0 348.2 214.0 347.5 216.0C346.8 218.0 345.8 220.0 345.0 222.0C344.2 224.0 343.4 226.0 342.5 228.0C341.6 230.0 340.5 232.0 339.5 234.0C338.5 236.0 337.5 238.0 336.5 240.0C335.5 242.0 334.5 244.0 333.5 246.0C332.5 248.0 331.5 250.0 330.5 252.0C329.5 254.0 328.5 256.0 327.5 258.0C326.5 260.0 325.4 262.0 324.5 264.0C323.6 266.0 322.8 268.0 322.0 270.0C321.2 272.0 320.3 274.0 319.5 276.0C318.7 278.0 317.8 280.0 317.0 282.0C316.2 284.0 315.7 286.0 315.0 288.0C314.3 290.0 313.5 292.0 313.0 294.0C312.5 296.0 312.3 298.0 312.0 300.0C311.7 302.0 311.1 304.0 311.0 306.0C310.9 308.0 311.3 310.0 311.5 312.0C311.7 314.0 311.6 316.0 312.0 318.0C312.4 320.0 313.3 322.0 314.0 324.0C314.7 326.0 315.3 328.0 316.0 330.0C316.7 332.0 317.2 334.0 318.0 336.0C318.8 338.0 320.0 340.0 321.0 342.0C322.0 344.0 323.0 346.0 324.0 348.0C325.0 350.0 326.0 352.0 327.0 354.0C328.0 356.0 328.9 358.0 330.0 360.0C331.1 362.0 332.9 365.0 333.5 366.0", "FACE": "M78.5 88.0C77.8 88.7 75.2 90.7 74.0 92.0C72.8 93.3 72.2 94.7 71.5 96.0C70.8 97.3 70.5 98.7 70.0 100.0C69.5 101.3 69.0 102.7 68.5 104.0C68.0 105.3 67.5 106.7 67.0 108.0C66.5 109.3 65.9 110.7 65.5 112.0C65.1 113.3 64.8 114.7 64.5 116.0C64.2 117.3 63.8 118.7 63.5 120.0C63.2 121.3 62.8 122.7 62.5 124.0C62.2 125.3 61.8 126.7 61.5 128.0C61.2 129.3 61.2 130.7 61.0 132.0C60.8 133.3 60.3 134.7 60.0 136.0C59.7 137.3 59.5 138.7 59.0 140.0C58.5 141.3 57.4 142.7 57.0 144.0C56.6 145.3 56.8 146.7 56.5 148.0C56.2 149.3 55.4 150.7 55.0 152.0C54.6 153.3 54.2 154.7 54.0 156.0C53.8 157.3 53.6 158.7 53.5 160.0C53.4 161.3 53.2 162.7 53.5 164.0C53.8 165.3 54.9 166.7 55.5 168.0C56.1 169.3 56.5 170.7 57.0 172.0C57.5 173.3 58.3 174.7 58.5 176.0C58.7 177.3 58.2 178.7 58.0 180.0C57.8 181.3 57.4 182.7 57.0 184.0C56.6 185.3 56.0 186.7 55.5 188.0C55.0 189.3 54.7 190.7 54.0 192.0C53.3 193.3 52.3 194.7 51.5 196.0C50.7 197.3 49.9 198.7 49.0 200.0C48.1 201.3 47.0 202.7 46.0 204.0C45.0 205.3 44.0 206.7 43.0 208.0C42.0 209.3 40.8 210.7 40.0 212.0C39.2 213.3 38.8 214.7 38.0 216.0C37.2 217.3 36.2 218.7 35.0 220.0C33.8 221.3 32.3 222.7 31.0 224.0C29.7 225.3 28.2 226.7 27.0 228.0C25.8 229.3 24.7 230.7 24.0 232.0C23.3 233.3 23.2 234.7 23.0 236.0C22.8 237.3 22.8 238.7 23.0 240.0C23.2 241.3 23.5 242.7 24.0 244.0C24.5 245.3 24.8 246.7 26.0 248.0C27.2 249.3 27.8 250.7 31.0 252.0C34.2 253.3 43.0 254.7 45.5 256.0C48.0 257.3 45.8 258.7 46.0 260.0C46.2 261.3 46.8 262.7 47.0 264.0C47.2 265.3 46.8 266.7 47.0 268.0C47.2 269.3 48.0 270.7 48.0 272.0C48.0 273.3 47.6 274.7 47.0 276.0C46.4 277.3 45.0 278.7 44.5 280.0C44.0 281.3 43.6 282.7 44.0 284.0C44.4 285.3 44.5 286.7 47.0 288.0C49.5 289.3 58.2 290.7 59.0 292.0C59.8 293.3 53.3 294.7 52.0 296.0C50.7 297.3 51.4 298.7 51.0 300.0C50.6 301.3 49.8 302.7 49.5 304.0C49.2 305.3 48.3 306.7 49.0 308.0C49.7 309.3 52.2 310.7 53.5 312.0C54.8 313.3 56.3 314.7 57.0 316.0C57.7 317.3 57.5 318.7 57.5 320.0C57.5 321.3 57.2 322.7 57.0 324.0C56.8 325.3 56.3 326.7 56.0 328.0C55.7 329.3 55.3 330.7 55.0 332.0C54.7 333.3 54.3 334.7 54.0 336.0C53.7 337.3 53.2 338.7 53.0 340.0C52.8 341.3 53.0 342.7 53.0 344.0C53.0 345.3 52.8 346.7 53.0 348.0C53.2 349.3 53.5 350.7 54.0 352.0C54.5 353.3 55.1 354.7 56.0 356.0C56.9 357.3 58.9 359.3 59.5 360.0", "JAW": "M62.0 362.0C63.0 362.3 66.0 363.5 68.0 364.0C70.0 364.5 72.0 364.8 74.0 365.0C76.0 365.2 78.0 365.0 80.0 365.0C82.0 365.0 84.0 365.2 86.0 365.0C88.0 364.8 90.0 364.3 92.0 364.0C94.0 363.7 96.0 363.3 98.0 363.0C100.0 362.7 102.0 362.3 104.0 362.0C106.0 361.7 108.0 361.3 110.0 361.0C112.0 360.7 114.0 360.5 116.0 360.0C118.0 359.5 120.0 358.5 122.0 358.0C124.0 357.5 126.0 357.5 128.0 357.0C130.0 356.5 132.0 355.5 134.0 355.0C136.0 354.5 138.0 354.5 140.0 354.0C142.0 353.5 144.0 352.5 146.0 352.0C148.0 351.5 150.0 351.5 152.0 351.0C154.0 350.5 156.0 349.7 158.0 349.0C160.0 348.3 162.0 347.7 164.0 347.0C166.0 346.3 168.0 345.7 170.0 345.0C172.0 344.3 174.0 343.8 176.0 343.0C178.0 342.2 180.0 341.2 182.0 340.0C184.0 338.8 186.0 337.8 188.0 336.0C190.0 334.2 192.0 332.7 194.0 329.0C196.0 325.3 198.0 319.8 200.0 314.0C202.0 308.2 205.0 297.3 206.0 294.0", "THROAT": "M148.5 352.0C149.5 353.0 153.3 356.0 154.5 358.0C155.7 360.0 155.4 362.0 155.5 364.0C155.6 366.0 155.2 368.0 155.0 370.0C154.8 372.0 154.3 374.0 154.5 376.0C154.7 378.0 155.2 380.0 156.0 382.0C156.8 384.0 158.2 386.0 159.5 388.0C160.8 390.0 162.2 392.0 163.5 394.0C164.8 396.0 166.2 398.0 167.5 400.0C168.8 402.0 169.9 404.0 171.0 406.0C172.1 408.0 172.8 410.0 174.0 412.0C175.2 414.0 176.9 416.0 178.0 418.0C179.1 420.0 180.1 423.0 180.5 424.0", "EAR": "M224.0 183.0C224.8 181.8 226.5 178.2 229.0 176.0C231.5 173.8 234.7 171.9 239.0 170.0C243.3 168.1 250.0 164.5 255.0 164.5C260.0 164.5 265.7 168.1 269.0 170.0C272.3 171.9 273.5 174.0 275.0 176.0C276.5 178.0 277.3 179.7 278.0 182.0C278.7 184.3 279.0 187.5 279.0 190.0C279.0 192.5 278.7 194.3 278.0 197.0C277.3 199.7 276.2 203.5 275.0 206.0C273.8 208.5 272.5 210.0 271.0 212.0C269.5 214.0 267.8 216.0 266.0 218.0C264.2 220.0 261.8 222.0 260.0 224.0C258.2 226.0 256.8 228.0 255.0 230.0C253.2 232.0 250.8 234.0 249.0 236.0C247.2 238.0 245.7 240.0 244.0 242.0C242.3 244.0 241.0 246.0 239.0 248.0C237.0 250.0 235.5 252.8 232.0 254.0C228.5 255.2 221.3 255.8 218.0 255.0C214.7 254.2 213.0 250.0 212.0 249.0", "BROW": "M62.0 166.0C63.3 165.1 66.7 161.9 70.0 160.5C73.3 159.1 77.8 157.6 82.0 157.5C86.2 157.4 91.0 158.8 95.0 160.0C99.0 161.2 103.2 163.2 106.0 164.5C108.8 165.8 111.0 167.4 112.0 168.0", "SIL": "M78.5 88.0L77.0 86.0L83.0 78.0L89.0 72.0L95.0 66.0L101.0 61.0L107.0 56.0L113.0 52.0L119.0 48.0L125.0 45.0L131.0 41.0L137.0 38.0L143.0 36.0L149.0 33.0L155.0 31.0L161.0 30.0L167.0 28.0L173.0 27.0L179.0 26.0L185.0 25.0L191.0 24.0L197.0 24.0L203.0 23.0L209.0 23.0L215.0 23.0L221.0 24.0L227.0 24.0L233.0 24.0L239.0 25.0L245.0 26.0L251.0 27.0L257.0 28.0L263.0 30.0L269.0 32.0L275.0 34.0L281.0 36.0L287.0 39.0L293.0 42.0L299.0 45.0L305.0 49.0L311.0 54.0L317.0 59.0L323.0 65.0L329.0 73.0L335.0 82.0L339.0 90.0L342.0 96.0L344.0 102.0L347.0 108.0L349.0 114.0L350.0 120.0L352.0 126.0L352.0 132.0L353.0 138.0L354.0 144.0L355.5 150.0L356.0 156.0L356.5 162.0L356.5 168.0L356.5 174.0L356.5 180.0L355.5 186.0L354.5 192.0L353.5 198.0L351.5 204.0L349.5 210.0L347.5 216.0L345.0 222.0L342.5 228.0L339.5 234.0L336.5 240.0L333.5 246.0L330.5 252.0L327.5 258.0L324.5 264.0L322.0 270.0L319.5 276.0L317.0 282.0L315.0 288.0L313.0 294.0L312.0 300.0L311.0 306.0L311.5 312.0L312.0 318.0L314.0 324.0L316.0 330.0L318.0 336.0L321.0 342.0L324.0 348.0L327.0 354.0L330.0 360.0L333.5 366.0L333.5 437.0L180.5 437.0L180.5 424.0L178.0 418.0L174.0 412.0L171.0 406.0L167.5 400.0L163.5 394.0L159.5 388.0L156.0 382.0L154.5 376.0L155.0 370.0L155.5 364.0L154.5 358.0L148.5 352.0L146.0 352.0L140.0 354.0L134.0 355.0L128.0 357.0L122.0 358.0L116.0 360.0L110.0 361.0L104.0 362.0L98.0 363.0L92.0 364.0L86.0 365.0L80.0 365.0L74.0 365.0L68.0 364.0L62.0 362.0L59.5 360.0L56.0 356.0L54.0 352.0L53.0 348.0L53.0 344.0L53.0 340.0L54.0 336.0L55.0 332.0L56.0 328.0L57.0 324.0L57.5 320.0L57.0 316.0L53.5 312.0L49.0 308.0L49.5 304.0L51.0 300.0L52.0 296.0L59.0 292.0L47.0 288.0L44.0 284.0L44.5 280.0L47.0 276.0L48.0 272.0L47.0 268.0L47.0 264.0L46.0 260.0L45.5 256.0L31.0 252.0L26.0 248.0L24.0 244.0L23.0 240.0L23.0 236.0L24.0 232.0L27.0 228.0L31.0 224.0L35.0 220.0L38.0 216.0L40.0 212.0L43.0 208.0L46.0 204.0L49.0 200.0L51.5 196.0L54.0 192.0L55.5 188.0L57.0 184.0L58.0 180.0L58.5 176.0L57.0 172.0L55.5 168.0L53.5 164.0L53.5 160.0L54.0 156.0L55.0 152.0L56.5 148.0L57.0 144.0L59.0 140.0L60.0 136.0L61.0 132.0L61.5 128.0L62.5 124.0L63.5 120.0L64.5 116.0L65.5 112.0L67.0 108.0L68.5 104.0L70.0 100.0L71.5 96.0L74.0 92.0L78.5 88.0Z"};
  const LT_ZONE = 'M50 0V86L156 94L160 150C165 176 171 198 180 220C192 202 208 182 236 168C250 160 268 162 276 172C284 184 282 210 276 226L300 340H420V0Z';
  function styleSvg(style, uid = style.id) {
    const id = (k) => `${k}-${uid}`;
    const { top, bottom } = style;
    const mark = style.buzz ? 40 : top; // altura de la línea: en el rapado, arriba del todo (coronilla)
    // La línea sobresale lo mismo por delante de la cara que por detrás de la nuca (bordes medidos en la lámina a esa altura)
    const [mx1, mx2] = { taper: [4, 374], low: [26, 388], mid: [30, 384], high: [40, 373], buzz: [101, 322] }[style.id] || [30, 384];
    const line = (d, w) => `<path d="${d}" style="fill:none;stroke:var(--fg, #ede6da);stroke-width:${w};stroke-linecap:round;stroke-linejoin:round"/>`;
    const hair = style.buzz ? `<rect width="420" height="340" fill="url(#${id('g')})"/>`
      : `<rect width="420" height="${top}" style="fill:var(--hair, #c8a46a)"/><rect y="${top - 1}" width="420" height="${bottom - top + 1}" fill="url(#${id('g')})"/>`;
    return `<svg viewBox="0 0 402 437" class="cut-svg" role="img" aria-label="${esc(tf('cut.back', '{name} visto de perfil', { name: styleName(style) }))}">
      <defs>
        <clipPath id="${id('h')}"><path d="${LT.SIL}"/></clipPath>
        <clipPath id="${id('z')}"><path d="${LT_ZONE}"/></clipPath>
        <linearGradient id="${id('g')}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}">
          <stop offset="0" style="stop-color:var(--hair, #c8a46a);stop-opacity:${style.buzz ? '.4' : '1'}"/>
          <stop offset="1" style="stop-color:var(--hair, #c8a46a);stop-opacity:${style.buzz ? '.3' : '0'}"/>
        </linearGradient>
        <linearGradient id="${id('f')}" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="430"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="${id('m')}"><rect width="420" height="437" fill="url(#${id('f')})"/></mask>
      </defs>
      <path d="${LT.SIL}" style="fill:var(--skin, #26221e)" mask="url(#${id('m')})"/>
      <g clip-path="url(#${id('h')})"><g clip-path="url(#${id('z')})">${hair}</g></g>
      ${line(LT.SKULL, 2.6)}${line(LT.FACE, 2.6)}${line(LT.JAW, 2.4)}${line(LT.THROAT, 2.2)}${line(LT.EAR, 2.8)}${line(LT.BROW, 2.6)}
      <line class="cut-mark" x1="${mx1}" x2="${mx2}" y1="${mark}" y2="${mark}" style="stroke:var(--fg, #ede6da);stroke-width:3;stroke-dasharray:12 9;transform-origin:${mx2}px 0" opacity=".85"/>
      <g aria-hidden="true">
        <g class="cut-clip" style="--b:${style.buzz ? 300 : bottom}px;--t:${mark}px;--x0:${mx2 + 9}px;--x1:${mx1 + 9}px">
          <rect y="-12" width="52" height="24" rx="9" style="fill:var(--fg, #ede6da)"/>
          <rect x="-9" y="-14" width="12" height="28" rx="3.5" style="fill:var(--hair, #c8a46a)"/>
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
