# FINAL UPLOAD CHECKLIST — Arzi ready package

Upload everything under `arzi-ready/` into the repo root of
https://github.com/dlo-500/text-to-handwriting

## Critical ADD (must exist on GitHub)

```
js/arzi-noise.js
js/arzi-realism.js
js/arzi-export-patch.js
js/core/file-classify.js
js/core/docx-build.js
js/core/ocr-pipeline.js
css/arzi-realism.css
lab/lab-layout.js
lab/tools/smart-convert.html
lab/tools/ocr-to-word.html
```

## Critical REPLACE

```
index.html
editor.html
template.html
styles.css
arzi-motion.js
lab/lab.html
lab/lab-common.js
lab/lab.css
lab/tools/pdf-to-word.html
lab/tools/word-to-pdf.html
lab/tools/pdf-to-excel.html
lab/tools/pdf-to-markdown.html
lab/tools/pdf-to-jpg.html
lab/tools/pdf-merge.html
lab/tools/pdf-split.html
lab/tools/pdf-compress.html
lab/tools/excel-to-pdf.html
lab/tools/html-to-pdf.html
README.md
LICENSE
```

## Optional docs

```
docs/CAPABILITY-MATRIX.md
lab/OPTION-A.md
lab/INFRASTRUCTURE.md
UPLOAD-NOW.md
FINAL-UPLOAD.md
```

## Do not delete other Lab tools on GitHub

Keep existing tools not listed here (ocr.html, pdf-sign, watermark, etc.).

## After upload — verify

1. Hard refresh Pages site
2. Editor → Real Ink → export PNG
3. Lab → Smart Convert → text PDF → non-empty .docx
4. Lab → Smart Convert → photo → OCR .docx
5. Lab → Word to PDF → simple docx → non-blank PDF
6. Confirm https://…/js/arzi-noise.js returns 200 (was 404 before)

## Quality bar met in this package

- Text vs scan routing (Smart Convert)
- Non-empty Word when text exists
- Explanatory output when scan has no layer
- Hardened Word→PDF (image + font wait)
- Shared layout + docx builders
- OCR preprocess helper
- Handwriting realism modules
