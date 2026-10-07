# Spanish preterite — speaking and large print

Open `index.html` to browse 14 numbered pages. The left Page buttons use the same font size as the conjugations. Selecting a page shows only that page and restarts the same saved recording. If your browser blocks automatic sound, tap Play. Print conjugations prints all pages on US Letter paper in bold 44-point text.

## Recordings

Serve the app over HTTPS (or localhost for development). Sign in or create a Supabase email/password account. Confirm your email if required. Select Record, allow microphone access, speak, then Stop. Preview the take and select Save recording, or Discard take. Navigation is held while recording or reviewing an unsaved take. A new saved take replaces the one recording used by every page.

Recordings are private to your account. Sign in with the same account on any device to hear them. The browser chooses a supported recording format (WebM, MP4, or Ogg); playback across devices depends on browser codec support. Current Safari and Chromium browsers are recommended. Unsaved takes remain in memory only; save before closing the page.

## Supabase setup

1. The bnaimitzvah project is configured; `supabase-setup.sql` has already been applied.
2. `config.js` contains the project URL and public publishable key. Never use a secret or service-role key.
3. Enable email/password authentication. Configure the deployed app URL in Supabase Auth’s Site URL and allowed redirects for confirmation emails.
4. Host these files together over HTTPS. For local development run `python -m http.server 8765`, then open http://localhost:8765.

The backend uses `public.spanish_recordings` and a private `spanish-page-recordings` Storage bucket, with owner-only row and object policies and a 50 MB recording limit. The fixed `all-pages` recording key keeps one recording per account for this lesson, regardless of the selected page or screen size. Supabase JavaScript 2.117.3 is pinned in the CDN script URL.

The connected project is bnaimitzvah (`fgomaujsdblpzxhnnqrg`). Recording becomes available after sign-in.
