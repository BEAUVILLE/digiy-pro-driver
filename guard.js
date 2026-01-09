/* =========================================
   DIGIY — guard.js (UNIVERSEL)
   - Vérifie l'accès via RPC (is_module_active)
   - Si inactif => redirige vers INSCRIPTION (porte unique)
   - Si actif => accès OK
   - Pas de boucle: après paiement/activation, on renvoie vers ESPACE PRO
========================================= */
(function(){
  "use strict";

  // === URLs (tes portes) ===
  const INSCRIPTION_URL = "https://beauville.github.io/inscription-digiy/";
  const ESPACE_PRO_URL  = "https://beauville.github.io/espace-pro/";

  // === Supabase ===
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const sb = (window.__sb)
    ? window.__sb
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.__sb = sb;

  // === Utils ===
  function normPhone(p){
    p = String(p||"").trim().replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if (p.startsWith("00221")) p = "+221" + p.slice(5);
    if (!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if (!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  function getPhone(){
    // 1) session (prioritaire)
    const s = sessionStorage.getItem("digiy_phone");
    if (s) return normPhone(s);

    // 2) legacy driver
    const d = sessionStorage.getItem("digiy_driver_phone");
    if (d) return normPhone(d);

    // 3) local legacy
    try{
      const a = JSON.parse(localStorage.getItem("digiy_driver_access_pin")||"null");
      if (a && a.phone) return normPhone(a.phone);
    }catch(_){}

    return null;
  }

  async function isActiveByPlan(phone, planCode){
    const { data, error } = await sb.rpc("is_module_active", {
      p_phone: phone,
      p_plan_code: planCode
    });
    if (error) throw error;
    return !!data;
  }

  function redirectInscription(planCode, fromUrl){
    const u = INSCRIPTION_URL
      + "?module=" + encodeURIComponent(planCode || "")
      + "&from=" + encodeURIComponent(fromUrl || location.href)
      + "&next=" + encodeURIComponent(ESPACE_PRO_URL);
    location.replace(u);
  }

  // === API publique ===
  window.DIGIY = window.DIGIY || {};

  // guardOrPay(planCode, fallbackLoginUrl?)
  // - true => accès OK
  // - false => redirection faite
  window.DIGIY.guardOrPay = async function(planCode, fallbackLoginUrl){
    const phone = normPhone(getPhone() || "");

    // Si pas de phone => on envoie vers page "login" si fournie, sinon inscription
    if (!phone){
      if (fallbackLoginUrl) {
        location.replace(fallbackLoginUrl);
        return false;
      }
      redirectInscription(planCode, location.href);
      return false;
    }

    // stocke phone propre (évite les surprises)
    sessionStorage.setItem("digiy_phone", phone);

    try{
      const ok = await isActiveByPlan(phone, planCode);

      if (!ok){
        redirectInscription(planCode, location.href);
        return false;
      }

      // Accès OK
      window.DIGIY_ACCESS = { phone, planCode, ok:true };
      document.documentElement.classList.add("access-ok");
      return true;

    }catch(e){
      console.warn("[DIGIY] guard rpc error:", e);
      // En cas d’erreur Supabase, on ne bloque pas (anti faux négatif)
      window.DIGIY_ACCESS = { phone, planCode, ok:true, degraded:true };
      document.documentElement.classList.add("access-ok");
      return true;
    }
  };
})();
