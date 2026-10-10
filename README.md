# Arzi — private handwriting & document lab

**Arzi** turns typed text into realistic handwritten letters (leave applications, notes) and runs a **privacy-first document lab** entirely in your browser. Files never leave your device on the default path.

## Features

### Handwriting studio
- Leave-application templates + free-form editor
- Handwriting fonts, paper textures, signatures
- **Real Ink** realism: deterministic micro-variation
- Export PNG / multi-page PDF

### The Lab
| Tool | Purpose |
|------|---------|
| **Smart Convert** | Auto text-layer vs scan → best path to Word |
| PDF → Word | Text-layer PDFs → editable `.docx` |
| OCR → Word | Scans & photos → `.docx` (eng / urd / hin) |
| Word → PDF | `.docx` → PDF (approximate layout) |
| PDF → Excel | Tabular text → `.xlsx` |
| Merge / Split / Compress / JPG | Structural PDF ops |
| OCR | Searchable text layer on scans |

## Architecture (Option A — client-side)

- Handwriting: fonts + noise PRNG + html2canvas / jsPDF
- PDF structure: pdf-lib · render/text: pdf.js
- DOCX: docx (write) · mammoth (read)
- OCR: Tesseract.js
- Shared: `js/core/*` · `lab/lab-layout.js`

## Layout

```
js/arzi-*.js + js/core/{file-classify,docx-build,ocr-pipeline}.js
css/arzi-realism.css
lab/ + lab/tools/smart-convert.html, ocr-to-word.html, …
docs/CAPABILITY-MATRIX.md
```

## Which tool?

| File | Tool |
|------|------|
| Text PDF | Smart Convert or PDF → Word |
| Scan / photo | Smart Convert or OCR → Word |
| Simple docx | Word → PDF |

See `docs/CAPABILITY-MATRIX.md` for limits.

## License

MIT — see `LICENSE`.
