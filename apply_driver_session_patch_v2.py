#!/usr/bin/env python3
# DIGIY PRO DRIVER — raccordement session serveur + tarifs sécurisés.
#
# Usage:
#   python3 apply_driver_session_patch_v2.py /chemin/vers/digiy-pro-driver
#
# Le script sauvegarde les trois fichiers, applique le patch, vérifie que les
# anciennes RPC tarifs ont disparu de l'éditeur, puis s'arrête sans commit/push.

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path


class PatchError(RuntimeError):
    pass


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise PatchError(f"{label}: attendu 1 bloc exact, trouvé {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise PatchError(f"{label}: bloc introuvable ou ambigu ({count})")
    return updated


def backup(path: Path) -> Path:
    dst = path.with_suffix(path.suffix + ".bak-driver-session")
    shutil.copy2(path, dst)
    return dst


def patch_pin(text: str) -> str:
    old_write = """function writeSession(phone,sl,token){
  const now=Date.now();
  const sess=JSON.stringify({slug:sl,phone,module:MODULE,validated_at:now,expires_at:now+MAX_AGE,session_token:token||"",access:true,access_ok:true});
  SKEYS.forEach(k=>{ls(k,sess);ss(k,sess)});
  PKEYS.forEach(k=>{ls(k,phone);ss(k,phone)});
  if(sl){
    SLKEYS.forEach(k=>ls(k,sl));
    try{const m=JSON.parse(ls("digiy_module_slugs")||"{}")||{};m[MODULE]=sl;ls("digiy_module_slugs",JSON.stringify(m))}catch(_){}
    ls("digiy_slug",sl);
  }
}"""

    new_write = """function writeSession(phone,sl,token,expiresAt){
  const now=Date.now();
  const parsedExpires=Date.parse(String(expiresAt||""));
  const finalExpires=Number.isFinite(parsedExpires)&&parsedExpires>now
    ? parsedExpires
    : now+MAX_AGE;
  const sess=JSON.stringify({
    slug:sl,
    phone,
    module:MODULE,
    validated_at:now,
    verified_at:now,
    expires_at:finalExpires,
    session_token:String(token||"").trim(),
    access:true,
    access_ok:true,
    pin_session_ok:true
  });
  SKEYS.forEach(k=>{ls(k,sess);ss(k,sess)});
  PKEYS.forEach(k=>{ls(k,phone);ss(k,phone)});
  if(sl){
    SLKEYS.forEach(k=>ls(k,sl));
    try{const m=JSON.parse(ls("digiy_module_slugs")||"{}")||{};m[MODULE]=sl;ls("digiy_module_slugs",JSON.stringify(m))}catch(_){}
    ls("digiy_slug",sl);
  }
}"""
    text = replace_once(text, old_write, new_write, "pin.html/writeSession")

    old_redirect = """function redirect(sl){
  try{const u=new URL(INDEX_URL,location.href);if(sl)u.searchParams.set("slug",sl);u.searchParams.delete("phone");location.replace(u.toString())}
  catch(_){location.replace(INDEX_URL)}
}"""
    new_redirect = """function redirect(sl){
  try{
    const u=new URL(INDEX_URL,location.href);
    if(sl&&!/\\d{7,}/.test(String(sl)))u.searchParams.set("slug",sl);
    else u.searchParams.delete("slug");
    u.searchParams.delete("phone");
    u.searchParams.delete("tel");
    location.replace(u.toString());
  }catch(_){
    location.replace(INDEX_URL);
  }
}"""
    text = replace_once(text, old_redirect, new_redirect, "pin.html/redirect")

    new_login = """async function doLogin(){
  if(pin.length!==4)return;
  $("btnEnter").disabled=true;
  showSt("status2","⏳ Vérification sécurisée…","spin");

  try{
    const sb=getSb();
    const{data,error}=await sb.rpc("driver_issue_session",{
      p_phone:confirmedPhone,
      p_pin:pin,
      p_user_agent:navigator.userAgent||""
    });

    if(error)throw new Error(error.message||"Erreur serveur");

    const row=Array.isArray(data)?data[0]:data;
    if(!row?.ok){
      pin="";
      updateDots();
      updateEnterBtn();
      $("btnEnter").disabled=false;
      for(let i=0;i<4;i++)$("d"+i).classList.add("err");
      shake($("pinDots"));

      const reason=String(row?.error||"");
      const msg=reason==="driver_access_inactive"
        ? "❌ Abonnement DRIVER inactif.\\nContacte DIGIY pour réactiver ton accès."
        : "❌ Code incorrect.\\nVérifie tes 4 chiffres et réessaie.";
      showSt("status2",msg,"err");
      return;
    }

    const finalSlug=String(row.slug||"").trim();
    const serverToken=String(row.token||"").trim();

    if(!finalSlug||serverToken.length<32){
      throw new Error("Session serveur DRIVER incomplète");
    }

    writeSession(
      confirmedPhone,
      finalSlug,
      serverToken,
      row.expires_at
    );

    showSt("status2","✅ Accès sécurisé ouvert. Redirection…","ok");
    setTimeout(()=>redirect(finalSlug),700);
  }catch(err){
    pin="";
    updateDots();
    updateEnterBtn();
    $("btnEnter").disabled=false;
    showSt("status2","❌ Erreur : "+(err?.message||"inattendue."),"err");
  }
}"""

    pattern = r'async function doLogin\(\)\s*\{.*?\n\}\n\}\)\(\);\s*</script>'
    replacement = new_login + '\n})();\n</script>'
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise PatchError(f"pin.html/doLogin: bloc final introuvable ou ambigu ({count})")

    return text


def patch_guard(text: str) -> str:
    text = replace_once(
        text,
        '''      const owner_id = parsed.owner_id || null;

      const access =''',
        '''      const owner_id = parsed.owner_id || null;
      const session_token = String(parsed.session_token || parsed.token || "").trim();

      const access =''',
        "guard.js/readStoredSession token",
    )
    text = replace_once(
        text,
        '''        phone,
        owner_id,
        module: MODULE,''',
        '''        phone,
        owner_id,
        session_token,
        module: MODULE,''',
        "guard.js/readStoredSession return",
    )
    text = replace_once(
        text,
        '''      owner_id: payload.owner_id || state.owner_id || null,
      module: MODULE,''',
        '''      owner_id: payload.owner_id || state.owner_id || null,
      session_token: String(payload.session_token || state.session_token || "").trim(),
      module: MODULE,''',
        "guard.js/saveSession token",
    )
    text = replace_once(
        text,
        '''    owner_id: stored?.owner_id || null,

    access: false,''',
        '''    owner_id: stored?.owner_id || null,
    session_token: stored?.session_token || "",

    access: false,''',
        "guard.js/state token",
    )

    new_login = '''  async function loginWithPin(identifierOrSlug, pin, explicitPhone) {
    const rawIdentifier = String(identifierOrSlug || "").trim();
    const p = normPin(pin);

    if (!p) return { ok: false, error: "PIN manquant." };

    let slug = "";
    let phone = normPhone(explicitPhone || state.phone || readSavedPhone() || "");

    const maybePhone = normPhone(rawIdentifier);
    const maybeSlug = normSlug(rawIdentifier);

    if (maybePhone && maybePhone.length >= 8) phone = maybePhone;
    else if (maybeSlug) slug = maybeSlug;

    if (!slug) slug = normSlug(state.slug || readSavedSlug() || "");
    if (!phone) phone = normPhone(state.phone || readSavedPhone() || "");

    if (!phone && slug) {
      const sub = await resolveSubBySlug(slug);
      phone = normPhone(sub?.phone || "");
    }

    if (!phone) return { ok: false, error: "Compte chauffeur non reconnu." };

    const issued = await rpc("driver_issue_session", {
      p_phone: phone,
      p_pin: p,
      p_user_agent: navigator.userAgent || ""
    });

    const auth = Array.isArray(issued?.data) ? issued.data[0] : issued?.data;
    if (!issued?.ok || !auth?.ok || !auth?.token || !auth?.slug) {
      const reason = String(auth?.error || "");
      return {
        ok: false,
        error: reason === "driver_access_inactive"
          ? "Abonnement DRIVER inactif."
          : "PIN invalide."
      };
    }

    const saved = saveSession({
      slug: normSlug(auth.slug),
      phone,
      access: true,
      session_token: auth.token,
      expires_at: auth.expires_at,
      verified_at: nowMs(),
      validated_at: nowIso()
    });

    state.slug = saved.slug;
    state.phone = saved.phone;
    state.owner_id = saved.owner_id;
    state.session_token = saved.session_token;
    state.access = true;
    state.access_ok = true;
    state.pin_session_ok = true;
    state.preview = false;
    state.ready_flag = true;
    state.error = null;
    state.verified_at = saved.verified_at;
    state.expires_at = saved.expires_at;
    state.validated_at = saved.validated_at;
    state.pin_url = buildPinUrl(saved);
    state.pay_url = buildPayUrl(saved);

    ensureUrlIdentity(saved.slug);
    showPage();

    return {
      ok: true,
      slug: saved.slug,
      phone: saved.phone,
      session_token: saved.session_token
    };
  }

'''
    text = regex_once(
        text,
        r'  async function loginWithPin\(identifierOrSlug, pin, explicitPhone\) \{.*?\n  \}\n\n  function logout\(\) \{',
        new_login + '  function logout() {',
        "guard.js/loginWithPin",
    )
    text = replace_once(
        text,
        '''  function logout() {
    clearAllLocalState();

    state.slug = "";''',
        '''  function logout() {
    const token = String(state.session_token || "").trim();
    if (token) {
      rpc("driver_revoke_session", { p_token: token }).catch(() => {});
    }

    clearAllLocalState();

    state.slug = "";''',
        "guard.js/logout revoke",
    )
    text = replace_once(
        text,
        '''    state.owner_id = null;
    state.access = false;''',
        '''    state.owner_id = null;
    state.session_token = "";
    state.access = false;''',
        "guard.js/logout token clear",
    )
    text = replace_once(
        text,
        '''    let owner_id = storedSession?.owner_id || state.owner_id || null;

    let verifiedAt =''',
        '''    let owner_id = storedSession?.owner_id || state.owner_id || null;
    let sessionToken = String(storedSession?.session_token || state.session_token || "").trim();

    let verifiedAt =''',
        "guard.js/check token variable",
    )
    text = replace_once(
        text,
        '''    state.owner_id = owner_id;
    state.verified_at = verifiedAt;''',
        '''    state.owner_id = owner_id;
    state.session_token = sessionToken;
    state.verified_at = verifiedAt;''',
        "guard.js/check state token",
    )
    text = replace_once(
        text,
        '''        owner_id,
        access: true,
        verified_at: verifiedAt || nowMs(),''',
        '''        owner_id,
        session_token: sessionToken,
        access: true,
        verified_at: verifiedAt || nowMs(),''',
        "guard.js/check save token",
    )
    text = replace_once(
        text,
        '''      state.owner_id = saved.owner_id;
      state.verified_at = saved.verified_at;''',
        '''      state.owner_id = saved.owner_id;
      state.session_token = saved.session_token;
      state.verified_at = saved.verified_at;''',
        "guard.js/check saved token",
    )
    return text


def patch_profile(text: str) -> str:
    text = replace_once(text, '<h2>Trajets habituels</h2>', '<h2>Mes tarifs directs</h2>', "profil/titre")
    text = replace_once(
        text,
        '<div class="muted">Tarif indicatif (FCFA)</div>',
        '<div class="muted">Mon tarif direct (FCFA)</div>',
        "profil/libellé",
    )

    helpers = '''
      const DRIVER_SESSION_KEYS = [
        "digiy_driver_session",
        "digiy_guard_driver_session",
        "digiy_guard_session",
        "DIGIY_DRIVER_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_DRIVER"
      ];

      function readDriverSessionToken(){
        for(const key of DRIVER_SESSION_KEYS){
          for(const store of [sessionStorage, localStorage]){
            try{
              const raw=store.getItem(key);
              if(!raw) continue;
              const parsed=JSON.parse(raw);
              const moduleName=String(parsed?.module||"DRIVER").toUpperCase();
              const expires=Number(parsed?.expires_at||0);
              const token=String(parsed?.session_token||parsed?.token||"").trim();
              if(moduleName!=="DRIVER") continue;
              if(expires&&Date.now()>=expires) continue;
              if(token.length>=32) return token;
            }catch(_){}
          }
        }
        return "";
      }

      function driverSessionToken(){
        return String(
          LAST_GUARD_STATE?.session_token ||
          window.DIGIY_GUARD?.state?.session_token ||
          readDriverSessionToken() ||
          ""
        ).trim();
      }

      function rateSessionError(code){
        return String(code||"")==="invalid_or_expired_session"
          ? "❌ Session serveur expirée. Repasse par la porte PIN."
          : "❌ Opération tarifs refusée.";
      }
'''
    text = replace_once(
        text,
        '''      let RATES_RPC_READY = true;
      let LAST_GUARD_STATE = null;
''',
        '''      let RATES_RPC_READY = true;
      let LAST_GUARD_STATE = null;
''' + helpers,
        "profil/helpers token",
    )
    text = replace_once(
        text,
        '''      function renderRates(rows){
        const localRoutes = driverReadPublicRoutes();
        const data = (Array.isArray(rows) ? rows : []).concat(localRoutes);
''',
        '''      function renderRates(rows){
        const data = Array.isArray(rows) ? rows : [];
''',
        "profil/vérité serveur",
    )
    text = replace_once(
        text,
        '''              const { data, error } = await sb.rpc("driver_disable_rate_by_slug", {
                p_slug: slug,
                p_rate_id: id
              });''',
        '''              const token=driverSessionToken();
              if(!token){
                setMsgRates("❌ Session serveur absente. Repasse par la porte PIN.", "bad");
                return;
              }

              const { data, error } = await sb.rpc("driver_session_disable_rate", {
                p_token: token,
                p_rate_id: id
              });''',
        "profil/disable",
    )
    text = replace_once(
        text,
        '''              if (data && data.ok === false) throw new Error(data.error || "disable_rate_error");''',
        '''              if (data && data.ok === false){
                setMsgRates(rateSessionError(data.error), "bad");
                return;
              }''',
        "profil/disable réponse",
    )

    old_load = '''        try{
          const { data, error } = await sb.rpc("driver_list_rates_by_slug", { p_slug: slug });

          if (error){
            if (isRpcMissing(error)){
              RATES_RPC_READY = false;
              renderRates([]);
              setMsgRates("✅ Mémoire locale des trajets habituels active.", "ok");
              return;
            }
            throw error;
          }

          RATES_RPC_READY = true;
          renderRates(data || []);
          setMsgRates("✅ Trajets habituels synchronisés.", "ok");
        }catch(e){'''
    new_load = '''        try{
          const token=driverSessionToken();
          if(!token){
            RATES_RPC_READY = true;
            renderRates([]);
            setMsgRates("❌ Session serveur absente. Repasse par la porte PIN.", "bad");
            return;
          }

          const { data, error } = await sb.rpc("driver_session_list_rates", {
            p_token: token
          });

          if (error){
            if (isRpcMissing(error)){
              RATES_RPC_READY = false;
              renderRates([]);
              setMsgRates("❌ Fonction sécurisée des tarifs indisponible.", "bad");
              return;
            }
            throw error;
          }

          if(data?.ok===false){
            renderRates([]);
            setMsgRates(rateSessionError(data.error), "bad");
            return;
          }

          RATES_RPC_READY = true;
          renderRates(Array.isArray(data?.rates) ? data.rates : []);
          setMsgRates("✅ Tarifs directs synchronisés avec Supabase.", "ok");
        }catch(e){'''
    text = replace_once(text, old_load, new_load, "profil/load")

    text = replace_once(
        text,
        '''          const { data, error } = await sb.rpc("driver_upsert_rate_by_slug", {
            p_slug: slug,
            p_route_label: routeLabel,
            p_price_fcfa: priceFcfa
          });''',
        '''          const token=driverSessionToken();
          if(!token){
            setMsgRates("❌ Session serveur absente. Repasse par la porte PIN.", "bad");
            return;
          }

          const { data, error } = await sb.rpc("driver_session_upsert_rate", {
            p_token: token,
            p_route_label: routeLabel,
            p_price_fcfa: priceFcfa
          });''',
        "profil/upsert",
    )
    text = replace_once(
        text,
        '''          if (data && data.ok === false) throw new Error(data.error || "save_rate_error");''',
        '''          if (data && data.ok === false){
            setMsgRates(rateSessionError(data.error || "save_rate_error"), "bad");
            return;
          }''',
        "profil/upsert réponse",
    )
    text = replace_once(
        text,
        '''              setMsgRates("⚠️ Fonction trajets habituels non branchée en base. Mémoire locale DRIVER utilisée.", "warn");''',
        '''              setMsgRates("❌ Fonction sécurisée des tarifs non branchée en base.", "bad");''',
        "profil/fallback",
    )
    text = regex_once(
        text,
        r'\n<script>\n/\* ══ DIGIY DRIVER — sécurité mémoire trajets proposés publics ══ \*/.*?</script>\n',
        '\n<!-- Les tarifs officiels sont désormais servis uniquement par Supabase via une session DRIVER valide. -->\n',
        "profil/suppression miroir local",
    )
    return text


def validate(pin: str, guard: str, profile: str) -> None:
    checks = {
        "pin driver_issue_session": 'sb.rpc("driver_issue_session"' in pin,
        "pin sans digiy_verify_pin": 'sb.rpc("digiy_verify_pin"' not in pin,
        "guard conserve token": "session_token" in guard,
        "guard révoque token": 'rpc("driver_revoke_session"' in guard,
        "liste sécurisée": 'sb.rpc("driver_session_list_rates"' in profile,
        "écriture sécurisée": 'sb.rpc("driver_session_upsert_rate"' in profile,
        "désactivation sécurisée": 'sb.rpc("driver_session_disable_rate"' in profile,
        "ancienne liste absente": 'sb.rpc("driver_list_rates_by_slug"' not in profile,
        "ancien upsert absent": 'sb.rpc("driver_upsert_rate_by_slug"' not in profile,
        "ancienne désactivation absente": 'sb.rpc("driver_disable_rate_by_slug"' not in profile,
        "miroir local supprimé": "sécurité mémoire trajets proposés publics" not in profile,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise PatchError("Validation finale échouée : " + "; ".join(failed))


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 apply_driver_session_patch_v2.py /chemin/vers/digiy-pro-driver")
        return 2

    root = Path(sys.argv[1]).expanduser().resolve()
    paths = {
        "pin": root / "pin.html",
        "guard": root / "guard.js",
        "profile": root / "profile-edition.html",
    }
    missing = [str(p) for p in paths.values() if not p.is_file()]
    if missing:
        raise PatchError("Fichier(s) absent(s) : " + ", ".join(missing))

    original = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}
    patched = {
        "pin": patch_pin(original["pin"]),
        "guard": patch_guard(original["guard"]),
        "profile": patch_profile(original["profile"]),
    }
    validate(patched["pin"], patched["guard"], patched["profile"])

    backups = [backup(path) for path in paths.values()]
    for name, path in paths.items():
        path.write_text(patched[name], encoding="utf-8")

    print("PATCH APPLIQUÉ — aucun commit, aucun push.")
    print("Fichiers modifiés :")
    for path in paths.values():
        print(f"  - {path}")
    print("Sauvegardes :")
    for path in backups:
        print(f"  - {path}")
    print("Étape suivante : tester connexion, ajout, liste, désactivation et déconnexion.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PatchError as exc:
        print(f"ERREUR PATCH : {exc}", file=sys.stderr)
        raise SystemExit(1)
