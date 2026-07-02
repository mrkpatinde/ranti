import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Ranti",
  description:
    "Comment Ranti collecte, utilise et protège vos données personnelles.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        &larr; Retour à l&rsquo;accueil
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 28 juin 2026
      </p>

      <div className="mt-10 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Qui sommes-nous
          </h2>
          <p className="mt-2">
            Ranti est un registre de loyers destiné aux propriétaires et
            locataires en Afrique de l&rsquo;Ouest. Le service est édité par
            Adonis KPATINDE, entrepreneur individuel basé au Bénin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Données que nous collectons
          </h2>
          <p className="mt-2">Ranti collecte uniquement les données nécessaires au fonctionnement du service :</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Propriétaire</strong> : numéro de téléphone, nom, prénom, civilité.
            </li>
            <li>
              <strong>Biens immobiliers</strong> : adresse, type de logement, nom du logement.
            </li>
            <li>
              <strong>Locataires</strong> : nom, prénom, téléphone (pour les relances de paiement).
            </li>
            <li>
              <strong>Baux et paiements</strong> : montant du loyer, date d&rsquo;échéance, historique des encaissements.
            </li>
            <li>
              <strong>Données techniques</strong> : adresse email (si connexion Google), identifiant de session, logs de connexion.
            </li>
          </ul>
          <p className="mt-3">
            Nous ne collectons jamais de données bancaires, de pièces d&rsquo;identité, ni de données de géolocalisation précise.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Comment nous utilisons vos données
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Créer et gérer votre compte propriétaire.</li>
            <li>Générer les échéances de loyer et suivre les paiements.</li>
            <li>Envoyer des relances automatiques aux locataires (SMS ou WhatsApp).</li>
            <li>Produire des reçus et quittances.</li>
            <li>Améliorer le service et détecter les anomalies techniques.</li>
          </ul>
          <p className="mt-3">
            Vos données ne sont jamais vendues, louées, ni partagées avec des tiers à des fins commerciales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Base légale du traitement
          </h2>
          <p className="mt-2">
            Le traitement de vos données repose sur l&rsquo;exécution du contrat (fourniture du service Ranti) et sur
            votre consentement explicite lors de la création du compte. Vous pouvez retirer votre consentement à tout
            moment en supprimant votre compte.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Où sont stockées vos données
          </h2>
          <p className="mt-2">
            Ranti utilise Supabase comme infrastructure de base de données. Les serveurs de Supabase sont hébergés en
            Europe (AWS Francfort). Les données sont chiffrées en transit (TLS) et au repos.
          </p>
          <p className="mt-2">
            Les sessions utilisateur sont gérées par Supabase Auth. Aucun mot de passe n&rsquo;est stocké en clair — seuls
            des hashs cryptographiques sont conservés.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Durée de conservation
          </h2>
          <p className="mt-2">
            Vos données sont conservées tant que votre compte est actif. Si vous supprimez votre compte, toutes vos
            données personnelles (profil, propriétés, locataires, baux) sont supprimées définitivement sous 30 jours.
            Les journaux techniques sont conservés 90 jours maximum.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Vos droits
          </h2>
          <p className="mt-2">Conformément aux lois applicables en zone UEMOA, vous disposez des droits suivants :</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Accéder à vos données personnelles.</li>
            <li>Rectifier des données inexactes.</li>
            <li>Supprimer votre compte et toutes les données associées.</li>
            <li>Vous opposer au traitement de vos données.</li>
            <li>Exporter vos données dans un format structuré.</li>
          </ul>
          <p className="mt-3">
            Pour exercer ces droits, contactez-nous à l&rsquo;adresse ci-dessous. Nous répondrons sous 15 jours ouvrés.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Cookies
          </h2>
          <p className="mt-2">
            Ranti utilise uniquement des cookies techniques essentiels au fonctionnement du service (cookie de session
            Supabase). Aucun cookie publicitaire ou de tracking n&rsquo;est déposé.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Contact
          </h2>
          <p className="mt-2">
            Pour toute question relative à cette politique de confidentialité ou pour exercer vos droits :
          </p>
          <p className="mt-2">
            Email : <span className="text-foreground font-medium">kadorel93@gmail.com</span>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Modifications
          </h2>
          <p className="mt-2">
            Cette politique peut être mise à jour. En cas de modification substantielle, vous serez informé par email ou
            via une notification dans l&rsquo;application.
          </p>
        </section>
      </div>
    </main>
  );
}
