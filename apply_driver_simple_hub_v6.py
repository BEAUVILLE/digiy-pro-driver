


#!/usr/bin/env python3
"""
DIGIY PRO DRIVER — Nettoyage structurel V6
------------------------------------------
Travaille uniquement dans une copie locale.
- Aucun commit
- Aucun push
- Aucun appel Supabase
- Sauvegarde complète avant modification
- Refuse d'agir si le noyau sécurisé n'est pas présent

Usage :
  python3 apply_driver_cleanup_v6.py \
    "/Users/jeanbaptistebeauville/modules/digiy-pro-driver"

Le script applique directement le nettoyage après validation du noyau.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable


VERSION = "V6-20260715"

REQUIRED_FILES = [
    "index.html",
    "hub.html",
    "pin.html",
    "guard.js",
    "ma-fiche.html",
    "generateur-digiy-driver.html",
    "profile-edition.html",
    "profil-driver.html",
    "tarifs-driver.html",
    "visibilite-driver.html",
    "session-driver.html",
    "assets/js/driver-secure-api.js",
    "assets/css/driver-mobile.css",
]

SECURE_MARKERS = [
    "driver_issue_session",
    "driver_revoke_session",
    "driver_session_get_cockpit",
    "driver_session_save_profile",
    "driver_session_list_rates",
    "driver_session_upsert_rate",
    "driver_session_disable_rate",
]

FORBIDDEN_ACTIVE_MARKERS = [
    "driver_upsert_rate_by_slug",
    "driver_list_rates_by_slug",
    "driver_disable_rate_by_slug",
    "digiy_driver_save_profile",
    "digiy_driver_get_cockpit_by_slug",
]

ADMIN_PAGES = [
    "profile-edition.html",
    "profil-driver.html",
    "tarifs-driver.html",
    "visibilite-driver.html",
    "session-driver.html",
    "cockpit-driver-complet.html",
]

LEGACY_UI = [
    "action.html",
    "alertes.html",
    "cockpit.html",
    "dashboard-pro.html",
    "driver-memory-check.html",
    "fiche.html",
    "oreille.html",
    "pay-transition.html",
    "profil-chauffeur.html",
    "qr-driver-carte-numérique-v2.html",
    "qr.html",
    "session.html",
    "support.html",
    "tarifs-edition.html",
    "tarifs.html",
    "trajets-complet.html",
    "trajets-programmer.html",
    "trajets.html",
]

LEGACY_TOOLS = [
    "apply_driver_simple_hub_v5.py",
    "apply_driver_mobile_split_v4_1.py",
    "apply_driver_mobile_split_v4.py",
    "claw tools driver·js",
    "digiy-driver-sync-ui.js",
]

LEGACY_INFRA = [
    "deploy-vps-web.yml",
    "deploy-vps-worker.yml",
    "index.ts",
    "digiy-agent-worker",
    "log-deploy",
    "github",
    "workflows",
]

ROOT_KEEP = {
    ".git",
    ".gitignore",
    ".nojekyll",
    "404.html",
    "CNAME",
    "README.md",
    "admin",
    "assets",
    "guard.js",
    "hub.html",
    "index.html",
    "ma-fiche.html",
    "generateur-digiy-driver.html",
    "pin.html",
    ".github",
}


class CleanupError(RuntimeError):
    pass


def say(message: str) -> None:
    print(message, flush=True)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def run(cmd: list[str], cwd: Path, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )


def copy_repo_without_git(root: Path, destination: Path) -> None:
    def ignore(directory: str, names: list[str]) -> set[str]:
        ignored = {".git"}
        ignored.update(name for name in names if name == "__pycache__")
        return ignored

    shutil.copytree(root, destination, ignore=ignore)


def validate_repository(root: Path) -> None:
    if not root.is_dir():
        raise CleanupError(f"Dépôt introuvable : {root}")

    if not (root / ".git").exists():
        raise CleanupError(
            "Ce dossier ne contient pas .git. "
            "Utilise la vraie copie locale du dépôt digiy-pro-driver."
        )

    missing = [name for name in REQUIRED_FILES if not (root / name).exists()]
    if missing:
        formatted = "\n".join(f"  - {name}" for name in missing)
        raise CleanupError(
            "Noyau sécurisé incomplet. Aucun fichier n'a été modifié.\n"
            f"Fichiers manquants :\n{formatted}"
        )

    scan_files = [
        root / "pin.html",
        root / "guard.js",
        root / "profile-edition.html",
        root / "profil-driver.html",
        root / "tarifs-driver.html",
        root / "visibilite-driver.html",
        root / "session-driver.html",
        root / "assets/js/driver-secure-api.js",
    ]
    corpus = "\n".join(read_text(path) for path in scan_files if path.exists())

    missing_markers = [marker for marker in SECURE_MARKERS if marker not in corpus]
    if missing_markers:
        formatted = "\n".join(f"  - {name}" for name in missing_markers)
        raise CleanupError(
            "Les RPC sécurisées ne sont pas toutes présentes. "
            "Aucun fichier n'a été modifié.\n"
            f"Marqueurs manquants :\n{formatted}"
        )

    simple_hub = read_text(root / "hub.html")
    required_hub_text = [
        "Bonjour chauffeur",
        "Ma fiche chauffeur",
        "Ma carte QR",
        "Partager sur WhatsApp",
    ]
    absent = [text for text in required_hub_text if text not in simple_hub]
    if absent:
        raise CleanupError(
            "hub.html n'est pas le HUB SIMPLE validé. "
            "Aucun fichier n'a été modifié.\n"
            + "\n".join(f"  - texte absent : {text}" for text in absent)
        )

    old_hub_markers = ["Choisis ton chemin", "Oreille DRIVER", "Mes trajets"]
    found_old = [text for text in old_hub_markers if text in simple_hub]
    if found_old:
        raise CleanupError(
            "hub.html contient encore l'ancien cockpit. "
            "Aucun fichier n'a été modifié.\n"
            + "\n".join(f"  - marqueur ancien : {text}" for text in found_old)
        )

    say("✅ Noyau sécurisé détecté.")
    say("✅ HUB SIMPLE détecté.")
    say("✅ Les 7 RPC de session sont présentes.")


def patch_admin_content(content: str) -> str:
    # Ressources et portes situées à la racine après déplacement dans admin/.
    root_targets = [
        "pin.html",
        "guard.js",
        "hub.html",
        "index.html",
        "ma-fiche.html",
        "generateur-digiy-driver.html",
    ]

    for target in root_targets:
        content = content.replace(f"./{target}", f"../{target}")

    content = content.replace("./assets/", "../assets/")

    # Les nouvelles pages techniques vivent toutes dans admin/.
    same_admin_redirects = {
        "./profil-chauffeur.html": "./profil-driver.html",
        "./tarifs.html": "./tarifs-driver.html",
        "./tarifs-edition.html": "./tarifs-driver.html",
        "./session.html": "./session-driver.html",
    }
    for old, new in same_admin_redirects.items():
        content = content.replace(old, new)

    # Les anciennes portes métier ne font plus partie du parcours.
    old_to_hub = [
        "action.html",
        "alertes.html",
        "cockpit.html",
        "dashboard-pro.html",
        "driver-memory-check.html",
        "fiche.html",
        "oreille.html",
        "pay-transition.html",
        "qr-driver-carte-numérique-v2.html",
        "qr.html",
        "support.html",
        "trajets-complet.html",
        "trajets-programmer.html",
        "trajets.html",
    ]
    for name in old_to_hub:
        # Préserve les guillemets et supprime proprement un éventuel hash.
        content = re.sub(
            rf"\./{re.escape(name)}(?:#[A-Za-z0-9_-]+)?",
            "../hub.html",
            content,
        )

    # Évite les doubles remontées créées par une relance du script.
    content = content.replace("../../assets/", "../assets/")
    content = content.replace("../../pin.html", "../pin.html")
    content = content.replace("../../guard.js", "../guard.js")
    content = content.replace("../../hub.html", "../hub.html")
    content = content.replace("../../index.html", "../index.html")
    content = content.replace("../../ma-fiche.html", "../ma-fiche.html")
    content = content.replace(
        "../../generateur-digiy-driver.html",
        "../generateur-digiy-driver.html",
    )

    return content


def move_if_present(source: Path, destination: Path) -> bool:
    if not source.exists():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise CleanupError(f"Destination déjà existante : {destination}")
    shutil.move(str(source), str(destination))
    return True


def active_files(root: Path) -> list[Path]:
    candidates: list[Path] = [
        root / "index.html",
        root / "hub.html",
        root / "pin.html",
        root / "guard.js",
        root / "ma-fiche.html",
        root / "generateur-digiy-driver.html",
        root / "assets/js/driver-secure-api.js",
    ]
    candidates.extend(sorted((root / "admin").glob("*.html")))
    return [path for path in candidates if path.exists()]


def scan_forbidden(root: Path) -> dict[str, list[str]]:
    findings: dict[str, list[str]] = {}
    for path in active_files(root):
        text = read_text(path)
        hits = [marker for marker in FORBIDDEN_ACTIVE_MARKERS if marker in text]
        if hits:
            findings[str(path.relative_to(root))] = hits
    return findings


def scan_secure_markers(root: Path) -> dict[str, list[str]]:
    findings: dict[str, list[str]] = {}
    for path in active_files(root):
        text = read_text(path)
        hits = [marker for marker in SECURE_MARKERS if marker in text]
        if hits:
            findings[str(path.relative_to(root))] = hits
    return findings


LOCAL_REF_RE = re.compile(
    r"""(?:href|src)\s*=\s*["']([^"'?#]+)(?:[?#][^"']*)?["']""",
    re.IGNORECASE,
)


