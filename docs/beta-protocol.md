# Ranti — Protocole de beta privée (Sprint 9)

## Statut

Version 1.0 — 2026-07-16. Cadre le Sprint 9 (tests terrain → corrections →
première beta privée). Principe 1 : le terrain gagne toujours — ce document
organise la rencontre entre le produit et la réalité, il ne la remplace pas.

## Objectif du sprint

Vérifier le critère de réussite du MVP (vision.md) sur de VRAIS propriétaires :

> Un propriétaire peut, chaque mois, suivre ses loyers sans registre papier et
> sans confusion.

Le sprint est réussi si des pilotes recrutés hors du premier cercle tiennent un
cycle de loyer complet dans Ranti — et y reviennent au cycle suivant.

---

## 1. Go / no-go avant d'inviter le premier pilote

État constaté le 2026-07-16 (session d'audit) :

| Vérification | État | Comment vérifier |
|---|---|---|
| Boucle cœur en prod (bail → échéances → encaissement → quittance) | ✅ vivante | 6 baux actifs, 6 encaissements confirmés, 6 documents émis en base live |
| Relances : envoi réel + garde-fou de silence | ✅ | `reminder_events` alimentée (ranti-ops, ADR-022) ; garde-fou sur /reminders (v0.3.19.1) |
| Intégrité : rejeu réseau sans double écriture | ✅ | idempotence v0.3.17.0, testée en base live |
| Hors-ligne : bandeau + lecture PWA | ✅ | v0.3.18.0 / v0.3.20.0, vérifiés en navigateur |
| Tarif unique partout, wording conforme | ✅ | audit 2026-07-16 (PR #164) |
| Surfaces publiques prod saines | ☐ à vérifier | `node apps/web/scripts/smoke-prod.mjs` depuis un poste (le réseau de la session d'audit ne joint pas monranti.com) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` posé dans Vercel | ☐ à vérifier | sinon le lien d'assistance du shell est masqué — indispensable en beta |
| ranti-ops opérationnel pendant la beta | ☐ à confirmer | qui envoie les relances chaque jour ? (dépendance assumée, ADR-022) |
| Sauvegarde / retour arrière connus | ☐ à confirmer | procédure de restauration Supabase notée quelque part |

**No-go tant que les ☐ ne sont pas cochés.**

---

## 2. Recrutement des pilotes

- **Cible : 5 à 8 propriétaires** correspondant au persona primaire
  (personas.md) : particulier, 1-20 logements, Bénin, suit aujourd'hui ses
  loyers au cahier/WhatsApp/mémoire, paie et reçoit en Mobile Money.
- **Au moins la moitié hors du premier cercle** (pas famille/amis proches) :
  la politesse fausse les signaux.
- Mix recherché : 1-3 logements (majorité) ET ≥ 8 logements (stress de la
  saisie en lot, #166) ; au moins un pilote peu à l'aise avec le smartphone.
- Engagement demandé au pilote : utiliser Ranti pour ses VRAIS loyers pendant
  2 cycles, un point WhatsApp par semaine, dire ce qui ne va pas sans ménagement.
- Contrepartie : gratuité étendue au-delà des 3 mois offerts, à l'appréciation
  du CEO — jamais de rémunération (ça fausse tout).

## 3. Session d'accueil (par pilote, ~45 min, en présentiel si possible)

1. **Avant d'ouvrir l'app** : poser les questions terrain 1-8 de personas.md
   (comment il suit ses loyers AUJOURD'HUI). Noter ses mots à lui
   (Principe 10 — le lexique de l'interface doit être le sien).
2. **Tâches NON guidées** (observer, ne pas aider avant 2 minutes de blocage) :
   - créer son espace (welcome-flow : objectif < 2 min) ;
   - saisir son portefeuille réel — plusieurs logements, dont les vacants
     (#166 : objectif < 2 min pour 5 logements) ;
   - retrouver « qui a payé, qui doit » sur l'accueil ;
   - simuler : « un locataire vient de vous payer en cash — faites ce qu'il
     faut » (encaisser → quittance → l'envoyer sur WhatsApp) ;
   - faire vérifier la quittance par le locataire (lien /recu, page /verifier).
3. **Grille d'observation** (noter, sans interpréter sur le moment) :
   où il hésite ; ce qu'il tape à côté ; les mots qu'il emploie pour chaque
   concept (bail ? contrat ? papier ?) ; ce qu'il fait AVANT qu'on le lui
   demande ; son téléphone (modèle, réseau, % batterie).
4. Poser les questions 9-12 de personas.md (consentement saisie, relances,
   rôle du locataire, moment de valeur).

## 4. Vie de la beta

- **Canal** : un groupe WhatsApp par pilote (pilote + CEO). Toute friction y
  passe, même « bête ». Réponse < 24 h.
- **Cadence** : point hebdo par pilote (5 min, WhatsApp) + revue métriques
  hebdo (requêtes §5) + tri des frictions en P0/P1/P2 comme l'audit.
- **Corrections** (Sprint 9, item 2) : P0 = sous 48 h ; P1 = dans le sprint ;
  P2 = backlog. Toute correction suit le circuit habituel (branche, tests, PR).
- **Incident grave** (perte de données, quittance fausse) : gel des invitations,
  correction, post-mortem dans docs/decisions avant reprise.

## 5. Métriques (SQL sur les tables métier — aucune instrumentation nouvelle)

L'unique événement produit existant (`login_outside_reminder`) mesure le
Principe 15 ; tout le reste se lit dans le métier. Revue hebdomadaire :

```sql
-- Activation : pilotes avec ≥ 1 bail actif dans les 48 h après inscription
select l.id, l.first_name, min(le.created_at) - l.created_at as delai_premier_bail
from landlords l left join leases le on le.landlord_id = l.id and le.status = 'active'
group by l.id, l.first_name, l.created_at;

-- Boucle complète : encaissements confirmés + document émis, par pilote / semaine
select r.landlord_id, date_trunc('week', r.confirmed_at) as semaine,
       count(*) as encaissements,
       count(q.id) as documents
from rent_receptions r left join receipts q on q.rent_reception_id = r.id and q.status = 'issued'
where r.status = 'confirmed' group by 1, 2 order by 2 desc;

-- Preuve à deux voix : taux d'ouverture / certification des quittances (ADR-013)
select tenant_ack, count(*) from receipts where status = 'issued' group by tenant_ack;

-- Relances : envois ops vs échéances en fenêtre (le garde-fou /reminders doit rester muet)
select date_trunc('week', sent_at) as semaine, count(*) from reminder_events group by 1 order by 1 desc;

-- Utilité mensuelle (Principe 15) : ouvertures hors jours de relance
select date_trunc('week', created_at) as semaine, count(*) from product_events
where event = 'login_outside_reminder' group by 1 order by 1 desc;
```

Seuils indicatifs de fin de sprint (à durcir avec les premières données) :
- ≥ 5 pilotes activés (bail actif < 48 h) ;
- ≥ 4 pilotes ont bouclé un cycle complet (encaissement → quittance envoyée) ;
- ≥ la moitié des quittances ouvertes par le locataire (`read`+`certified`) ;
- 0 déclenchement non résolu du garde-fou de relances ;
- au retour du 2ᵉ cycle : les pilotes reviennent SANS rappel de notre part.

## 6. Signaux qui débloquent les features gatées

| Signal terrain observé | Feature à débloquer |
|---|---|
| Un pilote demande une cadence de relance différente pour UN bail | `lease_reminder_rules` (database.md, ADR-022 critère de réouverture) |
| Perte d'une saisie faute de réseau malgré Phase 2 | File d'écriture offline (#167, hors scope actuel) |
| Des pilotes cherchent l'app « à installer » | Prompt d'installation PWA (décision 2026-07-16 : menu navigateur seulement) |
| ranti-ops déborde (volume de relances) | Réouverture ADR-022 (option B ou industrialisation ops) |
| Litige locataire réel sur une quittance | Prioriser le flux contestation côté propriétaire (ADR-013) |

## 7. Sortie du sprint

Le Sprint 9 se clôt par une note de synthèse dans docs/ (research-log.md) :
ce qui a été confirmé / infirmé des hypothèses de personas.md, les mots réels
des propriétaires, les corrections livrées, et la décision suivante :
**élargir la beta, pivoter un flux, ou geler une hypothèse.**
