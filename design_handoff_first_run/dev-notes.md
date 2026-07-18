# Prise en main & quittance — notes pour le dev

Maquettes concernées : `templates/first-run/` (espace propriétaire) et `templates/quittance-locataire/` (page publique locataire).

## À câbler (non fonctionnel dans la maquette)

**Quittance (modale propriétaire + page locataire)**
- QR code : grille décorative → générer un vrai QR pointant vers `https://ranti.app/q/<ref>`.
- Lien de vérification : statique (`RNT-2026-0148`) → référence réelle émise par le registre, numérotation séquentielle.
- « Partager sur WhatsApp » : deep link `wa.me/<tel locataire>` avec message pré-rempli + quittance PDF jointe.
- « PDF » / « Télécharger en PDF » : export PDF de la quittance (gabarit identique à la modale).
- Confirmation locataire : locale dans la maquette → POST vers le registre avec horodatage serveur, verrouillage après confirmation.

**Session & reprise**
- Skip (« Passer pour l'instant » / fermeture de l'accueil) et progression de la prise en main : à persister côté serveur pour que la reprise survive à une déconnexion / un changement d'appareil.
- « Se déconnecter » : réinitialise l'état local dans la maquette → vrai signout Supabase (OAuth Google, cf. ADR-010).

**Relances**
- Envoi WhatsApp / SMS simulé (bandeau « Relance envoyée hier ») → moteur de relances réel.
- Support : centre d'aide **Notion** en attendant WhatsApp — câbler l'URL publique du centre d'aide (bouton + liens des guides de la modale « Aide Ranti ») ; à terme, rebrancher le support WhatsApp (`wa.me/22901520000`, numéro placeholder).
- Empreinte SHA-256 : placeholder maquette (`c7a19b4e…d80f42e0`) → hash réel calculé côté serveur à l'émission de la quittance.

## Décisions de design reflétées dans la maquette
- Prise en main jamais bloquante : skip → tableau de bord vide honnête (état `exploration`), reprise possible à tout moment (barre latérale / menu mobile).
- Créer un bail depuis l'état exploration réengage le parcours guidé.
- Une seule action principale sur l'état vide (« Créer un bail »), cf. `docs/welcome-flow.md`.
- Données seed de démonstration : Florentine Dossou / Adjovi Hounkpatin / Villa 3 ch — Fidjrossè / 100 000 FCFA / réf. RNT-2026-0148.
