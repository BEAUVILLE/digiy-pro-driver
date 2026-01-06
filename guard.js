/* =========================================================
   DIGIY DRIVER PRO — GUARD ABONNEMENT + REDIRECTION (BÉTON)
   - Supabase init
   - LocalStorage phone
   - RPC: is_driver_active(p_phone) -> boolean
   - Si false -> redirect PAY_URL?phone=...&from=...
   - Gère PAY_URL avec ou sans slash
   - Conserve hash (#...) dans le from
========================================================= */

(function () {
  "use strict";

  // ✅ URL paiement (mets ton vrai endpoint)
  // Ex: "https://beauville.github.io/commencer-a-payer/"
  // ou "https://pay.digiylyfe.com/driver"
  const PAY_URL = "https://beauville.github.io/commencer-a-payer/";

  // ✅ Storage
  const LS_PHONE_KEY = "digiy_driver_phone";

  // ✅ Supabase (comme tu veux : prêt)
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const DIGIY = (window.DIGIY = window.DIGIY || {});
  DIGIY.PAY_URL = PAY_URL;
  DIGIY.LS_PHONE_KEY = LS_PHONE_KEY;

  function normalizePhone(input) {
    let p = String(input || "").trim();
    p = p.replace(/\s+/g, "").replace(/-/g, "");
    if (/^\d{9}$/.test(p)) p = "+221" + p;
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

  function ensureSupabase() {
    if (DIGIY.supabase) return DIGIY.supabase;

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase JS SDK non chargé. Ajoute le CDN supabase-js@2.");
    }

    DIGIY.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "digiy-driver-pro" } },
    });

    return DIGIY.supabase;
  }

  // ✅ Helper: construit une URL avec query params (sans bug ? & #)
  function buildUrlWithParams(base, params) {
    const b = String(base || "").trim();
    if (!b) throw new Error("PAY_URL vide");

    // Si base a déjà un "?" ou un "#", on s'appuie sur URL() si possible
    // Sinon on fait simple.
    let u;
    try {
      u = new URL(b, location.origin);
    } catch (e) {
      // fallback (rare)
      const sep = b.includes("?") ? "&" : "?";
      const q = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ""))}`)
        .join("&");
      return b + sep + q;
    }

    Object.entries(params).forEach(([k, v]) => {
      u.searchParams.set(k, String(v ?? ""));
    });

    return u.toString();
  }

  // ✅ Redirection paiement avec retour (BÉTON)
  function redirectToPay(phone) {
    const p = normalizePhone(phone || getPhone());

    // On garde TOUT : path + query + hash
    const from = location.origin + location.pathname + location.search + location.hash;

    const target = buildUrlWithParams(PAY_URL, {
      phone: p || "",
      from: from, // ⚠️ on laisse URLSearchParams encoder proprement
    });

    location.replace(target);
  }

  // ✅ Guard abonnement
  async function guardSubscriptionOrRedirect(phone) {
    const sb = ensureSupabase();
    const p = normalizePhone(phone || getPhone());

    if (!p) {
      location.replace("./authentification-chauffeur.html");
      return false;
    }

    try {
      const { data, error } = await sb.rpc("is_driver_active", { p_phone: p });
      if (error) throw error;

      if (data !== true) {
        redirectToPay(p);
        return false;
      }

      setPhone(p);
      return true;
    } catch (e) {
      console.warn("guardSubscriptionOrRedirect error:", e);
      alert("DIGIY: service temporairement indisponible. Réessaie.");
      return false;
    }
  }

  // ✅ Boot helper pour pages PRO
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

  // expose
  DIGIY.getPhone = getPhone;
  DIGIY.setPhone = setPhone;
  DIGIY.clearPhone = clearPhone;
  DIGIY.redirectToPay = redirectToPay;
  DIGIY.guardSubscriptionOrRedirect = guardSubscriptionOrRedirect;
  DIGIY.bootProPage = bootProPage;
})();

