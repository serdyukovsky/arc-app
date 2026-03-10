import { AnimatePresence, motion } from 'framer-motion'
import styles from './HeroCard.module.css'
import heroIllustration from '@/assets/hero-coil.svg'

interface HeroCardProps {
  completed: number
  total: number
}

export function HeroCard({ completed, total }: HeroCardProps) {
  const allDone = total > 0 && completed >= total

  const getText = () => {
    if (allDone) return 'Все привычки\nвыполнены! 🎉'
    if (completed <= 0) return `0 из ${total} привычек\nвыполнено`
    if (completed === 2) return `2 из ${total} привычек\nвыполнено 🔥`
    if (completed === 1) return `1 из ${total} привычек\nвыполнено 💪`
    return `${completed} из ${total} привычек\nвыполнено 🔥`
  }
  const text = getText()

  return (
    <div className={styles.card}>
      <div className={styles.media}>
        <img
          src={heroIllustration}
          alt=""
          className={styles.illustration}
          draggable={false}
        />
      </div>
      <div className={styles.textWrap}>
        <div className={styles.dim}>Сегодня</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={text}
            className={styles.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {text.split('\n').map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
