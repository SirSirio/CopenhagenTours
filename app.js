/* global L, DATA */
(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = (id) => {
    const p = DATA.places[id];
    if (!p) { console.warn('Missing place:', id); return { id, name: id, lat: 55.68, lng: 12.58, kind: 'sight' }; }
    return Object.assign({ id }, p);
  };
  const tourById = (id) => DATA.tours.find((t) => t.id === id);
  const C = (key) => `var(--${key})`;

  const ICON = {
    fork: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 3v18M5 3c-2 0-2 6 0 6M5 3c2 0 2 6 0 6M13 3v18M13 3h4a3 3 0 0 1 0 6h-4"/></svg>',
    boat: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c2 2 4 2 6 0s4-2 6 0 4 2 6 0"/><path d="M5 14l1-5h12l1 5"/><path d="M12 4v5"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  };

  // ---------- Google Maps links ----------
  const gmPlace = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', ' + (p.addr || 'Copenhagen'))}`;
  const gmDir = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
  const gmRoute = (tour) => {
    const pts = tour.stops.filter((s) => !s.optional).map((s) => P(s.place));
    if (pts.length < 2) return '#';
    const o = pts[0], d = pts[pts.length - 1];
    let mid = pts.slice(1, -1);
    if (mid.length > 9) { // Google Maps app caps waypoints at 9 — sample evenly
      const step = mid.length / 9; mid = Array.from({ length: 9 }, (_, i) => mid[Math.floor(i * step)]);
    }
    const wp = mid.map((p) => `${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}&waypoints=${encodeURIComponent(wp)}&travelmode=walking`;
  };

  // ---------- router ----------
  const views = { home: 'home', tours: 'tours', tour: 'tour', map: 'map-view', eat: 'eat', defence: 'defence', info: 'info' };
  const tabOf = { home: 'home', defence: 'home', tours: 'tours', tour: 'tours', map: 'map', eat: 'eat', info: 'info' };
  let lastView = null;

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const view = views[parts[0]] ? parts[0] : 'home';
    const q = Object.fromEntries(new URLSearchParams(qs || ''));

    $$('.view').forEach((v) => v.classList.remove('active'));
    $('#' + views[view]).classList.add('active');
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabOf[view]));

    switch (view) {
      case 'home': renderHome(); break;
      case 'tours': renderTours(); break;
      case 'tour': renderTour(parts[1]); break;
      case 'map': showMap(q.f || 'all'); break;
      case 'eat': renderEat(parts[1] || 'rest'); break;
      case 'defence': renderDefence(); break;
      case 'info': renderInfo(); break;
    }
    if (view !== 'map' && !(view === 'eat' && lastView === 'eat')) window.scrollTo(0, 0);
    lastView = view;
  }

  // ---------- shared fragments ----------
  function tourCard(t) {
    const preview = t.stops.filter((s) => !s.eat && !s.optional && !s.transit).slice(0, 6).map((s) => `<span>${esc(P(s.place).name)}</span>`).join('');
    return `<a class="card" href="#/tour/${t.id}" style="--c:${C(t.id)}">
      <div class="card-top"><span class="badge">${t.num}</span><h3>${esc(t.name)}</h3></div>
      <p class="blurb">${esc(t.tagline)}</p>
      <div class="stops-preview">${preview}</div>
      <div class="meta"><span><b>${esc(t.km)}</b></span><span><b>${esc(t.hours)}</b></span><span><b>${esc(t.budget)}</b></span><span>${esc(t.best)}</span></div>
    </a>`;
  }

  function factsRow(p, extra = []) {
    const f = [];
    if (p.time) f.push(`<span>⏱ ${esc(p.time)}</span>`);
    if (p.cost) f.push(`<span>${esc(p.cost)}</span>`);
    if (p.hours) f.push(`<span>${esc(p.hours)}</span>`);
    extra.forEach((x) => f.push(x));
    f.push(`<a href="${gmPlace(p)}" target="_blank" rel="noopener">Google Maps</a>`);
    f.push(`<a href="${gmDir(p)}" target="_blank" rel="noopener">Walk there</a>`);
    return `<div class="facts">${f.join('')}</div>`;
  }

  // ---------- HOME ----------
  function renderHome() {
    const T = DATA.trip;
    const days = T.days.map((d) => `<div class="day${d.star ? ' star' : ''}" style="--c:${C(d.color)}">
        <a href="${d.href}"><div class="d">${esc(d.label)}</div><div class="t">${esc(d.title)}</div><div class="s">${esc(d.sub)}</div></a></div>`).join('');
    const cards = DATA.tours.map(tourCard).join('');
    $('#home').innerHTML = `
      <div class="wrap">
        <div class="hero"><div class="hero-grid"></div>
          <div class="eyebrow"><span class="pill solid" style="--c:${C('lx')}">${esc(T.edition)}</span><span>${esc(T.dates)} · ${esc(T.who)}</span></div>
          <h1>${esc(T.city)}<span class="dot">.</span></h1>
          <p class="sub">${T.intro}</p>
          <div class="daystrip">${days}</div>
        </div>
        <div class="section">
          <a class="callout" href="#/defence" style="display:block">
            <div class="k">★ ${esc(T.bigDay.label)}</div>
            <p><b>${esc(T.bigDay.title)}</b> — ${esc(T.bigDay.sub)} <span class="mono" style="color:var(--text)">→ open plan</span></p>
          </a>
        </div>
        <div class="section">
          <div class="section-head"><h2>Pick a line</h2><a class="more" href="#/tours">All tours →</a></div>
          <p class="muted" style="margin:-6px 0 16px;font-size:14.5px">${esc(T.tourIntro)}</p>
          <div class="cards">${cards}</div>
        </div>
        <div class="section">
          <div class="section-head"><h2>Eat &amp; drink</h2><a class="more" href="#/eat">Open lists →</a></div>
          <div class="cards three">
            <a class="card" href="#/eat" style="--c:${C('eat')}"><div class="card-top"><h3>Cheap &amp; good food</h3></div><p class="blurb">${DATA.restaurants.length} places, sortable by price, area and type. Smørrebrød, hot dogs, porridge, tacos, the lot.</p></a>
            <a class="card" href="#/eat/bars" style="--c:${C('bar')}"><div class="card-top"><h3>Cheap bars</h3></div><p class="blurb">${DATA.bars.length} bodegas, brewpubs and dives with honest beer prices — plus the legal "kiosk beer" trick.</p></a>
            <a class="card" href="#/eat/food" style="--c:${C('l3')}"><div class="card-top"><h3>Danish food 101</h3></div><p class="blurb">What to order, how to say it, and where each thing is best.</p></a>
          </div>
        </div>
        <div class="section">
          <div class="section-head"><h2>Map</h2><a class="more" href="#/map">Open →</a></div>
          <a class="card" href="#/map" style="--c:var(--line-2)"><div class="card-top"><h3>Everything on one map</h3></div><p class="blurb">Filter by line, food or bars, find yourself with the locate button, and jump to Google Maps for turn-by-turn.</p></a>
        </div>
        <footer class="foot">${T.footer}</footer>
      </div>`;
  }

  // ---------- TOURS ----------
  function renderTours() {
    const cards = DATA.tours.map(tourCard).join('');
    const bonus = DATA.bonus.map((b) => { const p = P(b.place); return `<div class="card place" style="--c:var(--line-2)"><div><h3>${esc(p.name)}</h3><div class="sub">${esc(b.near)}</div><p class="blurb">${esc(p.blurb)}</p><a class="maplink" href="${gmPlace(p)}" target="_blank" rel="noopener">${ICON.pin} Google Maps</a></div></div>`; }).join('');
    const trips = DATA.daytrips.map((d) => `<div class="card" style="--c:var(--line-2)"><div class="card-top"><h3>${esc(d.name)}</h3></div><p class="blurb">${esc(d.blurb)}</p><div class="meta"><span><b>${esc(d.how)}</b></span><span>${esc(d.cost)}</span><span>${esc(d.time)}</span></div>${d.link ? `<a class="maplink" href="${d.link}" target="_blank" rel="noopener" style="margin-top:8px;display:inline-flex;gap:4px;align-items:center;font-family:var(--font-mono);font-size:11.5px;color:var(--muted)">${ICON.pin} Google Maps</a>` : ''}</div>`).join('');
    $('#tours').innerHTML = `
      <div class="wrap">
        <div class="section">
          <div class="eyebrow" style="margin-bottom:10px">Six lines · pick by mood</div>
          <h2 style="font-size:32px;font-weight:700;letter-spacing:-.03em">Tours</h2>
          <p class="muted" style="margin:10px 0 18px;font-size:15px;max-width:60ch">${esc(DATA.trip.toursPage)}</p>
          <div class="cards">${cards}</div>
        </div>
        <div class="section">
          <div class="section-head"><h2>Bonus stops</h2><span class="more">slot into any line</span></div>
          <div class="cards">${bonus}</div>
        </div>
        <div class="section">
          <div class="section-head"><h2>Day trips</h2><span class="more">for a longer stay</span></div>
          <div class="cards">${trips}</div>
        </div>
      </div>`;
  }

  // ---------- TOUR DETAIL ----------
  let miniMap = null;
  function renderTour(id) {
    const t = tourById(id) || DATA.tours[0];
    let n = 0;
    const stops = t.stops.map((s) => {
      const p = P(s.place);
      const cls = ['stop']; let badge;
      if (s.eat) { cls.push('eat'); badge = ICON.fork; }
      else if (s.transit) { cls.push('transit'); badge = ICON.boat; }
      else { n += 1; badge = n; if (s.optional) cls.push('optional'); }
      const tags = [];
      if (s.optional) tags.push('<span class="tag">Optional</span>');
      if (s.eat) tags.push('<span class="tag">Eat / drink</span>');
      if (s.transit) tags.push('<span class="tag">Transit</span>');
      const extra = [];
      if (s.minutes) extra.push(`<span>⏱ ${s.minutes} min here</span>`);
      return `<div class="${cls.join(' ')}"><span class="badge">${badge}</span>
        <div class="stop-body">
          <h3>${esc(p.name)}${tags.join('')}</h3>
          <p class="note">${s.note || p.blurb || ''}</p>
          ${s.tip || p.tip ? `<div class="tip"><b>Tip</b> · ${s.tip || p.tip}</div>` : ''}
          ${factsRow(Object.assign({}, p, { time: null }), extra)}
        </div></div>`;
    }).join('');
    const tips = (t.tips || []).map((x) => `<li>${x}</li>`).join('');
    const stats = [['Distance', t.km], ['Time', t.hours], ['Budget', t.budget], ['Start → End', t.startEnd]]
      .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('');

    $('#tour').innerHTML = `
      <div class="wrap">
        <div class="tour-head" style="--c:${C(t.id)}">
          <a class="back" href="#/tours">← All lines</a>
          <div class="line-id"><span class="badge">${t.num}</span><span class="eyebrow" style="color:var(--c)">Line ${t.num} · ${esc(t.colorName)}</span></div>
          <h1>${esc(t.name)}</h1>
          <p class="tagline">${esc(t.tagline)}</p>
          <div class="stats">${stats}</div>
          <div class="btnrow" style="margin-top:14px">
            <a class="btn" href="${gmRoute(t)}" target="_blank" rel="noopener">${ICON.ext} Route in Google Maps</a>
            <a class="btn ghost" href="#/map?f=${t.id}">${ICON.pin} Show on big map</a>
          </div>
          <div class="minimap" id="minimap"></div>
        </div>
        <div class="section">
          <div class="section-head"><h2>Stops</h2><span class="more">${n} stops · ${esc(t.km)}</span></div>
          <p class="muted" style="margin:-6px 0 14px;font-size:14px">${esc(t.pace)}</p>
          <div class="route" style="--c:${C(t.id)}">${stops}</div>
        </div>
        ${tips ? `<div class="section"><div class="section-head"><h2>Good to know</h2></div><ul class="tips">${tips}</ul></div>` : ''}
        <div class="section">
          <div class="section-head"><h2>Other lines</h2></div>
          <div class="cards">${DATA.tours.filter((x) => x.id !== t.id).slice(0, 2).map(tourCard).join('')}</div>
        </div>
      </div>`;

    if (miniMap) { miniMap.remove(); miniMap = null; }
    miniMap = L.map('minimap', { zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false });
    tiles().addTo(miniMap);
    const group = tourLayer(t, { mini: true });
    group.addTo(miniMap);
    miniMap.fitBounds(group.getBounds(), { padding: [22, 22] });
    miniMap.on('click', () => { location.hash = `#/map?f=${t.id}`; });
    setTimeout(() => miniMap && miniMap.invalidateSize(), 60);
  }

  // ---------- MAP ----------
  let map = null, layers = {}, meMarker = null, watchId = null, currentFilter = null;
  // OpenStreetMap tiles, darkened with a CSS filter (see .leaflet-tile-pane in styles.css). No API key needed.
  const tiles = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  });

  function pin(p, opts) {
    const o = Object.assign({ color: 'l1', label: '', small: false, glyph: false }, opts);
    const cls = 'pin' + (o.small ? ' small' : '') + (o.glyph ? ' glyph' : '');
    const size = o.small ? 20 : 28;
    return L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: '', html: `<div class="${cls}" style="--c:${C(o.color)}">${o.label}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] }),
      title: p.name,
    });
  }
  function popup(p, kicker, color) {
    return `<div class="pop" style="--c:${C(color)}"><div class="k">${esc(kicker)}</div><h4>${esc(p.name)}</h4><p>${esc(p.blurb || '')}</p>
      <div class="links"><a href="${gmPlace(p)}" target="_blank" rel="noopener">Google Maps</a><a href="${gmDir(p)}" target="_blank" rel="noopener">Walk there</a></div></div>`;
  }
  function tourLayer(t, opts = {}) {
    const g = L.featureGroup();
    const pts = t.stops.filter((s) => !s.optional).map((s) => { const p = P(s.place); return [p.lat, p.lng]; });
    L.polyline(pts, { color: getComputedStyle(document.documentElement).getPropertyValue('--' + t.id).trim() || '#fff', weight: opts.mini ? 3 : 4, opacity: .85, lineJoin: 'round', dashArray: null }).addTo(g);
    let n = 0;
    t.stops.forEach((s) => {
      const p = P(s.place);
      let label, glyph = false, small = false;
      if (s.eat) { label = ICON.fork; glyph = true; small = false; }
      else if (s.transit) { label = ICON.boat; glyph = true; }
      else { n += 1; label = String(n); }
      const m = pin(p, { color: t.id, label, glyph, small });
      if (!opts.mini) m.bindPopup(popup(p, `Line ${t.num} · ${s.eat ? 'eat' : s.transit ? 'transit' : 'stop ' + n}${s.optional ? ' · optional' : ''}`, t.id));
      m.addTo(g);
    });
    return g;
  }

  function initMap() {
    map = L.map('map', { zoomControl: false }).setView([55.680, 12.585], 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    tiles().addTo(map);
    layers.all = L.featureGroup();
    DATA.tours.forEach((t) => { layers[t.id] = tourLayer(t); layers[t.id].addTo(layers.all); });
    layers.eat = L.featureGroup(DATA.restaurants.map((r) => { const p = P(r.place); return pin(p, { color: 'eat', label: ICON.fork, glyph: true }).bindPopup(popup(Object.assign({}, p, { blurb: `${r.type} · ${r.priceLabel} · ${p.blurb || ''}` }), 'Eat · ' + r.area, 'eat')); }));
    layers.bars = L.featureGroup(DATA.bars.map((b) => { const p = P(b.place); return pin(p, { color: 'bar', label: '◍', glyph: true }).bindPopup(popup(Object.assign({}, p, { blurb: `${b.beer} · ${p.blurb || ''}` }), 'Bar · ' + b.area, 'bar')); }));
    layers.mon = L.featureGroup(DATA.defence.mapPlaces.map((x, i) => { const p = P(x.place); return pin(p, { color: 'lx', label: x.label || String(i + 1) }).bindPopup(popup(p, 'Mon 28 · ' + x.kicker, 'lx')); }));
    const pts = DATA.defence.mapPlaces.filter((x) => x.route).map((x) => { const p = P(x.place); return [p.lat, p.lng]; });
    if (pts.length > 1) L.polyline(pts, { color: '#f1efe8', weight: 3, opacity: .6, dashArray: '6 8' }).addTo(layers.mon);

    $('#locate').addEventListener('click', locateMe);
  }

  function chipsHtml(active) {
    const items = [{ id: 'all', name: 'All lines', color: 'text' }]
      .concat(DATA.tours.map((t) => ({ id: t.id, name: `${t.num} · ${t.short}`, color: t.id })))
      .concat([{ id: 'eat', name: 'Eat', color: 'eat' }, { id: 'bars', name: 'Bars', color: 'bar' }, { id: 'mon', name: 'Mon 28', color: 'lx' }]);
    return items.map((c) => `<a class="chip${c.id === active ? ' active' : ''}" href="#/map?f=${c.id}" style="--c:${C(c.color)}"><i></i>${esc(c.name)}</a>`).join('');
  }

  function showMap(filter) {
    if (!map) initMap();
    $('#map-chips').innerHTML = chipsHtml(filter);
    if (filter === currentFilter) { setTimeout(() => map.invalidateSize(), 50); return; }
    Object.values(layers).forEach((l) => { if (map.hasLayer(l)) map.removeLayer(l); });
    const l = layers[filter] || layers.all;
    l.addTo(map);
    currentFilter = filter;
    setTimeout(() => {
      map.invalidateSize();
      const b = l.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [28, 28], maxZoom: 15 });
    }, 60);
    const activeChip = $('#map-chips .chip.active');
    if (activeChip) activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function locateMe() {
    if (!navigator.geolocation) { alert('Geolocation is not available on this device.'); return; }
    const onPos = (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pin me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 1000 }).addTo(map);
        map.setView(ll, Math.max(map.getZoom(), 15));
      } else { meMarker.setLatLng(ll); }
    };
    navigator.geolocation.getCurrentPosition((pos) => { onPos(pos); if (meMarker) map.setView(meMarker.getLatLng(), Math.max(map.getZoom(), 15)); },
      () => alert('Could not get your location. Check location permission for this site.'), { enableHighAccuracy: true, timeout: 10000 });
    if (watchId == null) watchId = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
  }

  // ---------- EAT & DRINK ----------
  const eatState = { price: 'all', area: 'all', type: 'all', sort: 'price', barArea: 'all', barSort: 'price' };
  const uniq = (arr) => Array.from(new Set(arr)).sort();
  const sel = (id, label, options, value) => `<div><label for="${id}">${label}</label><br><select id="${id}">${options.map((o) => `<option value="${esc(o[0])}"${o[0] === value ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;

  function renderEat(seg) {
    const segs = [['rest', 'Restaurants'], ['bars', 'Bars'], ['food', 'Danish food 101']];
    $('#eat').innerHTML = `<div class="wrap"><div class="section">
      <div class="eyebrow" style="margin-bottom:10px">Eat &amp; drink · cheap first</div>
      <div class="segment">${segs.map(([k, v]) => `<a href="#/eat/${k}" ${k === seg ? 'class="active"' : ''} role="button">${v}</a>`).join('')}</div>
      <div id="eat-body"></div></div></div>`;
    $$('.segment a').forEach((a) => { a.style.cssText = 'min-height:36px;padding:0 14px;border-radius:999px;font-family:var(--font-mono);font-size:12px;letter-spacing:.05em;color:var(--muted);display:inline-flex;align-items:center'; if (a.classList.contains('active')) { a.style.background = 'var(--surface-3)'; a.style.color = 'var(--text)'; } });
    if (seg === 'bars') renderBars(); else if (seg === 'food') renderFood(); else renderRestaurants();
  }

  function placeCard(p, x, color, kicker) {
    const badge = x.flag ? `<span class="flag">${esc(x.flag)}</span>` : '';
    return `<div class="card place" style="--c:${C(color)}">
      <div>
        <h3>${esc(p.name)}${badge}</h3>
        <div class="sub">${esc(kicker)}</div>
        <p class="blurb">${x.blurb || p.blurb || ''}</p>
        ${x.tryThis ? `<p class="try"><b>Order:</b> ${esc(x.tryThis)}</p>` : ''}
        ${x.hours ? `<div class="hours">${esc(x.hours)}</div>` : ''}
        <a class="maplink" href="${gmPlace(p)}" target="_blank" rel="noopener">${ICON.pin}<span>${esc(p.addr || 'Google Maps')}</span></a>
      </div>
      <div class="price">${esc(x.priceLabel)}</div>
    </div>`;
  }

  function renderRestaurants() {
    const R = DATA.restaurants;
    const areas = uniq(R.map((r) => r.area)), types = uniq(R.map((r) => r.type));
    let list = R.filter((r) => (eatState.price === 'all' || String(r.price) === eatState.price) && (eatState.area === 'all' || r.area === eatState.area) && (eatState.type === 'all' || r.type === eatState.type));
    const nm = (r) => P(r.place).name;
    list = list.slice().sort((a, b) => eatState.sort === 'price' ? (a.avg - b.avg) || nm(a).localeCompare(nm(b)) : eatState.sort === 'name' ? nm(a).localeCompare(nm(b)) : a.area.localeCompare(b.area) || a.avg - b.avg);
    const body = `<div class="toolbar">
        ${sel('f-price', 'Price', [['all', 'Any price'], ['1', 'Cheap · under 120 kr'], ['2', 'Mid · 120–250 kr'], ['3', 'Splurge · 250+ kr']], eatState.price)}
        ${sel('f-area', 'Area', [['all', 'All areas']].concat(areas.map((a) => [a, a])), eatState.area)}
        ${sel('f-type', 'Type', [['all', 'All types']].concat(types.map((a) => [a, a])), eatState.type)}
        ${sel('f-sort', 'Sort', [['price', 'Cheapest first'], ['area', 'By area'], ['name', 'A → Z']], eatState.sort)}
      </div>
      <div class="count">${list.length} of ${R.length} places · prices are per person, roughly</div>
      <div class="cards">${list.map((r) => placeCard(P(r.place), r, 'eat', `${r.type} · ${r.area}`)).join('')}</div>
      <div class="callout" style="margin-top:18px"><div class="k">Rule of thumb</div><p>${DATA.eatTip}</p></div>`;
    $('#eat-body').innerHTML = body;
    $('#f-price').onchange = (e) => { eatState.price = e.target.value; renderRestaurants(); };
    $('#f-area').onchange = (e) => { eatState.area = e.target.value; renderRestaurants(); };
    $('#f-type').onchange = (e) => { eatState.type = e.target.value; renderRestaurants(); };
    $('#f-sort').onchange = (e) => { eatState.sort = e.target.value; renderRestaurants(); };
  }

  function renderBars() {
    const B = DATA.bars;
    const areas = uniq(B.map((b) => b.area));
    let list = B.filter((b) => eatState.barArea === 'all' || b.area === eatState.barArea);
    list = list.slice().sort((a, b) => eatState.barSort === 'price' ? (a.avg - b.avg) || P(a.place).name.localeCompare(P(b.place).name) : eatState.barSort === 'name' ? P(a.place).name.localeCompare(P(b.place).name) : a.area.localeCompare(b.area) || a.avg - b.avg);
    $('#eat-body').innerHTML = `<div class="toolbar">
        ${sel('b-area', 'Area', [['all', 'All areas']].concat(areas.map((a) => [a, a])), eatState.barArea)}
        ${sel('b-sort', 'Sort', [['price', 'Cheapest beer first'], ['area', 'By area'], ['name', 'A → Z']], eatState.barSort)}
      </div>
      <div class="count">${list.length} bars · beer price = a normal draught/bottle, roughly</div>
      <div class="cards">${list.map((b) => placeCard(P(b.place), Object.assign({}, b, { priceLabel: b.beer }), 'bar', `${b.vibe} · ${b.area}`)).join('')}</div>
      <div class="callout" style="margin-top:18px"><div class="k">The local trick</div><p>${DATA.barTip}</p></div>`;
    $('#b-area').onchange = (e) => { eatState.barArea = e.target.value; renderBars(); };
    $('#b-sort').onchange = (e) => { eatState.barSort = e.target.value; renderBars(); };
  }

  function renderFood() {
    $('#eat-body').innerHTML = `<div class="count">${DATA.food101.length} things worth ordering at least once</div>
      <div class="foodgrid">${DATA.food101.map((f) => `<div class="food"><h4>${esc(f.name)} <span class="muted" style="font-weight:400;font-size:13px">${esc(f.say || '')}</span></h4><p>${f.what}</p><div class="where">→ ${esc(f.where)}</div></div>`).join('')}</div>`;
  }

  // ---------- DEFENCE DAY ----------
  function renderDefence() {
    const D = DATA.defence;
    const tl = D.timeline.map((x) => `<div class="tl${x.hi ? ' hi' : ''}"><div class="time">${esc(x.time)}</div><div class="body"><h3>${esc(x.title)}</h3><p>${x.text}</p>${x.facts ? `<div class="facts">${x.facts}</div>` : ''}</div></div>`).join('');
    const opts = D.options.map((o) => { const p = P(o.place); return `<div class="option${o.rec ? ' rec' : ''}" style="--c:${C('lx')}">
        <div class="k"><span class="pill">${esc(o.tag)}</span>${o.rec ? '<span class="pill" style="border-color:var(--lx);color:var(--lx)">Recommended</span>' : ''}</div>
        <h4>${esc(p.name)}</h4><p>${o.text}</p>
        <div class="facts"><span>${esc(o.price)}</span><span>${esc(o.hours)}</span><span>${esc(o.toAirport)}</span><a href="${gmPlace(p)}" target="_blank" rel="noopener">Google Maps</a>${o.book ? `<a href="${o.book}" target="_blank" rel="noopener">Book</a>` : ''}</div></div>`; }).join('');
    $('#defence').innerHTML = `<div class="wrap">
      <div class="tour-head" style="--c:${C('lx')}">
        <a class="back" href="#/">← Home</a>
        <div class="line-id"><span class="badge">★</span><span class="eyebrow" style="color:var(--c)">${esc(D.kicker)}</span></div>
        <h1>${esc(D.title)}</h1>
        <p class="tagline">${D.intro}</p>
        <div class="btnrow" style="margin-top:14px"><a class="btn ghost" href="#/map?f=mon">${ICON.pin} Show the day on the map</a></div>
      </div>
      <div class="section"><div class="section-head"><h2>Timeline</h2><span class="more">defence 13:00 · flight 19:00</span></div><div class="timeline">${tl}</div></div>
      <div class="section"><div class="section-head"><h2>Where to celebrate</h2><span class="more">late lunch, 15:30–17:00</span></div>
        <p class="muted" style="margin:-6px 0 6px;font-size:14.5px">${D.celebrateIntro}</p>
        <div class="options">${opts}</div></div>
      <div class="section"><div class="section-head"><h2>Morning options</h2><span class="more">before the defence</span></div><ul class="tips">${D.morning.map((m) => `<li>${m}</li>`).join('')}</ul></div>
      <div class="section"><div class="section-head"><h2>Don't forget</h2></div><ul class="tips">${D.checklist.map((m) => `<li>${m}</li>`).join('')}</ul></div>
    </div>`;
  }

  // ---------- INFO ----------
  function renderInfo() {
    const I = DATA.info;
    const cards = I.sections.map((s) => `<div class="info"><h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`).join('');
    const phrases = I.phrases.map(([da, en]) => `<div><div class="da">${esc(da)}</div><div class="en">${esc(en)}</div></div>`).join('');
    $('#info').innerHTML = `<div class="wrap">
      <div class="section"><div class="eyebrow" style="margin-bottom:10px">Practical</div><h2 style="font-size:32px;font-weight:700;letter-spacing:-.03em">Good to know</h2></div>
      <div class="section" style="padding-top:0;border-top:0"><div class="info-grid">${cards}</div></div>
      <div class="section"><div class="section-head"><h2>Ten words of Danish</h2></div><div class="info"><div class="phrases">${phrases}</div></div></div>
      <footer class="foot">${DATA.trip.footer}</footer>
    </div>`;
  }

  // ---------- boot ----------
  $('#brand-tag').textContent = DATA.trip.tag;
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
