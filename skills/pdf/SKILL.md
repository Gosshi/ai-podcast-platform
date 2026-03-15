---
name: pdf
description: Use when the task involves reading, extracting from, creating, combining, splitting, rotating, or otherwise manipulating PDF files. Best for PDF-focused workflows where the input or output is a .pdf document.
---

# PDF

Adapted for Codex from Anthropic's `pdf` skill.

Use this skill whenever PDF handling is central to the task.

## Workflow

### 1. Identify the PDF Job

Determine which of these applies:
- read or summarize text
- extract tables or images
- merge or split files
- rotate or reorder pages
- fill or create a document
- OCR a scanned PDF

### 2. Pick the Lightest Tool That Works

Prefer simple tooling first:
- text extraction tools for readable PDFs
- `pdftotext` or similar command-line extraction when available
- PDF libraries when page-level edits are required
- OCR only when the PDF is image-based

Do not start with OCR if the PDF already contains extractable text.

### 3. Inspect Before Editing

Before modifying a PDF, confirm:
- page count
- whether text is selectable
- whether forms or images are involved
- whether the task is page-level, text-level, or layout-level

### 4. Perform the Operation

Keep the transformation minimal and verifiable:
- preserve page order unless asked to change it
- avoid lossy conversions when unnecessary
- keep filenames explicit

### 5. Validate the Output

After changes, verify:
- page count is correct
- text still extracts if expected
- the output opens cleanly
- requested pages/content are present

## Heuristics

- For summaries, extract text first and work from the text.
- For scanned PDFs, use OCR and state when quality is uncertain.
- For forms, verify whether the task is field filling or visual flattening.
- For merged outputs, confirm input ordering explicitly.

## Output Expectation

The result should make clear what was changed, what file was produced, and any quality limits such as OCR uncertainty or poor source scans.
