/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";

// Page « À propos » : contenu strictement factuel (mêmes faits que les CGU :
// éditeur WI'SOFT SOLUTIONS, posture non-custodiale, contact). Aucun chiffre
// inventé, aucun témoignage : la preuve honnête est une contrainte de marque
// (DESIGN.md). Liée depuis la colonne « Entreprise » du footer landing.

export const metadata: Metadata = {
  title: "À propos de Ranti",
  description:
    "Ranti est le registre de loyer des propriétaires africains, édité au Bénin par WI'SOFT SOLUTIONS. Ranti ne détient et ne transfère aucun fonds.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        &larr; Retour à l'accueil
      </Link>

      <h1 className="mt-8 font-display text-[clamp(2.1rem,4.5vw,2.9rem)] font-extrabold tracking-[-0.02em] text-ink-title">
        À propos de Ranti
      </h1>

      <div className="mt-8 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Ce que fait Ranti</h2>
          <p className="mt-2">
            Ranti est un registre de loyer pensé pour les propriétaires africains. Vous
            encaissez le loyer comme d'habitude : cash, Mobile Money ou virement. Ranti
            tient le registre, relance vos locataires avant l'échéance et édite la
            quittance, confirmée par le locataire et vérifiable en ligne.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Ranti ne touche jamais l'argent
          </h2>
          <p className="mt-2">
            Ranti ne détient et ne transfère aucun fonds. L'argent circule directement
            entre le locataire et vous ; Ranti garde la preuve du paiement, jamais les
            fonds. C'est un service logiciel, pas un service de paiement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Qui édite Ranti</h2>
          <p className="mt-2">
            Ranti est édité au Bénin par <strong>WI'SOFT SOLUTIONS</strong>, société
            enregistrée sous le RCCM RB/COT/20 A 62590, IFU 0202377982188.
          </p>
          <p className="mt-2">
            Une question, une remarque ? Écrivez-nous :{" "}
            <a
              href="mailto:mrkpatinde@gmail.com"
              className="font-medium text-foreground underline underline-offset-2 hover:text-accent transition"
            >
              mrkpatinde@gmail.com
            </a>
          </p>
        </section>
      </div>

      <div className="mt-12 rounded-2xl border border-line-soft bg-muted px-5 py-4 text-sm leading-relaxed text-foreground/80">
        Pour le détail des engagements réciproques, consultez les{" "}
        <Link href="/conditions" className="font-medium text-foreground underline underline-offset-2 hover:text-accent transition">
          conditions d'utilisation
        </Link>{" "}
        et la{" "}
        <Link href="/confidentialite" className="font-medium text-foreground underline underline-offset-2 hover:text-accent transition">
          politique de confidentialité
        </Link>
        .
      </div>
    </main>
  );
}