def scan_broken_local_links(root: Path) -> list[str]:
    broken: list[str] = []
    for page in active_files(root):
        text = read_text(page)
        for raw in LOCAL_REF_RE.findall(text):
            ref = html.unescape(raw.strip())
            if not ref or ref.startswith(("#", "/", "http:", "https:", "mailto:", "tel:", "data:", "javascript:")):
                continue
            target = (page.parent / ref).resolve()
            try:
                target.relative_to(root.resolve())
            except ValueError:
                broken.append(
                    f"{page.relative_to(root)} -> {ref} (sort du dépôt)"
                )
                continue
            if not target.exists():
                broken.append(
                    f"{page.relative_to(root)} -> {ref} (introuvable)"
                )
    return sorted(set(broken))


def write_index(root: Path) -> None:
    content = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>DIGIY DRIVER — Accès chauffeur</title>
  <meta name="description" content="Accès sécurisé à l’espace chauffeur DIGIY DRIVER."/>
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet"/>
  <meta name="theme-color" content="#0b3b29"/>
  <script>
    window.location.replace("./hub.html");
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=./hub.html"/>
  </noscript>
</head>
<body>
  <p>Ouverture de DIGIY DRIVER… <a href="./hub.html">Continuer</a></p>
</body>
</html>
"""
    write_text(root / "index.html", content)


def write_404(root: Path) -> None:
    content = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>DIGIY DRIVER — Redirection</title>
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet"/>
  <script>
    window.location.replace("./hub.html");
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=./hub.html"/>
  </noscript>
</head>
<body>
  <p>Cette ancienne porte a été rangée. <a href="./hub.html">Retour à DRIVER</a></p>
</body>
</html>
"""
    write_text(root / "404.html", content)


