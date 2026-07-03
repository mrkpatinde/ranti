import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Ranti",
  description:
    "Conditions générales d'utilisation du service Ranti — registre de loyers.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        &larr; Retour à l&rsquo;accueil
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Conditions d&rsquo;utilisation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 28 juin 2026
      </p>

      <div className="mt-10 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Présentation du service
          </h2>
          <p className="mt-2">
            Ranti est un registre numérique de loyers qui permet aux propriétaires de suivre les paiements de leurs
            locataires, de générer des échéances automatiques, d&rsquo;envoyer des relances et de produire des reçus.
          </p>
          <p className="mt-2">
            Le service est accessible sur <span className="font-medium">https://www.monranti.com</span> et est édité par
            Adonis KPATINDE, entrepreneur individuel basé au Bénin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Inscription et compte
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              L&rsquo;inscription nécessite un numéro de téléphone valide (vérifié par OTP) ou un compte Google.
            </li>
            <li>
              Le propriétaire est responsable de l&rsquo;exactitude des informations fournies (nom, téléphone,
              propriétés, locataires).
            </li>
            <li>
              Chaque compte est strictement personnel. Le partage de compte est interdit.
            </li>
            <li>
              Ranti se réserve le droit de suspendre un compte en cas d&rsquo;utilisation frauduleuse ou abusive.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Obligations du propriétaire
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              Saisir des informations exactes concernant ses biens, ses locataires et les montants de loyer.
            </li>
            <li>
              Obtenir le consentement du locataire avant de renseigner son numéro de téléphone dans Ranti (pour les
              relances automatiques).
            </li>
            <li>
              Valider ou annuler les encaissements déclarés par les locataires dans un délai raisonnable.
            </li>
            <li>
              Ne pas utiliser Ranti pour des activités illégales, frauduleuses ou contraires aux lois en vigueur dans
              l&rsquo;espace UEMOA.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Tarification
          </h2>
          <p className="mt-2">
            Durant la phase pilote, Ranti est gratuit pour les propriétaires participants. Une tarification sera
            communiquée avant toute mise en place de paiement. Actuellement, le tarif prévisionnel est de{" "}
            <strong>300 FCFA par loyer par mois</strong>.
          </p>
          <p className="mt-2">
            Les frais liés aux SMS de relance (envoyés via un fournisseur externe) pourront être facturés séparément
            ou inclus dans l&rsquo;abonnement. Toute modification tarifaire sera annoncée au moins 30 jours à
            l&rsquo;avance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Responsabilité
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              Ranti est un outil de suivi et de relance — il ne garantit pas le paiement effectif des loyers par les
              locataires.
            </li>
            <li>
              Ranti ne remplace pas un contrat de bail écrit entre le propriétaire et le locataire. Le service facilite
              le suivi, mais la relation contractuelle reste entre les parties.
            </li>
            <li>
              Ranti met en œuvre des mesures techniques raisonnables pour assurer la disponibilité du service, mais ne
              peut garantir une disponibilité de 100 %.
            </li>
            <li>
              Ranti ne peut être tenu responsable des dommages indirects (perte de revenus, perte de données) liés à
              l&rsquo;utilisation du service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Relances et messages
          </h2>
          <p className="mt-2">
            En utilisant Ranti, le propriétaire autorise le service à envoyer des SMS ou messages de relance aux
            numéros de téléphone des locataires qu&rsquo;il a renseignés. Le propriétaire est seul responsable
            d&rsquo;avoir obtenu l&rsquo;accord préalable du locataire pour recevoir ces messages.
          </p>
          <p className="mt-2">
            Les messages de relance sont envoyés automatiquement selon des fenêtres prédéfinies (J-5, J-1, J+3, J+10
            par rapport à la date d&rsquo;échéance). Le propriétaire peut désactiver les relances à tout moment depuis
            son tableau de bord.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Propriété intellectuelle
          </h2>
          <p className="mt-2">
            Le nom Ranti, le logo, le code source et l&rsquo;interface utilisateur sont la propriété exclusive
            d&rsquo;Adonis KPATINDE. Toute reproduction, modification ou utilisation non autorisée est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Résiliation
          </h2>
          <p className="mt-2">
            Le propriétaire peut supprimer son compte à tout moment depuis les paramètres de l&rsquo;application.
            Toutes les données associées (profil, propriétés, locataires, baux, encaissements) seront supprimées
            définitivement sous 30 jours.
          </p>
          <p className="mt-2">
            Ranti se réserve le droit de résilier un compte en cas de violation des présentes conditions, après une
            notification préalable de 7 jours restée sans effet.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Droit applicable
          </h2>
          <p className="mt-2">
            Les présentes conditions sont régies par le droit béninois et les règlements applicables dans
            l&rsquo;espace UEMOA. Tout litige sera soumis aux juridictions compétentes de Cotonou (Bénin).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Contact
          </h2>
          <p className="mt-2">
            Pour toute question relative aux présentes conditions d&rsquo;utilisation :
          </p>
          <p className="mt-2">
            Email : <span className="text-foreground font-medium">kadorel93@gmail.com</span>
          </p>
        </section>
      </div>
    </main>
  );
}
