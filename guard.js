/* =========================================
   DIGIY PRO DRIVER — guard.js (FINAL)
   - GitHub Pages friendly
   - Login phone via session/localStorage
   - Check abonnement via RPC is_driver_active(p_phone text) -> boolean
   - Redirect paiement si inactif (past_due / etc.)
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
  const supabase = (window.__sb)
    ? window.__sb
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.__sb = supabase;

  // ✅ Utils
  function normPhone(p){
    p = String(p||"").trim().replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if(p.startsWith("00221")) p = "+221" + p.slice(5);
    if(!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if(!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  function getPhone(){
    const s = sessionStorage.getItem("digiy_driver_phone");
    if (s) return normPhone(s);

    try{
      const a = JSON.parse(localStorage.getItem("digiy_driver_access_pin")||"null");
      if (a && a.phone) return normPhone(a.phone);
    }catch(_){}

    return null;
  }

  async function isDriverActive(phone){
    try{
      const { data, error } = await supabase.rpc('is_driver_active', { p_phone: phone });
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
      + "&from="  + encodeURIComponent(fromUrl || location.href);
    location.replace(u);
  }

  // ✅ API publique
  window.DIGIY = window.DIGIY || {};

  window.DIGIY.getPhone = getPhone;

  // return boolean:
  // - true  => accès OK
  // - false => redirection paiement effectuée
  window.DIGIY.guardSubscriptionOrRedirect = async function(phone, fromUrl){
    phone = normPhone(phone || getPhone() || "");
    if(!phone) return true; // laisse la page gérer login

    const ok = await isDriverActive(phone);

    if (ok === null){
      // Supabase down => ne bloque pas
      return true;
    }

    if (!ok){
      redirectToPay(phone, fromUrl || location.href);
      return false;
    }

    return true;
  };

})();