def write_readme(root: Path) -> None:
    content = """# DIGIY PRO DRIVER

Accès chauffeur DIGIYLYFE — simple, direct et sécurisé.

## Parcours chauffeur

```text
PIN
→ accueil simple
→ Ma fiche chauffeur
→ Ma carte QR
→ Partager sur WhatsApp
```

Le chauffeur ne voit que trois gestes :

1. consulter sa fiche ;
2. afficher sa carte QR ;
3. partager sa fiche au client.

## Noyau publié

| Chemin | Rôle |
|---|---|
| `index.html` | Entrée courte vers le hub |
| `hub.html` | Accueil chauffeur à trois actions |
| `pin.html` | Ouverture de la session DRIVER |
| `guard.js` | Protection et contrôle de session |
| `ma-fiche.html` | Fiche chauffeur |
| `generateur-digiy-driver.html` | Carte QR |
| `assets/` | Ressources partagées |
| `admin/` | Atelier DIGIY protégé |

## Atelier DIGIY

Les pages techniques sont rangées dans `admin/` :

- `profil-driver.html`
- `tarifs-driver.html`
- `visibilite-driver.html`
- `session-driver.html`
- `profile-edition.html`
- `cockpit-driver-complet.html` lorsqu’il existe

Elles utilisent les RPC de session serveur. Elles ne sont pas liées depuis le
hub chauffeur.

## Sécurité

Les opérations de profil et de tarifs passent par une session DRIVER :

- `driver_issue_session`
- `driver_revoke_session`
- `driver_session_get_cockpit`
- `driver_session_save_profile`
- `driver_session_list_rates`
- `driver_session_upsert_rate`
- `driver_session_disable_rate`

Les anciennes écritures directes par slug ne font pas partie du noyau actif.

## Doctrine

Paiement direct au chauffeur.
0 % de commission DIGIY.
Le chauffeur garde son argent et son client.
"""
    write_text(root / "README.md", content)


