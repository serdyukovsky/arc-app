import { Drawer } from '@/components/Drawer/Drawer'
import styles from './GoalCompleteSheet.module.css'

interface GoalCompleteSheetProps {
  open: boolean
  habitName?: string
  onComplete: () => void
  onContinue: () => void
}

export function GoalCompleteSheet({ open, habitName, onComplete, onContinue }: GoalCompleteSheetProps) {
  return (
    <Drawer open={open} onClose={() => {}}>
      <div className={styles.content}>
        <h3 className={styles.title}>Цель достигнута ✓</h3>
        <p className={styles.message}>
          «{habitName ?? 'Привычка'}» достигла цели. Что дальше?
        </p>
        <button className={styles.primary} onClick={onComplete}>
          Завершить привычку
        </button>
        <button className={styles.secondary} onClick={onContinue}>
          Продолжить без цели
        </button>
      </div>
    </Drawer>
  )
}
