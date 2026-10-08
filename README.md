# Spanish preterite — speaking and large print

Select a Page button in the left frame to show one numbered page and play your saved opening recording. The page links use the same font size as the conjugations. Use your browser's Print command to print every page in bold 44-point type on US Letter paper.

The plural second-person forms use **ustedes**, which takes the same conjugation as the third-person plural, including reflexive pronouns.

## Speaking practice

Each page contains one infinitive and its conjugations. Use the Record button to the right of the center page, aligned horizontally with its page number. The center page goes blank while you speak and the button changes to Stop. After ten seconds without microphone sound, recording stops automatically. You can also select Stop to restore the page immediately. After one second, your recording plays. Playback stops after ten seconds of continuous silence or stalled audio. If your browser blocks automatic sound, a Play button appears.

The first original recording is preserved as `opening-recording.webm` (12.42 seconds). It was recovered from the browser cache and verified against the original upload checksum. It plays when the app opens and when a page is selected, without sign-in. Browser autoplay restrictions may require tapping Play. An existing signed-in Supabase session also preserves a separate cloud copy under the `opening-example` key.

Practice takes remain separate from that opening recording. They play one second after Stop and stay only in this browser session. They are not uploaded or saved, and recording practice requires no sign-in.

Serve over HTTPS or localhost to allow microphone access. For local development, run `python -m http.server 8765` and open http://localhost:8765.

Supabase configuration is in `config.js`. The separate cloud copy uses the existing `spanish_recordings` table and Storage bucket in bnaimitzvah. Practice takes do not alter previously saved recordings.
