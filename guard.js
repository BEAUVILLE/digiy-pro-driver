/* =========================================
   DIGIY PRO DRIVER — guard.js (FINAL+)
   - GitHub Pages friendly
   - Login phone via session/localStorage
   - Check abonnement via RPC: is_driver_active(p_phone text) -> boolean
   - Redirect paiement si inactif
   - Cache léger
   - Alias guardOrPay() pour compatibilité avec index.html
========================================= */
(function(){
  'use strict';

  // ✅ Paiement (repo séparé)
  const PAY_URL = "https://beauville.github.io/commencer-a-payer/";

  // ✅ Supabase
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // ✅ Client global unique
  const sb = (window.__sb)
    ? window.__sb
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.__sb = sb;

  // =========================
  // UI (optionnel)
  // =========================
  function setStatus(txt){
    const el = document.getElementById("guard_status");
    if (el) el.textContent = txt;
  }

  // =========================
  // Utils
  // =========================
  function normPhone(p){
    p = String(p||"").trim();
    // retire espaces et caractères inutiles (garde chiffres et +)
    p = p.replace(/\s+/g,"").replace(/[^\d+]/g,"");

    // convertit 00221xxxxxxxxx -> +221xxxxxxxxx
    if (p.startsWith("00221")) p = "+221" + p.slice(5);

    // si commence par 221 sans + -> ajoute +
    if (!p.startsWith("+") && p.startsWith("221")) p = "+" + p;

    // si 9 chiffres (format local) -> +221
    if (!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;

    return p;
  }

  function getPhone(){
    // 1) session
    const s = sessionStorage.getItem("digiy_driver_phone");
    if (s) return normPhone(s);

    // 2) local storage (pin object)
    try{
      const a = JSON.parse(localStorage.getItem("digiy_driver_access_pin")||"null");
      if (a && a.phone) return normPhone(a.phone);
    }catch(_){}

    // 3) fallback générique si tu l’utilises ailleurs
    const g = localStorage.getItem("digiy_phone") || localStorage.getItem("phone");
    if (g) return normPhone(g);

    return null;
  }

  function cacheKey(phone){
    return "digiy_driver_active_cache__" + normPhone(phone || "");
  }

  function getCache(phone){
    try{
      const raw = localStorage.getItem(cacheKey(phone));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== "object") return null;
      if(!obj.ts || (Date.now() - obj.ts) > 60 * 1000) return null; // 60s cache
      return obj.ok;
    }catch(_){
      return null;
    }
  }

  function setCache(phone, ok){
    try{
      localStorage.setItem(cacheKey(phone), JSON.stringify({ ok: !!ok, ts: Date.now() }));
    }catch(_){}
  }

  async function isDriverActive(phone){
    try{
      const { data, error } = await sb.rpc('is_driver_active', { p_phone: phone });
      if (error) throw error;
      return !!data;
    }catch(e){
      // ⚠️ si Supabase a un souci, on ne bloque pas “à tort”
      console.warn("[DIGIY] is_driver_active error:", e);
      return null; // inconnu
    }
  }

  function redirectToPay(phone, fromUrl){
    const u = PAY_URL
      + "?phone=" + encodeURIComponent(phone || "")
      + "&from="  + encodeURIComponent(fromUrl || location.href)
      + "&module=" + encodeURIComponent("DRIVER_PRO");
    location.replace(u);
  }

  // =========================
  // API publique
  // =========================
  window.DIGIY = window.DIGIY || {};
  window.DIGIY.getPhone = getPhone;

  /**
   * return boolean:
   * - true  => accès OK
   * - false => redirection paiement effectuée
   * - true  => si phone vide (la page gère login)
   */
  window.DIGIY.guardSubscriptionOrRedirect = async function(phone, fromUrl){
    phone = normPhone(phone || getPhone() || "");

    if(!phone){
      setStatus("📵 Téléphone manquant — connexion requise");
      return true; // laisse la page gérer le login
    }

    setStatus("🔐 Vérification abonnement...");

    // cache 60s pour éviter de spam RPC
    const cached = getCache(phone);
    if (cached !== null){
      if (cached){
        setStatus("✅ Abonnement actif");
        return true;
      }else{
        setStatus("⛔ Abonnement inactif — paiement requis");
        redirectToPay(phone, fromUrl || location.href);
        return false;
      }
    }

    const ok = await isDriverActive(phone);

    if (ok === null){
      // Supabase down => ne bloque pas (safe)
      setStatus("⚠️ Vérification indisponible — accès autorisé");
      return true;
    }

    setCache(phone, ok);

    if (!ok){
      setStatus("⛔ Abonnement inactif — paiement requis");
      redirectToPay(phone, fromUrl || location.href);
      return false;
    }

    setStatus("✅ Abonnement actif");
    return true;
  };

  /**
   * ✅ Alias attendu par ta page actuelle:
   * window.DIGIY.guardOrPay("DRIVER_PRO", "/digiy-driver/authentification-chauffeur.html")
   *
   * - moduleCode est gardé pour compat, mais on s’en sert surtout pour mettre &module=
   * - loginUrl = où envoyer si pas de phone (ou si tu veux gérer login)
   */
  window.DIGIY.guardOrPay = async function(moduleCode, loginUrl){
    const phone = getPhone();

    // si pas de phone -> on redirige vers loginUrl (comme tu veux)
    if(!phone){
      setStatus("📵 Connexion requise");
      if (loginUrl) location.href = loginUrl;
      return false;
    }

    // sinon vérif abonnement (redirige PAY si inactif)
    return await window.DIGIY.guardSubscriptionOrRedirect(phone, loginUrl || location.href);
  };

})();
