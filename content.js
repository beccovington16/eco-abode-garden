// Loads the garden's words and photos from the files in content/.
// Shared by the website (app.js) and the printable signs (signs.html).

async function readText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Couldn't load ${path}`);
  return res.text();
}

// Splits "---\nkey: value\n---\nbody" into { data, body }.
function parseFrontMatter(src) {
  const match = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: src };
  return { data: parseFields(match[1]), body: match[2].trim() };
}

function parseFields(text) {
  const data = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return data;
}

const splitList = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);

// Lines starting with a single "#" are notes for whoever edits the file ("## " headings are kept).
const withoutComments = (text) => text.split('\n').filter((l) => !/^\s*#(?!#)/.test(l)).join('\n');

const slugify = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function loadStop(slug, index, total) {
  const { data, body } = parseFrontMatter(await readText(`content/stops/${slug}.md`));
  const [x, y] = splitList(data.map).map(Number);
  return {
    slug,
    number: index + 1,
    total,
    name: data.name || slug,
    map: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null,
    now: data.now || '',
    before: data.before || '',
    keyPlants: splitList(data.key_plants),
    otherPlants: splitList(data.other_plants),
    body,
  };
}

// key-plants.md is a list of "## Name" sections: a few "field: value" lines, a blank line, then the description.
function parseKeyPlants(src) {
  return withoutComments(src)
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const [nameLine, ...rest] = chunk.split('\n');
      const text = rest.join('\n').trim();
      const blank = text.search(/\n\s*\n/);
      const fields = parseFields(blank < 0 ? text : text.slice(0, blank));
      const name = nameLine.trim();
      return {
        slug: slugify(name),
        name,
        botanical: fields.botanical || '',
        photo: fields.photo || '',
        description: blank < 0 ? '' : text.slice(blank).trim(),
      };
    });
}

// Minimal CSV reader: handles quoted fields ("8,9,13") and doubled quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((f) => f.trim()));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

// Web-sized copies made by _working/make-plant-photos.py from the original in images/plants/.
const plantPhoto = (original, size) => {
  if (!original) return '';
  const base = original.split('/').pop().replace(/\.[^.]+$/, '');
  return `images/plants-web/${base}-${size}.jpg`;
};

// Every plant in the garden, once each, from the plant audit's master list.
async function loadPlantList() {
  const [csv, bedsText] = await Promise.all([
    readText('content/plant-list.csv'),
    readText('content/garden-beds.txt'),
  ]);
  // A bed as visitors see it: numbered like the map, made up of one or more audit beds.
  const beds = withoutComments(bedsText).split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter(([num, name]) => num && name)
    .map(([num, name, parts = '']) => {
      const number = Number.isFinite(Number(num)) ? Number(num) : null;
      const auditBeds = new Map(parts.split(',').map((part) => {
        const [, n, label] = part.trim().match(/^(\d+)\s*(.*)$/) || [];
        return [Number(n), label || ''];
      }).filter(([n]) => Number.isFinite(n)));
      return { key: number ?? slugify(name), number, name, auditBeds, label: number ? `${number}. ${name}` : name };
    });

  const plants = parseCsv(csv).filter((r) => r.plant).map((r) => {
    // Audit bed numbers, ignoring notes like "9 (4+ around the garden)".
    const auditNums = r.beds.split(',').map((b) => parseInt(b, 10)).filter(Number.isFinite);
    const where = beds
      .map((bed) => ({ bed, parts: auditNums.filter((n) => bed.auditBeds.has(n)).map((n) => bed.auditBeds.get(n)) }))
      .filter(({ parts }) => parts.length)
      .map(({ bed, parts }) => {
        const named = [...new Set(parts.filter(Boolean))];
        // Only name the parts when the bed has more than one, e.g. "Tiered Garden (upper tiers)".
        return { key: bed.key, label: bed.auditBeds.size > 1 && named.length ? `${bed.label} (${named.join(', ')})` : bed.label };
      });
    return {
      slug: slugify(r.plant),
      name: r.plant,
      botanical: r.botanical && r.botanical !== r.plant ? r.botanical : '',
      native: r.native !== 'no',
      where,
      thumb: plantPhoto(r.photo, 'sm'),
      photo: plantPhoto(r.photo, 'lg'),
    };
  });
  const sortKey = (name) => name.replace(/^['‘’"]+/, '').toLowerCase();
  plants.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));
  // Map beds in map order, then any beds that aren't on the map.
  beds.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
  return { plants, beds, sortKey };
}

async function loadGarden() {
  const order = withoutComments(await readText('content/walking-order.txt'))
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const [stops, plants, home] = await Promise.all([
    Promise.all(order.map((slug, i) => loadStop(slug, i, order.length))),
    readText('content/key-plants.md').then(parseKeyPlants),
    readText('content/home.md').then(parseFrontMatter),
  ]);

  const plantByName = new Map(plants.map((p) => [p.name.toLowerCase(), p]));
  for (const plant of plants) {
    plant.stops = stops.filter((s) => s.keyPlants.some((n) => n.toLowerCase() === plant.name.toLowerCase()));
  }

  return {
    stops,
    plants,
    home,
    findStop: (slug) => stops.find((s) => s.slug === slug),
    findPlant: (name) => plantByName.get(name.toLowerCase()),
    loadPage: async (slug) => parseFrontMatter(await readText(`content/pages/${slug}.md`)),
    loadPlantList,
  };
}
