import subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(["node","test/server.mjs"]);time.sleep(1);U="http://localhost:8770"
with sync_playwright() as p:
  b=p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]);pg=b.new_page();pg.goto(U)
  for s,expect in [("Ich lerne Deutsch.","contour" not in ""),("Wie heißt du?",False),("Kommst du morgen zur Schule?",True),("Wo wohnst du?",False)]:
    pg.fill("#txt",s);pg.click("#tip");pg.wait_for_function("document.getElementById('tip').dataset.state==='playing'")
    x=urllib.request.urlopen(U+"/__ssml").read().decode()
    print(s,"| text exact in SSML:",f">{s}<" in x or s in x,"| rise contour:","contour" in x,"| lang de-DE:",'xml:lang="de-DE"' in x);pg.click("#stop")
  pg.click("#speeds button:nth-child(6)");print("playbackRate after 1.25x:",pg.evaluate("window.__r=1") and pg.evaluate("[...document.querySelectorAll('#speeds button')].find(b=>b.getAttribute('aria-pressed')==='true').textContent"))
  b.close()
srv.kill()
