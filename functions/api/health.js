import { ALL } from "../_lib/providers.js";
export const onRequestGet = ({ env }) => new Response(JSON.stringify({ ok: true, configured: Object.keys(ALL).filter(n => ALL[n].enabled(env)) }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
