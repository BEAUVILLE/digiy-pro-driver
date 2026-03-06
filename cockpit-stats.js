// cockpit-stats.js — DRIVER cockpit (waits DIGIY_GUARD.ready)
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

  async function load(){

    try{

      const g = window.DIGIY_GUARD;

      if(!g?.ready){
        console.warn("DIGIY_GUARD.ready missing");
        return;
      }

      const r = await g.ready;

      if(!r?.ok) return;

      const slug = r.slug;

      // UI statut
      const pill = document.getElementById("pillStatus");
      const dot  = document.getElementById("dot");
      const sLine = document.getElementById("statusLine");

      if(pill) pill.innerHTML = `Statut : <b>Actif</b>`;
      if(dot) dot.classList.add("ok");
      if(sLine) sLine.textContent = "Abonnement actif";

      const btnA = document.getElementById("btnPrimaryAction");
      const hint = document.getElementById("actionHint");
      const desc = document.getElementById("actionDesc");

      if(btnA) btnA.textContent = "Ouvrir mes courses";
      if(hint) hint.textContent = "Gère tes courses, zones, et historique.";
      if(desc) desc.textContent = "Accès cockpit DRIVER — stats & opérations.";

      // appel RPC
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

      if(res?.error){
        console.error("RPC error:", res.error);
        notif([
          {
            level:"warn",
            tag:"SQL",
            title:"Erreur stats",
            text: res.error.message
          }
        ]);
        return;
      }

      const data = res?.data ?? res;

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

      // KPIs
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

  if(document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", load);
  else
    load();

  window.DIGIY_COCKPIT_STATS = { load };

})();
