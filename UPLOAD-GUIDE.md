# Upload guide — replace these files in your GitHub repo

Upload / replace in this order (GitHub web UI or git push):

## New folders (create first)
1. `js/`  (new folder at repo root)
2. `css/` (new folder at repo root)

## New files
| Local path | Upload to repo as |
|------------|-------------------|
| `js/arzi-noise.js` | `js/arzi-noise.js` |
| `js/arzi-realism.js` | `js/arzi-realism.js` |
| `js/arzi-export-patch.js` | `js/arzi-export-patch.js` |
| `css/arzi-realism.css` | `css/arzi-realism.css` |
| `LICENSE` | `LICENSE` |
| `README.md` | `README.md` |

## Replace existing files
| Local path | Replaces |
|------------|----------|
| `index.html` | `index.html` |
| `editor.html` | `editor.html` |
| `template.html` | `template.html` |
| `styles.css` | `styles.css` |
| `arzi-motion.js` | `arzi-motion.js` |
| `robots.txt` | `robots.txt` (optional — update domain) |
| `sitemap.xml` | `sitemap.xml` (optional — update domain) |

## Do NOT touch yet
- Everything under `lab/` — leave as-is (still works)

## After upload
1. Open `editor.html` → Layout tab → enable **Real Ink** → export PNG → words should look individually written.
2. Same test on `template.html`.
3. Replace `YOUR-DOMAIN-OR-GITHUB-PAGES-URL` in `robots.txt` and `sitemap.xml` with your real URL.

## Git CLI (optional)

```bash
cd your-local-clone
# copy everything from arzi-ready/ over the repo root
cp -r path/to/arzi-ready/* .
git add js css index.html editor.html template.html styles.css arzi-motion.js README.md LICENSE robots.txt sitemap.xml
git commit -m "feat: Real Ink handwriting variation, paper textures, README & LICENSE"
git push
```
