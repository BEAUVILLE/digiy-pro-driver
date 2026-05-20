/*
  DIGIY DRIVER — Sync UI
  Version terrain V1 — 2026-05-20

  À poser dans :
  assets/js/digiy-driver-sync-ui.js

  Rôle :
  - Brancher DRIVER sur le pont commun DIGIY_BRIDGE si présent
  - Lire les courses / trajets
  - Lire le statut chauffeur si disponible
  - Lire les tarifs si disponibles
  - Lire les notes/signaux locaux
  - Mettre une carte "Synchronisation DRIVER" dans hub / cockpit / trajets / tarifs / profil
  - Garder une mémoire locale terrain quand les sources distantes ne répondent pas
*/

(function(){
  "use strict";

  if(window.DIGIY_DRIVER_SYNC_UI_READY) return;
  window.DIGIY_DRIVER_SYNC_UI_READY = true;

  const MODULE = "DRIVER";
  const SIGNALS_KEY = "DIGIY_DRIVER_PRO_SIGNALS";
  const SNAPSHOT_KEY = "DIGIY_DRIVER_SYNC_SNAPSHOT_V1";
  const PAY_SIGNALS_KEY = "DIGIY_PAY_PRO_SIGNALS";

  const CFG = {
    module: MODULE,
    reservationRpcs: [
      "digiy_driver_trajets_by_slug",
      "digiy_driver_courses_by_slug",
      "digiy_driver_rides_by_slug",
      "digiy_driver_reservations_by_slug",
      "digiy_driver_trips_by_slug"
    ],
    availabilityRpcs: [],
    availabilityTables: []
  };

  const DIRECT_RPCS = {
    trips: [
      "digiy_driver_trajets_by_slug",
      "digiy_driver_courses_by_slug",
      "digiy_driver_rides_by_slug",
      "digiy_driver_reservations_by_slug",
      "digiy_driver_trips_by_slug"
    ],
    status: [
      "digiy_driver_status_by_slug",
      "digiy_driver_profile_by_slug",
      "digiy_driver_public_profile_by_slug",
      "digiy_driver_get_profile"
    ],
    tarifs: [
      "digiy_driver_tarifs_by_slug",
      "digiy_driver_prices_by_slug",
      "digiy_driver_get_tarifs"
    ]
  };

  const TABLES = {
    trips: [
      { table:"digiy_driver_trajets", slugCol:"slug" },
      { table:"digiy_driver_courses", slugCol:"slug" },
      { table:"driver_trajets", slugCol:"slug" },
      { table:"driver_courses", slugCol:"slug" }
    ],
    status: [
      { table:"digiy_driver_profiles", slugCol:"slug" },
      { table:"driver_profiles", slugCol:"slug" },
      { table:"digiy_driver_public_profiles", slugCol:"slug" }
    ],
    tarifs: [
      { table:"digiy_driver_tarifs", slugCol:"slug" },
      { table:"driver_tarifs", slugCol:"slug" },
      { table:"digiy_driver_prices", slugCol:"slug" }
    ]
  };

  function $(id){
    return document.getElementById(id);
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, function(m){
      return {
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "\"":"&quot;",
        "'":"&#39;"
      }[m];
    });
  }

  function lower(value){
    return String(value || "").trim().toLowerCase();
  }

  function ymd(value){
    if(!value) return "";

    const s = String(value).trim().slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return "";

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2,"0"),
      String(d.getDate()).padStart(2,"0")
    ].join("-");
  }

  function todayYmd(){
    return ymd(new Date());
  }

  function money(value){
    const n = Number(value || 0);
    if(!Number.isFinite(n) || n <= 0) return "—";
    return n.toLocaleString("fr-FR") + " F";
  }

  function safeJson(raw, fallback){
    try{
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(_){
      return fallback;
    }
  }

  function readLocalArray(key){
    try{
      const rows = safeJson(localStorage.getItem(key) || "[]", []);
      return Array.isArray(rows) ? rows : [];
    }catch(_){
      return [];
    }
  }

  function writeLocalArray(key, rows){
    try{
      localStorage.setItem(key, JSON.stringify((rows || []).slice(-100)));
    }catch(_){}
  }

  function readSnapshot(){
    try{
      const snap = safeJson(localStorage.getItem(SNAPSHOT_KEY) || "{}", {});
      return snap && typeof snap === "object" ? snap : {};
    }catch(_){
      return {};
    }
  }

  function writeSnapshot(snapshot){
    try{
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot || {}));
    }catch(_){}
  }

  function pushSignal(signal){
    const rows = readLocalArray(SIGNALS_KEY);

    const item = {
      id: signal.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      module: MODULE,
      source: signal.source || "driver-sync",
      type: signal.type || "info",
      label: signal.label || signal.message || "Indication DRIVER",
      message: signal.message || signal.label || "Indication DRIVER",
      href: signal.href || "./hub.html",
      created_at: signal.created_at || new Date().toISOString()
    };

    const key = lower(`${item.type}:${item.source}:${item.label}:${item.href}`);

    const filtered = rows.filter(function(row){
      const rowKey = lower(`${row.type}:${row.source}:${row.label || row.message}:${row.href}`);
      return rowKey !== key;
    });

    filtered.push(item);
    writeLocalArray(SIGNALS_KEY, filtered);

    return item;
  }

  function waitForBridge(){
    return new Promise(function(resolve){
      if(window.DIGIY_BRIDGE){
        resolve(window.DIGIY_BRIDGE);
        return;
      }

      let tries = 0;

      const timer = setInterval(function(){
        tries += 1;

        if(window.DIGIY_BRIDGE){
          clearInterval(timer);
          resolve(window.DIGIY_BRIDGE);
          return;
        }

        if(tries > 40){
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  }

  async function initBridge(){
    const bridge = await waitForBridge();

    if(!bridge){
      return {
        bridge:null,
        session:{ module:MODULE, slug:"", phone:"", access:false }
      };
    }

    try{
      await bridge.init(CFG);
      const session = bridge.getSession ? bridge.getSession() : {};
      return { bridge, session: session || {} };
    }catch(e){
      console.warn("[DIGIY DRIVER SYNC] bridge init ignoré:", e?.message || e);
      return {
        bridge,
        session:{ module:MODULE, slug:"", phone:"", access:false }
      };
    }
  }

  function getSb(bridge){
    try{
      if(bridge && typeof bridge.getSb === "function"){
        const sb = bridge.getSb();
        if(sb) return sb;
      }
    }catch(_){}

    if(window.DIGIY_GUARD?.getSb){
      try{
        const sb = window.DIGIY_GUARD.getSb();
        if(sb) return sb;
      }catch(_){}
    }

    if(!window.supabase?.createClient) return null;

    const url = window.DIGIY_SUPABASE_URL || "";
    const key = window.DIGIY_SUPABASE_ANON || window.DIGIY_SUPABASE_ANON_KEY || "";

    if(!url || !key) return null;

    try{
      return window.supabase.createClient(url, key, {
        auth:{
          persistSession:false,
          autoRefreshToken:false,
          detectSessionInUrl:false
        }
      });
    }catch(_){
      return null;
    }
  }

  async function rpcTry(sb, names, args){
    if(!sb?.rpc) return null;

    for(const name of names || []){
      try{
        const { data, error } = await sb.rpc(name, args || {});

        if(!error && data != null){
          return data;
        }

        if(error){
          console.warn("[DIGIY DRIVER SYNC] RPC ignorée:", name, error.message || error);
        }
      }catch(e){
        console.warn("[DIGIY DRIVER SYNC] RPC exception:", name, e?.message || e);
      }
    }

    return null;
  }

  async function tableTry(sb, tables, slug){
    if(!sb?.from || !slug) return [];

    for(const cfg of tables || []){
      try{
        const { data, error } = await sb
          .from(cfg.table)
          .select("*")
          .eq(cfg.slugCol || "slug", slug)
          .limit(50);

        if(!error && Array.isArray(data)){
          return data;
        }

        if(error){
          console.warn("[DIGIY DRIVER SYNC] table ignorée:", cfg.table, error.message || error);
        }
      }catch(e){
        console.warn("[DIGIY DRIVER SYNC] table exception:", cfg.table, e?.message || e);
      }
    }

    return [];
  }

  function arrayFromData(data, primaryKey){
    if(Array.isArray(data)) return data;
    if(Array.isArray(data?.data)) return data.data;
    if(Array.isArray(data?.rows)) return data.rows;
    if(Array.isArray(data?.items)) return data.items;
    if(primaryKey && Array.isArray(data?.[primaryKey])) return data[primaryKey];
    if(data && typeof data === "object") return [data];
    return [];
  }

  function normalizeTrip(row){
    const date =
      ymd(row.date) ||
      ymd(row.day) ||
      ymd(row.pickup_date) ||
      ymd(row.departure_date) ||
      ymd(row.created_at) ||
      "";

    const status = lower(
      row.status ||
      row.state ||
      row.etat ||
      row.course_status ||
      row.ride_status ||
      ""
    );

    const payStatus = lower(
      row.payment_status ||
      row.pay_status ||
      row.pay ||
      row.paiement ||
      ""
    );

    const amount = Number(
      row.amount ||
      row.price ||
      row.prix ||
      row.tarif ||
      row.total ||
      row.amount_total ||
      0
    ) || 0;

    return {
      id:String(row.id || row.ref || row.reference || row.uuid || Math.random()).trim(),
      date,
      client:String(row.client_name || row.client || row.customer_name || row.name || "Client").trim(),
      from:String(row.from || row.depart || row.pickup || row.pickup_label || row.origin || "").trim(),
      to:String(row.to || row.arrivee || row.destination || row.dropoff || row.destination_label || "").trim(),
      status,
      payment_status:payStatus,
      amount,
      raw:row
    };
  }

  function normalizeStatus(row){
    if(!row || typeof row !== "object") return {
      label:"Statut non lu",
      available:false,
      online:false
    };

    const raw = lower(
      row.status ||
      row.driver_status ||
      row.availability ||
      row.disponibilite ||
      row.state ||
      ""
    );

    const online = !!(
      row.is_online === true ||
      row.online === true ||
      raw.includes("online") ||
      raw.includes("connecte") ||
      raw.includes("connecté")
    );

    const available = !!(
      row.is_available === true ||
      row.available === true ||
      row.disponible === true ||
      raw.includes("available") ||
      raw.includes("disponible") ||
      raw.includes("libre")
    );

    let label = "Statut non renseigné";

    if(available) label = "Disponible";
    else if(online) label = "Connecté";
    else if(raw.includes("busy") || raw.includes("occupe") || raw.includes("occupé")) label = "Occupé";
    else if(raw.includes("offline") || raw.includes("hors")) label = "Hors ligne";
    else if(raw) label = raw;

    return {
      label,
      available,
      online,
      raw:row
    };
  }

  function normalizeTarif(row){
    const amount = Number(
      row.amount ||
      row.price ||
      row.prix ||
      row.tarif ||
      row.value ||
      0
    ) || 0;

    return {
      id:String(row.id || row.code || row.name || Math.random()),
      label:String(row.label || row.name || row.title || row.type || "Tarif").trim(),
      amount,
      raw:row
    };
  }

  function isPendingTrip(trip){
    const s = lower(trip.status);
    return (
      !s ||
      s.includes("pending") ||
      s.includes("attente") ||
      s.includes("new") ||
      s.includes("demande")
    );
  }

  function isDoneTrip(trip){
    const s = lower(trip.status);
    return (
      s.includes("done") ||
      s.includes("termine") ||
      s.includes("terminé") ||
      s.includes("complete") ||
      s.includes("completed")
    );
  }

  function isCancelledTrip(trip){
    const s = lower(trip.status);
    return s.includes("cancel") || s.includes("annul");
  }

  function isPaidTrip(trip){
    const s = lower(trip.payment_status);
    return (
      s === "paid" ||
      s === "ok" ||
      s === "confirmed" ||
      s === "succeeded" ||
      s.includes("payé") ||
      s.includes("paye")
    );
  }

  async function loadTrips(sb, slug){
    let rows = [];

    const rpcData = await rpcTry(sb, DIRECT_RPCS.trips, {
      p_slug:slug,
      slug:slug,
      p_module:MODULE,
      module:MODULE
    });

    rows = arrayFromData(rpcData, "trips");

    if(!rows.length){
      rows = await tableTry(sb, TABLES.trips, slug);
    }

    const localSignals = readLocalArray(SIGNALS_KEY)
      .filter(s => lower(s.type || "").includes("course") || lower(s.source || "").includes("trajet"))
      .map(s => ({
        id:s.id,
        date:ymd(s.created_at),
        client:s.client || "Client",
        from:s.from || "",
        to:s.to || "",
        status:s.status || "local",
        amount:s.amount || 0,
        source:"local"
      }));

    return rows.concat(localSignals).map(normalizeTrip);
  }

  async function loadStatus(sb, slug){
    const rpcData = await rpcTry(sb, DIRECT_RPCS.status, {
      p_slug:slug,
      slug:slug,
      p_module:MODULE,
      module:MODULE
    });

    const rpcRows = arrayFromData(rpcData, "profile");

    if(rpcRows.length){
      return normalizeStatus(rpcRows[0]);
    }

    const tableRows = await tableTry(sb, TABLES.status, slug);

    if(tableRows.length){
      return normalizeStatus(tableRows[0]);
    }

    const snap = readSnapshot();

    if(snap.status){
      return normalizeStatus(snap.status.raw || snap.status);
    }

    return normalizeStatus({});
  }

  async function loadTarifs(sb, slug){
    const rpcData = await rpcTry(sb, DIRECT_RPCS.tarifs, {
      p_slug:slug,
      slug:slug,
      p_module:MODULE,
      module:MODULE
    });

    let rows = arrayFromData(rpcData, "tarifs");

    if(!rows.length){
      rows = await tableTry(sb, TABLES.tarifs, slug);
    }

    const localTarifs = readLocalArray("DIGIY_DRIVER_TARIFS")
      .concat(readLocalArray("DIGIY_DRIVER_PRICES"));

    return rows.concat(localTarifs).map(normalizeTarif);
  }

  function readNotes(){
    const driverSignals = readLocalArray(SIGNALS_KEY);
    const driverNotes = readLocalArray("DIGIY_DRIVER_NOTES");
    const paySignals = readLocalArray(PAY_SIGNALS_KEY);

    return driverSignals
      .concat(driverNotes)
      .concat(paySignals.filter(s => lower(s.module || "PAY") === "pay" || lower(s.source || "").includes("pay")))
      .slice(-20);
  }

  function makeSummary(data){
    const today = todayYmd();

    const trips = (data.trips || []).filter(t => !isCancelledTrip(t));
    const todayTrips = trips.filter(t => t.date === today);
    const pendingTrips = trips.filter(isPendingTrip);
    const doneTrips = trips.filter(isDoneTrip);
    const dueTrips = trips.filter(t => !isPaidTrip(t));
    const notes = data.notes || [];
    const tarifs = data.tarifs || [];

    return {
      today,
      counts:{
        trips:trips.length,
        todayTrips:todayTrips.length,
        pendingTrips:pendingTrips.length,
        doneTrips:doneTrips.length,
        dueTrips:dueTrips.length,
        notes:notes.length,
        tarifs:tarifs.length
      },
      todayTrips,
      pendingTrips,
      doneTrips,
      dueTrips,
      notes,
      tarifs,
      status:data.status || {}
    };
  }

  function saveSnapshot(payload){
    const snapshot = {
      module:MODULE,
      saved_at:new Date().toISOString(),
      slug:payload.slug || "",
      summary:payload.summary || {},
      status:payload.status || {},
      trips:payload.trips || [],
      tarifs:payload.tarifs || [],
      notes:payload.notes || []
    };

    writeSnapshot(snapshot);
  }

  function ensureStyles(){
    if($("digiyDriverSyncStyle")) return;

    const style = document.createElement("style");
    style.id = "digiyDriverSyncStyle";
    style.textContent = `
      .digiy-driver-sync-card{
        margin:12px 0;
        padding:14px;
        border-radius:22px;
        border:2px solid rgba(250,204,21,.42);
        background:
          radial-gradient(circle at top left,rgba(250,204,21,.14),transparent 44%),
          linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.06));
        color:inherit;
        box-shadow:0 14px 32px rgba(0,0,0,.18);
      }

      .digiy-driver-sync-title{
        font-size:1.15rem;
        font-weight:1000;
        line-height:1.15;
        color:#fde68a;
      }

      .digiy-driver-sync-sub{
        margin-top:5px;
        font-size:.95rem;
        font-weight:900;
        line-height:1.35;
        opacity:.86;
      }

      .digiy-driver-sync-grid{
        margin-top:10px;
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }

      .digiy-driver-sync-pill{
        border:1px solid rgba(255,255,255,.16);
        border-radius:16px;
        padding:10px;
        background:rgba(0,0,0,.14);
        font-size:.84rem;
        font-weight:1000;
        line-height:1.2;
      }

      .digiy-driver-sync-pill strong{
        display:block;
        font-size:1.35rem;
        line-height:1;
        margin-bottom:5px;
        color:#fff;
      }

      .digiy-driver-sync-alert{
        margin-top:10px;
        padding:11px 12px;
        border-radius:16px;
        border:1px solid rgba(250,204,21,.35);
        background:rgba(250,204,21,.10);
        color:#fde68a;
        font-weight:1000;
        line-height:1.35;
      }

      .digiy-driver-sync-ok{
        margin-top:10px;
        padding:11px 12px;
        border-radius:16px;
        border:1px solid rgba(34,197,94,.35);
        background:rgba(34,197,94,.10);
        color:#bbf7d0;
        font-weight:1000;
        line-height:1.35;
      }

      .digiy-driver-sync-actions{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .digiy-driver-sync-actions a{
        min-height:46px;
        border-radius:15px;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:9px 10px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        color:inherit;
        text-decoration:none;
        font-size:.88rem;
        font-weight:1000;
      }

      .digiy-driver-sync-actions a.pay{
        background:linear-gradient(135deg,#facc15,#f59e0b);
        color:#241300;
        border-color:rgba(250,204,21,.42);
      }

      @media(max-width:720px){
        .digiy-driver-sync-grid,
        .digiy-driver-sync-actions{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;

    document.head.appendChild(style);
  }

  function findInsertTarget(){
    return (
      document.querySelector(".hero") ||
      document.querySelector(".hubHead") ||
      document.querySelector(".top") ||
      document.querySelector("main") ||
      document.body
    );
  }

  function upsertCard(payload){
    ensureStyles();

    let card = $("digiyDriverSyncCard");

    if(!card){
      card = document.createElement("section");
      card.id = "digiyDriverSyncCard";
      card.className = "digiy-driver-sync-card";

      const target = findInsertTarget();

      if(target && target.parentNode){
        target.insertAdjacentElement("afterend", card);
      }else{
        document.body.prepend(card);
      }
    }

    const summary = payload.summary || {};
    const counts = summary.counts || {};
    const status = summary.status || {};
    const firstPending = (summary.pendingTrips || [])[0];
    const firstDue = (summary.dueTrips || [])[0];

    let alertHtml = "";

    if(firstPending){
      alertHtml = `
        <div class="digiy-driver-sync-alert">
          🚕 Course / demande à traiter :
          ${esc(firstPending.from || "départ non précisé")}
          ${firstPending.to ? "→ " + esc(firstPending.to) : ""}.
        </div>
      `;
    }else if(firstDue){
      alertHtml = `
        <div class="digiy-driver-sync-alert">
          💰 Paiement à suivre :
          ${esc(firstDue.client || "client")} · ${esc(money(firstDue.amount))}.
        </div>
      `;
    }else{
      alertHtml = `
        <div class="digiy-driver-sync-ok">
          ✅ Aucun signal chauffeur urgent détecté pour le moment.
        </div>
      `;
    }

    card.innerHTML = `
      <div class="digiy-driver-sync-title">🔁 Synchronisation DRIVER</div>
      <div class="digiy-driver-sync-sub">
        Courses, statut chauffeur, tarifs, notes et porte PAY parlent dans le même espace.
      </div>

      <div class="digiy-driver-sync-grid">
        <div class="digiy-driver-sync-pill">
          <strong>${esc(status.label || "—")}</strong>
          Statut chauffeur
        </div>

        <div class="digiy-driver-sync-pill">
          <strong>${esc(counts.todayTrips || 0)}</strong>
          Courses aujourd’hui
        </div>

        <div class="digiy-driver-sync-pill">
          <strong>${esc(counts.pendingTrips || 0)}</strong>
          À traiter
        </div>

        <div class="digiy-driver-sync-pill">
          <strong>${esc(counts.dueTrips || 0)}</strong>
          Argent à suivre
        </div>
      </div>

      ${alertHtml}

      <div class="digiy-driver-sync-actions">
        <a href="./trajets.html">🚕 Trajets</a>
        <a href="./tarifs.html">💰 Tarifs</a>
        <a href="./cockpit.html">🧭 Coffre</a>
        <a class="pay" href="https://pro-pay.digiylyfe.com/admin.html">💰 PAY</a>
      </div>
    `;
  }

  function updateExistingCounters(payload){
    const c = payload.summary?.counts || {};

    const mappings = [
      ["countTrips", c.trips],
      ["countTodayTrips", c.todayTrips],
      ["countPendingTrips", c.pendingTrips],
      ["countDueTrips", c.dueTrips],
      ["countNotes", c.notes],
      ["countTarifs", c.tarifs]
    ];

    mappings.forEach(function(pair){
      const el = $(pair[0]);
      if(el) el.textContent = String(pair[1] || 0);
    });

    const pill =
      $("sessionPill") ||
      $("pillState") ||
      $("driverStatus") ||
      $("statusPill");

    if(pill && payload.status?.label){
      pill.textContent = payload.status.label;
      if(payload.status.available || payload.status.online){
        pill.classList.add("ok");
        pill.classList.remove("warn","bad");
      }
    }
  }

  function upsertSignalsFromSummary(payload){
    const summary = payload.summary || {};
    const c = summary.counts || {};

    if(c.pendingTrips > 0){
      pushSignal({
        type:"course",
        source:"driver-sync",
        label:`${c.pendingTrips} course(s) / demande(s) à traiter`,
        href:"./trajets.html"
      });
    }

    if(c.dueTrips > 0){
      pushSignal({
        type:"payment",
        source:"driver-sync",
        label:`${c.dueTrips} paiement(s) à suivre`,
        href:"https://pro-pay.digiylyfe.com/admin.html"
      });
    }

    if(c.tarifs === 0){
      pushSignal({
        type:"tarifs",
        source:"driver-sync",
        label:"Tarifs chauffeur à vérifier",
        href:"./tarifs.html"
      });
    }
  }

  async function boot(){
    const { bridge, session } = await initBridge();
    const sb = getSb(bridge);
    const slug = session?.slug || "";

    let trips = [];
    let status = normalizeStatus({});
    let tarifs = [];
    let notes = readNotes();

    try{
      if(sb && slug){
        trips = await loadTrips(sb, slug);
        status = await loadStatus(sb, slug);
        tarifs = await loadTarifs(sb, slug);
      }
    }catch(e){
      console.warn("[DIGIY DRIVER SYNC] lecture distante ignorée:", e?.message || e);
    }

    const old = readSnapshot();

    if(!trips.length && Array.isArray(old.trips)) trips = old.trips;
    if(!tarifs.length && Array.isArray(old.tarifs)) tarifs = old.tarifs;
    if(!notes.length && Array.isArray(old.notes)) notes = old.notes;
    if((!status || status.label === "Statut non lu") && old.status) status = old.status;

    const payload = {
      module:MODULE,
      slug,
      access: !!session?.access,
      status,
      trips,
      tarifs,
      notes
    };

    payload.summary = makeSummary(payload);

    saveSnapshot(payload);
    upsertSignalsFromSummary(payload);
    upsertCard(payload);
    updateExistingCounters(payload);

    window.dispatchEvent(new CustomEvent("digiy:driver:sync", {
      detail:payload
    }));

    console.log("[DIGIY DRIVER SYNC] OK", payload.summary);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})();
