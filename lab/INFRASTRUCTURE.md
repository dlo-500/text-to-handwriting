# Why many Lab conversions feel broken — and what infrastructure is required

## What I checked on your live repo (2026-10-08)

| Asset | Status |
|-------|--------|
| `lab/tools/pdf-to-word.html` | Fixed CDN (`index.umd.js`) is **deployed** |
| `lab/lab-layout.js` | **Present** on GitHub + Pages |
| Live Pages URL | https://dlo-500.github.io/text-to-handwriting/lab/tools/pdf-to-word.html → 200 |

So the previous CDN fix **is** live. Empty `.docx` files are almost always a **different** problem.

---

## Why PDF → Word returns an “empty” file

### Cause A — Scanned PDF (most common)
Many “PDF” files are **photos of pages** with **no text layer**.

```
pdf.js getTextContent()  →  0 characters
         ↓
docx is still generated (valid ZIP)
         ↓
Word opens a blank-looking document
```

**Client-side cannot invent text from images** without OCR.

**What to do:** use **Lab → OCR** on that file first, then convert.  
The new `pdf-to-word.html` now:

- Counts extracted characters
- Shows “No text layer found” clearly
- Writes an explanatory paragraph into the `.docx` instead of a silent blank file

### Cause B — Text PDF works, but layout is plain
Even with text, browser conversion is **text reconstruction**, not Microsoft Word layout fidelity. Tables, columns, headers/footers will not match the original pixel-for-pixel.

### Cause C — Ad-blocker / offline CDN
If `cdn.jsdelivr.net` or `cdnjs` is blocked, `docx` never loads. The new file throws a clear error instead of a silent empty download.

---

## Honest capability matrix (client-side only)

| Tool | Works well when… | Fails when… | Needs server? |
|------|------------------|-------------|----------------|
| PDF → JPG/PNG | Always (render pages) | Very large PDFs (memory) | No |
| PDF merge / split / rotate | Always | Corrupt PDFs | No |
| PDF compress | Moderate | Already highly compressed scans | No |
| PDF → Word | **Text-layer** PDFs | Scans, complex layout | OCR for scans; server for fidelity |
| PDF → Excel | Clear tabular text | Prose, complex tables | Same |
| Word → PDF | Simple .docx | Heavy floating layouts | Server for perfect fidelity |
| Excel → PDF | Simple sheets | Charts / merged cells | Optional |
| OCR | Clear scans, Latin scripts | Handwriting, low contrast | No (Tesseract.js is heavy in-browser) |

---

## Infrastructure options (pick one strategy)

### Option 1 — Stay 100% private / client-side (current Arzi design)
**Pros:** No cost, no uploads, GDPR-friendly, works offline after load  
**Cons:** Scanned PDF → Word will never be great without OCR; layout fidelity is limited  

**Improvements still worth doing:**
1. One-click **OCR → Word** pipeline
2. Clearer UI warnings (“this PDF has no text layer”)
3. Web Worker for large PDFs
4. Pin CDN scripts to local copies in-repo (survive jsDelivr outages)

**Cost:** $0  
**Complexity:** Low

---

### Option 2 — Lightweight serverless backend (recommended if you need “it just works”)
Run conversion on a small API:

| Service | Role |
|---------|------|
| **Gotenberg** (Docker) or **LibreOffice** headless | PDF ↔ DOCX ↔ high fidelity |
| **Cloudflare Workers / Vercel / Fly.io** | Host the API |
| Your static Arzi site | UI only; uploads file → API → download |

**Pros:** Real Word/Excel quality, handles scans via server OCR  
**Cons:** Cost, privacy (file briefly touches server), ops  

**Rough cost:** $5–20/month for light traffic  

---

### Option 3 — Commercial conversion API
ConvertAPI, CloudConvert, Adobe PDF Services, Nutrient  

**Pros:** Best quality, least engineering  
**Cons:** Per-file cost, privacy policy, API keys  

---

## What you should replace **right now**

Only this file (hardened empty-file handling + character count + explicit MIME):

```
lab/tools/pdf-to-word.html
```

From package: `arzi-ready/lab/tools/pdf-to-word.html`

Keep `lab/lab-layout.js` as already deployed.

---

## Recommended product path for Arzi

1. **Short term (this week)**  
   - Deploy the hardened `pdf-to-word.html`  
   - On the Lab home page, label converters:  
     - “Text PDF → Word”  
     - “Scan → use OCR first”  

2. **Medium term**  
   - Build **OCR → Word** single tool  
   - Vendor `pdf.min.js` + `docx` UMD into `/lab/vendor/` so CDNs cannot break the site  

3. **If users demand perfect Word**  
   - Add Option 2 (Gotenberg on Fly.io) behind an optional “High fidelity (uploads file)” toggle  
   - Keep the free client-side path as default for privacy  

---

## Bottom line

| Question | Answer |
|----------|--------|
| Is the CDN fix deployed? | **Yes** |
| Why empty Word files? | Usually **no text layer** (scans), not a missing upload |
| Can pure browser match MS Word? | **No** — not for layout or scans |
| Infrastructure required for “always works”? | **Server** (LibreOffice/Gotenberg) or **paid API** |
| What to upload now? | Replace **`lab/tools/pdf-to-word.html`** only |
