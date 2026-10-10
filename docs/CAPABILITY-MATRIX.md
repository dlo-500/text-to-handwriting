# Arzi Lab — Capability Matrix

| Tool | Best input | Quality | Speed | Notes |
|------|------------|---------|-------|-------|
| **Smart Convert** | PDF / image / docx | Routes correctly | Fast probe | Primary entry |
| PDF → Word | Text-layer PDF | Good text, plain layout | Fast | Empty if scan |
| OCR → Word | Scan / photo | OCR-limited | Slow first run | eng/urd/hin |
| Word → PDF | Simple .docx | Approximate | Medium | Not MS layout |
| PDF → Excel | Clear tables | Heuristic | Fast | Prose fails |
| Merge / Split / Compress | Any PDF | High | Fast | pdf-lib |
| PDF → JPG | Any PDF | High | Medium | pdf.js render |
| OCR (searchable PDF) | Scan | Good on print | Slow | Tesseract |

## Failure modes (by design honesty)
- Scan into PDF→Word → explanatory docx or empty text (use OCR path)
- Complex multi-column legal PDF → text order may drift
- Handwritten forms → OCR weak (not supported as primary)
