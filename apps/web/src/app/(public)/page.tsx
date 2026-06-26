import Link from "next/link"
import { motion } from "framer-motion"

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
}

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: "easeOut"
    }
  }
}

const slideUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
}

const buttonHoverVariants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  }
}

const cardHoverVariants = {
  rest: { y: 0, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" },
  hover: {
    y: -4,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-white px-6 py-12 text-black">
      {/* Hero Section */}
      <motion.section 
        className="space-y-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div className="space-y-4" variants={itemVariants}>
          <motion.p 
            className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500"
            variants={fadeInVariants}
          >
            Ranti
          </motion.p>
          <motion.h1 
            className="text-4xl font-semibold leading-tight tracking-tight text-black"
            variants={slideUpVariants}
          >
            Vos loyers, sans confusion.
          </motion.h1>
          <motion.p 
            className="text-lg leading-8 text-neutral-700"
            variants={slideUpVariants}
          >
            Ranti aide les propriétaires à voir qui a payé, qui est en retard, et quelle preuve existe avant toute relance.
          </motion.p>
        </motion.div>

        <motion.div 
          className="space-y-3"
          variants={itemVariants}
        >
          <motion.div variants={slideUpVariants}>
            <Link
              href="#beta"
              className="block w-full rounded-xl bg-black px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800"
            >
              Demander un accès
            </Link>
          </motion.div>
          <motion.div variants={slideUpVariants}>
            <Link
              href="#comment-ca-marche"
              className="block w-full rounded-xl border border-neutral-300 px-4 py-3 text-center text-base font-medium text-black transition hover:border-black"
            >
              Voir comment ça marche
            </Link>
          </motion.div>
        </motion.div>

        <motion.div 
          className="text-center text-sm text-neutral-500"
          variants={itemVariants}
        >
          <p>Pensé pour les propriétaires qui gèrent leurs loyers</p>
          <p>avec WhatsApp, un cahier, Excel, des appels ou des captures Mobile Money.</p>
        </motion.div>
      </motion.section>

      {/* Situations fréquentes */}
      <motion.section 
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          Situations fréquentes
        </motion.h2>
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
        >
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Un locataire dit avoir payé, mais la preuve est difficile à retrouver.</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Le propriétaire oublie qui doit être relancé.</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Les reçus sont faits à la main ou envoyés trop tard.</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Les paiements cash, Mobile Money et virements sont dispersés.</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Pour qui ? */}
      <motion.section 
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          Pour qui ?
        </motion.h2>
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
        >
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Propriétaires de 1 à 20 logements</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Petits gestionnaires immobiliers</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Propriétaires qui suivent les loyers avec WhatsApp, cahier ou Excel</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Ce que Ranti permet de faire */}
      <motion.section 
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          Ce que Ranti permet de faire
        </motion.h2>
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
        >
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Suivre les loyers attendus</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Marquer un paiement comme reçu</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Voir les retards</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Attacher une preuve</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Générer une quittance simple</p>
          </motion.div>
          <motion.div 
            className="flex items-start gap-3"
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
          >
            <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-black" />
            <p className="text-neutral-700">Préparer une relance WhatsApp propre</p>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Carte d'interface produit réaliste */}
      <motion.section 
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          À quoi ça ressemble
        </motion.h2>
        <motion.div 
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-6"
          variants={slideUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          whileHover="hover"
          variants={cardHoverVariants}
        >
          {/* En-tête de la carte */}
          <motion.div 
            className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h3 className="font-medium text-black">Loyers - Juin 2025</h3>
            <span className="text-sm text-neutral-500">3/5 payés</span>
          </motion.div>
          
          {/* Liste des locataires */}
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* Locataire 1 - Payé */}
            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">AK</span>
                </div>
                <div>
                  <p className="font-medium text-black">Adama Koné</p>
                  <p className="text-sm text-neutral-500">Appartement B1</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">75 000 FCFA</p>
                <p className="text-sm text-green-600">Payé</p>
                <p className="text-xs text-neutral-500">Mobile Money</p>
                <p className="text-xs text-neutral-400">Capture jointe</p>
              </div>
            </motion.div>

            {/* Locataire 2 - En retard */}
            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">FD</span>
                </div>
                <div>
                  <p className="font-medium text-black">Fatou Diallo</p>
                  <p className="text-sm text-neutral-500">Studio C2</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">60 000 FCFA</p>
                <p className="text-sm text-red-600">-2 jours</p>
                <p className="text-xs text-neutral-500">Virement</p>
                <p className="text-xs text-neutral-400">À vérifier</p>
              </div>
            </motion.div>

            {/* Locataire 3 - Payé */}
            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                  <span className="text-sm font-medium">YT</span>
                </div>
                <div>
                  <p className="font-medium text-black">Yacouba Touré</p>
                  <p className="text-sm text-neutral-500">Maison D1</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-black">100 000 FCFA</p>
                <p className="text-sm text-green-600">Payé</p>
                <p className="text-xs text-neutral-500">Cash</p>
                <p className="text-xs text-neutral-400">Reçu généré</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Actions */}
          <motion.div 
            className="flex gap-3 mt-6 pt-4 border-t border-neutral-200"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <motion.button 
              className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium"
              whileHover={{ scale: 1.02, backgroundColor: "#374151" }}
              whileTap={{ scale: 0.98 }}
            >
              Confirmer
            </motion.button>
            <motion.button 
              className="flex-1 rounded-lg border border-neutral-300 text-black py-2 text-sm font-medium"
              whileHover={{ scale: 1.02, borderColor: "#000" }}
              whileTap={{ scale: 0.98 }}
            >
              Relancer
            </motion.button>
            <motion.button 
              className="flex-1 rounded-lg border border-neutral-300 text-black py-2 text-sm font-medium"
              whileHover={{ scale: 1.02, borderColor: "#000" }}
              whileTap={{ scale: 0.98 }}
            >
              Générer reçu
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Bêta privée */}
      <motion.section 
        id="beta"
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          Ranti ouvre bientôt en bêta privée.
        </motion.h2>
        <motion.p 
          className="text-neutral-700 leading-relaxed"
          variants={slideUpVariants}
        >
          Les premiers propriétaires pourront tester une version simple pour suivre leurs loyers, retards, preuves et quittances.
        </motion.p>
        <motion.div 
          className="space-y-3"
          variants={itemVariants}
        >
          <motion.div variants={slideUpVariants}>
            <Link
              href="#beta"
              className="block w-full rounded-xl bg-black px-4 py-3 text-center text-base font-medium text-white transition hover:bg-neutral-800"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Demander un accès
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Section comment ça marche (ancrage) */}
      <motion.section 
        id="comment-ca-marche"
        className="mt-16 space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.h2 
          className="text-2xl font-semibold text-black"
          variants={slideUpVariants}
        >
          Comment ça marche ?
        </motion.h2>
        <motion.p 
          className="text-neutral-700 leading-relaxed"
          variants={slideUpVariants}
        >
          Ranti est conçu pour être simple et direct. Vous ajoutez vos logements et locataires, puis vous suivez les paiements au fur et à mesure. Chaque paiement peut être marqué avec sa preuve, et vous voyez immédiatement qui est à jour et qui est en retard.
        </motion.p>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        className="mt-20 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-500"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <p>Ranti - Le cahier de loyers moderne des propriétaires africains</p>
      </motion.footer>
    </main>
  )
}
