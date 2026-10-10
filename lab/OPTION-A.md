# Option A — Client-side only (chosen)

## What you get
- No server, no uploads, no monthly cost
- Privacy-first Lab tools

## New tool
**`lab/tools/ocr-to-word.html`** — Scan PDF or photo → Tesseract OCR → download `.docx`

## Workflow for users
| File type | Use this tool |
|-----------|----------------|
| PDF with selectable text | **PDF to Word** |
| Scanned PDF / photo | **OCR → Word** |
| Need searchable PDF only | **OCR** (existing) |

## Upload these files
1. **ADD** `lab/tools/ocr-to-word.html` (new)
2. **REPLACE** `lab/tools/pdf-to-word.html` (hardened + link to OCR→Word)
3. **REPLACE** `lab/lab.html` (catalog entry for OCR→Word)

## Limits (accepted under Option A)
- OCR quality depends on scan clarity
- First language download needs network (then cached)
- Layout will not match commercial Word converters
