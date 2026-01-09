/* =========================================
   DIGIY PRO DRIVER — guard.js (NO LOOP)
   - Porte unique: INSCRIPTION DIGIY
   - Évite la boucle:
       * inconnu + pas de phone => inscription
       * connu mais pas actif => écran "Activation en cours"
       * actif => accès
   - Check abonnement via RPC: is_driver_active(p_phone text) -> boolean
   - GitHub Pages friendly
========================================= */
(function(){
  'use strict';

  // ✅ UNIQUE PORTE D’ENTRÉE
  const ENTRY_URL   = "https://beauville.github.io/inscription-digiy/";

  // ✅ Page "Activation en cours" (créée dynamiquement si absente)
  const PENDING_URL = "./pending.html";

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
  // UI status (optionnel)
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
    p = p.replace(/\s+/g,"").replace(/[^\d+]/g,"");
    if(p.startsWith("00221")) p = "+221" + p.slice(5);
    if(!p.startsWith("+") && p.startsWith("221")) p = "+" + p;
    if(!p.startsWith("+221") && /^\d{9}$/.test(p)) p = "+221" + p;
    return p;
  }

  function getPhone(){
    // 1) session
    const s = sessionStorage.getItem("digiy_driver_phone");
    if (s) return normPhone(s);

    // 2) local storage (objet pin)
    try{
      const a = JSON.parse(localStorage.getItem("digiy_driver_access_pin")||"null");
      if (a && a.phone) return normPhone(a.phone);
    }catch(_){}

    // 3) fallback générique
    const g = localStorage.getItem("digiy_phone") || localStorage.getItem("phone");
    if (g) return normPhone(g);

    return null;
  }

  // "pro connu" => on évite de le renvoyer vers inscription (anti-boucle)
  function isKnownPro(){
    return localStorage.getItem("digiy_known_pro") === "1";
  }

  function markKnownPro(){
    try{ localStorage.setItem("digiy_known_pro","1"); }catch(_){}
  }

  // Cache léger (évite spam RPC)
  function cacheKey(phone){ return "digiy_driver_active_cache__" + normPhone(phone||""); }
  function getCache(phone){
    try{
      const raw = localStorage.getItem(cacheKey(phone));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== "object") return null;
      if(!obj.ts || (Date.now() - obj.ts) > 45 * 1000) return null; // 45s
      return !!obj.ok;
    }catch(_){ return null; }
  }
  function setCache(phone, ok){
    try{ localStorage.setItem(cacheKey(phone), JSON.stringify({ ok: !!ok, ts: Date.now() })); }catch(_){}
  }

  async function isDriverActive(phone){
    try{
      const { data, error } = await sb.rpc('is_driver_active', { p_phone: phone });
      if (error) throw error;
      return !!data;
    }catch(e){
      // si Supabase down: ne pas bloquer à tort
      console.warn("[DIGIY] is_driver_active error:", e);
      return null; // inconnu
    }
  }

  // =========================
  // Redirections (sans boucle)
  // =========================
  function goEntry(reason, moduleCode, phone){
    // marque pro connu si on a un phone (il a déjà commencé le parcours)
    if (phone) markKnownPro();

    const u = new URL(ENTRY_URL);
    u.searchParams.set("module", String(moduleCode || "DRIVER_PRO"));
    u.searchParams.set("reason", String(reason || ""));
    if (phone) u.searchParams.set("phone", phone);
    u.searchParams.set("from", location.href);
    location.replace(u.toString());
  }

  function ensurePendingPage(){
    // Si on est déjà sur pending.html, pas besoin
    if (location.pathname.endsWith("pending.html")) return;

    // On ne peut pas créer un fichier sur GitHub Pages via JS.
    // Donc: si pending.html n'existe pas, on affiche un overlay simple.
    // Mais si TU crées pending.html dans le repo, on redirigera vers lui.
  }

  function goPending(moduleCode, phone){
    // marque pro connu pour éviter retour inscription
    markKnownPro();

    // tente rediriger vers pending.html (si présent dans repo)
    const u = new URL(PENDING_URL, location.href);
    u.searchParams.set("module", String(moduleCode || "DRIVER_PRO"));
    if (phone) u.searchParams.set("phone", phone);
    u.searchParams.set("from", location.href);

    // on redirige; si 404, le navigateur affichera 404
    // donc on prévoit aussi un fallback overlay si tu préfères (voir plus bas)
    location.replace(u.toString());
  }

  function showPendingOverlay(moduleCode, phone){
    // fallback UX (zéro fichier à créer)
    document.documentElement.classList.remove("access-ok");
    setStatus("⏳ Activation en cours");

    const div = document.createElement("div");
    div.style.position="fixed";
    div.style.inset="0";
    div.style.background="rgba(0,0,0,.75)";
    div.style.display="flex";
    div.style.alignItems="center";
    div.style.justifyContent="center";
    div.style.zIndex="99999";
    div.innerHTML = `
      <div style="max-width:520px;width:92%;background:rgba(6,27,20,.98);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px 16px;font-family:system-ui;color:#eafff1">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">⏳ Activation en cours</div>
        <div style="opacity:.85;line-height:1.5;font-size:14px">
          Ton inscription est enregistrée.<br>
          Ton abonnement <b>${String(moduleCode||"DRIVER_PRO")}</b> est en cours d’activation par <b>JB BEAUVILLE</b>.
          <div style="margin-top:10px;opacity:.85">Téléphone : <b>${phone || "—"}</b></div>
        </div>
        <div style="height:1px;background:rgba(255,255,255,.12);margin:14px 0"></div>
        <a href="${ENTRY_URL}" style="display:inline-flex;justify-content:center;align-items:center;width:100%;padding:12px 14px;border-radius:14px;background:#16a34a;color:#042012;font-weight:900;text-decoration:none">
          Revenir à l’inscription (tarifs)
        </a>
      </div>
    `;
    document.body.appendChild(div);
  }

  // =========================
  // API publique
  // =========================
  window.DIGIY = window.DIGIY || {};
  window.DIGIY.getPhone = getPhone;

  /**
   * ✅ Appel standard :
   *   await window.DIGIY.guardOrPay("DRIVER_PRO")
   */
  window.DIGIY.guardOrPay = async function(moduleCode){
    const module = String(moduleCode || "DRIVER_PRO").toUpperCase();
    const phone = getPhone();

    setStatus("🔐 Vérification...");

    // 1) pas de phone
    if(!phone){
      // si pro "connu" (a déjà démarré le parcours) => pas inscription => pending
      if (isKnownPro()){
        setStatus("⏳ Activation en cours");
        // pas de phone, donc overlay (sinon pending.html avec phone vide c'est ok aussi)
        showPendingOverlay(module, "");
        return false;
      }

      // sinon: vrai nouveau -> inscription
      setStatus("📝 Inscription requise");
      goEntry("missing_phone", module, "");
      return false;
    }

    // dès qu'on a un phone, on marque "connu"
    markKnownPro();

    // cache
    const cached = getCache(phone);
    if (cached !== null){
      if (cached){
        setStatus("✅ Accès autorisé");
        window.DIGIY_ACCESS = { ok:true, phone, module, cached:true };
        document.documentElement.classList.add("access-ok");
        return true;
      }
      // not active cached -> pending
      setStatus("⏳ Activation en cours");
      // si tu n'as pas créé pending.html, on affiche overlay pour éviter 404
      showPendingOverlay(module, phone);
      return false;
    }

    // 2) check abonnement via RPC
    const ok = await isDriverActive(phone);

    if (ok === null){
      // RPC down => laisse passer (safe)
      setStatus("⚠️ Vérification indisponible — accès autorisé");
      window.DIGIY_ACCESS = { ok:true, phone, module, note:"rpc_down" };
      document.documentElement.classList.add("access-ok");
      return true;
    }

    setCache(phone, ok);

    if(!ok){
      setStatus("⏳ Activation en cours");
      // pas de boucle: on NE renvoie PAS vers inscription, on met pending
      showPendingOverlay(module, phone);
      return false;
    }

    // 3) OK
    setStatus("✅ Accès autorisé");
    window.DIGIY_ACCESS = { ok:true, phone, module };
    document.documentElement.classList.add("access-ok");
    return true;
  };

})();
