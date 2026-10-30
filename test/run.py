import subprocess,time,urllib.request,json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(["node","test/server.mjs"],cwd="..");time.sleep(1.2)
U="http://localhost:8770";g=lambda p:urllib.request.urlopen(U+p).read().decode()
def setm(**k):
  for p,m in k.items():g(f"/__set/{p}/{m}")
def calls():return json.loads(g("/__calls"))
res=[]
def ok(n,c,x=""):res.append(c);print(("PASS " if c else "FAIL ")+n,x)
PLAY="document.getElementById('tip').dataset.state==='playing'"; IDLE="document.getElementById('tip').dataset.state==='idle'"
STUB="""(()=>{const voices=[{lang:'de-DE',name:'STUB'}];const s={speaking:false,paused:false,getVoices:()=>voices,cancel(){s.speaking=false},speak(u){s.speaking=true;window.__spoken=u.text;setTimeout(()=>u.onstart&&u.onstart(),50);setTimeout(()=>{s.speaking=false;u.onend&&u.onend()},3000)},pause(){s.paused=true},resume(){s.paused=false}};
Object.defineProperty(window,'speechSynthesis',{value:s});window.SpeechSynthesisUtterance=function(t){this.text=t}})()"""
with sync_playwright() as p:
  b=p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
  def page(vp={"width":1280,"height":900},touch=False,stub=False):
    pg=b.new_page(viewport=vp,has_touch=touch);pg.provs=[];pg.on("response",lambda r:pg.provs.append(r.headers.get("x-tts-provider")) if "/api/tts" in r.url else None)
    if stub:pg.add_init_script(STUB)
    pg.goto(U);pg.evaluate("window.__plays=0;window.__gsp.audio.addEventListener('play',()=>window.__plays++)");return pg
  def go(pg,t,tap=False):
    pg.fill("#txt",t);(pg.tap if tap else pg.click)("#tip")
  S=["Guten Morgen!","Wie geht es dir?","Ich möchte Deutsch lernen.","Können Sie mir bitte helfen?","Ich wohne seit einem Jahr in Deutschland."]
  for dev,vp,touch in [("desktop",{"width":1280,"height":900},False),("mobile-EMULATED",{"width":390,"height":844},True)]:
    print("==",dev);setm(azure="ok",google="ok",eleven="ok");pg=page(vp,touch)
    for s0 in S:
      s=("Mobil: " if touch else "")+s0
      go(pg,s,touch);pg.wait_for_function(PLAY,timeout=8000);x=g("/__ssml")
      ok(f"primary engine, finger→audio '{s}'",pg.provs[-1]=="azure" and s in x and pg.evaluate("window.__gsp.audio.duration>0"));pg.click("#stop")
    go(pg,S[1],touch);pg.wait_for_function(PLAY);pg.click("#tip");pg.wait_for_function("document.getElementById('tip').dataset.state==='paused'");pg.click("#tip");pg.wait_for_function(PLAY)
    ok("pause/resume via fingertip",True);n=len(pg.provs);pg.click("#speeds button:nth-child(1)");r1=pg.evaluate("window.__gsp.audio.playbackRate");pg.click("#speeds button:nth-child(6)")
    ok("speed 0.65→1.25 applied to audio, no new request",r1==.65 and pg.evaluate("window.__gsp.audio.playbackRate")==1.25 and len(pg.provs)==n)
    pg.click("#rep");pg.wait_for_timeout(300);ok("replay",pg.evaluate("window.__gsp.audio.currentTime<1 && !window.__gsp.audio.paused"));pg.click("#stop")
    ok("no horizontal overflow",not pg.evaluate("document.documentElement.scrollWidth>innerWidth"));pg.close()
  print("== failover");pg=page()
  g("/__zero");setm(azure="500");go(pg,"Failover eins");pg.wait_for_function(PLAY,timeout=9000)
  ok("azure 500 → google automatically, ONE click, no error",pg.provs[-1]=="google" and pg.inner_text("#status").count("خطا")==0,pg.inner_text("#status"));pg.click("#stop")
  c0=calls();go(pg,"Failover zwei");pg.wait_for_function(PLAY);c1=calls()
  ok("circuit breaker: azure skipped while cooling down",c1["azure"]==c0["azure"] and pg.provs[-1]=="google");pg.click("#stop")
  time.sleep(3);setm(azure="401",google="429");go(pg,"Failover drei");pg.wait_for_function(PLAY,timeout=9000)
  ok("azure 401 + google 429 → elevenlabs",pg.provs[-1]=="elevenlabs");pg.click("#stop");time.sleep(3)
  setm(azure="garbage",google="ok");go(pg,"Garbage audio");pg.wait_for_function(PLAY,timeout=9000);ok("invalid (non-mp3) audio rejected server-side → next engine",pg.provs[-1]=="google");pg.click("#stop");time.sleep(3)
  setm(azure="hang",google="ok");t=time.time();go(pg,"Hang test");pg.wait_for_function(PLAY,timeout=12000);ok(f"hanging engine cut by timeout, next engine used ({time.time()-t:.1f}s)",pg.provs[-1]=="google" and time.time()-t<8);pg.click("#stop");time.sleep(3)
  print("== all engines down");setm(azure="500",google="500",eleven="500");go(pg,"Alles kaputt");pg.wait_for_function(IDLE);pg.wait_for_timeout(300);t=pg.inner_text("#status")
  ok("all fail, no device voice → honest error, not 'internet' message","همه موتورها" in t and "اتصال اینترنت برقرار نیست" not in t,t);pg.close()
  time.sleep(3);pg=page(stub=True);go(pg,"Alles kaputt zwei");pg.wait_for_function(PLAY,timeout=9000)
  ok("all fail → device de-DE voice (SIMULATED voice stub) speaks the text",pg.evaluate("window.__spoken")=="Alles kaputt zwei",pg.inner_text("#status")[:50]);pg.close()
  print("== concurrency");setm(azure="slow",google="ok",eleven="ok");time.sleep(3);pg=page()
  pg.fill("#txt","Erste Anfrage");pg.click("#tip");pg.wait_for_timeout(300);pg.fill("#txt","Zweite Anfrage");pg.click("#tip");pg.wait_for_function(PLAY,timeout=9000);pg.wait_for_timeout(2500)
  ok("old request superseded: exactly one audio played, for the NEW text",pg.evaluate("window.__plays")==1 and pg.evaluate("window.__gsp.audio.src!==''"),f"plays={pg.evaluate('window.__plays')}");pg.click("#stop")
  g("/__zero");time.sleep(3);setm(azure="slow");pg.fill("#txt","Doppelklick");pg.click("#tip");pg.click("#tip");pg.click("#go");pg.wait_for_function(PLAY,timeout=9000)
  ok("duplicate clicks while loading → 1 backend call",calls()["azure"]==1,str(calls()));pg.close()
  b.close()
print(f"\n{sum(res)}/{len(res)} passed");srv.kill()
