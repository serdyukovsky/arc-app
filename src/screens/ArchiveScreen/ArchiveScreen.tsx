import type { Habit } from '@/types'
import { CATEGORIES } from '@/types'
import { Icon } from '@/components/Icon/Icon'
import styles from './ArchiveScreen.module.css'

interface ArchiveScreenProps {
  habits: Habit[]
  onUnarchive: (id: string) => void
  showToast: (msg: string) => void
}

export function ArchiveScreen({ habits, onUnarchive, showToast }: ArchiveScreenProps) {
  if (habits.length === 0) {
    return (
      <div className={styles.screen}>
        <h1 className={styles.title}>Архив</h1>
        <div className={styles.empty}>
          <Icon name="archive" size={48} style={{ opacity: 0.2 }} />
          <p>Нет архивированных привычек</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Архив</h1>
      <div className={styles.list}>
        {habits.map((h) => {
          const cat = CATEGORIES.find((c) => c.id === h.category)
          return (
            <div key={h.id} className={styles.card}>
              <div className={styles.info}>
                <span className={styles.category}>{cat?.label ?? h.category}</span>
                <span className={styles.name}>{h.name}</span>
              </div>
              <button
                className={styles.restoreBtn}
                onClick={() => {
                  onUnarchive(h.id)
                  showToast('Привычка восстановлена')
                }}
              >
                <Icon name="unarchive" size={20} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
