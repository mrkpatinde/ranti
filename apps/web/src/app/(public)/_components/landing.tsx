"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Clock,
  FileText,
  ArrowRight,
  X,
  ChevronDown,
  Shield,
  Zap,
  Bell,
} from "lucide-react";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

// Inscription propriétaire (téléphone → OTP → /welcome).
const SIGNUP_HREF = "/signup";

const MotionLink = motion.create(Link);

// ─── FaqItem ─────────────────────────────────────────────────────────────────
function FaqItem({
  q,
  a,
  index,
  openIndex,
  setOpenIndex,
}: {
  q: string;
  a: string;
  index: number;
  openIndex: number | null;
  setOpenIndex: (i: number | null) => void;
}) {
  const isOpen = openIndex === index;
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpenIndex(isOpen ? null : index)}
        className="flex w-full items-center justify-between py-5 text-left font-medium text-foreground"
      >
        {q}
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.28 }}>
          <ChevronDown size={18} className="text-muted-foreground flex-shrink-0 ml-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <p className="text-muted-foreground pb-5 leading-relaxed text-sm pr-10">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Logo SVG ────────────────────────────────────────────────────────────────
function RantiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="7" className="fill-foreground" />
      <rect x="8" y="10" width="16" height="2.5" rx="1.25" className="fill-background" />
      <rect x="8" y="15" width="12" height="2.5" rx="1.25" className="fill-background" />
      <rect x="8" y="20" width="8" height="2.5" rx="1.25" className="fill-background" />
    </svg>
  );
}

