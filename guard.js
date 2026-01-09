/* =========================================
   DIGIY PRO DRIVER — guard.js (ONE ENTRY)
   - Une seule porte d'entrée : INSCRIPTION
   - Si pas actif -> inscription (où tarifs sont visibles)
   - Check abonnement via RPC is_driver_active(p_phone text) -> boolean
========================================= */
(function(){
  'use strict';

  // ✅ UNIQUE PORTE D’ENTRÉE (ta page inscription, avec tarifs visibles)
  const ENTRY_URL = "https://digiylyfe.com/inscription-pro.html"; // <-- mets TON URL finale ici

  // ✅ Supabase
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const sb = (window.__sb)
    ? window.__sb
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.__sb = sb;

  // UI status (optionnel)
  function setStatus(txt){
    const el = document.getElementById("guard_status");
    if (el) el.textContent = txt;
  }

  function normPhone(p){
    p = String(p||"").trim();
    p = p.replace(/\s+/g,"").replace(/[^\d+]/g,"");
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

    const g = localStorage.getItem("digiy_phone") || localStorage.getItem("phone");
    if (g) return normPhone(g);

    return null;
  }

  async function isDriverActive(phone){
    try{
      const { data, error } = await sb.rpc('is_driver_active', { p_phone: phone });
      if (error) throw error;
      return !!data;
    }catch(e){
      // Si RPC down: on n'empêche pas (safe)
      console.warn("[DIGIY] is_driver_active error:", e);
      return null;
    }
  }

  function goEntry(reason, moduleCode, phone){
    const u = new URL(ENTRY_URL);
    u.searchParams.set("module", String(moduleCode||"DRIVER_PRO"));
    if (reason) u.searchParams.set("reason", reason); // missing_phone / not_active
    if (phone) u.searchParams.set("phone", phone);
    u.searchParams.set("from", location.href);
    location.replace(u.toString());
  }

  // API
  window.DIGIY = window.DIGIY || {};
  window.DIGIY.getPhone = getPhone;

  // ✅ Fonction attendue par ta page
  window.DIGIY.guardOrPay = async function(moduleCode){
    const module = String(moduleCode || "DRIVER_PRO").toUpperCase();
    const phone = getPhone();

    setStatus("🔐 Vérification...");

    // 1) Pas identifié -> entrée unique
    if(!phone){
      setStatus("📝 Inscription requise");
      goEntry("missing_phone", module, "");
      return false;
    }

    // 2) Identifié -> check actif
    const ok = await isDriverActive(phone);

    if (ok === null){
      // RPC down => laisse passer (safe)
      setStatus("⚠️ Vérification indisponible — accès autorisé");
      window.DIGIY_ACCESS = { ok:true, phone, module, note:"rpc_down" };
      document.documentElement.classList.add("access-ok");
      return true;
    }

    if(!ok){
      setStatus("⛔ Paiement requis");
      goEntry("not_active", module, phone);
      return false;
    }

    // 3) OK
    setStatus("✅ Accès autorisé");
    window.DIGIY_ACCESS = { ok:true, phone, module };
    document.documentElement.classList.add("access-ok");
    return true;
  };

})();
