import type { Metadata } from "next";
import Link from "next/link";
import { ReopenConsent } from "@/components/reopen-consent";

export const metadata: Metadata = {
  title: "Politique de confidentialité de Ranti",
  description:
    "Comment Ranti collecte, utilise et protège vos données personnelles. Ranti ne traite aucune donnée bancaire.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        &larr; Retour à l’accueil
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 18 juillet 2026
      </p>

      <div className="mt-6 rounded-2xl border border-line-soft bg-muted px-5 py-4 text-sm leading-relaxed text-foreground/80">
        <p>
          <strong>Responsable de traitement :</strong> Adonis KPATINDE, entrepreneur individuel,
          Bénin.
        </p>
        <p className="mt-1">
          <strong>Contact / exercice des droits :</strong>{" "}
          <span className="font-medium text-foreground">kadorel93@gmail.com</span>
        </p>
        <p className="mt-3">
          Ranti ne traite <strong>aucune donnée bancaire</strong> et ne manipule aucun paiement.
        </p>
      </div>

      <div className="mt-10 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Notre principe</h2>
          <p className="mt-2">
            Ranti vous aide à suivre vos loyers, relancer vos locataires et délivrer des
            quittances. Pour cela, nous traitons certaines données personnelles, les vôtres et
            celles de vos locataires, avec le minimum nécessaire. <strong>Nous ne collectons
            aucune coordonnée bancaire et ne traitons aucun flux d’argent</strong>, puisque Ranti
            ne touche jamais aux loyers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Données que nous traitons</h2>
          <p className="mt-2">
            <strong>Vous, propriétaire :</strong>
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              identité et contact : nom, adresse e-mail (via connexion Google), numéro de
              téléphone, pays ;
            </li>
            <li>
              données d’usage : baux, logements, montants de loyer, échéances, paiements que vous
              déclarez, quittances, relances ;
            </li>
            <li>
              données techniques : journaux de connexion, type d’appareil, éventuels cookies
              nécessaires au fonctionnement.
            </li>
          </ul>
          <p className="mt-3">
            <strong>Vos locataires (données que vous renseignez) :</strong>
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>nom, numéro de téléphone, et le cas échéant e-mail ;</li>
            <li>informations liées au bail et aux paiements que vous déclarez.</li>
          </ul>
          <p className="mt-3">
            Vous nous fournissez ces données et <strong>vous garantissez avoir informé le
            locataire</strong> que ses coordonnées sont utilisées pour la gestion de son bail
            (suivi, relances, quittances).
          </p>
          <p className="mt-3">
            <strong>Nous ne traitons pas</strong> de numéros de carte, de comptes bancaires ou
            Mobile Money aux fins d’encaissement. Une référence de transaction que vous
            renseignez sert uniquement de justificatif rattaché à un paiement ; Ranti n’exécute
            aucun paiement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Pourquoi nous les traitons</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              fournir le service : suivi des loyers, préparation et envoi des relances,
              génération des quittances ;
            </li>
            <li>authentifier votre compte et le sécuriser ;</li>
            <li>assurer le support et améliorer le produit ;</li>
            <li>respecter nos obligations légales.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Bases légales</h2>
          <p className="mt-2">
            Selon la réglementation applicable en matière de protection des données personnelles
            (notamment celle applicable au Bénin, sous le contrôle de l’APDP, Autorité de
            Protection des Données Personnelles), nous nous appuyons sur : l’<strong>exécution du
            contrat</strong> (vous fournir le service), notre <strong>intérêt légitime</strong>
            (sécurité, amélioration), le <strong>consentement</strong> lorsqu’il est requis, et le
            <strong> respect d’obligations légales</strong>. Pour les données des locataires, le
            traitement repose sur l’intérêt légitime du propriétaire à gérer son bail, sous sa
            responsabilité.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Qui a accès aux données</h2>
          <p className="mt-2">
            Vos données ne sont <strong>jamais vendues</strong>. Elles peuvent être traitées par
            des prestataires techniques agissant pour notre compte, uniquement pour faire
            fonctionner le service :
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              hébergement et base de données : Supabase (serveurs AWS en Europe, Irlande,
              eu-west-1) ;
            </li>
            <li>authentification : Google ;</li>
            <li>envoi de messages aux locataires : fournisseur WhatsApp / SMS.</li>
          </ul>
          <p className="mt-3">
            Aucun prestataire de paiement n’intervient, puisque Ranti ne manipule pas d’argent.
            Nous pouvons divulguer des données si la loi l’exige.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Le locataire</h2>
          <p className="mt-2">
            Le locataire n’a pas de compte. Il reçoit des liens ponctuels pour confirmer un
            paiement ou consulter une quittance. Il peut confirmer ou contester l’exactitude d’un
            document ; les deux positions sont conservées.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Durée de conservation</h2>
          <p className="mt-2">
            Nous conservons les données tant que votre compte est actif, puis pendant la durée
            nécessaire à nos obligations légales (par exemple comptables) ou à la preuve. Vous
            pouvez demander la suppression de votre compte ; certaines données peuvent être
            conservées le temps légalement requis.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Sécurité</h2>
          <p className="mt-2">
            Nous mettons en œuvre des mesures raisonnables pour protéger vos données (contrôle
            d’accès, chiffrement en transit, cloisonnement par compte). Aucun système n’étant
            infaillible, nous vous invitons à protéger vos identifiants.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Transferts internationaux</h2>
          <p className="mt-2">
            Nos prestataires techniques peuvent héberger des données en dehors de votre pays. Le
            cas échéant, nous veillons à ce que des garanties appropriées encadrent ces transferts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Vos droits</h2>
          <p className="mt-2">
            Vous disposez d’un droit d’<strong>accès</strong>, de <strong>rectification</strong>,
            d’<strong>effacement</strong>, d’<strong>opposition</strong> et de{" "}
            <strong>portabilité</strong> sur vos données, dans les conditions prévues par la loi
            applicable. Pour les exercer, écrivez à{" "}
            <span className="font-medium text-foreground">kadorel93@gmail.com</span>. Vous pouvez
            aussi saisir l’autorité de protection des données compétente (l’APDP au Bénin).
          </p>
          <p className="mt-3">
            Concernant les données de vos locataires, c’est à vous, en tant que propriétaire, de
            relayer et traiter leurs demandes ; nous vous y aidons sur demande.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">11. Cookies</h2>
          <p className="mt-2">
            Nous utilisons uniquement les cookies nécessaires au fonctionnement et à la sécurité
            du service (cookie de session Supabase). Aucun cookie publicitaire ou de tracking
            n’est déposé.
          </p>
          <p className="mt-3">
            Votre consentement est recueilli via Axeptio. Vous pouvez revenir sur vos choix à tout
            moment : <ReopenConsent />.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">12. Mineurs</h2>
          <p className="mt-2">
            Le service s’adresse à des adultes gérant des biens locatifs. Nous ne collectons pas
            sciemment de données de mineurs.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">13. Modifications</h2>
          <p className="mt-2">
            Nous pouvons faire évoluer cette politique. Toute modification substantielle vous sera
            notifiée par email ou via une notification dans l’application.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">14. Contact</h2>
          <p className="mt-2">
            Pour toute question relative à vos données :{" "}
            <span className="font-medium text-foreground">kadorel93@gmail.com</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
