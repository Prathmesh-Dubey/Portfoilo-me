# Portfolio + one-click resume

Next.js app: a public portfolio, an admin editor at `/admin`, and a resume PDF generated from the same content.
All data lives in MongoDB (`MONGODB_URI`, database `MONGODB_DB`, default `reuseme`): portfolios, photos, screenshots, uploaded resume PDFs,
backups, members, payments, free accounts and their saved resumes, suggestions, one-time email codes and rate limits (see `lib/db.ts`).
`data/portfolio.json` is only used to seed a brand-new database. To copy an old `data/` folder in: `npm run migrate:mongo`.
Saves carry a version stamp, so an out-of-date tab can't overwrite newer changes; it reloads the latest data instead.

## Run

```bash
npm install
npm run dev          # http://localhost:3000   (admin: /admin)
npm run build && npm start   # production
```

## Admin login

Sign in at `/admin` with the email + password from `.env.local` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
On first sign-in they are copied into the database (password stored hashed). After that:

- **Change password**: admin dock → More → Account & password (needs the current password).
- **Forgot password**: "Forgot password?" on the sign-in page → a 6-digit code is emailed to the admin Gmail
  (valid 5 minutes) → enter it with a new password.
- Delete the `owner` document in the `accounts` collection to go back to the values in `.env.local`.

### Email (for reset codes and suggestion alerts)

Fill `SMTP_PASS` in `.env.local` with a Gmail **App Password** (Google Account → Security → 2-Step Verification → App passwords).
Until then, reset codes are printed in the terminal running the server, and suggestions only appear in the admin Inbox.

## What you can edit (at /admin)

- **Every section** has an Edit button: profile & links, about, skills, experience, education, certifications/achievements.
- **Projects**: unlimited. Each has a *Live / deployed URL*, a *GitHub repo URL*, any number of extra links, and optional screenshots (upload or paste a URL).
  Card preview: your screenshot → otherwise a live capture of the deployed site's front page → otherwise the GitHub repo card.
  Clicking the preview opens the live site, or the GitHub repo when there's no deployment.
- **User view**: the dock's *User view* button (or the toast after any save) shows the page exactly as visitors see it.
- **Inbox**: suggestions visitors send from the *Suggest* section.
- **Which resume visitors download** (Resume PDF panel, top): *Website resume* (generated from the site) or *My uploaded PDF*
  (upload any PDF, e.g. one made in Word). The hero "Download resume" and navbar "My resume" buttons follow this choice.
- **Resume PDF** (dock → "Resume PDF"): pick the template (Creative / Classic ATS), paper (Letter/A4), accent colour,
  and the **3 projects** that go on the resume. The preview is the real PDF file visitors download.
- **Backup / Restore** download or restore the whole site as JSON. Every save also keeps a backup in the database (last 30).

## For visitors

- **Build your resume** (`/resume-builder`): anyone can fill in their details, preview live and download a PDF made with the same templates. Without an account the draft stays in their browser.
- **Free account** (`/login?mode=signup`, email code or Google): saves their resume-builder draft on the site. Free accounts can't edit any portfolio.
- **Suggest**: a form that sends suggestions to you (admin Inbox + Gmail when email is set up). Rate-limited with a hidden bot trap.

## Resume accuracy check

```bash
npm run verify:resume -- http://localhost:3000
```

Extracts the text from the generated PDF and confirms every field is printed character-for-character, that
unselected projects are absent, that links are clickable, and that "fit on one page" produced one page.

## Hosting

Works on Vercel or any Node host. Set these environment variables on the host: `MONGODB_URI`, `MONGODB_DB`, `SESSION_SECRET`
(required in production), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_*`, `MAIL_FROM_NAME`, `GOOGLE_CLIENT_ID`, `UPI_*`, `PRICE_*`, `SUPPORT_*`.
In MongoDB Atlas → Network Access allow `0.0.0.0/0` (Vercel has no fixed IP). In Google Cloud Console add the site's https
address to the OAuth client's Authorised JavaScript origins. Uploads are limited to 4 MB (Vercel's request size limit).