/** Motif Ranti miniaturisé — 3 barres décroissantes, utilisé comme puce de liste */
function LedgerMark({ className = "text-foreground/30" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="11"
      viewBox="0 0 13 11"
      fill="none"
      aria-hidden="true"
      className={`flex-shrink-0 ${className}`}
    >
      <rect x="0" y="0" width="13" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="4.5" width="9.5" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="9" width="6" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

// ─── Dashboard Card (product visual) ─────────────────────────────────────────
function DashboardCard() {
  const rows = [
    { name: "Aline", unit: "Chambre 1", status: "paid", detail: "Reçu prêt" },
    { name: "Koffi", unit: "Boutique", status: "late", detail: "Relance envoyée" },
    { name: "Mireille", unit: "Appartement", status: "paid", detail: "Reçu envoyé" },
    { name: "Omar", unit: "Studio", status: "paid", detail: "Reçu prêt" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_24px_80px_rgb(0,0,0,0.07)] overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <RantiLogo size={20} />
          <span className="font-semibold text-sm text-foreground">Tableau de bord</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground font-medium">Juin 2026</span>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 border-b border-border bg-muted/20">
        {[
          { label: "Attendus", value: "4", color: "text-foreground" },
          { label: "Payés", value: "3", color: "text-emerald-600" },
          { label: "En retard", value: "1", color: "text-amber-600" },
          { label: "Reçus", value: "2", color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {s.label}
            </span>
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {rows.map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.45, delay: i * 0.08, ease: EASE }}
            className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                {row.name[0]}
              </div>
              <div className="min-w-0">
                <span className="font-medium text-sm text-foreground block truncate">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.unit}</span>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                row.status === "paid"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  : "bg-amber-50 text-amber-700 border border-amber-200/50"
              }`}
            >
              {row.status === "paid" ? "Payé" : "En retard"}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block flex-shrink-0">
              {row.detail}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "Pourquoi Ranti ?",
      a: "Parce que gérer ses loyers sur papier, par WhatsApp ou sur des screenshots Mobile Money, ça fonctionne — jusqu'au jour où ça ne fonctionne plus. Ranti prend en charge les relances et les reçus sans vous imposer un logiciel compliqué. Vous gardez le contrôle, Ranti fait le reste.",
    },
    {
      q: "Mes locataires doivent-ils créer un compte ?",
      a: "Non. Ranti leur envoie un lien par message. Ils cliquent pour confirmer avoir payé, sans créer de compte. Ranti reste votre outil privé.",
    },
    {
      q: "Est-ce que Ranti encaisse les paiements à ma place ?",
      a: "Non. L'argent passe toujours par vous : cash, Mobile Money ou virement. Ranti suit les échéances et relance automatiquement, mais c'est vous qui validez que le paiement a bien été encaissé.",
    },
    {
      q: "Est-ce que Ranti peut confirmer qu'un locataire a payé ?",
      a: "Non. Le locataire peut confirmer via le lien qu'il a payé, mais seul vous validez l'encaissement dans votre espace. Ranti ne valide jamais à votre place.",
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      a: "Oui. Vos données sont chiffrées et hébergées en toute sécurité. Vous seul avez accès à votre espace.",
    },
    {
      q: "Puis-je exporter mes données ?",
      a: "Oui, vous pouvez générer des reçus PDF et consulter l'historique de tous vos paiements et validations.",
    },
  ];

  const heroWords = "Vos loyers, sans confusion.".split(" ");
  const heroContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
  const heroWord = {
    hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
  };

  // Header scroll listener (bordure au scroll)
  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector("header[data-landing-header]");
      if (header) {
        header.setAttribute("data-scrolled", window.scrollY > 10 ? "true" : "false");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <motion.header
        data-landing-header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="fixed top-0 left-0 right-0 h-16 z-50 bg-background/80 backdrop-blur-md border-b border-transparent data-[scrolled=true]:border-border transition-colors"
      >
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <RantiLogo size={26} />
            <span className="font-bold text-lg tracking-tight text-foreground">Ranti</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Se connecter
            </Link>
            <MotionLink
              href={SIGNUP_HREF}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center h-9 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              Commencer
            </MotionLink>
          </div>
        </div>
      </motion.header>

      <main className="flex-grow">
        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center text-center pt-36 pb-0 overflow-hidden">
          {/* Background blobs — slow drift */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] overflow-hidden">
            <motion.div
              animate={{ x: [0, 38, -22, 14, 0], y: [0, -28, 20, -12, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
              className="absolute top-24 left-[12%] w-80 h-80 rounded-full bg-muted/80 blur-[90px]"
            />
            <motion.div
              animate={{ x: [0, -32, 18, -8, 0], y: [0, 24, -32, 12, 0] }}
              transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", repeatType: "mirror", delay: 4 }}
              className="absolute top-8 right-[8%] w-72 h-72 rounded-full bg-muted/60 blur-[80px]"
            />
            <motion.div
              animate={{ x: [0, 20, -28, 10, 0], y: [0, 30, -18, 22, 0], scale: [1, 1.08, 0.96, 1.04, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", repeatType: "mirror", delay: 9 }}
              className="absolute top-40 left-[38%] w-64 h-64 rounded-full bg-muted/50 blur-[100px]"
            />
          </div>

          <div className="relative max-w-4xl mx-auto px-6 flex flex-col items-center">
            {/* Title */}
            <motion.h1
              variants={heroContainer}
              initial="hidden"
              animate="visible"
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-primary leading-[1.0] mb-7"
            >
              {heroWords.map((w, i) => (
                <motion.span key={i} variants={heroWord} style={{ display: "inline-block", marginRight: "0.22em" }}>
                  {w}
                </motion.span>
              ))}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
              className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed mb-10"
            >
              Renseignez vos baux une fois. Ranti suit les échéances, relance automatiquement vos
              locataires et génère les reçus après votre validation.
            </motion.p>

            {/* CTA pill */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65, ease: EASE }}
              className="flex flex-col sm:flex-row items-center gap-3"
            >
              <MotionLink
                href={SIGNUP_HREF}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className="inline-flex items-center gap-2 h-13 px-8 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-md hover:shadow-lg transition-shadow group"
              >
                Ouvrir mon espace propriétaire
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </MotionLink>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Déjà un compte ?
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-4 text-xs text-muted-foreground"
            >
              Gratuit jusqu&apos;à 3 logements · sans carte bancaire
            </motion.p>
          </div>

          {/* Dashboard visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: EASE }}
            className="relative max-w-3xl w-full mx-auto px-6 mt-16"
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              <DashboardCard />
            </motion.div>
            {/* Shadow glow */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-12 bg-foreground/5 blur-2xl rounded-full" />
          </motion.div>
        </section>

        {/* ── ENGAGEMENTS ────────────────────────────────────────────────────── */}
        <section className="pt-28 pb-12">
          <div className="max-w-5xl mx-auto px-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-12"
            >
              Ce sur quoi Ranti est construit
            </motion.p>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            >
              {[
                {
                  icon: <Shield size={18} />,
                  title: "Vous gardez le contrôle",
                  body: "Ranti ne valide jamais un paiement à votre place. Vous seul confirmez qu'un loyer a été encaissé, avant que le reçu soit émis.",
                },
                {
                  icon: <FileText size={18} />,
                  title: "Vos données restent privées",
                  body: "Baux, locataires, encaissements : personne d'autre n'y accède. Données chiffrées, hébergées en sécurité, accessibles uniquement par vous.",
                },
                {
                  icon: <Zap size={18} />,
                  title: "Adapté à votre réalité",
                  body: "Cash, Mobile Money, virement bancaire : tous vos modes de paiement sont pris en charge. Conçu pour fonctionner sans infrastructure bancaire.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
                  className="bg-card px-8 py-8 flex flex-col gap-4"
                >
                  <div className="h-9 w-9 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS — alternating sections ──────────────────────────── */}
        <section className="py-28">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.85, ease: EASE }}
              className="text-center mb-20"
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Comment ça marche ?
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Renseignez le bail. Ranti automatise le suivi.
              </h2>
            </motion.div>

            <div className="flex flex-col gap-24">
              {[
                {
                  num: "01",
                  title: "Renseignez vos logements et vos baux",
                  body: "Ajoutez vos propriétés, logements et locataires. Renseignez le bail : montant du loyer, périodicité, date d'échéance. Ranti génère les échéances automatiquement.",
                  flip: false,
                  visual: (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-medium">
                        Bail · Studio Marcory
                      </p>
                      <div className="space-y-2.5 mb-4">
                        {[
                          { label: "Locataire", value: "Koffi Mensah" },
                          { label: "Loyer mensuel", value: "75 000 FCFA" },
                          { label: "Échéance", value: "Le 5 de chaque mois" },
                          { label: "Début du bail", value: "1 jan. 2025" },
                        ].map((row, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                          >
                            <span className="text-xs text-muted-foreground">{row.label}</span>
                            <span className="text-xs font-semibold text-foreground">{row.value}</span>
                          </div>
                        ))}
                      </div>
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-8 w-full rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground gap-1.5"
                      >
                        + Ajouter un logement
                      </motion.div>
                    </div>
                  ),
                },
                {
                  num: "02",
                  title: "Ranti relance, le locataire confirme",
                  body: "Quand une échéance arrive ou passe en retard, Ranti envoie automatiquement un message au locataire avec un lien de confirmation. Vous êtes informé dès qu'il répond.",
                  flip: true,
                  visual: (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Relance automatique
                      </p>
                      <div className="p-4 rounded-xl bg-muted/40 border border-border">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bell size={14} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Loyer juin · Koffi, Studio</p>
                            <p className="text-sm text-foreground leading-snug">
                              &quot;Votre loyer du 5 juin est dû. Cliquez ici pour confirmer votre
                              paiement.&quot;
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground">Koffi · Studio Marcory</span>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                          En attente
                        </span>
                      </div>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        En attente de confirmation du locataire
                      </motion.div>
                    </div>
                  ),
                },
                {
                  num: "03",
                  title: "Vous validez, le reçu part tout seul",
                  body: "Le locataire a confirmé avoir payé. Vous vérifiez et validez l'encaissement dans votre espace. Ranti génère le reçu PDF et l'envoie automatiquement au locataire.",
                  flip: false,
                  visual: (
                    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                      <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">Vue du mois</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                          Juin 2026
                        </span>
                      </div>
                      {[
                        { name: "Aline", status: "Validé", badge: "bg-emerald-50 text-emerald-700", action: "Reçu PDF" },
                        { name: "Koffi", status: "Confirmé", badge: "bg-blue-50 text-blue-700", action: "Valider" },
                        { name: "Mireille", status: "Validé", badge: "bg-emerald-50 text-emerald-700", action: "Reçu PDF" },
                      ].map((r, i) => (
                        <div
                          key={i}
                          className="px-5 py-3.5 flex items-center justify-between border-b border-border last:border-b-0"
                        >
                          <span className="text-sm font-medium text-foreground">{r.name}</span>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.badge}`}>
                            {r.status}
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                              r.action === "Valider"
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            {r.action}
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center ${
                    step.flip ? "md:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <motion.div
                    className="flex flex-col"
                    initial={{ opacity: 0, y: 60 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "0px" }}
                    transition={{ duration: 0.9, ease: EASE }}
                  >
                    <span className="text-4xl font-bold text-foreground/25 mb-4 font-mono">{step.num}</span>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.body}</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 60 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "0px" }}
                    transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
                  >
                    {step.visual}
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURE GRID ─────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-border bg-muted/15">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.85, ease: EASE }}
              className="text-center mb-16"
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Fonctionnalités
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ce que Ranti fait pour vous.</h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "0px" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
            >
              {[
                { icon: <Bell size={20} />, title: "Relances automatiques", body: "Ranti envoie la relance au bon moment selon les règles du bail. Pas besoin d'y penser." },
                { icon: <Check size={20} />, title: "Confirmation par le locataire", body: "Le locataire reçoit un lien et confirme avoir payé. Vous êtes informé immédiatement." },
                { icon: <Shield size={20} />, title: "Vous validez l'encaissement", body: "Seul vous confirmez qu'un paiement a bien été reçu. Ranti ne valide jamais à votre place." },
                { icon: <FileText size={20} />, title: "Reçus générés automatiquement", body: "Après votre validation, le reçu PDF est créé et envoyé au locataire. Zéro effort." },
                { icon: <Clock size={20} />, title: "Suivi des échéances", body: "Ranti calcule les dates de paiement à partir du bail et les suit mois après mois." },
                { icon: <Zap size={20} />, title: "Adapté au terrain africain", body: "Cash, Mobile Money, virement : tous vos modes de paiement sont suivis dans Ranti." },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-2xl border border-border bg-card shadow-sm flex flex-col gap-4 cursor-default"
                >
                  <div className="h-10 w-10 rounded-xl bg-muted/70 border border-border/60 flex items-center justify-center text-muted-foreground">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CE QUE RANTI N'EST PAS ────────────────────────────────────────── */}
        <section className="py-28 bg-foreground text-background">
          <div className="max-w-5xl mx-auto px-6">
            <motion.h2
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.85, ease: EASE }}
              className="text-3xl md:text-4xl font-bold tracking-tight text-background mb-16 text-center"
            >
              Ce que Ranti n&apos;est pas
            </motion.h2>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "0px" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            >
              {[
                { title: "Pas un logiciel compliqué", body: "Renseignez vos baux en quelques minutes. Ranti prend en charge le suivi dès le premier jour." },
                { title: "Pas une banque", body: "L'argent passe toujours par vous : cash, Mobile Money ou virement. Ranti relance, mais n'encaisse pas." },
                { title: "Pas une marketplace", body: "Vos locataires n'ont pas de compte. Ils reçoivent un lien, confirment, c'est tout." },
                { title: "Pas un outil comptable", body: "Pas de bilan, pas de taxes. Juste vos baux, vos loyers et vos reçus." },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 60 }, visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } } }}
                  className="pt-5 border-t border-background/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <X size={14} className="text-background/50" />
                    <h3 className="font-semibold text-background text-sm">{item.title}</h3>
                  </div>
                  <p className="text-sm text-background/60 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────────── */}
        <section className="py-28 border-b border-border">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.85, ease: EASE }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple et gratuit pour commencer.</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.9, delay: 0.08, ease: EASE }}
              whileHover={{ y: -4 }}
              className="rounded-3xl border border-border bg-card p-8 md:p-12 shadow-sm flex flex-col md:flex-row gap-10 md:gap-16 items-start"
            >
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center h-7 px-3 rounded-full bg-foreground text-background text-xs font-semibold uppercase tracking-wide">
                  Offre de lancement
                </div>
                <div>
                  <h3 className="text-5xl font-bold tracking-tight mb-1">Gratuit</h3>
                  <p className="text-muted-foreground">Jusqu&apos;à 3 logements inclus.</p>
                </div>
                <ul className="space-y-3">
                  {["Toutes les fonctionnalités de base", "Aucune carte bancaire requise", "Support par email"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-3.5 text-sm">
                        <LedgerMark className="text-foreground/40" />
                        <span className="text-foreground font-medium">{item}</span>
                      </li>
                    ),
                  )}
                </ul>
                <div className="pt-5 border-t border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock size={14} />
                    <span>
                      <span className="font-medium text-foreground">À venir :</span> Formule propriétaire (4+
                      logements).
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-start gap-3 w-full md:w-auto">
                <MotionLink
                  href={SIGNUP_HREF}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 350, damping: 22 }}
                  className="inline-flex items-center justify-center h-13 px-8 rounded-full bg-primary text-primary-foreground font-semibold whitespace-nowrap shadow-sm text-sm"
                >
                  Ouvrir mon espace gratuitement
                </MotionLink>
                <p className="text-xs text-muted-foreground">Moins de 2 minutes pour s&apos;inscrire</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── EXPÉRIENCE HUMAINE ───────────────────────────────────────────── */}
        <section className="py-24 border-t border-border">
          <div className="max-w-4xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-start">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px" }}
                transition={{ duration: 0.85, ease: EASE }}
              >
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                  Une expérience humaine, pas seulement un logiciel.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ranti est pensé pour s&apos;adapter à votre vraie manière de gérer les loyers, sans vous
                  imposer une nouvelle façon de faire. Un accompagnement proche du terrain pour bien démarrer
                  et garder le contrôle.
                </p>
              </motion.div>

              <motion.ul
                className="space-y-4 pt-1"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "0px" }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
              >
                {[
                  "Prise en main en moins de dix minutes.",
                  "Un support humain pour bien démarrer.",
                  "Pensé pour les réalités africaines.",
                  "Moins de confusion, plus de tranquillité.",
                  "Construit avec les retours du terrain.",
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } } }}
                    className="flex items-center gap-3.5"
                  >
                    <LedgerMark className="text-foreground/40" />
                    <span className="text-foreground font-medium">{item}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="max-w-2xl mx-auto px-6">
            <motion.h2
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.85, ease: EASE }}
              className="text-3xl font-bold tracking-tight mb-12"
            >
              Questions fréquentes
            </motion.h2>
            <div className="border-y border-border">
              {faqs.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} index={i} openIndex={openIndex} setOpenIndex={setOpenIndex} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
        <section className="py-32 bg-muted/20 border-t border-border">
          <div className="max-w-3xl mx-auto px-6 text-center flex flex-col items-center">
            <motion.h2
              initial={{ opacity: 0, y: 60, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.9, ease: EASE }}
              className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
            >
              Renseignez un bail. Ranti relance, vous validez.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.75, delay: 0.15, ease: EASE }}
              className="text-lg text-muted-foreground mb-10 max-w-md"
            >
              Ajoutez vos logements, renseignez vos baux. Ranti suit les échéances, relance vos locataires et
              génère les reçus après votre validation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.75, delay: 0.28, ease: EASE }}
            >
              <MotionLink
                href={SIGNUP_HREF}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className="inline-flex items-center gap-2 h-14 px-10 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-md hover:shadow-lg transition-shadow group"
              >
                Ouvrir mon espace propriétaire
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </MotionLink>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <RantiLogo size={20} />
            <span className="text-sm font-semibold text-foreground">Ranti</span>
          </Link>
          <p className="text-xs text-muted-foreground">© 2026 Ranti. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Se connecter
            </Link>
            <Link href={SIGNUP_HREF} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Ouvrir un espace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
