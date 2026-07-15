# ADR-019 — Rail FeexPay obligatoire + dépréciation de la saisie assistée

## Statut

Accepté (2026-07-15). **Supersède** ADR-012 (saisie vocale) et ADR-014 (collage
SMS Mobile Money) ; supersède la ligne d'ADR-018 « payin FeexPay à la charge du
locataire ». S'articule avec ADR-018 (cœur transactionnel) et ADR-020
(onboarding bail-centric + dashboard lecture seule).

## Contexte

ADR-018 a posé le rail transactionnel (encaissement via PSP, ledger, split 5 %,
webhooks) comme **option**, à côté des filets universels : alias P2P (ADR-009),
saisie vocale (ADR-012) et collage de SMS Mobile Money (ADR-014), tous assistés
par Gemini pour accélérer la saisie manuelle du propriétaire.

Décision CEO (2026-07-15) : simplifier radicalement le produit. Le rail FeexPay
devient le **chemin d'encaissement unique**, et la saisie assistée (vocale +
collage SMS) est retirée. Le propriétaire ne saisit plus les paiements : il les
**reçoit** via le rail.

## Décision

1. **Relance inchangée** : SMS depuis les échéances (`rent_dues`), cron
   quotidien, zéro IA (ADR-006).

2. **Cash-in = 100 % via FeexPay, montant plein.** Le locataire paie **le loyer
   exact via FeexPay** (aucun paiement partiel sur le rail ; le fractionné est
   **abandonné**). Plus de cash hors-rail sur ce chemin.

3. **Locataire = 0 surcharge.** Le locataire paie exactement le loyer. Les frais
   FeexPay (payin + payout) sont **absorbés dans la commission 5 %** de Ranti —
   ce qui supersède la ligne d'ADR-018 « payin 1,7 % à la charge du locataire ».
   Marge Ranti nette ≈ 2,35 % (aux taux FeexPay archivés par ligne, ADR-018 v4).

4. **Split** : Ranti prélève **5 % tout inclus** (frais FeexPay + commission),
   **95 % net** reversés au propriétaire. Le split fiscal (TVA) reste vision
   comptabilité interne (ADR-018 v5), jamais montré au propriétaire.

5. **Payout vers le rail de réception du propriétaire.** Chaque propriétaire
   définit son rail (MTN MoMo, Moov Money, Celtiis Cash, PI-SPI, virement
   bancaire) ; les 95 % y sont reversés via l'API payout FeexPay.

6. **Quittance** automatique à la confirmation (ADR-007, inchangé).

7. **Dépréciation** : la saisie vocale (ADR-012) et le collage SMS (ADR-014) sont
   **retirés du code** (`lib/sms/*`, `lib/voice/*`, `api/{sms,voice}/collection`,
   composants dashboard `voice-capture` / `sms-ingestion-zone` /
   `validation-bottom-sheet`, `recordSmsCollection`, dépendance
   `GEMINI_API_KEY`). Le dashboard devient lecture seule (ADR-020).

## Conséquences

- Pipeline unique et lisible : relance → cash-in (webhook) → split 5 % →
  quittance → payout. Preuve de paiement automatique, réconciliation propre,
  monétisation transactionnelle.
- Surface réduite : plus de saisie assistée à maintenir, plus de dépendance
  Gemini côté encaissement.
- **Pari portefeuille assumé** : suppose que tout locataire paie le loyer plein
  via FeexPay chaque mois. Le cash et le fractionné ne sont plus captés sur ce
  chemin — décision produit assumée.
- Le « pas d'IA » de Ranti reste une règle **marketing** ; il n'y a plus d'IA
  d'encaissement sous le capot après ce retrait.

## Préconditions (avant activation en production)

- **Détention des fonds (BCEAO)** — résolu côté structure (sous-comptes au nom du
  propriétaire ou externalisation art. 7 avec FeexPay agréé), voir ADR-018
  « caveat juridique ». À confirmer par le contrat FeexPay.
- **Due-diligence FeexPay** : payout tiers multi-rails, split, webhooks signés,
  idempotence, sandbox (checklist produite le 2026-07-15).

## Notes de séquencement

- Le **retrait** de la saisie assistée est livré immédiatement (cette décision).
- Le **rail** (checkout cash-in + payout + réconciliation) reste à construire ;
  tant qu'il n'est pas en production, l'encaissement se limite au suivi lecture
  seule. Ne pas retirer un chemin de capture avant que le rail soit live et
  adopté a été pesé et tranché en faveur du retrait (décision CEO).
