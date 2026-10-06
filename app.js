// The website: reads the address after "#" and draws the matching page.
//   #/                    home (map and links)
//   #/stop/main-garden    a Stop
//   #/plants              the Plant Guide
//   #/page/about-us       a Feature or other page from content/pages

const app = document.getElementById('app');
const sheet = document.getElementById('plant-sheet');
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

function plantTile(plant) {
  const picture = plant.photo
    ? `<img src="${esc(plant.photo)}" alt="" loading="lazy">`
    : `<span class="tile-placeholder" aria-hidden="true">${esc(plant.name[0])}</span>`;
  return `<button class="plant-tile" type="button" data-plant="${esc(plant.name)}">${picture}<span>${esc(plant.name)}</span></button>`;
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
  const plants = stop.keyPlants.map((n) => garden.findPlant(n)).filter(Boolean);

  const photo = stop.before
    ? compareMarkup(stop)
    : stop.now ? `<img class="photo" src="${esc(stop.now)}" alt="${esc(stop.name)} today">` : '';

  app.innerHTML = `
    ${topBar(`Stop ${stop.number} of ${stop.total}`)}
    <h1 class="page-title">${esc(stop.name)}</h1>
    ${photo}
    <div class="prose">${md(stop.body)}</div>

    ${plants.length ? `
      <h2 class="section-title">Key plants here</h2>
      <div class="tiles">${plants.map(plantTile).join('')}</div>` : ''}

    ${stop.otherPlants.length ? `
      <p class="also"><strong>Also here:</strong> ${esc(stop.otherPlants.join(', '))}</p>` : ''}

    ${next
      ? `<a class="next" href="#/stop/${next.slug}"><span><small>Next stop · ${next.number}</small>${esc(next.name)}</span><span aria-hidden="true">→</span></a>`
      : `<a class="next" href="#/"><span><small>That's the whole garden</small>Thanks for visiting</span><span aria-hidden="true">→</span></a>`}`;

  const compare = app.querySelector('.compare');
  if (compare) setUpCompare(compare);
}

function renderPlants(focusSlug) {
  app.innerHTML = `
    ${topBar('Plant guide')}
    <h1 class="page-title">Plant guide</h1>
    <p class="intro">The plants visitors ask us about most. You'll find them all over the garden.</p>
    <div class="plant-guide">
    ${garden.plants.map((p) => `
      <article class="plant-card" id="plant-${p.slug}">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : ''}
        <h2>${esc(p.name)}</h2>
        ${p.botanical ? `<p class="botanical">${esc(p.botanical)}</p>` : ''}
        ${md(p.description)}
        ${p.stops.length ? `<p class="also"><strong>Find it at:</strong> ${p.stops.map((s) => `<a href="#/stop/${s.slug}">${esc(s.name)}</a>`).join(', ')}</p>` : ''}
      </article>`).join('')}
    </div>`;
  if (focusSlug) document.getElementById(`plant-${focusSlug}`)?.scrollIntoView();
}

async function renderPage(slug) {
  let page;
  try { page = await garden.loadPage(slug); } catch { return renderNotFound(); }
  const { data, body } = page;
  app.innerHTML = `
    ${topBar()}
    <h1 class="page-title">${esc(data.title || slug)}</h1>
    ${data.photo ? `<img class="photo" src="${esc(data.photo)}" alt="">` : ''}
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

function openPlant(name) {
  const plant = garden.findPlant(name);
  if (!plant) return;
  document.getElementById('plant-sheet-name').textContent = plant.name;
  document.getElementById('plant-sheet-botanical').textContent = plant.botanical;
  const elsewhere = plant.stops.filter((s) => `#/stop/${s.slug}` !== location.hash);
  document.getElementById('plant-sheet-body').innerHTML = `
    ${plant.photo ? `<img class="sheet-photo" src="${esc(plant.photo)}" alt="${esc(plant.name)}">` : `<div class="sheet-photo tile-placeholder" aria-hidden="true">${esc(plant.name[0])}</div>`}
    ${md(plant.description)}
    ${elsewhere.length ? `<p class="also"><strong>Also find it at:</strong> ${esc(elsewhere.map((s) => s.name).join(', '))}</p>` : ''}
    <a class="sheet-link" href="#/plants/${plant.slug}">See all key plants ›</a>`;
  sheet.showModal();
}

app.addEventListener('click', (e) => {
  const tile = e.target.closest('[data-plant]');
  if (tile) openPlant(tile.dataset.plant);
});
sheet.addEventListener('click', (e) => {
  if (e.target === sheet || e.target.closest('.sheet-close') || e.target.closest('.sheet-link')) sheet.close();
});

// ---------- Routing ----------

function route() {
  if (sheet.open) sheet.close();
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
