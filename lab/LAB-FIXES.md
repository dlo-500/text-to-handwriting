# Lab conversion tools — diagnosis & fixes

## Root causes found

### 1. PDF → Word was completely broken (CDN 404)
**File:** `lab/tools/pdf-to-word.html`

```html
<!-- OLD (404 — docx global never defined) -->
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js"></script>

<!-- FIXED -->
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"></script>
```

Without the UMD build, `const { Document, Packer, ... } = docx` threw and the tool always showed “Could not convert”.

### 2. Weak geometric clustering
Line grouping used a fixed `size * 0.4` threshold. That fails when:

- Mixed font sizes appear on one line
- Pages are scaled differently
- Subscripts / superscripts shift baseline

**Fix:** `lab/lab-layout.js` uses **median + MAD** (median absolute deviation) for adaptive line tolerance, and gap-aware space insertion.

### 3. Word → PDF race conditions
Mammoth HTML was rendered in a hidden iframe, then `html2canvas` ran before images finished loading → blank or partial pages.

**Fix:** wait for `iframe.onload`, wait for all images, short layout settle delay, clearer error messages.

### 4. PDF → Excel column splits
Fixed gap factor only. Now user can choose Tight / Balanced / Loose, and rows are normalised to a consistent column count per sheet.

---

## What pure client-side conversion **cannot** do perfectly

| Conversion | Realistic quality | Notes |
|------------|-------------------|-------|
| PDF → Word (text PDF) | Good text, fair structure | No true layout/tables fidelity without a commercial engine |
| PDF → Word (scanned) | Needs OCR first | Use Lab → OCR, then convert |
| Word → PDF | Good for simple docs | Complex floating layouts may shift |
| PDF → Excel | Good for clear tables | Multi-column prose becomes “fake” columns |
| Excel → PDF | Good | Simple table rendering via pdf-lib |
| PDF → JPG/PNG | Excellent | pdf.js render is solid |
| PDF merge/split/compress | Excellent | pdf-lib |

True “pixel-perfect Office conversion” needs commercial engines (Nutrient, Aspose, ConvertAPI) or a server with LibreOffice. Arzi stays **100% private / client-side**, so we optimise extraction quality within that constraint.

---

## New / updated files in this package

| Path | Change |
|------|--------|
| `lab/lab-layout.js` | **New** — median/MAD line clustering, column gaps, role classification |
| `lab/tools/pdf-to-word.html` | **Fixed** CDN + layout engine + empty-scan message |
| `lab/tools/pdf-to-excel.html` | **Upgraded** layout engine + gap sensitivity |
| `lab/tools/word-to-pdf.html` | **Hardened** image wait + errors |
| `lab/tools/pdf-to-markdown.html` | layout script wired |
| Other tools | Copied as-is (already functional) |

---

## Further additions worth doing later

1. **OCR → Word pipeline** — one button: scan PDF → Tesseract → docx  
2. **Table detection** — use x-histogram peaks for multi-column tables in PDF→Excel  
3. **pdf-lib page render for Word→PDF** alternative path when html2canvas fails  
4. **Worker-based extraction** — move heavy page loops off the main thread for large PDFs  
5. **Drag-reorder pages** already in organise tool — surface it on the Lab home more clearly  
