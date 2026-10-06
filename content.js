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
  };
}
