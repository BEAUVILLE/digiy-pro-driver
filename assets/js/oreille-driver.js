/* ==========================================================================
   DIGIYLYFE — OREILLE DRIVER V1
   Fichier : assets/js/oreille-driver.js
   Version : 2026-05-24 · client + téléphone + départ + arrivée + tarif
   Dépendance : assets/js/oreille-metier-core.js

   Doctrine :
   L’Oreille écoute.
   DIGIY formule.
   Le chauffeur valide.
   DRIVER range.
   Aucun trajet, prix ou engagement n’est confirmé automatiquement.
   ========================================================================== */

(function () {
  "use strict";

  var VERSION = "oreille-driver-v1-20260524";
  var CLIENTS_KEY = "DIGIY_DRIVER_CLIENTS_LOCAL_V1";

  var DRIVER_GUIDE =
    "Bienvenue dans Oreille DRIVER DIGIYLYFE. " +
    "Ici, le chauffeur peut parler ou cliquer pour préparer une course. " +
    "DRIVER aide à préciser le client, le téléphone, le lieu de départ, l’arrivée, la date, l’heure, le tarif, le mode de paiement et le statut. " +
    "Mais DRIVER ne confirme jamais seul une course, un prix ou un engagement. " +
    "Le chauffeur vérifie le trajet, le tarif, la disponibilité et les conditions avant de répondre au client. " +
    "L’Oreille prépare. DIGIY formule. Le chauffeur relit. Le chauffeur valide. DRIVER range. " +
    "Le terrain garde la main.";

  var DRIVER_TEMPLATES = [
    "🚕 Nouvelle course — client · téléphone · départ · arrivée · date · heure.",
    "✅ Course confirmée — client · téléphone · départ · arrivée · tarif · mode.",
    "💰 Paiement course — montant · mode cash/Wave/autre · client · trajet · preuve.",
    "🕐 Retard / attente — client · téléphone · lieu · nouvelle heure · détail.",
    "❌ Annulation — client · téléphone · trajet · raison · statut.",
    "📍 Départ à préciser — lieu de départ · client · téléphone.",
    "🏁 Arrivée à préciser — destination · client · détail.",
    "🔁 Retour / disponibilité — lieu · date · heure · trajet possible.",
    "🧾 Note chauffeur — client · téléphone · remarque · statut.",
    "⚠️ Doute / brouillon — garder en note, ne pas confirmer sans validation."
  ];

  var DRIVER_CONFIG = {
    module: "DRIVER",
    title: "Oreille DRIVER",
    subtitle: "Client · téléphone · départ · arrivée · heure · tarif · statut.",
    storagePrefix: "DIGIY_OREILLE_METIER",
    guideText: DRIVER_GUIDE,
    templates: DRIVER_TEMPLATES
  };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
  }

  function lower(value) {
    return normalizeText(value).toLowerCase();
  }

  function findMountTarget() {
    return (
      document.querySelector("#digiy-oreille-driver") ||
      document.querySelector("[data-digiy-oreille-driver]") ||
      document.querySelector("[data-digiy-driver-oreille]") ||
      document.querySelector("#digiy-oreille-metier") ||
      document.querySelector("[data-digiy-oreille]")
    );
  }

  function extractField(text, labels) {
    var clean = normalizeText(text);

    for (var i = 0; i < labels.length; i += 1) {
      var label = labels[i];

      var re = new RegExp(
        "(?:^|[\\s;,.|—-])" +
          label +
          "\\s*[:\\-]?\\s*([^;|\\n]+?)(?=\\s+(?:client|nom|source|tel|tél|telephone|téléphone|départ|depart|arrivée|arrivee|destination|date|jour|heure|horaire|prix|tarif|montant|mode|paiement|statut|détail|detail|raison|note|preuve)\\s*[:\\-]|$)",
        "i"
      );

      var match = clean.match(re);
      if (match && match[1]) return normalizeText(match[1]);
    }

    return "";
  }

  function extractPhone(text) {
    var clean = normalizeText(text);

    var explicit = clean.match(/(?:tel|tél|telephone|téléphone|phone|numéro|numero)\s*[:\-]?\s*((?:\+?\d[\d\s().-]{6,}\d))/i);
    if (explicit && explicit[1]) return normalizeText(explicit[1]);

    var any = clean.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    return any ? normalizeText(any[0]) : "";
  }

  function extractClientName(text) {
    var explicit = extractField(text, ["client", "nom", "personne", "source"]);
    if (explicit) return explicit;

    var clean = normalizeText(text);
    var pour = clean.match(/\b(?:pour|avec|chez|client)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,40})/i);

    if (pour && pour[1]) {
      var candidate = normalizeText(pour[1])
        .replace(/\b(?:tel|départ|depart|arrivée|arrivee|date|heure|prix|tarif|cash|wave)\b.*$/i, "")
        .trim();

      if (candidate && candidate.length <= 45) return candidate;
    }

    return "";
  }

  function extractDeparture(text) {
    return extractField(text, [
      "départ",
      "depart",
      "lieu de départ",
      "lieu depart",
      "prise en charge",
      "pickup",
      "départ de",
      "depart de"
    ]);
  }

  function extractArrival(text) {
    return extractField(text, [
      "arrivée",
      "arrivee",
      "destination",
      "arrivée à",
      "arrivee a",
      "vers",
      "à",
      "a"
    ]);
  }

  function extractDate(text) {
    var explicit = extractField(text, ["date", "jour"]);
    if (explicit) return explicit;

    var clean = normalizeText(text);

    var numeric = clean.match(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/);
    if (numeric && numeric[1]) return numeric[1];

    var natural = clean.match(/\b(aujourd'hui|demain|après-demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i);
    if (natural && natural[1]) return natural[1];

    return "";
  }

  function extractTime(text) {
    var explicit = extractField(text, ["heure", "horaire"]);
    if (explicit) return explicit;

    var clean = normalizeText(text);
    var match = clean.match(/\b(\d{1,2}\s*h(?:\s*\d{2})?|\d{1,2}:\d{2})\b/i);
    return match && match[1] ? normalizeText(match[1]) : "";
  }

  function extractPrice(text) {
    var explicit = extractField(text, ["prix", "tarif", "montant"]);
    if (explicit) return explicit;

    var clean = normalizeText(text);
    var match = clean.match(/\b(\d[\d\s.,]*)\s*(fcfa|f\s*cfa|xof|cfa|€|eur|euro|euros)\b/i);

    if (match && match[1]) {
      return normalizeText(match[1] + " " + (match[2] || ""));
    }

    return "";
  }

  function extractPaymentMode(text) {
    var explicit = extractField(text, ["mode", "paiement", "mode paiement"]);
    if (explicit) return explicit;

    var t = lower(text);

    if (/wave|wav/.test(t)) return "Wave";
    if (/cash|espèce|espece|liquide/.test(t)) return "cash";
    if (/orange money|om\b/.test(t)) return "Orange Money";
    if (/virement|banque|carte|autre|mobile money/.test(t)) return "autre";

    return "";
  }

  function extractDetail(text) {
    return extractField(text, ["détail", "detail", "raison", "note", "remarque", "preuve"]);
  }

  function guessStatus(text) {
    var t = lower(text);

    if (/confirmé|confirme|confirmation|ok pour|validé|valide|accepté|accepte/.test(t)) return "à confirmer par le chauffeur";
    if (/terminé|termine|finie|fini|déposé|depose/.test(t)) return "terminé à vérifier";
    if (/annulé|annule|annulation|annuler/.test(t)) return "annulation";
    if (/retard|attente|attendre|décalé|decale|reporter/.test(t)) return "retard / modification";
    if (/payé|paye|paiement|wave|cash|reçu|recu/.test(t)) return "paiement à vérifier";

    return "nouvelle demande";
  }

  function missingFields(draft) {
    var missing = [];

    if (!draft.client_name) missing.push("client");
    if (!draft.client_phone) missing.push("téléphone");
    if (!draft.departure) missing.push("départ");
    if (!draft.arrival) missing.push("arrivée");
    if (!draft.date) missing.push("date");
    if (!draft.time) missing.push("heure");
    if (!draft.price) missing.push("tarif/prix");
    if (!draft.payment_mode) missing.push("mode cash/Wave/autre");

    return missing;
  }

  function buildDriverDraft(text) {
    var clean = normalizeText(text);

    var draft = {
      module: "DRIVER",
      raw_text: clean,
      client_name: extractClientName(clean),
      client_phone: extractPhone(clean),
      departure: extractDeparture(clean),
      arrival: extractArrival(clean),
      date: extractDate(clean),
      time: extractTime(clean),
      price: extractPrice(clean),
      payment_mode: extractPaymentMode(clean),
      detail: extractDetail(clean),
      status: guessStatus(clean),
      created_at: new Date().toISOString(),
      warning: "À vérifier par le chauffeur avant confirmation."
    };

    draft.missing = missingFields(draft);
    return draft;
  }

  function formatDriverDraftMessage(draft) {
    if (!draft || !draft.raw_text) {
      return "DRIVER · Note vide : préciser client, téléphone, départ, arrivée, date, heure, tarif et mode avant validation.";
    }

    var clientPart = "Client : " + (draft.client_name || "à préciser");
    var phonePart = "Téléphone : " + (draft.client_phone || "à préciser");
    var departurePart = "Départ : " + (draft.departure || "à préciser");
    var arrivalPart = "Arrivée : " + (draft.arrival || "à préciser");
    var datePart = "Date : " + (draft.date || "à préciser");
    var timePart = "Heure : " + (draft.time || "à préciser");
    var pricePart = "Tarif : " + (draft.price || "à préciser");
    var modePart = "Mode : " + (draft.payment_mode || "cash / Wave / autre à choisir");
    var detailPart = "Détail : " + (draft.detail || "à préciser");
    var statusPart = "Statut : " + (draft.status || "nouvelle demande");

    var missing =
      draft.missing && draft.missing.length
        ? "Manque : " + draft.missing.join(", ") + ". "
        : "Course complète à vérifier. ";

    var warning =
      "DRIVER ne confirme pas seul. Le chauffeur doit vérifier trajet, disponibilité, tarif et conditions avant réponse client.";

    if (draft.status === "paiement à vérifier") {
      warning = "Paiement à vérifier avant de compter l’argent comme reçu.";
    }

    if (draft.status === "annulation") {
      warning = "Annulation à confirmer avec le client avant rangement définitif.";
    }

    return (
      "DRIVER · Course préparée — " +
      clientPart +
      " · " +
      phonePart +
      " · " +
      departurePart +
      " · " +
      arrivalPart +
      " · " +
      datePart +
      " · " +
      timePart +
      " · " +
      pricePart +
      " · " +
      modePart +
      " · " +
      detailPart +
      " · " +
      statusPart +
      ". " +
      missing +
      warning +
      " Texte d’origine : " +
      draft.raw_text
    );
  }

  function formulateDriverDeep(text) {
    return formatDriverDraftMessage(buildDriverDraft(text));
  }

  function getClients() {
    try {
      var raw = localStorage.getItem(CLIENTS_KEY) || "[]";
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function setClients(clients) {
    try {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify((clients || []).slice(0, 200)));
    } catch (_err) {}
  }

  function upsertClientFromDraft(draft) {
    if (!draft || (!draft.client_name && !draft.client_phone)) return null;

    var clients = getClients();
    var phone = normalizeText(draft.client_phone);
    var name = normalizeText(draft.client_name) || "Client sans nom";
    var found = null;

    if (phone) {
      found = clients.find(function (c) {
        return normalizeText(c.phone) === phone;
      });
    }

    if (!found && name) {
      found = clients.find(function (c) {
        return lower(c.name) === lower(name);
      });
    }

    var now = new Date().toISOString();

    if (found) {
      found.name = found.name || name;
      found.phone = found.phone || phone;
      found.last_departure = draft.departure || found.last_departure || "";
      found.last_arrival = draft.arrival || found.last_arrival || "";
      found.last_date = draft.date || found.last_date || "";
      found.last_time = draft.time || found.last_time || "";
      found.last_price = draft.price || found.last_price || "";
      found.last_payment_mode = draft.payment_mode || found.last_payment_mode || "";
      found.last_status = draft.status || found.last_status || "";
      found.updated_at = now;
    } else {
      found = {
        id: "driver_client_" + Date.now(),
        name: name,
        phone: phone,
        last_departure: draft.departure || "",
        last_arrival: draft.arrival || "",
        last_date: draft.date || "",
        last_time: draft.time || "",
        last_price: draft.price || "",
        last_payment_mode: draft.payment_mode || "",
        last_status: draft.status || "nouvelle demande",
        notes: "",
        created_at: now,
        updated_at: now
      };

      clients.unshift(found);
    }

    setClients(clients);
    return found;
  }

  function injectDriverStyles() {
    if (document.getElementById("digiyOreilleDriverStyles")) return;

    var style = document.createElement("style");
    style.id = "digiyOreilleDriverStyles";
    style.textContent =
      ".digiy-driver-help{" +
        "margin:10px 0 0;" +
        "border:1px dashed rgba(83,58,26,.24);" +
        "border-radius:16px;" +
        "background:rgba(250,204,21,.13);" +
        "padding:10px;" +
        "color:#25351f;" +
        "font-weight:950;" +
        "line-height:1.32;" +
        "font-size:14px;" +
      "}" +

      ".digiy-driver-help b{color:#6b4e09;font-weight:1000}" +

      ".digiy-oreille-templates{" +
        "display:grid!important;" +
        "grid-template-columns:repeat(2,minmax(0,1fr))!important;" +
        "gap:7px!important;" +
        "max-height:220px!important;" +
        "overflow-y:auto!important;" +
        "padding-right:5px!important;" +
        "scroll-snap-type:y proximity!important;" +
        "-webkit-overflow-scrolling:touch!important;" +
        "border:1px solid rgba(83,58,26,.18)!important;" +
        "border-radius:18px!important;" +
        "background:rgba(255,255,255,.38)!important;" +
        "padding:8px!important;" +
      "}" +

      ".digiy-oreille-template{" +
        "min-height:52px!important;" +
        "display:flex!important;" +
        "align-items:center!important;" +
        "justify-content:flex-start!important;" +
        "border-radius:14px!important;" +
        "font-size:12px!important;" +
        "font-weight:1000!important;" +
        "line-height:1.14!important;" +
        "padding:8px!important;" +
        "letter-spacing:-.01em!important;" +
        "scroll-snap-align:start!important;" +
        "overflow:hidden!important;" +
      "}" +

      ".digiy-driver-client-mini{" +
        "margin-top:10px;" +
        "border:1px solid rgba(24,32,20,.14);" +
        "border-radius:16px;" +
        "background:#fffdf4;" +
        "padding:10px;" +
        "font-weight:900;" +
        "color:#182014;" +
        "line-height:1.32;" +
        "font-size:14px;" +
      "}" +

      ".digiy-driver-client-mini b{" +
        "display:block;" +
        "margin-bottom:4px;" +
        "color:#14532d;" +
        "font-weight:1000;" +
      "}" +

      "@media(min-width:760px){" +
        ".digiy-oreille-templates{max-height:245px!important;}" +
        ".digiy-oreille-template{min-height:56px!important;font-size:12.5px!important;}" +
      "}" +

      "@media(max-width:360px){" +
        ".digiy-oreille-templates{max-height:205px!important;}" +
        ".digiy-oreille-template{min-height:49px!important;font-size:11.5px!important;}" +
      "}";

    document.head.appendChild(style);
  }

  function addDriverHelp(target) {
    if (!target || target.querySelector(".digiy-driver-help")) return;

    var status = target.querySelector(".digiy-oreille-status");
    if (!status) return;

    var help = document.createElement("div");
    help.className = "digiy-driver-help";
    help.innerHTML =
      "<b>DRIVER demande une trace complète.</b><br>" +
      "Client · téléphone · départ · arrivée · date · heure · tarif · mode cash/Wave/autre. " +
      "Aucune course n’est confirmée sans validation du chauffeur.";

    status.insertAdjacentElement("afterend", help);
  }

  function addClientPreview(target) {
    if (!target || target.querySelector(".digiy-driver-client-mini")) return;

    var notes = target.querySelector(".digiy-oreille-notes");
    if (!notes) return;

    var box = document.createElement("div");
    box.className = "digiy-driver-client-mini";
    box.innerHTML =
      "<b>📇 Fichier client DRIVER local</b>" +
      "<span>Quand tu ranges une course avec nom ou téléphone, DRIVER garde une trace client sur cet appareil.</span>";

    notes.insertAdjacentElement("beforebegin", box);
  }

  function patchInstanceButtons(target, core) {
    if (!target) return;

    target.addEventListener(
      "click",
      function (event) {
        var actionEl = event.target.closest("[data-action]");
        if (!actionEl) return;

        var action = actionEl.getAttribute("data-action");
        var textArea = target.querySelector(".digiy-oreille-text");
        var status = target.querySelector(".digiy-oreille-status");

        if (!textArea) return;

        if (action === "formulate") {
          window.setTimeout(function () {
            textArea.value = formulateDriverDeep(textArea.value);
            if (status) status.textContent = "Course DRIVER préparée. Complète les champs manquants puis valide.";
          }, 0);
        }

        if (action === "save") {
          window.setTimeout(function () {
            var draft = buildDriverDraft(textArea.value);
            upsertClientFromDraft(draft);

            if (status) {
              status.textContent =
                draft.missing && draft.missing.length
                  ? "Course rangée en brouillon. Il manque : " + draft.missing.join(", ") + "."
                  : "Course rangée. Client local mis à jour si nom ou téléphone présent.";
            }

            if (core && typeof core.showToast === "function") {
              core.showToast("DRIVER rangé en brouillon");
            }
          }, 0);
        }
      },
      true
    );
  }

  function exposeDriverApi(core) {
    window.DigiyOreilleDRIVER = {
      version: VERSION,
      config: DRIVER_CONFIG,
      templates: DRIVER_TEMPLATES.slice(),
      guideText: DRIVER_GUIDE,
      clientsKey: CLIENTS_KEY,

      detect: function (text) {
        return buildDriverDraft(text);
      },

      formulate: function (text) {
        return formulateDriverDeep(text);
      },

      getClients: getClients,
      setClients: setClients,

      saveDraft: function (text) {
        var draft = buildDriverDraft(text);
        var message = formatDriverDraftMessage(draft);

        upsertClientFromDraft(draft);

        if (!core || typeof core.saveNote !== "function") return null;

        return core.saveNote(DRIVER_CONFIG, message, {
          driver_draft: draft,
          trajet: draft
        });
      },

      speakGuide: function () {
        if (core && typeof core.speak === "function") core.speak(DRIVER_GUIDE);
      },

      stopVoice: function () {
        if (core && typeof core.stopVoice === "function") core.stopVoice();
      }
    };
  }

  function mountDriverOreille(core) {
    var target = findMountTarget();

    exposeDriverApi(core);
    injectDriverStyles();

    if (!target) {
      console.info("[DIGIY Oreille DRIVER] Aucun conteneur trouvé. Ajoute <div id=\"digiy-oreille-driver\"></div> pour afficher l’oreille.");
      return;
    }

    if (target.getAttribute("data-digiy-oreille-mounted") === "1") return;

    target.setAttribute("data-digiy-oreille-mounted", "1");

    var instance = core.mount({
      target: target,
      module: DRIVER_CONFIG.module,
      title: DRIVER_CONFIG.title,
      subtitle: DRIVER_CONFIG.subtitle,
      storagePrefix: DRIVER_CONFIG.storagePrefix,
      guideText: DRIVER_CONFIG.guideText,
      templates: DRIVER_CONFIG.templates
    });

    window.DigiyOreilleDRIVER.instance = instance || null;

    addDriverHelp(target);
    addClientPreview(target);
    patchInstanceButtons(target, core);

    console.info("[DIGIY Oreille DRIVER] montée avec succès.");
  }

  function bootDriverOreille() {
    var tries = 0;
    var maxTries = 30;

    function attempt() {
      tries += 1;

      var core = window.DigiyOreilleMetier;

      if (core && typeof core.mount === "function") {
        mountDriverOreille(core);
        return;
      }

      if (tries >= maxTries) {
        console.warn("[DIGIY Oreille DRIVER] Core introuvable. Vérifie que oreille-metier-core.js est chargé avant oreille-driver.js.");
        return;
      }

      window.setTimeout(attempt, 100);
    }

    attempt();
  }

  ready(bootDriverOreille);
})();
