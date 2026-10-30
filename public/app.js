const S = window.SITE, $ = id => document.getElementById(id);
const txt=$("txt"), go=$("go"), pp=$("pp"), rep=$("rep"), stop=$("stop"), st=$("status");
$("logo").src=$("flogo").src=S.logo; $("photo").src=S.photo; const tip=$("tip");
const igOk=!S.instagram.startsWith("["), waOk=!S.whatsapp.startsWith("[");
const IG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
const WA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z"/></svg>';
const links=(igOk?`<a href="https://instagram.com/${S.instagram.replace("@","")}" target="_blank" rel="noopener">${IG}Instagram <small>${S.instagram}</small></a>`:"")+(waOk?`<a href="https://wa.me/${S.whatsapp.replace(/\D/g,"")}" target="_blank" rel="noopener">${WA}WhatsApp</a>`:"");
$("contact").innerHTML=links||"<p>اطلاعات تماس به‌زودی اضافه می‌شود.</p>"; $("fcontact").innerHTML=links;

const audio = new Audio(); audio.preservesPitch = true; audio.webkitPreservesPitch = true;
let url=null, lastText=null, lastVoice=null, rate=1, ctl=null, seq=0, pending=null, mode="none"; // mode: none | server | device
window.__gsp={audio};
const synth=window.speechSynthesis, deVoice=()=>synth&&synth.getVoices().find(v=>/^de[-_]/i.test(v.lang));
if(synth)synth.onvoiceschanged=()=>{};
const msg=(m,e)=>{st.textContent=m;st.className=e?"err":""};
const upd=()=>{const n=txt.value.length;$("cnt").textContent=`${n} / ${S.maxChars}`;$("cnt").className="count"+(n>S.maxChars?" over":"")};
txt.addEventListener("input",upd); upd();
$("clear").onclick=()=>{txt.value="";upd();txt.focus()};
$("speeds").innerHTML=[.65,.8,.9,1,1.15,1.25].map(v=>`<button type="button" data-r="${v}" aria-pressed="${v===1}">${v.toFixed(2)}x</button>`).join("");
$("speeds").onclick=e=>{const b=e.target.closest("button");if(!b)return;rate=+b.dataset.r;audio.playbackRate=rate;
  document.querySelectorAll("#speeds button").forEach(x=>x.setAttribute("aria-pressed",x===b));$("spd").textContent=rate.toFixed(2)+"x"};

const L={idle:"شنیدن تلفظ",loading:"در حال تولید صدا…",playing:"مکث",paused:"ادامه پخش"};
function state(s){tip.dataset.state=go.dataset.state=s;tip.setAttribute("aria-label",L[s]);$("golbl").textContent=L[s]}
audio.onplay=()=>{state("playing");pp.textContent="مکث";stop.disabled=rep.disabled=false};
audio.onpause=()=>{if(audio.ended||mode!=="server")return;const mid=audio.currentTime>0;state(mid?"paused":"idle");pp.textContent=mid?"ادامه":"پخش"};
audio.onended=()=>{state("idle");pp.textContent="پخش";msg("پخش تمام شد.")};

function silence(){audio.pause();if(synth)synth.cancel()}               // exactly one output at a time
function play(){audio.playbackRate=rate;return audio.play().catch(e=>{state("idle");msg(e.name==="NotAllowedError"?"مرورگر پخش را مسدود کرد. دوباره روی دکمه بزنید.":"پخش صدا ممکن نشد.",true)})}
function playDevice(text){ // last resort, only with a real de-* voice installed
  silence();const u=new SpeechSynthesisUtterance(text);u.lang="de-DE";u.voice=deVoice();u.rate=rate;mode="device";
  u.onstart=()=>{state("playing");pp.textContent="مکث";stop.disabled=rep.disabled=false};
  u.onend=()=>{if(mode==="device"){state("idle");pp.textContent="پخش"}};u.onerror=()=>{state("idle")};
  synth.speak(u);pp.disabled=false;msg("سرویس‌های آنلاین پاسخ ندادند؛ از صدای آلمانی دستگاه شما استفاده شد (کیفیت و لحن ممکن است ضعیف‌تر باشد).")}

pp.onclick=()=>{if(mode==="device"){synth.speaking&&!synth.paused?(synth.pause(),state("paused")):(synth.resume(),state("playing"));return}audio.paused?play():audio.pause()};
rep.onclick=()=>{if(mode==="device")return playDevice(lastText);audio.currentTime=0;play()};
stop.onclick=()=>{silence();audio.currentTime=0;state("idle");pp.textContent="پخش";msg("")};

