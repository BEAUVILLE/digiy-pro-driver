# DIGIY DRIVER PRO — V4 Neurones

## Pourquoi cette V4

La V3 posait une nouvelle navigation, mais elle pouvait encore devenir une sur-couche :
un joli couloir qui mène vers des pages toujours trop chargées.

La V4 corrige cela.

Objectif :

> Ne pas créer un sas devant le labyrinthe.  
> Démonter le labyrinthe.

---

## Doctrine V4

- Une page = un seul sujet.
- Le dashboard ne montre que l’activité immédiate.
- Le hub est un répertoire pur, pas une page de contenu.
- Les alertes vivent dans `alertes.html`.
- La session vit dans `session.html`.
- PAY reste une porte transversale, pas un menu DRIVER.
- La bottom nav disparaît.
- Le header contextuel remplace les menus permanents.

---

## Fichiers du noyau

À poser en premier :

1. `hub.html`
2. `session.html`
3. `alertes.html`
4. `dashboard-pro.html`
5. `index.html`
6. `cockpit.html`

---

## Rôle des pages

| Fichier | Rôle |
|---|---|
| `index.html` | Entrée courte |
| `dashboard-pro.html` | Activité immédiate uniquement |
| `hub.html` | Répertoire des portes |
| `session.html` | Session et accès |
| `alertes.html` | Voix, messages, lecteur DIGIY |
| `cockpit.html` | Ancien cockpit archivé / redirection douce |

---

## Ce qui n’est pas touché

À garder intact pour cette étape :

- `guard.js`
- `trajets.html`
- `profil-chauffeur.html`
- `tarifs.html`
- `pin.html`
- `generateur-digiy-driver.html`
- `ma-fiche.html`
- `claw-tools-driver.js`
- `cockpit-stats.js`

Ces pages seront allégées ensuite une par une.

---

## PAY / Mon argent

Dans DRIVER, PAY reste une simple porte :

```html
https://pro-pay.digiylyfe.com/
```

La logique d’abonnement reste côté PAY.

Si le pro est abonné, PAY ouvre.
Sinon PAY redirige vers commencer à payer.

---

## Test téléphone

Après pose :

1. Ouvrir `index.html`
2. Aller vers `dashboard-pro.html`
3. Vérifier que le bas d’écran est libre
4. Ouvrir `hub.html`
5. Ouvrir `session.html`
6. Ouvrir `alertes.html`
7. Tester la voix
8. Tester `Mes trajets`
9. Tester `Mon argent`
10. Vérifier que `cockpit.html` ne casse pas les anciens liens

---

## Signature courte

DRIVER conduit.
Le HUB oriente.
La SESSION sécurise.
Les ALERTES parlent.
PAY reste une porte.
Le chauffeur garde son cerveau libre.

BY DIGIYLYFE
[README.md](https://github.com/user-attachments/files/27981306/README.md)

