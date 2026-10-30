// Builds SSML from the student's text. The original text is never rewritten:
// it is only XML-escaped and split at sentence boundaries.
const W = /^(wer|wen|wem|wessen|was|wo|woher|wohin|wann|warum|wieso|weshalb|weswegen|wie|welche[rsmn]?|wozu|womit|wodurch|wofür)$/i;
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

export function splitSentences(text) {
  return text.match(/[^.!?…]+[.!?…]*/g)?.map(s => s.trim()).filter(Boolean) ?? [];
}
// Heuristic only: punctuation + first word. Not full grammatical analysis.
export function sentenceType(s) {
  const first = (s.match(/^[\p{L}ßäöüÄÖÜ]+/u) || [""])[0];
  if (s.endsWith("?")) return W.test(first) ? "w" : "yn";
  if (s.endsWith("!")) return "excl";
  return "decl";
}
export function buildSsml(text, voice) { // voice=null -> no <voice> wrapper (Google) and no contour (unsupported)
  const gen = voice === null;
  const parts = splitSentences(text).map(s => {
    const t = sentenceType(s), e = esc(s);
    if (t === "yn" && !gen) return `<s><prosody contour="(70%,+0%) (100%,+14%)">${e}</prosody></s><break time="250ms"/>`; // rise only at the end
    if (t === "excl" && !gen) return `<s><prosody volume="+10%">${e}</prosody></s><break time="300ms"/>`;
    return `<s>${e}</s><break time="${t === "w" ? 250 : 300}ms"/>`; // W-questions fall: no pitch lift
  });
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="de-DE">${gen ? parts.join("") : `<voice name="${voice}">${parts.join("")}</voice>`}</speak>`;
}
