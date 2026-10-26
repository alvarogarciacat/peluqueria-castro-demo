// Peluquería Castro · ajustes de la demo: colores, tipografía y fotos (combinables) + 5 combinaciones.
// Se carga en <head> (sin defer) para aplicar el tema antes de pintar y evitar parpadeos.
// Solo existe en la demo: en la web final se fija el tema elegido y este archivo desaparece.
(() => {
  const STORE = 'castro-demo-tema';

  const COLORES = {
    noche: { name: 'Noche y latón', desc: 'Oscuro elegante', sw: ['#0f0e0c', '#f3eee5', '#c8a46a'], meta: '#0f0e0c' },
    carbon: { name: 'Carbón y amarillo', desc: 'Urbano, con fuerza', sw: ['#0b0b0b', '#f5d000', '#f2f2ef'], meta: '#0b0b0b' },
    arena: { name: 'Arena y teja', desc: 'Claro, cálido y cercano', sw: ['#f6f1ea', '#c2562f', '#231d17'], meta: '#f6f1ea' },
    mar: { name: 'Blanco y azul', desc: 'Mediterráneo y luminoso', sw: ['#f7f8f6', '#1f5f99', '#12263a'], meta: '#f7f8f6' },
    neon: { name: 'Noche neón', desc: 'Juvenil y atrevido', sw: ['#0e1020', '#ff5d73', '#eef0ff'], meta: '#0e1020' },
  };

  const TIPOS = {
    clasica: { name: 'Clásica', desc: 'Instrument Serif + Manrope', family: '"Instrument Serif", serif', q: 'family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700' },
    urbana: { name: 'Urbana', desc: 'Archivo ancha + Inter', family: 'Archivo, sans-serif', style: 'font-weight:800;font-stretch:115%', q: 'family=Archivo:wdth,wght@62..125,400..900&family=Inter:wght@400;500;600;700' },
    fresca: { name: 'Fresca', desc: 'Bricolage Grotesque + Manrope', family: '"Bricolage Grotesque", sans-serif', style: 'font-weight:700', q: 'family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Manrope:wght@400;500;600;700' },
    redonda: { name: 'Redondeada', desc: 'Unbounded + Outfit', family: 'Unbounded, sans-serif', style: 'font-weight:600', q: 'family=Unbounded:wght@400..800&family=Outfit:wght@400;500;600;700' },
    editorial: { name: 'Editorial', desc: 'Fraunces + DM Sans', family: 'Fraunces, serif', style: 'font-weight:500', q: 'family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=DM+Sans:opsz,wght@9..40,400..700' },
  };

  const ROLES = ['hero', 'hero-movil', 'intro', 'feature', 'final', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  const CLASICA = {
    hero: 'img/hero-cliente.webp', 'hero-movil': 'img/hero-movil.webp', intro: 'img/salon.webp', feature: 'img/tijeras.webp',
    final: 'img/local.webp', g1: 'img/barba.webp', g2: 'img/corte.webp', g3: 'img/herramientas.webp',
    g4: 'img/peine.webp', g5: 'img/navaja.webp', g6: 'img/sillon.webp',
  };
  const FOTOS = {
    clasica: { name: 'Barbería clásica', desc: 'Tonos oscuros y cálidos', src: (r) => CLASICA[r] },
    urbana: { name: 'Urbana', desc: 'Joven, neón y diseños', src: (r) => `img/urbana/${r}.webp` },
    luminosa: { name: 'Luminosa', desc: 'Todas las edades, salón claro', src: (r) => `img/luminosa/${r}.webp` },
  };

  const PRESETS = {
    clasica: { name: 'Clásica premium', desc: 'Barbería elegante de toda la vida', color: 'noche', tipo: 'clasica', fotos: 'clasica' },
    urbana: { name: 'Urbana', desc: 'Calle, fuerza y fades', color: 'carbon', tipo: 'urbana', fotos: 'urbana' },
    familiar: { name: 'Fresca y familiar', desc: 'Cercana, para todas las edades', color: 'arena', tipo: 'fresca', fotos: 'luminosa' },
    mediterranea: { name: 'Mediterránea', desc: 'Luminosa y tranquila', color: 'mar', tipo: 'editorial', fotos: 'luminosa' },
    neon: { name: 'Neón juvenil', desc: 'La más joven y atrevida', color: 'neon', tipo: 'redonda', fotos: 'urbana' },
  };
  const DEFAULT = { color: 'noche', tipo: 'clasica', fotos: 'clasica' };

  // ---------- estado ----------
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // La URL manda sin guardar (?tema=urbana, o ?color=…&tipo=…&fotos=…): sirve para comparar sin pisar lo elegido
  let fromUrl = false;
  let cur = { ...DEFAULT, ...read() };
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('tema') && PRESETS[q.get('tema')]) { const p = PRESETS[q.get('tema')]; cur = { color: p.color, tipo: p.tipo, fotos: p.fotos }; fromUrl = true; }
    ['color', 'tipo', 'fotos'].forEach((k) => { if (q.get(k)) { cur[k] = q.get(k); fromUrl = true; } });
  } catch { /* */ }
  if (!COLORES[cur.color]) cur.color = DEFAULT.color;
  if (!TIPOS[cur.tipo]) cur.tipo = DEFAULT.tipo;
  if (!FOTOS[cur.fotos]) cur.fotos = DEFAULT.fotos;

  const root = document.documentElement;
  const loaded = new Set();
  function loadFont(q) {
    if (loaded.has(q)) return;
    loaded.add(q);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${q}&display=swap`;
    document.head.appendChild(l);
  }

  function applyPhotos() {
    const set = FOTOS[cur.fotos];
    document.querySelectorAll('[data-foto]').forEach((el) => {
      const url = set.src(el.dataset.foto);
      if (el.tagName === 'SOURCE') { if (el.getAttribute('srcset') !== url) el.setAttribute('srcset', url); }
      else if (el.getAttribute('src') !== url) el.setAttribute('src', url);
    });
  }

  function apply() {
    root.dataset.color = cur.color;
    root.dataset.tipo = cur.tipo;
    root.dataset.fotos = cur.fotos;
    loadFont(TIPOS[cur.tipo].q);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = COLORES[cur.color].meta;
    if (document.readyState !== 'loading') { applyPhotos(); syncUi(); }
  }
  apply();

  // Precarga de la foto principal del tema elegido
  if (document.querySelector('meta[name="castro-hero"]') || location.pathname.endsWith('/') || location.pathname.endsWith('index.html')) {
    const mob = matchMedia('(max-width: 760px)').matches;
    const l = document.createElement('link');
    l.rel = 'preload'; l.as = 'image'; l.href = FOTOS[cur.fotos].src(mob ? 'hero-movil' : 'hero');
    document.head.appendChild(l);
  }

  function set(patch) {
    cur = { ...cur, ...patch };
    if (!fromUrl) write(cur);
    apply();
  }

  // ---------- panel de ajustes ----------
  let ui = null;
  function syncUi() {
    if (!ui) return;
    ui.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k, v = b.dataset.v;
      const on = k === 'preset'
        ? ['color', 'tipo', 'fotos'].every((x) => PRESETS[v][x] === cur[x])
        : cur[k] === v;
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function buildUi() {
    if (document.body.dataset.noAjustes !== undefined) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aj-fab';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.2-.6-2 0-.9.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/></svg><span>Ajustes</span>';
    btn.setAttribute('aria-label', 'Ajustes de la demo: colores, tipografía y fotos');

    ui = document.createElement('dialog');
    ui.className = 'aj';
    ui.setAttribute('aria-label', 'Ajustes de la demo');
    const chip = (k, v, inner, cls = '') => `<button type="button" class="aj-opt ${cls}" data-k="${k}" data-v="${v}" aria-pressed="false">${inner}</button>`;
    const sw = (c) => `<span class="aj-sw">${c.map((x) => `<i style="background:${x}"></i>`).join('')}</span>`;
    const aa = (t) => `<span class="aj-aa" style="font-family:${t.family};${t.style || ''}">Aa</span>`;
    ui.innerHTML = `
      <div class="aj-head">
        <div><p class="aj-title">Ajustes de la demo</p><p class="aj-sub">Prueba combinaciones. Esto no aparecerá en la web final.</p></div>
        <button type="button" class="aj-x" data-aj-close aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="aj-body">
        <h3 class="aj-h">Combinaciones listas</h3>
        <div class="aj-grid aj-grid--presets">
          ${Object.entries(PRESETS).map(([id, p]) => chip('preset', id, `
            ${sw(COLORES[p.color].sw)}${aa(TIPOS[p.tipo])}
            <span class="aj-name">${p.name}</span><span class="aj-desc">${p.desc}</span>`, 'aj-opt--preset')).join('')}
        </div>
        <h3 class="aj-h">Colores</h3>
        <div class="aj-grid">${Object.entries(COLORES).map(([id, c]) => chip('color', id, `${sw(c.sw)}<span class="aj-name">${c.name}</span><span class="aj-desc">${c.desc}</span>`)).join('')}</div>
        <h3 class="aj-h">Tipografía</h3>
        <div class="aj-grid">${Object.entries(TIPOS).map(([id, t]) => chip('tipo', id, `${aa(t)}<span class="aj-name">${t.name}</span><span class="aj-desc">${t.desc}</span>`)).join('')}</div>
        <h3 class="aj-h">Fotos</h3>
        <div class="aj-grid aj-grid--fotos">${Object.entries(FOTOS).map(([id, f]) => chip('fotos', id, `<img src="${f.src('g1')}" alt="" loading="lazy"><span class="aj-name">${f.name}</span><span class="aj-desc">${f.desc}</span>`)).join('')}</div>
        <button type="button" class="aj-reset" data-aj-reset>Volver a la original</button>
      </div>`;
    document.body.append(btn, ui);

    btn.addEventListener('click', () => {
      Object.values(TIPOS).forEach((t) => loadFont(t.q)); // para ver el «Aa» de cada tipografía
      syncUi();
      ui.showModal();
    });
    ui.addEventListener('click', (e) => {
      if (e.target === ui || e.target.closest('[data-aj-close]')) return ui.close();
      if (e.target.closest('[data-aj-reset]')) return set({ ...DEFAULT });
      const b = e.target.closest('[data-k]');
      if (!b) return;
      if (b.dataset.k === 'preset') { const p = PRESETS[b.dataset.v]; set({ color: p.color, tipo: p.tipo, fotos: p.fotos }); }
      else set({ [b.dataset.k]: b.dataset.v });
    });
    syncUi();
  }

  document.addEventListener('DOMContentLoaded', () => { applyPhotos(); buildUi(); });
  // Si se cambia el tema en otra pestaña (p. ej. web y panel abiertos a la vez)
  window.addEventListener('storage', (e) => {
    if (e.key === STORE && !fromUrl) { cur = { ...DEFAULT, ...read() }; apply(); }
  });

  window.CastroTema = { PRESETS, COLORES, TIPOS, FOTOS, ROLES, get: () => ({ ...cur }), set };
})();
