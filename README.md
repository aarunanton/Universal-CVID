# Universal CV ID

**One ID. Every version of your career.**

Build your CV once and get a permanent Universal CV ID (for example `#UCVID-K7Q4M`). Make tailored versions for each job, check them against the job advert, share them by link or QR code, and track where you applied. Everything runs in the browser: no account, no server, no tracking.

**Live site:** https://aarunanton.github.io/Universal-CVID/ (once GitHub Pages is enabled: Settings → Pages → branch `main`, folder `/`)

---

## Features

| Feature | What it does |
|---|---|
| **One ID, many versions** | A main CV plus tailored copies for specific jobs. Every version carries the same ID. |
| **Job match** | Paste a job advert to get a keyword match score, see what's missing, and add missing terms in one click. Then save the result as a new tailored version. |
| **CV check** | Live feedback: weak openers ("responsible for"), bullets without numbers, over-long bullets, missing contact details. |
| **Templates** | Four templates (Meridian, Ledger, Slate, Plain ATS), six accent colours, drag-and-drop section order. |
| **Share by link** | The full CV is compressed into the link itself, so it works without a server. |
| **QR contact card** | A short contact-card link and QR code for business cards and badges. |
| **Text PDF export** | PDFs use real text, so applicant tracking systems can read them. You can also print any template from the browser. |
| **JSON Resume** | Import and export in the open [JSON Resume](https://jsonresume.org) format. |
| **Application tracker** | Saved → Applied → Interview → Offer / Rejected, linked to the CV version you sent. |
| **Light and dark mode** | Follows the system setting, with a manual toggle. |
| **Private** | All data lives in the browser's local storage. |

CVs saved by the first prototype (the `universalCVs` storage key) are imported automatically the first time the new builder opens.

## Files

```
Universal-CVID/
├── index.html        Landing page
├── app.html          The builder (edit, design, job match, versions, share, tracker)
├── p.html            Public profile page that opens shared links and QR codes
├── assets/
│   ├── cv.js         Data model, storage, templates, CV checks, job match, sharing, PDF
│   ├── app.js        Builder interface
│   └── styles.css    Design tokens (light and dark) and all styles
├── cv-builder.html   Redirect to app.html (keeps old links working)
└── dashboard.html    Redirect to app.html#versions
```

Plain HTML, CSS and JavaScript with no build step. Libraries load from cdnjs: [lz-string](https://github.com/pieroxy/lz-string) (link compression), [qrcodejs](https://github.com/davidshimjs/qrcodejs) (QR codes) and [jsPDF](https://github.com/parallax/jsPDF) (PDF export).

## Run locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Known limits

- Data is stored per browser. Use JSON export, or a share link, to move a CV between devices.
- Share links are long because the CV travels inside them. The QR code uses the shorter contact-card link.
- Job match is keyword-based and runs on your device. It does not use AI.

## Roadmap

- Accounts and cloud sync, so an ID resolves to your latest CV from any device
- Short links (`/id/K7Q4M`) backed by a small API
- AI rewriting of bullet points
- Cover letters tied to each tailored version
- View analytics for shared links

## Licence

MIT © Aarun Antony