class TtsError extends Error{constructor(m,fb){super(m);this.fb=fb}} // fb: may fall back to device voice
async function fetchAudio(text,voice,signal){
  if(location.protocol==="file:")throw new TtsError("این صفحه از روی فایل محلی (file://) باز شده و سرور تلفظ در آن وجود ندارد. سایت باید روی یک آدرس https منتشر شود (راهنمای README) و از همان آدرس باز شود.",false);
  if(navigator.onLine===false)throw new TtsError("اینترنت شما قطع است.",true);
  const t=setTimeout(()=>ctl.abort("timeout"),25000);let r;
  try{r=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voice}),signal})}
  catch(e){ if(signal.aborted&&ctl.signal.reason!=="timeout")throw e;
    throw new TtsError(signal.aborted?"پاسخ سرور خیلی طول کشید.":"اینترنت شما وصل است، اما به سرور تلفظ دسترسی نداریم (سرور در دسترس نیست یا شبکه شما آن را مسدود کرده).",true)}
  finally{clearTimeout(t)}
  const type=r.headers.get("content-type")||"";
  if(r.ok&&type.startsWith("audio/"))return{blob:await r.blob(),prov:r.headers.get("X-TTS-Provider")};
  if(r.status===404||r.status===405)throw new TtsError("بخش سرور تولید صدا روی این سایت نصب نشده است (Functions مستقر نشده).",true);
  const j=type.includes("json")?await r.json().catch(()=>({})):{};
  if(r.status===400||r.status===429&&j.code==="rate")throw new TtsError(j.error||"درخواست نامعتبر است.",false);
  throw new TtsError(j.error||`خطای سرور (${r.status}).`,true);
}
function decodable(src){return new Promise((ok,bad)=>{const a=new Audio();const t=setTimeout(()=>bad(),6000);a.preload="metadata";a.onloadedmetadata=()=>{clearTimeout(t);a.duration>0&&isFinite(a.duration)?ok():bad()};a.onerror=()=>{clearTimeout(t);bad()};a.src=src})}

// THE one speech function: main button AND fingertip button
async function speak(){
  const text=txt.value, voice=$("voice").value;
  if(mode==="server"&&url&&text===lastText&&voice===lastVoice&&!pending){ // same sentence already generated
    if(!audio.paused){audio.pause();return} if(audio.currentTime>0&&!audio.ended)return play(); audio.currentTime=0;return play()}
  if(mode==="device"&&text===lastText&&synth.speaking){pp.onclick();return}
  if(pending&&pending.key===text+"|"+voice)return;                      // duplicate click while loading
  if(!text.trim()){msg("لطفاً یک جمله آلمانی وارد کنید.",true);txt.focus();return}
  if(text.length>S.maxChars)return msg(`حداکثر ${S.maxChars} نویسه مجاز است.`,true);
  const my=++seq; if(ctl)ctl.abort(); ctl=new AbortController(); silence(); mode="none";   // supersede any older request
  pending={key:text+"|"+voice};state("loading");msg("");
  try{
    const {blob,prov}=await fetchAudio(text,voice,ctl.signal); if(my!==seq)return;
    const u=URL.createObjectURL(blob);
    try{await decodable(u)}catch{URL.revokeObjectURL(u);throw new TtsError("فایل صوتی دریافتی معتبر یا قابل پخش نبود.",true)}
    if(my!==seq){URL.revokeObjectURL(u);return}
    if(url)URL.revokeObjectURL(url); url=u;audio.src=u;lastText=text;lastVoice=voice;mode="server";pending=null;pp.disabled=false;
    msg(prov&&prov!=="azure"?`پخش با موتور جایگزین (${prov})`:"");await play();
  }catch(e){
    if(my!==seq)return; pending=null;
    if(e instanceof TtsError&&e.fb&&synth&&deVoice()){lastText=text;playDevice(text);return}
    state("idle");msg((e instanceof TtsError?e.message:"خطای داخلی برنامه: "+e.message)+(e.fb&&!deVoice()?" همچنین صدای آلمانی روی دستگاه شما نصب نیست.":""),true);console.error(e)
  }finally{if(my===seq)pending=null}
}
go.onclick=tip.onclick=speak; state("idle");
