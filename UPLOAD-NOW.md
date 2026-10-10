# Upload now — quality increment

## ADD (new)

| Path |
|------|
| `js/core/file-classify.js` |
| `js/core/docx-build.js` |
| `lab/tools/smart-convert.html` |
| `lab/tools/ocr-to-word.html` *(if not already)* |
| `docs/CAPABILITY-MATRIX.md` *(optional)* |

## REPLACE

| Path |
|------|
| `lab/lab.html` |
| `lab/tools/pdf-to-word.html` |

## Keep using

| Path |
|------|
| `lab/lab-layout.js` |
| `lab/lab-common.js` |
| `js/arzi-noise.js` / `arzi-realism.js` / realism CSS |
| Handwriting `editor.html` / `template.html` |

## After upload — test order

1. Lab → **Smart Convert** → text PDF from Word/Google Docs → download `.docx` (non-empty).
2. Smart Convert → phone photo of text → OCR → `.docx`.
3. Smart Convert → pure scan PDF → should badge as scan and OCR path.
4. Hard-refresh (`Ctrl+Shift+R`) if CDN/cache sticks.

## Quality bar this increment

- Correct routing (text vs scan)
- Non-empty Word when text exists
- Explanatory docx when text does not exist
- Shared builders (no duplicated broken CDN assumptions)
