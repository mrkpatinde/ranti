// ADR-018 — Intégration Kkiapay, isolée du domaine payments (architecture :
// la logique de calcul/cycle de vie vit dans src/lib/payments ; tout ce qui
// parle à Kkiapay vit ici). Le futur client API (checkout, statut, payout)
// s'ajoutera dans ce dossier.

export { KKIAPAY_SIGNATURE_HEADER, verifyKkiapaySignature } from "./signature"
