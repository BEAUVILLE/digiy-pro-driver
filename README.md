[README (12).md](https://github.com/user-attachments/files/27980259/README.12.md)# DIGIY DRIVER PRO — V3 Architecture Volants

## Vision

Cette version réorganise l’espace **DIGIY DRIVER PRO** pour alléger l’écran chauffeur.

L’objectif est simple :

> Le chauffeur ouvre une porte, fait une chose, puis revient.  
> Le moteur reste puissant derrière, l’interface reste légère devant.

Cette V3 supprime l’effet “page fourre-tout” et remplace la navigation du bas par une logique plus claire :

- **un header contextuel en haut** ;
- **deux camemberts-volants** ;
- **des pages dédiées par sujet** ;
- **PAY / Mon argent comme simple porte transversale**.

---

## Doctrine d’interface

### 1. Une page = un sujet

Chaque page doit porter une seule intention principale.

| Page | Rôle |
|---|---|
| `index.html` | Porte d’entrée chauffeur |
| `dashboard-pro.html` | Activité immédiate |
| `hub.html` | Répertoire des portes DRIVER |
| `session.html` | Session et accès |
| `alertes.html` | Voix, messages, lecteur DIGIY |
| `trajets.html` | Gestion des trajets |
| `profil-chauffeur.html` | Profil chauffeur |
| `tarifs.html` | Tarifs |
| `generateur-digiy-driver.html` | QR / partage |
| `pin.html` | Accès sécurisé |
| `ma-fiche.html` | Fiche client |
| `cockpit.html` | Archive / redirection douce vers `hub.html` |

---

## Architecture V3

### Fichiers créés

- `hub.html`
- `session.html`
- `alertes.html`

### Fichiers remplacés / allégés

- `index.html`
- `dashboard-pro.html`
- `cockpit.html`

### Fichiers à garder intacts pour l’instant

- `guard.js`
- `trajets.html`
- `profil-chauffeur.html`
- `tarifs.html`
- `pin.html`
- `generateur-digiy-driver.html`
- `ma-fiche.html`
- `claw-tools-driver.js`
- `cockpit-stats.js`
- `devenir-chauffeur.html`
- `driver-zone-now.html`
- `mes-lieux.html`
- `support.html`
- `redirect.html`

---

## Les deux camemberts-volants

### Volant 1 — Conduire

Actions du quotidien :

- Mon activité
- Mes trajets
- Nouvelle note
- Actualiser

### Volant 2 — Piloter

Gestion du module :

- Hub DRIVER
- Ma session
- Mes alertes
- Mon profil
- Mes tarifs
- Mon QR
- Ma fiche client
- Mon accès
- Mon argent

---

## PAY / Mon argent

Dans DRIVER, **PAY ne devient pas un menu lourd**.

PAY reste une porte transversale :

> Si le professionnel est abonné, la porte PAY s’ouvre.  
> Sinon, il est dirigé vers “Commencer à payer”.

Le lien posé dans les volants doit simplement pointer vers :

```html
https://pro-pay.digiylyfe.com/
```

La logique d’abonnement reste côté PAY.

---

## Dashboard V3

`dashboard-pro.html` doit rester très léger.

Il contient seulement :

- un statut session ;
- 2 KPIs :
  - assignées ;
  - en cours ;
- la course active si elle existe ;
- un bouton `Mes trajets` ;
- un bouton `Actualiser`.

Tout le reste part dans les pages dédiées.

---

## Alertes et lecteur DIGIY

Les alertes sont concentrées dans `alertes.html`.

Cette page regroupe :

- alertes vocales DRIVER ;
- alerte message ;
- lecteur DIGIY ;
- tests rapides.

Le dashboard peut afficher une alerte courte, mais ne doit pas porter tout le système.

---

## Navigation

La bottom nav est retirée.

Chaque page utilise un header contextuel court, par exemple :

```text
[ ← activité ] [ MES TRAJETS ] [ ➕ Nouveau ]
```

ou :

```text
[ ← hub ] [ MES ALERTES ] [ 🔔 Toggle ]
```

Le bas de l’écran reste libre pour la lecture.

---

## Ordre de pose recommandé

1. Poser `hub.html`
2. Poser `session.html`
3. Poser `alertes.html`
4. Remplacer `dashboard-pro.html`
5. Remplacer `index.html`
6. Remplacer `cockpit.html`

Ensuite seulement, patcher au fil de l’eau :

- `trajets.html`
- `profil-chauffeur.html`
- `tarifs.html`
- `pin.html`
- `generateur-digiy-driver.html`
- `ma-fiche.html`

---

## Test terrain après pose

À tester sur téléphone :

1. `index.html`
2. entrée PIN
3. `dashboard-pro.html`
4. ouverture volant Conduire
5. ouverture volant Piloter
6. accès `hub.html`
7. accès `session.html`
8. accès `alertes.html`
9. lien PAY / Mon argent
10. retour activité

---

## Doctrine courte

> DRIVER conduit.  
> Le HUB oriente.  
> La SESSION sécurise.  
> Les ALERTES parlent.  
> PAY reste une porte.  
> Le chauffeur garde l’écran libre.

---

## Signature

DIGIY DRIVER PRO  
**L’écosystème direct des métiers pro.**

BY DIGIYLYFE

