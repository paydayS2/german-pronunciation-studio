// Independent TTS engines. Each: { name, enabled(env), synth({text,ssml,voice,env,signal}) -> Uint8Array }.
// Failures throw PErr(code) with code in: auth | rate | server | network | timeout | bad_audio  (never contains secrets).
export class PErr extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
const kind = s => s === 401 || s === 403 ? "auth" : s === 429 ? "rate" : "server";
async function call(url, init, signal) {
  let r; try { r = await fetch(url, { ...init, signal }); }
  catch (e) { throw new PErr(e.name === "TimeoutError" || e.name === "AbortError" ? "timeout" : "network"); }
  if (!r.ok) throw new PErr(kind(r.status), r.status);
  return r;
}
const GVOICE = { katja: "de-DE-Neural2-F", amala: "de-DE-Neural2-F", conrad: "de-DE-Neural2-D", killian: "de-DE-Neural2-D" };
const AVOICE = { katja: "de-DE-KatjaNeural", amala: "de-DE-AmalaNeural", conrad: "de-DE-ConradNeural", killian: "de-DE-KillianNeural" };
export const azure = { name: "azure", enabled: e => !!(e.AZURE_SPEECH_KEY && e.AZURE_SPEECH_REGION),
  ssmlFor: "azure",
  async synth({ ssml, voice, env, signal }) {
    const r = await call(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "User-Agent": "gsp" },
      body: ssml(AVOICE[voice] || AVOICE.katja) }, signal);
    return new Uint8Array(await r.arrayBuffer());
  } };
export const google = { name: "google", enabled: e => !!e.GOOGLE_TTS_KEY,
  async synth({ ssml, voice, env, signal }) {
    const r = await call(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { ssml: ssml(null) }, voice: { languageCode: "de-DE", name: GVOICE[voice] || GVOICE.katja }, audioConfig: { audioEncoding: "MP3" } }) }, signal);
    const j = await r.json().catch(() => ({})); if (!j.audioContent) throw new PErr("bad_audio");
    return Uint8Array.from(atob(j.audioContent), c => c.charCodeAt(0));
  } };
export const elevenlabs = { name: "elevenlabs", enabled: e => !!(e.ELEVENLABS_KEY && e.ELEVENLABS_VOICE_ID), plain: true, // no SSML: no intonation control
  async synth({ text, env, signal }) {
    const r = await call(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_64`, { method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }) }, signal);
    return new Uint8Array(await r.arrayBuffer());
  } };
export const ALL = { azure, google, elevenlabs };
export const validMp3 = b => b.length > 800 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
