# German Pronunciation Studio — Farzane Yoosefi
Cloudflare Pages (`public/`) + Pages Functions (`functions/`) + multi-engine neural German TTS.

## Engines & failover (one click → automatic fallback)
Order (env `TTS_ORDER`, default `azure,google,elevenlabs`); only engines with keys are used. Per-engine timeout `TTS_TIMEOUT_MS` (default 6000), cooldown after failure `TTS_COOLDOWN_MS` (auth 10 min, others 30 s; rate 60 s). Invalid/non-MP3 audio counts as failure. Last resort: the device's own de-* voice (browser-side, only if installed).
| Engine | Secrets (Cloudflare Pages → Settings → Variables, as Secrets) | Intonation |
|---|---|---|
| Azure AI Speech | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | SSML: end-rise for yes/no questions |
| Google Cloud TTS (Neural2 de-DE) | `GOOGLE_TTS_KEY` (API key, Text-to-Speech API enabled) | SSML pauses only; no pitch contour |
| ElevenLabs | `ELEVENLABS_KEY`, `ELEVENLABS_VOICE_ID` | none (plain text; model decides) |

Deploy the WHOLE folder (`npx wrangler pages deploy public` from the project root so `functions/` is included). `GET /api/health` lists configured engines (404 = Functions not deployed).
Local: put the variables in `.dev.vars`, run `npx wrangler pages dev public`.

## Brand assets (already integrated)
- `logo.png` = lossless square crop of the supplied FY logo (black margins removed only); `favicon.png` = 192px copy. `instructor.webp` = supplied photo, format-converted only (q92), no retouching. The photo already contains the fingertip play icon, so none was added.

## Replace brand assets
- Logo: overwrite `public/assets/logo.png` and `favicon.png`.
- Photo: put supplied image in `public/assets/`, set `photo` in `config.js`. Never re-crop faces beyond responsive sizing.
- Instagram / WhatsApp: `public/config.js` only.

## Swapping TTS provider
Implement `synthesize(ssml, env)` returning an MP3 ArrayBuffer (see `functions/_lib/azure.js`), import it in `tts.js`.

## Diagnostics
`GET /api/health` returns `{ok,configured}`: 404 = Functions not deployed (deploy the whole folder, not just `public/`); `configured:false` = secrets missing.
## Tests
`node test/server.mjs` + `python3 test/run.py` (mock Azure, plumbing only).

## Known limitations (honest)
- NOT TESTED against the real Azure API: no credentials/network in the build environment. Nothing was run in Android/desktop browsers.
- Iran: Azure account signup/billing from Iran is likely blocked by sanctions; end users reach only your Cloudflare site, but Cloudflare reachability from Iran is also unverified. Test from both regions.
- Intonation is heuristic (punctuation + first word): yes/no questions get an end-rise, W-questions and statements none. Not grammatical analysis.
- Rate limiting is in-memory per Worker isolate (best-effort). Use Cloudflare Rate Limiting rules for real protection.
- Playback speed uses `playbackRate` with `preservesPitch`; support varies by browser.
- Max 300 characters per request.

- Tests (`test/`) use MOCK engines: they prove routing/failover/playback logic, not real voice quality. Real engines, Android/iPhone devices and Iran reachability are untested.
- Server cache and circuit-breaker state are per Worker isolate (best effort).
- Device-voice fallback ignores speed changes until the next play and has no intonation control.

## IMPORTANT: how to run / deploy (the "no server access" message)
`index.html` MUST be opened from the deployed https address (or `npx wrangler pages dev public` → http://localhost:8788). Double-clicking `public/index.html` (file://) cannot work: the speech server does not exist there.
Deploy from the project ROOT (so `functions/` ships): `npx wrangler pages deploy public --project-name=farzane-yoosefi`, or connect the Git repo to Cloudflare Pages (build output dir `public`; `functions/` is auto-detected). Dashboard drag-and-drop of `public/` alone does NOT deploy `functions/`.
Then add the Secrets (Settings → Variables and Secrets), redeploy, and open `https://YOUR-SITE/diag.html` → «اجرای آزمایش»: it shows the real /api/health and /api/tts status, audio size, decode result and plays the sentence.
