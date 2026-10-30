import http from "node:http"; import fs from "node:fs";
process.env.X=1; const tts=await import("../functions/api/tts.js"); const health=await import("../functions/api/health.js");
const M={azure:"ok",google:"ok",eleven:"ok"}, calls={azure:0,google:0,eleven:0}; let ssml="", envOn=!process.env.NOKEYS; const mp3=fs.readFileSync("test/mock.mp3"), real=globalThis.fetch;
const sleep=(ms,sig)=>new Promise((res,rej)=>{const t=setTimeout(res,ms);sig&&sig.addEventListener("abort",()=>{clearTimeout(t);const e=new Error("aborted");e.name="TimeoutError";rej(e)})});
async function mock(p,o,mk){calls[p]++; const m=M[p]; if(m==="slow")await sleep(1500,o.signal); if(m==="hang")await sleep(60000,o.signal); if(/^\d+$/.test(m))return new Response("",{status:+m}); if(m==="garbage")return mk(Buffer.from("<html>not audio</html>".repeat(80))); if(m==="net")throw new TypeError("fetch failed"); return mk(mp3)}
globalThis.fetch=async(u,o)=>{u=String(u);
 if(u.includes("tts.speech.microsoft.com")){ssml=o.body;return mock("azure",o,b=>new Response(b,{headers:{"Content-Type":"audio/mpeg"}}))}
 if(u.includes("texttospeech.googleapis.com"))return mock("google",o,b=>new Response(JSON.stringify({audioContent:Buffer.from(b).toString("base64")})));
 if(u.includes("api.elevenlabs.io"))return mock("eleven",o,b=>new Response(b,{headers:{"Content-Type":"audio/mpeg"}}));
 return real(u,o)};
const env=()=>envOn?{AZURE_SPEECH_KEY:"MOCK",AZURE_SPEECH_REGION:"germanywestcentral",GOOGLE_TTS_KEY:"MOCK",ELEVENLABS_KEY:"MOCK",ELEVENLABS_VOICE_ID:"v",TTS_COOLDOWN_MS:"2500",TTS_TIMEOUT_MS:"4000"}:{};
const mime={".html":"text/html",".js":"text/javascript",".png":"image/png",".webp":"image/webp"};
http.createServer(async(q,s)=>{
 const m=q.url.match(/^\/__set\/(\w+)\/(\w+)/); if(m){M[m[1]]=m[2];s.end("ok");return}
 if(q.url==="/__calls"){s.end(JSON.stringify(calls));return} if(q.url==="/__ssml"){s.end(ssml);return}
 if(q.url==="/__zero"){for(const k in calls)calls[k]=0;s.end("ok");return}
 if(q.url==="/api/health"){const r=await health.onRequestGet({env:env()});s.writeHead(200,Object.fromEntries(r.headers));s.end(await r.text());return}
 if(q.url==="/api/tts"&&q.method==="POST"){let b="";for await(const c of q)b+=c;
  const r=await tts.onRequestPost({request:new Request("http://x/api/tts",{method:"POST",headers:{"CF-Connecting-IP":"t"+Math.random()},body:b}),env:env()});
  s.writeHead(r.status,Object.fromEntries(r.headers));s.end(Buffer.from(await r.arrayBuffer()));return}
 const f="public"+(q.url==="/"?"/index.html":q.url.split("?")[0]);
 if(fs.existsSync(f)){s.writeHead(200,{"Content-Type":mime[f.slice(f.lastIndexOf("."))]||"text/plain"});s.end(fs.readFileSync(f))}else{s.writeHead(404);s.end()}
}).listen(8770);
