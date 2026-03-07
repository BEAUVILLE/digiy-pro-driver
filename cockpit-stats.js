// cockpit-stats.js — DRIVER cockpit (guard-aware, preview-safe)
(function(){
  "use strict";

  const money = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val ?? "—");
  };

  function notif(items){
    const box = document.getElementById("notifList");
    if(!box) return;

    box.innerHTML = "";

    (items || []).forEach(it => {
      const tagClass =
        it.level === "warn" ? "warn" :
        it.level === "ok" ? "ok" : "info";

      const div = document.createElement("div");
      div.className = "notif";
      div.innerHTML = `
        <div>
          <b>${it.title}</b>
          <div class="muted" style="font-weight:800;margin-top:2px">
            ${it.text}
          </div>
        </div>
        <div class="tag ${tagClass}">${it.tag}</div>
      `;
      box.appendChild(div);
    });
  }

  function setPreviewUi(reason){
    const pill = document.getElementById("pillStatus");
    const dot  = document.getElementById("dot");
    const sLine = document.getElementById("statusLine");
    const btnA = document.getElementById("btnPrimaryAction");
    const hint = document.getElementById("actionHint");
    const desc = document.getElementById("actionDesc");

    if(pill) pill.innerHTML = `Statut : <b>Aperçu</b>`;
    if(dot) {
      dot.classList.remove("ok");
      dot.classList.add("warn");
    }
    if(sLine) {
      if(reason === "no_subscription") sLine.textContent = "Abonnement inactif";
      else sLine.textContent = "Mode aperçu";
    }

    if(btnA) btnA.textContent = "Voir le logiciel";
    if(hint) hint.textContent = "Aperçu du cockpit DRIVER avant accès réel.";
    if(desc) desc.textContent = "Le chauffeur peut voir l’outil sans ouvrir les vraies données.";

    set("kpiTripsToday", 2);
    set("kpiTrips7d", 9);
    set("kpiTrips30d", 28);
    set("kpiZone", "Saly");
    set("kpiDriverStatus", "preview");
    set("kpiLastTripAt", "—");
    set("moneyMonth", money(245000));
    set("txCount", "28 courses");
    set("todayHint", "Aperçu");

    notif([
      {
        level:"info",
        tag:"APERÇU",
        title:"Cockpit visible",
        text: reason === "no_subscription"
          ? "Accès réel inactif. Aperçu affiché."
          : "Le logiciel reste visible en mode aperçu."
      }
    ]);
  }

  function setLiveUi(){
    const pill = document.getElementById("pillStatus");
    const dot  = document.getElementById("dot");
    const sLine = document.getElementById("statusLine");
    const btnA = document.getElementById("btnPrimaryAction");
    const hint = document.getElementById("actionHint");
    const desc = document.getElementById("actionDesc");

    if(pill) pill.innerHTML = `Statut : <b>Actif</b>`;
    if(dot) {
      dot.classList.remove("warn");
      dot.classList.add("ok");
    }
    if(sLine) sLine.textContent = "Abonnement actif";

    if(btnA) btnA.textContent = "Ouvrir mes courses";
    if(hint) hint.textContent = "Gère tes courses, zones, et historique.";
    if(desc) desc.textContent = "Accès cockpit DRIVER — stats & opérations.";
  }

  async function getGuardState(){
    const g = window.DIGIY_GUARD;

    if(!g?.ready){
      return {
        ok:false,
        preview:true,
        access_ok:false,
        slug:"",
        reason:"guard_missing"
      };
    }

    await g.ready;
    return g.state || {
      ok:false,
      preview:true,
      access_ok:false,
      slug:"",
      reason:"guard_empty"
    };
  }

  async function load(){
    try{
      const g = window.DIGIY_GUARD;
      const st = await getGuardState();

      if(st?.preview){
        setPreviewUi(st.reason);
        return;
      }

      if(!st?.access_ok){
        setPreviewUi(st?.reason || "access_ko");
        return;
      }

      const slug = st.slug;
      if(!slug){
        setPreviewUi("missing_slug");
        return;
      }

      setLiveUi();

      let res;
      try{
        res = await g.rpc("cockpit_driver_stats_by_slug", { p_slug: slug });
      }catch(e){
        console.warn("RPC stats missing:", e);
        notif([
          {
            level:"warn",
            tag:"SQL",
            title:"Stats indisponibles",
            text:"La fonction cockpit_driver_stats_by_slug n'est pas encore installée."
          }
        ]);
        return;
      }

      if(!res?.ok){
        const errText =
          res?.data?.message ||
          res?.data?.error ||
          "Erreur RPC inconnue";
        notif([
          {
            level:"warn",
            tag:"SQL",
            title:"Erreur stats",
            text: errText
          }
        ]);
        return;
      }

      const data = res?.data;
      const s = Array.isArray(data) ? data[0] : data;

      if(!s){
        notif([
          {
            level:"info",
            tag:"INFO",
            title:"Stats",
            text:"Aucune donnée de course pour l’instant."
          }
        ]);
        return;
      }

      set("kpiTripsToday", s.trips_today ?? 0);
      set("kpiTrips7d", s.trips_7d ?? 0);
      set("kpiTrips30d", s.trips_30d ?? 0);

      set("kpiZone", s.zone_slug || "—");
      set("kpiDriverStatus", s.driver_status || "—");

      set(
        "kpiLastTripAt",
        s.last_trip_at
          ? new Date(s.last_trip_at).toLocaleString("fr-FR")
          : "—"
      );

      set("moneyMonth", money(s.revenue_30d_fcfa || 0));
      set("txCount", `${s.trips_30d ?? 0} courses`);
      set("todayHint", "Aujourd’hui");

      notif([
        {
          level:"ok",
          tag:"OK",
          title:"Cockpit prêt",
          text:"Accès validé. Données chargées."
        }
      ]);
    }catch(e){
      console.error("cockpit-stats load error:", e);

      notif([
        {
          level:"warn",
          tag:"ERREUR",
          title:"Chargement",
          text:"Erreur cockpit. Regarde la console."
        }
      ]);
    }
  }

  async function reload(){
    if(window.DIGIY_GUARD?.refresh){
      await window.DIGIY_GUARD.refresh();
    }
    await load();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", load);
  }else{
    load();
  }

  window.DIGIY_COCKPIT_STATS = {
    load,
    reload
  };
})();
