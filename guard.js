/* =========================================================
   DIGIY DRIVER PRO — GUARD ABONNEMENT + REDIRECTION
   - Supabase init
   - Lecture phone (localStorage)
   - RPC is_driver_active(p_phone) -> boolean
   - Si false -> redirect PAY_URL?phone=...&from=...
========================================================= */

(function () {
  "use strict";

  // ✅ Mets ici ton lien de paiement (GitHub Pages ou domaine)
  const PAY_URL = "https://beauville.github.io/commencer-a-payer/";

  // ✅ Clé storage unique (évite collisions)
  const LS_PHONE_KEY = "digiy_driver_phone";

  // ✅ Supabase (intégré comme tu veux : prêt à l’emploi)
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // Expose en global pour tes pages
  const DIGIY = (window.DIGIY = window.DIGIY || {});
  DIGIY.PAY_URL = PAY_URL;
  DIGIY.LS_PHONE_KEY = LS_PHONE_KEY;

  function qs(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    // mini feedback (sans bling-bling)
    console.log("DIGIY:", msg);
  }

  function normalizePhone(input) {
    let p = String(input || "").trim();
    // supprime espaces et tirets
    p = p.replace(/\s+/g, "").replace(/-/g, "");
    // si juste 9 chiffres, on ajoute +221 (Sénégal)
    if (/^\d{9}$/.test(p)) p = "+221" + p;
    // si commence par 221 sans +, on corrige
    if (/^221\d{9}$/.test(p)) p = "+" + p;
    return p;
  }

  function getPhone() {
    return normalizePhone(localStorage.getItem(LS_PHONE_KEY));
  }

  function setPhone(phone) {
    localStorage.setItem(LS_PHONE_KEY, normalizePhone(phone));
  }

  function clearPhone() {
    localStorage.removeItem(LS_PHONE_KEY);
  }

  // ✅ Init Supabase (via CDN @supabase/supabase-js@2 déjà inclus dans tes pages)
  function ensureSupabase() {
    if (DIGIY.supabase) return DIGIY.supabase;

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase JS SDK non chargé. Ajoute le script CDN supabase-js@2.");
    }

    DIGIY.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "digiy-driver-pro" } },
    });

    return DIGIY.supabase;
  }

  // ✅ Redirection paiement avec retour
  function redirectToPay(phone) {
    const from = encodeURIComponent(location.href);
    const url =
      PAY_URL +
      "?phone=" +
      encodeURIComponent(phone || "") +
      "&from=" +
      from;

    location.replace(url);
  }

  // ✅ Guard abonnement
  async function guardSubscriptionOrRedirect(phone) {
    const sb = ensureSupabase();

    const p = normalizePhone(phone || getPhone());

    // pas de phone -> retour login
    if (!p) {
      toast("Aucun téléphone, redirection vers login.");
      location.replace("./authentification-chauffeur.html");
      return false;
    }

    try {
      const { data, error } = await sb.rpc("is_driver_active", { p_phone: p });
      if (error) throw error;

      // data doit être true pour passer
      if (data !== true) {
        toast("Abonnement inactif/past_due -> redirection paiement.");
        redirectToPay(p);
        return false;
      }

      // ok, on garde le phone propre
      setPhone(p);
      return true;
    } catch (e) {
      console.warn("guardSubscriptionOrRedirect error:", e);
      alert("DIGIY: service temporairement indisponible. Réessaie.");
      return false;
    }
  }

  // ✅ Helper à appeler en 1 ligne sur chaque page PRO
  async function bootProPage(options) {
    options = options || {};
    const requireSub = options.requireSubscription !== false; // default true
    const phone = options.phone || getPhone();

    if (requireSub) {
      const ok = await guardSubscriptionOrRedirect(phone);
      if (!ok) return false;
    }
    return true;
  }

  // Expose API
  DIGIY.getPhone = getPhone;
  DIGIY.setPhone = setPhone;
  DIGIY.clearPhone = clearPhone;
  DIGIY.guardSubscriptionOrRedirect = guardSubscriptionOrRedirect;
  DIGIY.bootProPage = bootProPage;
})();