def update_admin_pages(root: Path) -> list[str]:
    moved: list[str] = []
    admin_dir = root / "admin"
    admin_dir.mkdir(exist_ok=True)

    for name in ADMIN_PAGES:
        source = root / name
        destination = admin_dir / name

        if source.exists():
            if destination.exists():
                raise CleanupError(
                    f"Deux versions concurrentes existent : {source} et {destination}"
                )
            shutil.move(str(source), str(destination))
            moved.append(name)

    for page in sorted(admin_dir.glob("*.html")):
        original = read_text(page)
        patched = patch_admin_content(original)
        if patched != original:
            write_text(page, patched)

    return moved


def move_legacy(root: Path, legacy_root: Path) -> dict[str, list[str]]:
    result = {"ui": [], "tools": [], "infra": [], "archive": []}

    for name in LEGACY_UI:
        if move_if_present(root / name, legacy_root / "ui" / name):
            result["ui"].append(name)

    for name in LEGACY_TOOLS:
        if move_if_present(root / name, legacy_root / "tools" / name):
            result["tools"].append(name)

    for name in LEGACY_INFRA:
        if move_if_present(root / name, legacy_root / "infra" / name):
            result["infra"].append(name)

    old_archive = root / "archive"
    if old_archive.exists():
        move_if_present(old_archive, legacy_root / "archive")
        result["archive"].append("archive/")

    return result


def root_inventory(root: Path) -> list[str]:
    return sorted(path.name + ("/" if path.is_dir() else "") for path in root.iterdir())


def git_diff_check(root: Path) -> tuple[bool, str]:
    result = run(["git", "diff", "--check"], cwd=root)
    return result.returncode == 0, result.stdout.strip()


def git_status(root: Path) -> str:
    return run(["git", "status", "--short"], cwd=root).stdout.rstrip()


def git_diff_stat(root: Path) -> str:
    return run(["git", "diff", "--stat"], cwd=root).stdout.rstrip()


