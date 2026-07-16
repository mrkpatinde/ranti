/* eslint-disable react/no-unescaped-entities */
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RantiLogo } from "@/components/ranti-logo";
import quittanceDemo from "../../../../public/quittance-demo.png";

const SIGNUP_HREF = "/signup";

// Landing minimale : un titre, une phrase, un bouton, puis le produit.
// Le visuel n'est pas une maquette : public/quittance-demo.png est rendu
// par le vrai composant ReceiptPdf avec les données de /verifier/demo
// (regénérer via apps/web/scripts/generate-demo-quittance.tsx).
export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f9f8f6] text-[#292929]">
      <header className="px-6 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <RantiLogo size={28} />
            <span className="font-display text-lg font-extrabold tracking-tight">Ranti</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#72726e] transition hover:bg-[#f2f6e1] hover:text-[#292929]"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 pb-24 pt-14 text-center md:pt-24">
        <h1 className="lp-rise font-display mx-auto max-w-2xl text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] sm:text-5xl md:text-6xl [text-wrap:balance]">
          Le registre de loyer des propriétaires africains.
        </h1>

        <p className="lp-rise lp-rise-2 mx-auto mt-6 max-w-xl text-lg leading-8 text-[#72726e]">
          Vous encaissez le loyer. Ranti édite la quittance, votre locataire la confirme.
        </p>

        <div className="lp-rise lp-rise-3 mt-9">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5b6f00] px-7 py-4 text-base font-semibold text-[#fcfcf8] shadow-[0_6px_16px_-6px_rgba(91,111,0,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 hover:bg-[#4c5616] hover:shadow-[0_16px_34px_-12px_rgba(91,111,0,0.55)]"
          >
            Gérer vos loyers
            <ArrowRight size={18} strokeWidth={1.8} />
          </Link>
          {/* Tarif unique — contrainte de marque verrouillée (DESIGN.md). */}
          <p className="mt-4 text-sm text-[#72726e]">
            3 mois gratuits, puis 5 % sur chaque paiement de loyer réussi.
          </p>
        </div>

        {/* Le produit : la quittance elle-même (spécimen recadré sur son
            contenu par le script de génération). Pas de lp-rise ici : c'est
            l'élément LCP, il doit peindre immédiatement. Cliquer = vérifier. */}
        <div className="mx-auto mt-14 max-w-2xl md:mt-20">
          <Link href="/verifier/demo" className="group block" aria-label="Vérifier cette quittance d'exemple en ligne">
            <div className="overflow-hidden rounded-[10px] border border-[#d5d5d2] bg-white shadow-[0_24px_80px_-28px_rgba(41,41,41,0.32)] transition duration-300 ease-out group-hover:-translate-y-1 motion-reduce:group-hover:translate-y-0 group-hover:shadow-[0_32px_90px_-28px_rgba(41,41,41,0.38)]">
              <Image
                src={quittanceDemo}
                alt="Quittance de loyer Ranti n° RNT-2026-DEMO (spécimen), certifiée par le locataire, avec QR de vérification"
                priority
                sizes="(max-width: 768px) 100vw, 672px"
                className="h-auto w-full"
              />
            </div>
          </Link>
          <p className="mt-5 text-sm text-[#72726e]">
            Quittance d'exemple n° RNT-2026-DEMO. La vôtre vous attend.{" "}
            <Link href={SIGNUP_HREF} className="font-semibold text-[#5b6f00] underline-offset-4 hover:underline">
              Créer votre compte
            </Link>
          </p>
        </div>
      </main>

      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#72726e]">
          <span className="font-display font-extrabold tracking-tight text-[#72726e]">Ranti</span>
          <Link href="/conditions" className="transition hover:text-[#292929]">Conditions</Link>
          <Link href="/confidentialite" className="transition hover:text-[#292929]">Confidentialité</Link>
        </div>
      </footer>
    </div>
  );
}
