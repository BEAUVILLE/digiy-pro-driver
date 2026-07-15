


#!/usr/bin/env python3
# DIGIY PRO DRIVER — HUB SIMPLE V5
#
# Usage :
#   python3 apply_driver_simple_hub_v5.py /chemin/vers/digiy-pro-driver
#
# Ce patch :
# - sauvegarde le hub complet ;
# - remplace seulement hub.html par un écran chauffeur ultra-simple ;
# - conserve tous les autres fichiers et toutes les routes sécurisées ;
# - ne fait aucun commit et aucun push.

from __future__ import annotations

import shutil
import sys
from pathlib import Path


class PatchError(RuntimeError):
    pass


SIMPLE_HUB = r'''<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>Je conduis • DIGIY DRIVER</title>
  <meta name="description" content="Espace simple du chauffeur DIGIY : fiche, carte QR et partage client."/>
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet"/>
  <meta name="theme-color" content="#0b3b29"/>

  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet"/>

  <script>
    window.DIGIY_SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
    window.DIGIY_SUPABASE_ANON_KEY = "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";
    window.DIGIY_SUPABASE_ANON = window.DIGIY_SUPABASE_ANON_KEY;
    window.DIGIY_SUPABASE_KEY = window.DIGIY_SUPABASE_ANON_KEY;
    window.DIGIY_MODULE = "DRIVER";
    window.DIGIY_ABOS_MODULE = "DRIVER";
    window.DIGIY_LOGIN_URL = "./pin.html";
  </script>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="./assets/js/digiy-abos-access.js?v=abos-20260522"></script>
  <script src="./guard.js?v=driver-session-v5"></script>

  <style>
    :root{
      --bg:#0b3b29;
      --bg2:#07281c;
      --line:rgba(255,255,255,.17);
      --text:#f3fff7;
      --muted:rgba(243,255,247,.72);
      --shadow:0 18px 48px rgba(0,0,0,.28);
    }
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{
      margin:0;
      min-height:100dvh;
      color:var(--text);
      font-family:Outfit,system-ui,-apple-system,"Segoe UI",sans-serif;
      background:
        radial-gradient(520px 330px at 15% -5%,rgba(34,197,94,.24),transparent 65%),
        radial-gradient(420px 280px at 100% 5%,rgba(250,204,21,.12),transparent 62%),
        linear-gradient(180deg,var(--bg),var(--bg2));
      padding:calc(18px + env(safe-area-inset-top,0px)) 14px calc(24px + env(safe-area-inset-bottom,0px));
    }
    a{color:inherit;text-decoration:none}
    button{font:inherit}
    .shell{
      width:min(560px,100%);
      min-height:calc(100dvh - 42px);
      margin:0 auto;
      display:flex;
      flex-direction:column;
    }
    .brand{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      min-height:44px;
    }
    .brandMark{
      display:flex;
      align-items:center;
      gap:10px;
      font-weight:1000;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .brandIcon{
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      border-radius:15px;
      background:rgba(255,255,255,.10);
      border:1px solid var(--line);
      font-size:23px;
    }
    .secure{
      display:inline-flex;
      align-items:center;
      min-height:32px;
      padding:6px 10px;
      border-radius:999px;
      color:#bbf7d0;
      border:1px solid rgba(34,197,94,.42);
      background:rgba(34,197,94,.12);
      font-size:12px;
      font-weight:900;
      white-space:nowrap;
    }
    .hero{padding:34px 4px 22px}
    .eyebrow{
      margin-bottom:8px;
      color:#fff0a8;
      font-size:12px;
      font-weight:1000;
      letter-spacing:.15em;
      text-transform:uppercase;
    }
    h1{
      margin:0;
      font-size:clamp(42px,13vw,70px);
      line-height:.9;
      letter-spacing:-.055em;
      font-weight:1000;
    }
    .intro{
      margin:18px 0 0;
      max-width:430px;
      color:var(--muted);
      font-size:17px;
      line-height:1.45;
      font-weight:800;
    }
    .choices{display:grid;gap:12px;margin-top:8px}
    .choice{
      width:100%;
      min-height:112px;
      display:grid;
      grid-template-columns:64px 1fr 24px;
      align-items:center;
      gap:14px;
      padding:17px;
      border-radius:25px;
      border:1px solid var(--line);
      background:linear-gradient(180deg,rgba(255,255,255,.115),rgba(255,255,255,.065));
      color:var(--text);
      box-shadow:var(--shadow);
      text-align:left;
      cursor:pointer;
      transition:transform .12s ease,background .12s ease,border-color .12s ease;
    }
    .choice:hover{
      transform:translateY(-1px);
      background:rgba(255,255,255,.14);
      border-color:rgba(255,255,255,.27);
    }
    .choice:active{transform:none}
    .choice.primary{
      border-color:rgba(34,197,94,.44);
      background:
        radial-gradient(360px 160px at 100% 0%,rgba(34,197,94,.23),transparent 70%),
        linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.07));
    }
    .choice.share{
      border-color:rgba(250,204,21,.40);
      background:
        radial-gradient(360px 160px at 100% 0%,rgba(250,204,21,.18),transparent 70%),
        linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.065));
    }
    .choiceIcon{
      width:64px;
      height:64px;
      display:grid;
      place-items:center;
      border-radius:21px;
      border:1px solid rgba(255,255,255,.15);
      background:rgba(255,255,255,.10);
      font-size:34px;
    }
    .choiceText b{
      display:block;
      margin-bottom:5px;
      color:#fff;
      font-size:24px;
      line-height:1.05;
      letter-spacing:-.025em;
      font-weight:1000;
    }
    .choiceText span{
      display:block;
      color:var(--muted);
      font-size:14px;
      line-height:1.35;
      font-weight:800;
    }
    .arrow{
      color:rgba(255,255,255,.62);
      font-size:25px;
      font-weight:1000;
    }
    .message{
      min-height:24px;
      margin:14px 4px 0;
      color:#bbf7d0;
      font-size:14px;
      font-weight:900;
      line-height:1.4;
    }
    .foot{
      margin-top:auto;
      padding:28px 4px 4px;
      color:rgba(243,255,247,.46);
      font-size:12px;
      line-height:1.45;
      font-weight:800;
      text-align:center;
    }
    @media(max-width:390px){
      .choice{
        min-height:102px;
        grid-template-columns:56px 1fr 18px;
        gap:11px;
        padding:14px;
      }
      .choiceIcon{
        width:56px;
        height:56px;
        border-radius:18px;
        font-size:29px;
      }
      .choiceText b{font-size:21px}
      .choiceText span{font-size:13px}
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="brand">
      <div class="brandMark">
        <span class="brandIcon">🚕</span>
        <span>DIGIY DRIVER</span>
      </div>
      <span class="secure">● accès ouvert</span>
    </header>

    <section class="hero">
      <div class="eyebrow">Je conduis</div>
      <h1>Bonjour chauffeur.</h1>
      <p class="intro">
        Tout est prêt. Choisis simplement ce que tu veux montrer ou partager au client.
      </p>
    </section>

    <section class="choices" aria-label="Actions principales chauffeur">
      <a class="choice primary" href="./ma-fiche.html">
        <span class="choiceIcon">🪪</span>
        <span class="choiceText">
          <b>Ma fiche chauffeur</b>
          <span>Voir ma présentation, mon véhicule, mes zones et mon contact.</span>
        </span>
        <span class="arrow">›</span>
      </a>

      <a class="choice" href="./generateur-digiy-driver.html">
        <span class="choiceIcon">📱</span>
        <span class="choiceText">
          <b>Ma carte QR</b>
          <span>Afficher mon QR pour que le client puisse me retrouver.</span>
        </span>
        <span class="arrow">›</span>
      </a>

      <button class="choice share" id="shareBtn" type="button">
        <span class="choiceIcon">📲</span>
        <span class="choiceText">
          <b>Partager sur WhatsApp</b>
          <span>Envoyer directement le lien de ma fiche au client.</span>
        </span>
        <span class="arrow">›</span>
      </button>
    </section>

    <div class="message" id="message" aria-live="polite"></div>

    <footer class="foot">
      Paiement direct au chauffeur · 0 % de commission DIGIY
    </footer>
  </main>

  <script>
  (() => {
    "use strict";

    const shareBtn = document.getElementById("shareBtn");
    const message = document.getElementById("message");

    function ficheUrl(){
      return new URL("./ma-fiche.html", window.location.href).href;
    }

    async function shareFiche(){
      const url = ficheUrl();
      const text = "Voici ma fiche chauffeur DIGIY. Tu peux voir mes informations et me contacter directement :";

      message.textContent = "";

      if(navigator.share){
        try{
          await navigator.share({
            title:"Ma fiche chauffeur DIGIY",
            text,
            url
          });
          message.textContent = "✅ Fiche partagée.";
          return;
        }catch(error){
          if(error && error.name === "AbortError") return;
        }
      }

      const whatsapp =
        "https://wa.me/?text=" +
        encodeURIComponent(text + "\n" + url);

      window.open(whatsapp,"_blank","noopener,noreferrer");
      message.textContent = "✅ WhatsApp ouvert.";
    }

    shareBtn.addEventListener("click",shareFiche);
  })();
  </script>
</body>
</html>
'''


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 apply_driver_simple_hub_v5.py /chemin/vers/digiy-pro-driver")
        return 2

    root = Path(sys.argv[1]).expanduser().resolve()
    hub = root / "hub.html"

    if not hub.is_file():
        raise PatchError(f"Fichier absent : {hub}")

    old = hub.read_text(encoding="utf-8")

    required_old_markers = [
        "DIGIY_MODULE",
        "guard.js",
        "Mon profil",
        "Mes tarifs",
    ]
    missing = [marker for marker in required_old_markers if marker not in old]
    if missing:
        raise PatchError(
            "Le hub actuel ne ressemble pas au hub DRIVER attendu : "
            + ", ".join(missing)
        )

    full_backup = root / "hub-complet.html"
    safety_backup = root / "hub.html.bak-simple-v5"

    if not full_backup.exists():
        shutil.copy2(hub, full_backup)

    shutil.copy2(hub, safety_backup)
    hub.write_text(SIMPLE_HUB, encoding="utf-8")

    new = hub.read_text(encoding="utf-8")
    required_new = [
        "./ma-fiche.html",
        "./generateur-digiy-driver.html",
        "Partager sur WhatsApp",
        "./guard.js",
        'window.DIGIY_MODULE = "DRIVER"',
    ]
    failed = [marker for marker in required_new if marker not in new]
    if failed:
        shutil.copy2(safety_backup, hub)
        raise PatchError(
            "Validation du hub simple échouée, restauration effectuée : "
            + ", ".join(failed)
        )

    print("HUB SIMPLE V5 APPLIQUÉ — aucun commit, aucun push.")
    print("Écran quotidien :")
    print("  - Ma fiche chauffeur")
    print("  - Ma carte QR")
    print("  - Partager sur WhatsApp")
    print("Sauvegardes :")
    print(f"  - {full_backup}")
    print(f"  - {safety_backup}")
    print("Les pages profil, tarifs, visibilité et session restent présentes derrière.")
    print()
    print("Test : http://127.0.0.1:8080/hub.html?v=simple-v5")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PatchError as exc:
        print(f"ERREUR HUB SIMPLE V5 : {exc}", file=sys.stderr)
        raise SystemExit(1)
