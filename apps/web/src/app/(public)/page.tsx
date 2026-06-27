"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { Check, Clock, FileText, ArrowRight, X, ChevronDown } from "lucide-react"

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

const FadeIn = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay, ease: EASE }}
    className={className}
  >
    {children}
  </motion.div>
)

function FaqItem({
  q,
  a,
  index,
  openIndex,
  setOpenIndex,
}: {
  q: string
  a: string
  index: number
  openIndex: number | null
  setOpenIndex: (i: number | null) => void
}) {
  const isOpen = openIndex === index
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpenIndex(isOpen ? null : index)}
        className="flex w-full items-center justify-between py-6 text-left text-lg font-medium text-foreground"
      >
        {q}
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown size={20} className="flex-shrink-0 text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <p className="pb-6 pr-8 leading-relaxed text-muted-foreground">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Home() {
  const heroTitle = "Vos loyers, sans confusion."
  const words = heroTitle.split(" ")

  const heroContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  }
  const heroWordVariants = {
    hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: EASE },
    },
  }

  const lineRef = useRef(null)
  const lineInView = useInView(lineRef, { once: true, margin: "-100px" })

  const stepContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
  }
  const stepVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  }

  const rowVariants = {
    hidden: { opacity: 0, x: 24 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, delay: i * 0.12, ease: EASE },
    }),
  }

  const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  }

  const notRantiContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  }
  const notRantiItemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  }

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const faqs = [
    {
      q: "Mes locataires doivent-ils créer un compte ?",
      a: "Non. Ranti est votre outil privé. Vos locataires n'ont pas besoin de s'inscrire.",
    },
    {
      q: "Est-ce que Ranti encaisse les loyers à ma place ?",
      a: "Non. L'argent passe toujours par vous : cash, Mobile Money, virement. Ranti vous aide seulement à garder la trace de ce qui a été encaissé.",
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      a: "Oui. Vos données sont chiffrées et hébergées en toute sécurité. Vous seul avez accès à votre espace.",
    },
    {
      q: "Est-ce que ça fonctionne sans connexion stable ?",
      a: "Ranti fonctionne depuis un navigateur web. Une connexion de base suffit. Une version mobile optimisée est en préparation.",
    },
    {
      q: "Puis-je retrouver l'historique de mes loyers ?",
      a: "Oui. Vous générez des quittances et consultez l'historique de tous vos encaissements, échéance par échéance.",
    },
  ]

  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector("header")
      if (!header) return
      if (window.scrollY > 10) header.setAttribute("data-scrolled", "true")
      else header.removeAttribute("data-scrolled")
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-transparent bg-background/80 backdrop-blur-md transition-colors duration-300 data-[scrolled=true]:border-border"
      >
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="32" height="32" rx="7" className="fill-primary" />
              <rect x="8" y="10" width="16" height="2.5" rx="1.25" className="fill-primary-foreground" />
              <rect x="8" y="15" width="12" height="2.5" rx="1.25" className="fill-primary-foreground" />
              <rect x="8" y="20" width="8" height="2.5" rx="1.25" className="fill-primary-foreground" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-primary">Ranti</span>
          </Link>
          <nav>
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Se connecter
            </Link>
          </nav>
        </div>
      </motion.header>

      <main className="flex-grow pb-16 pt-32">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 md:pb-28">
          <motion.h1
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight text-primary md:text-6xl lg:text-[4rem]"
          >
            {words.map((word, i) => (
              <motion.span key={i} variants={heroWordVariants} style={{ display: "inline-block", marginRight: "0.25em" }}>
                {word}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
          >
            Ranti aide les propriétaires à voir qui a payé, qui est en retard et quelle preuve existe — avant toute relance.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/signup"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-8 font-medium text-primary-foreground transition-transform hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:w-auto"
            >
              Ouvrir mon espace propriétaire
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-md border border-input bg-transparent px-8 font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              Se connecter
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
            className="mt-5 max-w-md text-sm text-muted-foreground"
          >
            Pensé pour les propriétaires qui suivent leurs loyers avec WhatsApp, un cahier, des appels ou des captures Mobile Money.
          </motion.p>
        </section>

        {/* Comment ça marche */}
        <section className="border-t border-border py-24">
          <div className="mx-auto max-w-5xl px-6">
            <FadeIn>
              <h2 className="mb-16 text-3xl font-bold">Trois étapes, c&apos;est tout.</h2>
            </FadeIn>

            <motion.div
              variants={stepContainerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="relative grid grid-cols-1 gap-12 md:grid-cols-3"
            >
              <motion.div
                ref={lineRef}
                style={{ transformOrigin: "left" }}
                initial={{ scaleX: 0 }}
                animate={lineInView ? { scaleX: 1 } : {}}
                transition={{ duration: 0.8, ease: "easeInOut", delay: 0.2 }}
                className="absolute left-[10%] right-[10%] top-6 z-0 hidden h-px bg-border/50 md:block"
              />

              <motion.div variants={stepVariants} className="relative z-10 flex flex-col">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-muted-foreground shadow-sm">01</div>
                <h3 className="mb-3 text-xl font-semibold">Ajoutez vos logements</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Créez vos propriétés, vos logements et vos locataires en quelques minutes, puis posez le bail.
                </p>
              </motion.div>

              <motion.div variants={stepVariants} className="relative z-10 flex flex-col">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-muted-foreground shadow-sm">02</div>
                <h3 className="mb-3 text-xl font-semibold">Enregistrez vos encaissements</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Cash, Mobile Money, virement : vous notez ce qui a été encaissé et vous joignez une preuve si vous l&apos;avez.
                </p>
              </motion.div>

              <motion.div variants={stepVariants} className="relative z-10 flex flex-col">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-muted-foreground shadow-sm">03</div>
                <h3 className="mb-3 text-xl font-semibold">Gardez une vue claire</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Chaque mois, vous voyez qui a payé, qui est en retard, et vous générez une quittance en un clic.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Aperçu produit */}
        <section className="mx-auto mb-32 max-w-4xl px-6 pt-16">
          <FadeIn delay={0.1}>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between border-b border-border bg-card px-6 py-5">
                <h3 className="font-semibold text-card-foreground">Ce mois-ci</h3>
                <div className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">Novembre</div>
              </div>

              <div className="grid grid-cols-2 gap-6 border-b border-border bg-muted/30 px-6 py-4 text-sm md:grid-cols-4 md:gap-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Attendus</span>
                  <span className="text-lg font-medium text-foreground">8 loyers</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payés</span>
                  <span className="text-lg font-medium text-emerald-700 dark:text-emerald-400">5</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En retard</span>
                  <span className="text-lg font-medium text-amber-600 dark:text-amber-500">3</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quittances prêtes</span>
                  <span className="text-lg font-medium text-foreground">2</span>
                </div>
              </div>

              <div className="divide-y divide-border overflow-hidden bg-card">
                <motion.div custom={0} variants={rowVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center">
                  <div className="flex min-w-[150px] flex-1 flex-col">
                    <span className="font-medium text-foreground">Aline</span>
                    <span className="mt-0.5 text-sm text-muted-foreground">Chambre 1</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start sm:justify-center">
                    <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">Payé</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start text-sm text-muted-foreground sm:justify-end">
                    <span className="flex items-center gap-1.5"><FileText size={14} className="text-muted-foreground/70" /> Quittance prête</span>
                  </div>
                </motion.div>

                <motion.div custom={1} variants={rowVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center">
                  <div className="flex min-w-[150px] flex-1 flex-col">
                    <span className="font-medium text-foreground">Koffi</span>
                    <span className="mt-0.5 text-sm text-muted-foreground">Boutique</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start sm:justify-center">
                    <span className="inline-flex items-center rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">En retard</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start text-sm sm:justify-end">
                    <span className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-medium text-foreground">Encaisser</span>
                  </div>
                </motion.div>

                <motion.div custom={2} variants={rowVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="flex flex-col justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center">
                  <div className="flex min-w-[150px] flex-1 flex-col">
                    <span className="font-medium text-foreground">Mireille</span>
                    <span className="mt-0.5 text-sm text-muted-foreground">Appartement</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start sm:justify-center">
                    <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">Payé</span>
                  </div>
                  <div className="flex flex-1 items-center justify-start text-sm text-muted-foreground sm:justify-end">
                    <span className="flex items-center gap-1.5"><Check size={14} className="text-muted-foreground/70" /> Preuve disponible</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </FadeIn>
        </section>

        {/* Ce que Ranti clarifie */}
        <section className="border-y border-border bg-muted/30 py-24">
          <div className="mx-auto max-w-5xl px-6">
            <FadeIn>
              <h2 className="mb-12 text-2xl font-bold">La clarté, un mois après l&apos;autre.</h2>
            </FadeIn>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
              <FadeIn delay={0.1} className="flex flex-col">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm">
                  <Check size={18} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Qui a payé</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Vous voyez en un coup d&apos;œil les encaissements confirmés du mois.
                </p>
              </FadeIn>
              <FadeIn delay={0.2} className="flex flex-col">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm">
                  <Clock size={18} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Qui est en retard</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Vous identifiez immédiatement les échéances non réglées.
                </p>
              </FadeIn>
              <FadeIn delay={0.3} className="flex flex-col">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm">
                  <FileText size={18} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Quelle preuve existe</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Capture, reçu ou note : chaque encaissement est tracé.
                </p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Adapté au terrain */}
        <section className="py-24">
          <div className="mx-auto max-w-5xl px-6">
            <FadeIn>
              <h2 className="mb-10 text-3xl font-bold">Adapté à votre façon de travailler</h2>
            </FadeIn>
            <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
              <motion.ul variants={listVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="space-y-4">
                {[
                  "Cash",
                  "Mobile Money",
                  "Virement bancaire",
                  "Preuves par capture d'écran",
                  "Quittances simples",
                  "Propriétaires de 1 à 20 logements",
                ].map((item, i) => (
                  <motion.li key={i} variants={itemVariants} className="flex items-center gap-3 text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    <span className="text-lg">{item}</span>
                  </motion.li>
                ))}
              </motion.ul>

              <FadeIn delay={0.2} className="flex items-start">
                <div className="rounded-lg border border-border bg-muted/20 p-6">
                  <p className="font-medium leading-relaxed text-foreground">
                    Le propriétaire reste celui qui valide chaque encaissement.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Ranti ne confirme rien automatiquement. Vous gardez le contrôle total sur ce qui est marqué comme payé ou en retard.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Ce que Ranti n'est pas */}
        <section className="bg-foreground py-24 text-background">
          <div className="mx-auto max-w-5xl px-6">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7 }}
              className="mb-12 text-3xl font-bold text-background"
            >
              Ce que Ranti n&apos;est pas
            </motion.h2>

            <motion.div variants={notRantiContainerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { t: "Pas un logiciel compliqué", d: "Aucune configuration complexe. Vous ajoutez vos logements et vous commencez." },
                { t: "Pas une banque", d: "L'argent ne passe pas par nous. Vous encaissez comme d'habitude." },
                { t: "Pas une marketplace", d: "Vos locataires ne créent pas de compte. C'est votre outil privé." },
                { t: "Pas un outil comptable", d: "Pas de bilan, pas de taxes. Juste le suivi des loyers pour savoir où vous en êtes." },
              ].map((item, i) => (
                <motion.div key={i} variants={notRantiItemVariants} className="border-t border-background/20 pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <X size={16} className="text-background/60" />
                    <h3 className="font-semibold text-background">{item.t}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-background/70">{item.d}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-border bg-muted/10 py-24">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
            <FadeIn>
              <h2 className="mb-12 text-3xl font-bold">Simple et gratuit pour commencer.</h2>
            </FadeIn>
            <FadeIn delay={0.1} className="w-full">
              <div className="flex flex-col items-center justify-between gap-10 rounded-3xl border border-border bg-card p-8 text-left shadow-sm md:flex-row md:items-start md:p-12">
                <div className="w-full flex-1 space-y-6">
                  <div className="inline-flex items-center rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background">
                    Offre de lancement
                  </div>
                  <div>
                    <h3 className="mb-2 text-4xl font-bold tracking-tight">Gratuit</h3>
                    <p className="text-lg text-muted-foreground">Jusqu&apos;à 3 logements inclus.</p>
                  </div>
                  <ul className="space-y-4 py-2">
                    {["Toutes les fonctionnalités de base", "Aucune carte bancaire requise", "Support par email"].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Check size={12} className="text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 border-t border-border pt-6">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={16} />
                      <span className="font-medium text-foreground">À venir :</span> formule propriétaire (4 logements et plus).
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col items-center justify-center md:w-auto md:items-end">
                  <Link
                    href="/signup"
                    className="inline-flex h-14 w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-8 font-medium text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] md:w-auto"
                  >
                    Ouvrir mon espace — c&apos;est gratuit
                  </Link>
                  <p className="mt-4 text-center text-xs text-muted-foreground">Moins de 2 minutes pour s&apos;inscrire</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border py-24">
          <div className="mx-auto max-w-3xl px-6">
            <FadeIn>
              <h2 className="mb-12 text-3xl font-bold">Questions fréquentes</h2>
            </FadeIn>
            <div className="border-y border-border">
              {faqs.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} index={i} openIndex={openIndex} setOpenIndex={setOpenIndex} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-32">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: EASE }}
              className="mb-6 text-4xl font-bold tracking-tight"
            >
              Commencez par suivre un seul logement.
            </motion.h2>
            <FadeIn delay={0.2} className="flex w-full flex-col items-center">
              <p className="mb-10 text-lg text-muted-foreground">
                Ajoutez une propriété, un logement, un locataire, posez le bail — Ranti génère ensuite les échéances.
              </p>
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-8 font-medium text-primary-foreground transition-transform hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              >
                Ouvrir mon espace propriétaire
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </FadeIn>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p className="text-sm text-muted-foreground">Ranti © 2026 — le suivi de loyers des propriétaires africains.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Se connecter</Link>
            <Link href="/signup" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Ouvrir un espace</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
