import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation de Ranti",
  description:
    "Conditions générales d'utilisation du service Ranti, registre de loyers. Ranti ne détient et ne transfère aucun fonds.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        &larr; Retour à l’accueil
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Conditions générales d’utilisation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 18 juillet 2026
      </p>

      <div className="mt-6 rounded-2xl border border-line-soft bg-muted px-5 py-4 text-sm leading-relaxed text-foreground/80">
        <p>
          <strong>Éditeur :</strong> WI&apos;SOFT SOLUTIONS, RCCM RB/COT/20 A 62590, IFU 0202377982188, Bénin
          (ci-après « <strong>Ranti</strong> », « nous »).
        </p>
        <p className="mt-1">
          <strong>Contact :</strong>{" "}
          <span className="font-medium text-foreground">mrkpatinde@gmail.com</span>
        </p>
        <p className="mt-3">
          Ranti ne détient et ne transfère aucun fonds : ces conditions décrivent un
          service logiciel, pas un service de paiement.
        </p>
      </div>

      <div className="mt-10 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Objet</h2>
          <p className="mt-2">
            Ranti est un outil en ligne qui aide les propriétaires à <strong>suivre leurs
            loyers, relancer leurs locataires et délivrer des quittances</strong>. Ranti
            n’encaisse pas les loyers, ne détient aucun fonds et n’intervient jamais dans les
            paiements : l’argent circule directement entre le propriétaire et son locataire.
          </p>
          <p className="mt-2">
            Les présentes conditions régissent l’accès et l’utilisation du service. En créant
            un compte, vous les acceptez.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Définitions</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Utilisateur / Propriétaire</strong> : la personne qui crée un compte pour
              gérer ses loyers.
            </li>
            <li>
              <strong>Locataire</strong> : la personne redevable d’un loyer, renseignée par le
              Propriétaire. Le Locataire n’a pas de compte ; il reçoit des liens ponctuels
              (confirmation, quittance).
            </li>
            <li>
              <strong>Bail</strong> : l’accord locatif renseigné dans Ranti (loyer, échéance,
              logement).
            </li>
            <li>
              <strong>Relance</strong> : message de rappel préparé ou envoyé au Locataire (par
              exemple via WhatsApp ou SMS).
            </li>
            <li>
              <strong>Quittance</strong> : document attestant d’un paiement, généré après
              validation du Propriétaire.
            </li>
            <li>
              <strong>Abonnement</strong> : la formule payante du service au-delà de l’offre
              gratuite.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Ce que Ranti fait et ne fait pas
          </h2>
          <p className="mt-2">
            Ranti <strong>fournit</strong> : le suivi des baux et des échéances, la préparation
            et l’envoi de relances, la génération de quittances et de reçus, un journal des
            paiements déclarés, un tableau de bord.
          </p>
          <p className="mt-2">Ranti <strong>ne fournit pas</strong> et n’est pas :</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>un service d’encaissement ou de transfert d’argent ;</li>
            <li>une banque, un établissement de paiement ou de monnaie électronique ;</li>
            <li>un agent de recouvrement ;</li>
            <li>un conseil juridique, comptable ou fiscal.</li>
          </ul>
          <p className="mt-3">
            <strong>Ranti ne reçoit, ne détient et ne transfère jamais les loyers.</strong> Le
            Propriétaire reste seul responsable de la perception effective de ses loyers et des
            suites d’un impayé.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Compte</h2>
          <p className="mt-2">
            L’accès nécessite la création d’un compte via connexion Google. Vous vous engagez à
            fournir des informations exactes, à garder vos identifiants confidentiels et à nous
            signaler tout usage non autorisé. Vous êtes responsable de l’activité réalisée depuis
            votre compte.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Responsabilités de l’Utilisateur
          </h2>
          <p className="mt-2">En utilisant Ranti, vous garantissez :</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>disposer du droit de gérer les biens et les baux renseignés ;</li>
            <li>
              que les informations saisies (baux, montants, paiements déclarés) sont exactes ;
            </li>
            <li>
              <strong>détenir le droit de contacter chaque Locataire</strong> dont vous
              renseignez les coordonnées, et l’avoir informé que ses données sont traitées pour
              la gestion du bail ;
            </li>
            <li>
              respecter les lois locatives, fiscales et de protection des données applicables là
              où vous exercez.
            </li>
          </ul>
          <p className="mt-3">
            Vous êtes seul responsable du contenu que vous ajoutez et des décisions que vous
            prenez à partir des informations affichées.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Relances aux Locataires</h2>
          <p className="mt-2">
            Vous autorisez Ranti à préparer et, le cas échéant, envoyer des relances à vos
            Locataires en votre nom. Vous êtes responsable de la légitimité de ces envois et du
            respect des règles applicables aux communications (consentement, horaires, fréquence).
            Ranti n’est pas responsable du contenu que vous validez ni des suites d’une relance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Quittances et documents</h2>
          <p className="mt-2">
            Les quittances et reçus sont générés <strong>à partir des informations que vous
            validez</strong>. Vous êtes responsable de leur exactitude. La confirmation par le
            Locataire renforce la valeur probante du document, mais Ranti ne garantit pas sa
            qualification juridique dans toutes les juridictions. En cas de désaccord, Ranti
            documente les deux positions sans trancher.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Abonnement et paiement du service
          </h2>
          <p className="mt-2">
            Ranti propose une <strong>offre gratuite pour un logement</strong>, puis un{" "}
            <strong>abonnement</strong> pour un usage étendu. Le prix, la périodicité et les
            modalités de l’abonnement sont indiqués au moment de la souscription.
          </p>
          <p className="mt-2">
            L’abonnement rémunère <strong>uniquement le service logiciel</strong>. Ranti ne
            prélève <strong>aucune commission sur vos loyers</strong>. Sauf disposition légale
            contraire, les sommes versées au titre de l’abonnement ne sont pas remboursables au
            prorata en cas de résiliation anticipée.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Propriété intellectuelle</h2>
          <p className="mt-2">
            Ranti, sa marque, son interface et ses contenus sont protégés. Nous vous concédons un
            droit d’usage personnel, non exclusif et non transférable, limité à la durée de votre
            utilisation. Vos données vous appartiennent ; vous nous concédez le droit de les
            traiter pour fournir le service (voir la Politique de confidentialité).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Disponibilité et absence de garantie
          </h2>
          <p className="mt-2">
            Le service est fourni « en l’état » et « selon disponibilité ». Nous nous efforçons
            d’assurer sa continuité mais ne garantissons pas une disponibilité ininterrompue ni
            l’absence d’erreurs. Des interruptions pour maintenance ou raisons techniques peuvent
            survenir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Limitation de responsabilité
          </h2>
          <p className="mt-2">
            Dans les limites permises par la loi, Ranti ne saurait être tenu responsable des
            pertes indirectes, ni des conséquences d’un impayé, d’une relance, d’une donnée
            erronée saisie par vous, ou d’un litige entre vous et un Locataire. Ranti n’étant
            jamais partie au paiement, il n’assume aucune responsabilité relative aux flux
            d’argent entre vous et vos Locataires.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">12. Suspension et résiliation</h2>
          <p className="mt-2">
            Vous pouvez cesser d’utiliser Ranti à tout moment. Nous pouvons suspendre ou clôturer
            un compte en cas de manquement aux présentes conditions ou d’usage illicite. En cas de
            clôture, vous pouvez demander l’export de vos données dans un délai raisonnable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">13. Modification des conditions</h2>
          <p className="mt-2">
            Nous pouvons modifier ces conditions. Les changements substantiels vous seront
            notifiés. La poursuite de l’utilisation après notification vaut acceptation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">14. Droit applicable et litiges</h2>
          <p className="mt-2">
            Les présentes conditions sont régies par le droit béninois et les règlements
            applicables dans l’espace UEMOA. À défaut de résolution amiable, tout litige relève
            des tribunaux compétents de Cotonou (Bénin).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">15. Contact</h2>
          <p className="mt-2">
            Pour toute question relative aux présentes conditions :{" "}
            <span className="font-medium text-foreground">mrkpatinde@gmail.com</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
