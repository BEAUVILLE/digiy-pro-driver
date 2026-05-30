#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# PATCH DIGIYLYFE DRIVER — audit 20260530
# À lancer à la racine du dépôt BEAUVILLE/digiy-pro-driver.
# Sauvegarde automatique : chaque fichier modifié est copié en .bak-driver-20260530 avant écriture.

from pathlib import Path
import re
import shutil

ROOT = Path.cwd()
STAMP = "driver-20260530"
GUARD_VERSION = "driver-guard-normal-20260530"
PAY_FINAL_URL = "https://pro-pay.digiylyfe.com/module-bridge.html"

DRIVER_CONFIG_BLOCK = '''<!-- CONFIG — Je conduis / DRIVER (patch audit 20260530) -->
<script>
  window.DIGIY_SUPABASE_URL      = "https://wesqmwjjtsefyjnluosj.supabase.co";
  window.DIGIY_SUPABASE_ANON_KEY = "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";
  window.DIGIY_SUPABASE_ANON     = window.DIGIY_SUPABASE_ANON_KEY;
  window.DIGIY_MODULE            = "DRIVER";
  window.DIGIY_ABOS_MODULE       = "DRIVER";
  window.DIGIY_MODULE_LABEL      = "Je conduis";
  window.DIGIY_LOGIN_URL         = "./pin.html";
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./guard.js?v=driver-guard-normal-20260530"></script>
'''

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")

def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + f".bak-{STAMP}")
    if not bak.exists():
        shutil.copy2(path, bak)

def write_if_changed(path: Path, text: str, changed_files: list[str]) -> None:
    old = read(path)
    if old == text:
        print(f"OK inchangé : {path.name}")
        return
    backup(path)
    path.write_text(text, encoding="utf-8")
    changed_files.append(path.name)
    print(f"PATCH posé : {path.name}")

def ensure_abos_module(text: str) -> str:
    if "DIGIY_ABOS_MODULE" in text:
        return text
    return re.sub(
        r'(window\.DIGIY_MODULE\s*=\s*["\']DRIVER["\'];)',
        r'\1\n  window.DIGIY_ABOS_MODULE       = "DRIVER";',
        text,
        count=1
    )

def replace_guard_version(text: str) -> str:
    if re.search(r'<script\s+src="\./guard\.js\?v=[^"]*"></script>', text):
        return re.sub(
            r'<script\s+src="\./guard\.js\?v=[^"]*"></script>',
            f'<script src="./guard.js?v={GUARD_VERSION}"></script>',
            text
        )
    return text

def ensure_driver_guard_block(text: str) -> str:
    text = ensure_abos_module(text)
    if "guard.js" in text:
        return replace_guard_version(text)

    insert_at = text.find("<style>")
    if insert_at == -1:
        insert_at = text.find("</head>")
    if insert_at == -1:
        raise RuntimeError("Impossible de trouver <style> ou </head> pour insérer le guard.")

    return text[:insert_at] + DRIVER_CONFIG_BLOCK + text[insert_at:]

def patch_action_or_transition(filename: str, changed: list[str]) -> None:
    path = ROOT / filename
    if not path.exists():
        print(f"ABSENT : {filename} — ignoré")
        return
    text = read(path)
    text = ensure_driver_guard_block(text)
    write_if_changed(path, text, changed)

def patch_session(changed: list[str]) -> None:
    path = ROOT / "session.html"
    if not path.exists():
        print("ABSENT : session.html — ignoré")
        return

    text = read(path)
    text = ensure_abos_module(text)
    text = replace_guard_version(text)

    text = text.replace("https://commencer-a-payer.digiylyfe.com/", PAY_FINAL_URL)
    text = text.replace("https://commencer-a-payer.digiylyfe.com", PAY_FINAL_URL)

    text = text.replace("./generateur-digiy-driver.html", "./qr-driver-carte-numérique-v2.html")
    text = text.replace("./generateur-digiy-driver.htm", "./qr-driver-carte-numérique-v2.html")

    text = re.sub(
        r'\s*<script\s+src="\./assets/js/digiy-driver-sync-ui\.js[^"]*"\s+defer></script>\s*',
        "\n  <!-- Session légère : sync-ui métier retiré de session.html -->\n",
        text
    )

    write_if_changed(path, text, changed)

def patch_guard(changed: list[str]) -> None:
    path = ROOT / "guard.js"
    if not path.exists():
        print("ABSENT : guard.js — ignoré")
        return

    text = read(path)

    text = text.replace("https://commencer-a-payer.digiylyfe.com/", PAY_FINAL_URL)
    text = text.replace("https://commencer-a-payer.digiylyfe.com", PAY_FINAL_URL)

    if "digiyTimedFetch" not in text:
        text = text.replace("await fetch(", "await digiyTimedFetch(")
        helper = '''
  // PATCH AUDIT DRIVER 20260530 — timeout anti-moulinage Supabase/VPS
  const DRIVER_FETCH_TIMEOUT_MS = 2500;
  async function digiyTimedFetch(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function(){ controller.abort(); }, timeoutMs || DRIVER_FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }
'''
        text = re.sub(
            r'("use strict";\s*)',
            r'\1' + helper,
            text,
            count=1
        )

    if "localRaw = JSON.stringify(localSession)" not in text and "const raw = JSON.stringify(session);" in text:
        text = text.replace(
            "const raw = JSON.stringify(session);",
            '''const raw = JSON.stringify(session);

    // PATCH AUDIT DRIVER 20260530 — localStorage sans téléphone durable
    const localSession = Object.assign({}, session);
    try { delete localSession.phone; } catch (_) {}
    try {
      if (localSession.slug && /\\d{7,}/.test(String(localSession.slug))) {
        delete localSession.slug;
      }
    } catch (_) {}
    const localRaw = JSON.stringify(localSession);'''
        )
        text = text.replace("writeLocal(key, raw);", "writeLocal(key, localRaw);")

    text = text.replace('finalSlug = "driver-" + finalPhone;', 'finalSlug = ""; // PATCH audit : pas de slug fallback contenant le téléphone')
    text = text.replace("finalSlug = 'driver-' + finalPhone;", "finalSlug = ''; // PATCH audit : pas de slug fallback contenant le téléphone")

    text = re.sub(
        r'VERSION:\s*["\'][^"\']*["\']',
        'VERSION: "driver-guard-normal-20260530"',
        text
    )

    write_if_changed(path, text, changed)

def main() -> int:
    changed = []
    print("=== PATCH DRIVER 20260530 — démarrage ===")
    print(f"Dossier courant : {ROOT}")

    patch_action_or_transition("action.html", changed)
    patch_action_or_transition("pay-transition.html", changed)
    patch_session(changed)
    patch_guard(changed)

    print("\\n=== RÉSUMÉ ===")
    if changed:
      for name in changed:
          print(f"✓ {name}")
      print("\\nSauvegardes créées avec extension .bak-driver-20260530")
      print("À tester : PIN → HUB → action → pay-transition → PRO PAY → session.")
    else:
      print("Aucun fichier modifié.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
