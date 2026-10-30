import { buildSsml } from "../_lib/ssml.js";
import { ALL, PErr, validMp3 } from "../_lib/providers.js";

const MAX = 300, hits = new Map(), down = new Map(), cache = new Map(); // per-isolate state (best effort on Workers)
const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const COOL = { auth: 600000, rate: 60000, server: 30000, network: 30000, timeout: 30000, bad_audio: 30000 };

export async function onRequestPost({ request, env }) {
  const order = (env.TTS_ORDER || "azure,google,elevenlabs").split(",").map(s => s.trim()).filter(n => ALL[n] && ALL[n].enabled(env));
  if (!order.length) return json({ error: "هیچ موتور صوتی روی سرور تنظیم نشده است (کلید API وارد نشده).", code: "not_configured" }, 503);
  const ip = request.headers.get("CF-Connecting-IP") || "x", now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 20) return json({ error: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", code: "rate" }, 429);
  hits.set(ip, [...recent, now]);

  let body; try { body = await request.json(); } catch { return json({ error: "درخواست نامعتبر است.", code: "bad_request" }, 400); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "لطفاً یک جمله آلمانی وارد کنید.", code: "empty" }, 400);
  if (text.length > MAX) return json({ error: `حداکثر ${MAX} نویسه مجاز است.`, code: "too_long" }, 400);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) return json({ error: "متن شامل نویسه‌های نامعتبر است.", code: "bad_chars" }, 400);
  const voice = body.voice || "katja", key = voice + "|" + text;
  const ok = (bytes, prov, c) => new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-TTS-Provider": prov, "X-TTS-Cache": c } });
  if (cache.has(key)) { const c = cache.get(key); return ok(c.bytes, c.prov, "hit"); }

  const tried = [], timeout = +env.TTS_TIMEOUT_MS || 6000;
  for (const name of order) {
    const p = ALL[name];
    if ((down.get(name) || 0) > Date.now()) { tried.push({ provider: name, reason: "cooldown" }); continue; } // known-bad: skip instantly
    try {
      const ssml = v => buildSsml(text, v ?? null);
      const bytes = await p.synth({ text, ssml: p.plain ? null : ssml, voice, env, signal: AbortSignal.timeout(timeout) });
      if (!validMp3(bytes)) throw new PErr("bad_audio");
      down.delete(name); if (cache.size > 100) cache.delete(cache.keys().next().value); cache.set(key, { bytes, prov: name });
      return ok(bytes, name, "miss");
    } catch (e) {
      const code = e instanceof PErr ? e.code : "server";
      down.set(name, Date.now() + (+env.TTS_COOLDOWN_MS || COOL[code])); tried.push({ provider: name, reason: code });
      console.warn("[tts] provider failed", name, code, e.status || ""); // no keys, no text
    }
  }
  const allCool = tried.every(t => t.reason === "cooldown");
  return json({ error: "همه موتورهای تلفظ در این لحظه پاسخ ندادند.", code: allCool ? "all_cooling" : "all_failed", tried }, 502);
}
