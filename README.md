# Eco.Abode Open Garden

A phone guide for visitors walking the Eco.Abode garden during the Castlemaine Festival of Gardens. Visitors scan a QR sign at each Stop, or tap the map, to read about that part of the garden.

The words we use for things (Stop, Feature, Key Plant…) are defined in [CONTEXT.md](CONTEXT.md).

## Changing the words and photos

All the words live in the `content/` folder. You never need to touch the code to change them.

| To change… | Edit |
| --- | --- |
| A Stop's story, photos or plants | `content/stops/<stop>.md` |
| The order of the Stops (and their numbers) | `content/walking-order.txt` |
| The welcome message and notes on the home page | `content/home.md` |
| About us, Trust for Nature, Fire protection | `content/pages/<page>.md` |
| The Plant Guide and plant pop-ups | `content/key-plants.md` |

Each Stop file starts with a few settings between `---` lines, then the story:

```
---
name: Main Garden
map: 60, 38                               ← where the number sits on the map (% across, % down)
now: images/stops/main-garden-now.jpg     ← the photo people see first
before: images/stops/main-garden-before.jpg  ← revealed by the slider (leave blank for no slider)
key_plants: Banksia, Kangaroo Paw         ← must match a "## Name" in key-plants.md
other_plants: bottle trees, olive trees
---
The story goes here. Leave a blank line between paragraphs.
```

**To swap a photo:** put the new photo in `images/stops/` (or `images/plants/`) and update the file name in the settings. Photos about 1200px wide are plenty.

**Editing on github.com:** open the file, click the pencil icon, make your change, then click **Commit changes**. The live site updates within a minute or two.

## Printing the QR signs

Open `signs.html` **on the live site** (the web address plus `/signs.html`) and print on A5. There's one sign for the gate and one per Stop. The QR codes use the address you open the page from, so printing from your own computer would give codes that don't work.

## Previewing on your computer

The site loads its words from files, so it needs a small local web server instead of opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it's built

Plain HTML, CSS and JavaScript with no build step, hosted free on GitHub Pages.

- `index.html`, `styles.css`, `app.js`: the site itself
- `content.js`: reads the files in `content/` (shared with the signs page)
- `signs.html`: the printable A5 QR signs
- `.nojekyll`: tells GitHub Pages to serve the files as-is
