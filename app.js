// The website: reads the address after "#" and draws the matching page.
//   #/                    home (map and links)
//   #/stop/main-garden    a Stop
//   #/plants              the Plant Guide
//   #/page/about-us       a Feature or other page from content/pages

const app = document.getElementById('app');
let garden;

const FEATURE_LINKS = [
  ['#/page/about-us', 'About us'],
  ['#/plants', 'Plant guide'],
  ['#/page/trust-for-nature', 'Trust for Nature'],
  ['#/page/fire-protection', 'Fire protection'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => marked.parse(s || '');

function topBar(right = '') {
  return `<nav class="topbar"><a href="#/">‹ Map</a><span>${right}</span></nav>`;
}

// ---------- Pages ----------

function renderHome() {
  const { data, body } = garden.home;
  const pins = garden.stops.filter((s) => s.map).map((s) => `
    <a class="pin" href="#/stop/${s.slug}" style="left:${s.map.x}%;top:${s.map.y}%" aria-label="${s.number}. ${esc(s.name)}">${s.number}</a>`).join('');

  app.innerHTML = `
    <header class="hero">
      ${data.photo ? `<img class="hero-photo" src="${esc(data.photo)}" alt="${esc(data.photo_alt || '')}">` : ''}
      <p class="eyebrow">Eco.Abode · ${esc(data.event || '')}</p>
      <h1>Welcome</h1>
      <div class="hero-text">${md(body)}</div>
    </header>

    <section class="map-wrap" aria-label="Garden map">
      <div class="map">
        <img src="images/map.png" alt="Illustrated map of the garden">
        <span class="gate" style="left:7%;top:18%">Gate</span>
        ${pins}
      </div>
    </section>

    <div class="note">
      <p><strong>${esc(data.route_note || '')}</strong></p>
      <p><strong>Accessible option:</strong> ${esc(data.accessible_note || '')}</p>
    </div>

    <h2 class="section-title">The stops</h2>
    <ol class="stop-list">
      ${garden.stops.map((s) => `<li><a href="#/stop/${s.slug}"><span class="num">${s.number}</span>${esc(s.name)}<span class="chev">›</span></a></li>`).join('')}
    </ol>

    <h2 class="section-title">More about Eco.Abode</h2>
    <ul class="links">
      ${FEATURE_LINKS.map(([href, label]) => `<li><a href="${href}">${label}<span class="chev">›</span></a></li>`).join('')}
    </ul>
    <footer class="footer">
      <p>Thanks for visiting · Shaun, Bec and Lexie</p>
      ${data.instagram ? `
        <a class="social" href="https://www.instagram.com/${encodeURIComponent(data.instagram)}/" target="_blank" rel="noopener" aria-label="Eco.Abode on Instagram">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </a>` : ''}
    </footer>`;
}

function renderStop(slug) {
  const stop = garden.findStop(slug);
  if (!stop) return renderNotFound();
  const next = garden.stops[stop.number]; // number is 1-based, so this is the following Stop

  const photo = stop.before
    ? compareMarkup(stop)
    : stop.now ? `<img class="photo" src="${esc(stop.now)}" alt="${esc(stop.name)} today">` : '';

  app.innerHTML = `
    ${topBar(`Stop ${stop.number} of ${stop.total}`)}
    <h1 class="page-title">${esc(stop.name)}</h1>
    ${photo}
    <div class="prose">${md(stop.body)}</div>

    <a class="plants-link" href="#/plants">
      <span><small>Wondering what that plant is?</small>See every plant in our garden</span>
      <span class="chev" aria-hidden="true">›</span>
    </a>

    ${next
      ? `<a class="next" href="#/stop/${next.slug}"><span><small>Next stop · ${next.number}</small>${esc(next.name)}</span><span aria-hidden="true">→</span></a>`
      : `<a class="next" href="#/"><span><small>That's the whole garden</small>Thanks for visiting</span><span aria-hidden="true">→</span></a>`}`;

  const compare = app.querySelector('.compare');
  if (compare) setUpCompare(compare);
}

// Which way the Plant Guide is browsed; remembered while the visitor moves around the site.
const plantView = { mode: 'az', bed: null };

async function renderPlants(focusSlug) {
  if (!garden.plantList) {
    app.innerHTML = `${topBar('Plant guide')}<p class="loading">Loading the plants…</p>`;
    garden.plantList = await garden.loadPlantList();
  }
  const { plants, beds } = garden.plantList;
  if (plantView.bed === null) plantView.bed = String(beds[0].key);
  if (focusSlug && plants.some((p) => p.slug === focusSlug)) plantView.mode = 'az';

  app.innerHTML = `
    ${topBar('Plant guide')}
    <h1 class="page-title">Plant guide</h1>
    <p class="intro">Every plant in our garden, all ${plants.length} of them. Tap a plant to find out more.</p>
    <div class="plant-filter" role="group" aria-label="Browse plants">
      <button type="button" data-view="az" aria-pressed="${plantView.mode === 'az'}">A–Z</button>
      <button type="button" data-view="bed" aria-pressed="${plantView.mode === 'bed'}">By garden bed</button>
    </div>
    <label class="bed-picker" ${plantView.mode === 'bed' ? '' : 'hidden'}>
      <span>Garden bed</span>
      <select id="bed-select">
        ${beds.map((b) => `<option value="${b.key}" ${String(b.key) === plantView.bed ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}
      </select>
    </label>
    <p class="plant-count" id="plant-count" aria-live="polite"></p>
    <div class="plant-guide" id="plant-list"></div>`;

  drawPlantList();
  const focused = focusSlug && document.getElementById(`plant-${focusSlug}`);
  if (focused) { openPlantCard(focused); focused.scrollIntoView(); }
}

function drawPlantList() {
  const { plants, beds } = garden.plantList;
  const bedLabel = beds.find((b) => String(b.key) === plantView.bed)?.label || '';
  const shown = plantView.mode === 'bed' ? plants.filter((p) => p.where.some((w) => String(w.key) === plantView.bed)) : plants;

  let letter = '';
  const items = shown.map((p) => {
    let heading = '';
    if (plantView.mode === 'az') {
      const first = garden.plantList.sortKey(p.name)[0].toUpperCase();
      if (first !== letter) { letter = first; heading = `<h2 class="plant-letter">${esc(first)}</h2>`; }
    }
    const extra = garden.findPlant(p.name); // Key Plants also have a description
    return `${heading}
      <details class="plant-card" id="plant-${p.slug}" name="plant-guide">
        <summary>
          ${p.thumb
            ? `<img class="plant-photo" src="${esc(p.thumb)}" alt="" loading="lazy">`
            : `<span class="plant-photo tile-placeholder" aria-hidden="true">${esc(garden.plantList.sortKey(p.name)[0].toUpperCase())}</span>`}
          <h3>${esc(p.name)}</h3>
          <span class="chev" aria-hidden="true">›</span>
        </summary>
        <div class="plant-text">
          ${p.photo ? `<img class="plant-photo-large" data-src="${esc(p.photo)}" alt="${esc(p.name)}">` : ''}
          ${p.botanical ? `<p class="botanical">${esc(p.botanical)}</p>` : ''}
          ${p.native ? '' : '<p class="tag-exotic">Not native</p>'}
          ${extra ? md(extra.description) : ''}
          ${p.where.length ? `<div class="also"><strong>Find it in:</strong><ul class="where-list">${p.where.map((w) => `<li>${esc(w.label)}</li>`).join('')}</ul></div>` : ''}
        </div>
      </details>`;
  });

  document.getElementById('plant-list').innerHTML = items.join('');
  document.getElementById('plant-count').textContent = plantView.mode === 'bed'
    ? `${shown.length} plants in ${bedLabel}`
    : `${shown.length} plants, A–Z`;
}

// The larger photo only downloads when a plant is opened, to save data on 4G.
function openPlantCard(card) {
  card.open = true;
  const img = card.querySelector('img[data-src]');
  if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
}

function setPlantView(mode, bed) {
  plantView.mode = mode;
  if (bed) plantView.bed = String(bed);
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === mode));
  document.querySelector('.bed-picker').hidden = mode !== 'bed';
  document.getElementById('bed-select').value = plantView.bed;
  drawPlantList();
}

async function renderPage(slug) {
  let page;
  try { page = await garden.loadPage(slug); } catch { return renderNotFound(); }
  const { data, body } = page;
  app.innerHTML = `
    ${topBar()}
    <h1 class="page-title">${esc(data.title || slug)}</h1>
    ${data.photo ? `<img class="photo" src="${esc(data.photo)}" alt="${esc(data.photo_alt || '')}">` : ''}
    <div class="prose">${md(body)}</div>`;
}

function renderNotFound() {
  app.innerHTML = `${topBar()}<h1 class="page-title">Page not found</h1><p class="intro">Head back to the map to find your way.</p>`;
}

// ---------- Now / before photo slider ----------

function compareMarkup(stop) {
  return `
    <div class="compare" style="--pos:8%">
      <img src="${esc(stop.now)}" alt="${esc(stop.name)} today">
      <img class="before" src="${esc(stop.before)}" alt="${esc(stop.name)} before">
      <span class="tag tag-now">Now</span>
      <span class="tag tag-before">Before</span>
      <div class="handle" role="slider" tabindex="0" aria-label="Slide to compare now and before"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="8"></div>
      <span class="hint" aria-hidden="true">Drag to see before</span>
    </div>`;
}

function setUpCompare(el) {
  const handle = el.querySelector('.handle');
  const set = (pct) => {
    pct = Math.max(0, Math.min(100, pct));
    el.style.setProperty('--pos', `${pct}%`);
    handle.setAttribute('aria-valuenow', Math.round(pct));
    el.classList.add('used');
    el.classList.toggle('mostly-before', pct > 85);
  };
  const fromEvent = (e) => {
    const r = el.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); fromEvent(e); });
  el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) fromEvent(e); });
  handle.addEventListener('keydown', (e) => {
    const now = Number(handle.getAttribute('aria-valuenow'));
    if (e.key === 'ArrowRight') { set(now + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { set(now - 5); e.preventDefault(); }
  });
}

// ---------- Plant pop-up ----------

app.addEventListener('click', (e) => {
  const view = e.target.closest('[data-view]');
  if (view) setPlantView(view.dataset.view);
});
app.addEventListener('change', (e) => {
  if (e.target.id === 'bed-select') setPlantView('bed', e.target.value);
});
// Load a plant's larger photo when it's opened by tapping.
app.addEventListener('toggle', (e) => {
  if (e.target.matches?.('.plant-card') && e.target.open) openPlantCard(e.target);
}, true);

// ---------- Routing ----------

function route() {
  const [, kind, slug] = location.hash.split('/');
  if (kind === 'stop') renderStop(slug);
  else if (kind === 'plants') renderPlants(slug);
  else if (kind === 'page') renderPage(slug);
  else renderHome();
  if (kind !== 'plants' || !slug) window.scrollTo(0, 0);
}

loadGarden()
  .then((g) => { garden = g; route(); window.addEventListener('hashchange', route); })
  .catch((err) => {
    app.innerHTML = `<p class="loading">Sorry, the garden guide couldn't load. ${esc(err.message)}</p>`;
    console.error(err);
  });
