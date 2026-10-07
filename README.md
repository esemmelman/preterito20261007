# Spanish preterite — speaking and large print

Select a Page button in the left frame to show one numbered page and play your saved opening recording. The page links use the same font size as the conjugations. Print conjugations prints every page in bold 44-point type on US Letter paper.

The plural second-person forms use **ustedes**, which takes the same conjugation as the third-person plural, including reflexive pronouns.

## Speaking practice

Use the Record button to the right of the center page, aligned with its first infinitive. The center page goes blank while you speak and the button changes to Stop. Select Stop to restore the page immediately. After two seconds, your recording plays. If your browser blocks automatic sound, a Play button appears.

The existing opening recording loads from Supabase when the app opens and plays when a page is selected. Your previous sign-in is reused; if necessary, expand Sign in to load your opening recording. Browser autoplay restrictions may require tapping Play.

Practice takes remain separate from that opening recording. They play two seconds after Stop and stay only in this browser session. They are not uploaded or saved, and recording practice requires no sign-in.

Serve over HTTPS or localhost to allow microphone access. For local development, run `python -m http.server 8765` and open http://localhost:8765.

Supabase configuration is in `config.js`. The private opening recording uses the existing `spanish_recordings` table and Storage bucket in bnaimitzvah. Practice takes do not alter previously saved recordings.
