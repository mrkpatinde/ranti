# ADR-019 — Rail FeexPay obligatoire (cash-in unique)

## Statut

Acceptée — décision CEO 2026-07-15 (rédigée 2026-07-16).
**Activation en production conditionnée à la levée du gate juridique BCEAO**
(voir « Conséquences → Gate BCEAO »). Tant que le gate n'est pas levé, le rail
reste en sandbox et l'app décrit le chemin d'encaissement réellement disponible.

Supersède **ADR-012** (saisie vocale Gemini) et **ADR-014** (collage SMS
Mobile Money) : ces deux voies de capture sont retirées.
Amende **ADR-009** (l'alias de paiement PI-SPI n'est plus le chemin principal ;
il devient le filet de repli) et **ADR-018** (confirme FeexPay comme PSP retenu
et pose le rail comme cash-in **unique**, là où ADR-018 laissait coexister
plusieurs voies d'encaissement).
Réalisée en partie par **ADR-020** (dashboard lecture seule + onboarding
bail-centric).

## Contexte

ADR-018 a posé le cœur transactionnel (ledger `payment_transactions`, webhook
signé, modèle « All-Inclusive 5 % » : le propriétaire voit 5 % tout compris et
reçoit 95 % du net, les frais PSP étant des dépenses internes de Ranti). Sa
révision v4 a retenu **FeexPay** comme PSP (« le moins cher sur tous les plans »,
appréciation terrain). Mais ADR-018 laissait plusieurs chemins d'encaissement
coexister : rail PSP, alias PI-SPI direct (ADR-009), collage SMS (ADR-014),
saisie vocale (ADR-012), plus le formulaire manuel.

Cette multiplicité crée de la dette produit : plusieurs façons d'enregistrer un
loyer, des surfaces IA (vocal) à maintenir, un dashboard chargé de saisie, et un
message ambigu au locataire (« payez direct / gratuit » vs « payez via le rail,
95 % reversé »). Décision CEO : **un seul rail d'encaissement**, le reste devient
mémoire (lecture) ou filet.

## Décision

1. **Rail FeexPay = chemin d'encaissement unique.** Le locataire paie **100 % du
   loyer** (montant plein) via le checkout FeexPay. **Zéro surcharge locataire** :
   les frais PSP (payin + payout) sont absorbés par Ranti dans sa commission.

2. **Économie (modèle All-Inclusive 5 %, inchangé depuis ADR-018 v4/v5).** La
   commission de 5 % (TTC, TVA 18 % incluse — ADR-018 v5) est prélevée sur le
   brut ; **95 % net** sont reversés au propriétaire via l'**API payout FeexPay**,
   vers le **rail de réception** qu'il définit (MTN MoMo, Moov Money, Celtiis
   Cash, alias PI-SPI, compte bancaire). Frais FeexPay par défaut : 170 bp payin
   + 100 bp payout → **marge nette Ranti ≈ 2,35 %** (dépenses internes, invisibles
   du propriétaire par grants au niveau colonne).

3. **Le paiement fractionné est abandonné** côté UX (un loyer = un paiement du
   montant plein, cohérent avec le match exact ADR-018). La structure ledger
   `rent_reception_allocations` est **conservée** (historique, pas de migration
   destructive).

4. **Retrait des voies de capture superflues :** collage SMS Mobile Money
   (ADR-014) et saisie vocale Gemini (ADR-012) sont retirés. Cible de nettoyage :
   `lib/sms/*`, `lib/voice/*`, `api/sms/collection`, `api/voice/collection`, les
   composants dashboard `sms-ingestion-zone.tsx` + `voice-capture.tsx`, la
   `validation-bottom-sheet.tsx`, et la variable d'env `GEMINI_API_KEY`.

5. **Dashboard = lecture seule** (qui a payé / qui doit), **onboarding = créer un
   bail** (entrée de création unique). *Réalisé par ADR-020.*

6. **Relances inchangées** : SMS depuis les échéances (`rent_dues`, ADR-006),
   sans IA.

7. **Alias PI-SPI (ADR-009) = filet de repli**, plus le chemin principal. Il reste
   utile là où le rail FeexPay n'est pas encore disponible ou pendant la période
   gate BCEAO, mais il n'est plus la promesse produit centrale.

## Conséquences

- **« Ranti ne détient jamais les fonds » est abandonné comme cible produit.**
  Sous le rail, les fonds transitent par le wallet marchand FeexPay avant le
  payout ; le propriétaire reçoit 95 %. Le wording de l'app (pages alias /
  encaissement / page locataire `confirmer`) devra être aligné sur ce modèle une
  fois le rail live — en retirant « de compte à compte / Ranti ne touche jamais
  l'argent / 100 % » et en conservant ce qui reste vrai (**0 surcharge
  locataire**, paiement en un geste).

- **Gate BCEAO (bloquant avant la prod du payout).** La détention transitoire des
  fonds via le wallet marchand FeexPay peut qualifier Ranti d'établissement de
  paiement (Instruction BCEAO 001-01-2024). Deux pistes pour rester conforme sans
  agrément propre : (a) **sous-comptes cloisonnés par propriétaire** chez le PSP,
  ou (b) **contrat d'externalisation art. 7** avec FeexPay (partenariat sous
  l'agrément de FeexPay). Le gate doit être levé **avant** toute activation du
  payout en production.

- **Pont de capture (question ouverte).** Entre le retrait des voies manuelles
  (SMS/vocal) et le rail FeexPay live, faut-il garder l'encaissement manuel
  (`/collections/new`) comme filet ? À trancher : sans lui, aucun encaissement
  n'est possible tant que le gate BCEAO n'est pas levé.

- **Cap de mise en production** visé : semaine du **2026-07-22**, **sous réserve**
  de la levée du gate BCEAO.

- Le glossaire (« Alias PI-SPI ») et le modèle de domaine restent valides pour le
  filet alias ; à réviser quand le rail sera la surface principale.