def write_report(
    root: Path,
    backup: Path,
    legacy: Path,
    moved_admin: list[str],
    moved_legacy: dict[str, list[str]],
    broken_links: list[str],
    forbidden: dict[str, list[str]],
    secure: dict[str, list[str]],
    diff_ok: bool,
    diff_output: str,
) -> Path:
    report = root / "DRIVER_CLEANUP_REPORT.md"

    def bullets(values: Iterable[str]) -> str:
        items = list(values)
        return "\n".join(f"- `{value}`" for value in items) if items else "- Aucun"

    secure_lines: list[str] = []
    for file_name, markers in sorted(secure.items()):
        secure_lines.append(f"- `{file_name}` : {', '.join(f'`{m}`' for m in markers)}")

    forbidden_lines: list[str] = []
    for file_name, markers in sorted(forbidden.items()):
        forbidden_lines.append(f"- `{file_name}` : {', '.join(f'`{m}`' for m in markers)}")

    sections = [
        f"# Rapport de nettoyage DIGIY DRIVER — {VERSION}",
        "",
        "## Sauvegardes",
        "",
        f"- Copie complète avant nettoyage : `{backup}`",
        f"- Anciennes interfaces et outils sortis de la branche : `{legacy}`",
        "",
        "## Racine finale",
        "",
        bullets(root_inventory(root)),
        "",
        "## Pages déplacées vers admin/",
        "",
        bullets(moved_admin),
        "",
        "## Éléments sortis de la branche publiée",
        "",
        "### Interfaces",
        bullets(moved_legacy["ui"]),
        "",
        "### Outils",
        bullets(moved_legacy["tools"]),
        "",
        "### Infrastructure ancienne ou inactive",
        bullets(moved_legacy["infra"]),
        "",
        "### Ancien dossier archive",
        bullets(moved_legacy["archive"]),
        "",
        "## RPC sécurisées trouvées",
        "",
        "\n".join(secure_lines) if secure_lines else "- Aucune",
        "",
        "## Anciennes RPC interdites dans le noyau actif",
        "",
        "\n".join(forbidden_lines) if forbidden_lines else "- Aucune",
        "",
        "## Liens locaux cassés dans le noyau actif",
        "",
        bullets(broken_links),
        "",
        "## git diff --check",
        "",
        "- OK" if diff_ok else "- ÉCHEC",
        "",
        "```text",
        diff_output or "(aucune sortie)",
        "```",
        "",
        "## git status --short",
        "",
        "```text",
        git_status(root) or "(propre)",
        "```",
        "",
        "## git diff --stat",
        "",
        "```text",
        git_diff_stat(root) or "(aucun diff)",
        "```",
        "",
        "## Publication",
        "",
        "Aucun commit, aucun push et aucun déploiement n'ont été réalisés.",
        "",
    ]
    write_text(report, "\n".join(sections))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Nettoyage local, réversible et sécurisé de DIGIY PRO DRIVER."
    )
    parser.add_argument("repository", help="Chemin absolu du dépôt local")
    args = parser.parse_args()

    root = Path(args.repository).expanduser().resolve()
    validate_repository(root)

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root.parent / f"{root.name}-backup-before-cleanup-v6-{stamp}"
    legacy = root.parent / f"{root.name}-legacy-v6-{stamp}"

    if backup.exists() or legacy.exists():
        raise CleanupError("Un dossier de sauvegarde avec le même horodatage existe déjà.")

    say(f"📦 Sauvegarde complète : {backup}")
    copy_repo_without_git(root, backup)

    legacy.mkdir(parents=True)
    say(f"🗄️  Conservation hors branche : {legacy}")

    try:
        moved_admin = update_admin_pages(root)
        moved_legacy = move_legacy(root, legacy)

        write_index(root)
        write_404(root)
        write_readme(root)

        forbidden = scan_forbidden(root)
        secure = scan_secure_markers(root)
        broken_links = scan_broken_local_links(root)
        diff_ok, diff_output = git_diff_check(root)

        missing_secure_after = [
            marker
            for marker in SECURE_MARKERS
            if not any(marker in markers for markers in secure.values())
        ]

        errors: list[str] = []
        if forbidden:
            errors.append("anciennes RPC interdites encore présentes")
        if missing_secure_after:
            errors.append(
                "RPC sécurisées perdues : " + ", ".join(missing_secure_after)
            )
        if broken_links:
            errors.append("liens locaux cassés dans le noyau actif")
        if not diff_ok:
            errors.append("git diff --check en échec")

        report = write_report(
            root=root,
            backup=backup,
            legacy=legacy,
            moved_admin=moved_admin,
            moved_legacy=moved_legacy,
            broken_links=broken_links,
            forbidden=forbidden,
            secure=secure,
            diff_ok=diff_ok,
            diff_output=diff_output,
        )

        say("")
        say("════════════════════════════════════════════════════")
        if errors:
            say("⚠️  NETTOYAGE APPLIQUÉ MAIS CONTRÔLE FINAL NON VALIDÉ")
            for error in errors:
                say(f"  - {error}")
            say(f"Rapport : {report}")
            say(f"Sauvegarde : {backup}")
            say("Aucun commit ni push. Restaure depuis la sauvegarde avant publication.")
            return 2

        say("✅ NETTOYAGE DRIVER V6 APPLIQUÉ ET CONTRÔLÉ")
        say(f"✅ Rapport : {report}")
        say(f"✅ Sauvegarde : {backup}")
        say(f"✅ Anciennes interfaces conservées : {legacy}")
        say("✅ git diff --check : propre")
        say("✅ Aucun commit, aucun push, aucun déploiement")
        say("════════════════════════════════════════════════════")
        return 0

    except Exception:
        say("")
        say("❌ Une erreur est survenue après la sauvegarde.")
        say(f"✅ Copie intacte disponible ici : {backup}")
        say(f"✅ Éléments éventuellement déplacés ici : {legacy}")
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CleanupError as exc:
        print(f"\n❌ {exc}", file=sys.stderr)
        raise SystemExit(1)
