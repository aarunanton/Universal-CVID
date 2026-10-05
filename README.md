# Universal CV ID

**One ID. Every version of your career.**

Import your CV or build it here, and get a permanent Universal CV ID (for example `#UCVID-K7Q4M`). Keep one master CV, tick what each job needs, check it against the advert, and send a matching PDF, Word file, link or QR code. Everything runs in the browser: no account, no server, no tracking.

**Live site:** https://aarunanton.github.io/Universal-CVID/

---

## Features

| Feature | What it does |
|---|---|
| **Import** | Upload a PDF, Word (.docx), text or JSON Resume file, or paste text. Sections, roles, dates, bullets and skills are filled in for you to check. |
| **Master CV with tick-boxes** | Everything you've done lives in one master CV. Each version ticks the roles, bullets and skills it shows; unticked items stay stored. |
| **Versions** | Each version has its own title, profile, selection, design, target job and cover letter. All share one Universal CV ID. |
| **Score** | Pass/fail checks across Content, Format, Best practices and Job match: 3–6 bullets per role, numbers in bullets, weak openers, pronouns, buzzwords, passive voice, word count, page length and more. |
| **Job match** | Paste a job advert to get a keyword match score, see what's missing, add terms in one click, and save a tailored version. |
| **Design** | Six templates (Meridian, Classic, Slate, Ledger, Compact, Plain ATS), five fonts, font size, line spacing, margins, section spacing, date format, accent colour, optional photo, section order and visibility. |
| **Real A4 pages** | Long CVs flow across pages with page numbers; roles split cleanly between pages. |
| **Exports** | PDF that matches the preview exactly (real text), Word (.docx), plain-text PDF and JSON Resume. |
| **Cover letters** | One per version, drafted from the CV and the job advert, in the same design. PDF and Word. |
| **Share** | A link with the CV compressed into it (no server), plus a short contact-card link with a QR code. |
| **Application tracker** | Saved → Applied → Interview → Offer / Rejected, linked to the CV version sent. |
| **Editing** | Drag to reorder bullets and sections, Enter for a new bullet, paste many lines as many bullets, `**bold**`, `*italic*` and `[links](https://…)`, custom sections. |
| **Private** | All data lives in the browser's local storage. Light and dark mode. |

Data saved by earlier versions of the builder is upgraded automatically.

## Files

```
Universal-CVID/
├── index.html        Landing page
├── app.html          The builder
├── p.html            Public profile page that opens shared links and QR codes
├── assets/
│   ├── cv.js         Engine: data model, A4 pagination, score, job match, import parser, sharing, exports
│   ├── app.js        Builder interface
│   ├── p.js          Public profile page logic
│   ├── boot.js       Content security policy, loaded first on every page
│   ├── styles.css    Design tokens (light and dark), builder and CV template styles
│   ├── fonts/        Self-hosted fonts
│   └── vendor/       Self-hosted libraries
├── cv-builder.html   Redirect to app.html (keeps old links working)
└── dashboard.html    Redirect to app.html#versions
```

Plain HTML, CSS and JavaScript with no build step. Every library and font ships inside this repository (`assets/vendor`, `assets/fonts`), so the site makes **no requests to any other server**: [lz-string](https://github.com/pieroxy/lz-string) (link compression), [qrcodejs](https://github.com/davidshimjs/qrcodejs) (QR codes), [jsPDF](https://github.com/parallax/jsPDF) (plain-text PDF), [PDF.js](https://mozilla.github.io/pdf.js/) (PDF import), [mammoth](https://github.com/mwilliamson/mammoth.js) (Word import) and [docx](https://github.com/dolanmiu/docx) (Word export).

## Security and privacy

- **No third parties.** No CDN, no Google Fonts, no analytics. A content security policy (`assets/boot.js`) blocks outside connections and injected scripts.
- **Nothing from a link is trusted.** Shared links, imports and stored data are validated before display: design values are checked against known options, photos must be embedded images, and only `http(s)` links are made clickable.
- **You choose what a link carries.** Email, phone and location can each be left out of shared links and the QR card. Phone is off by default. Photos are never included.
- **Links can't be recalled.** A shared link contains the CV, so it can't be revoked once sent. The app says so before you copy it.
- **IDs** are generated with the browser's cryptographic random source. They are not yet centrally registered, so uniqueness is not guaranteed until the planned backend.
- **Self-declared.** Nothing on a CV or ID card is verified yet; shared pages say so.

## Run locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Known limits

- Data is stored per browser, unencrypted. Use an export or a share link to move a CV between devices.
- On GitHub Pages, other projects under the same `github.io` account share browser storage with this one. A custom domain removes that.
- Import is a best guess. Two-column CVs and scanned (image-only) PDFs import poorly; paste the text instead.
- "Download PDF" uses the browser's print window (choose "Save as PDF").
- Job match and the cover-letter draft are rule-based and run on your device. They do not use AI.

## Roadmap

- Accounts and cloud sync, so an ID resolves to your latest CV from any device
- Server-issued, longer IDs with a uniqueness check; revocable share links using random tokens separate from the ID
- LinkedIn data-export import; company and role picked out of a pasted job advert
- Verified claims: professional registers, universities, employers
- AI rewriting of bullet points and summaries
- View analytics for shared links

## Licence

MIT © Aarun Antony
