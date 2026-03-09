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
        <div className={styles.text}>
          {getText().split('\n').map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
