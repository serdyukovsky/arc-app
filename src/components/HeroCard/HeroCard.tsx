import { Icon } from '@/components/Icon/Icon'
import styles from './HeroCard.module.css'

interface HeroCardProps {
  completed: number
  total: number
  label?: string // «Сегодня» или выбранный день
  onAdd?: () => void // новая привычка
}

const pluralHabits = (n: number): string => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'привычки'
  return 'привычек'
}

export function HeroCard({ completed, total, label = 'Сегодня', onAdd }: HeroCardProps) {
  const allDone = total > 0 && completed >= total
  const text = allDone ? 'Всё выполнено' : `${completed} из ${total} ${pluralHabits(total)} выполнено`

  return (
    <div className={styles.card}>
      <div className={styles.info}>
        <div className={styles.dim}>{label}</div>
        <div className={styles.text}>{text}</div>
      </div>
      {onAdd && (
        <button type="button" className={styles.addBtn} onClick={onAdd} aria-label="Новая привычка">
          <Icon name="add" size={22} />
        </button>
      )}
    </div>
  )
}
