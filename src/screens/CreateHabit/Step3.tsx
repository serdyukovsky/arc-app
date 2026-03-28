import type { ReminderSlot } from '@/types'
import styles from './CreateHabit.module.css'

interface Step3Props {
  reminder: ReminderSlot
  reminderTime?: string
  onReminderChange: (v: ReminderSlot) => void
  onReminderTimeChange?: (time: string) => void
}

const TIMES: { id: ReminderSlot; title: string; sub: string }[] = [
  {
    id: 'none',
    title: 'Без напоминания',
    sub: 'Открою сам когда нужно',
  },
  {
    id: 'morning',
    title: '☀️ Утро',
    sub: '08:00',
  },
  {
    id: 'day',
    title: '🌤 День',
    sub: '13:00',
  },
  {
    id: 'evening',
    title: '🌙 Вечер',
    sub: '21:00',
  },
  {
    id: 'custom',
    title: '⏰ Своё время',
    sub: 'Выбрать точное время',
  },
]

export default function Step3({ reminder, reminderTime = '09:00', onReminderChange, onReminderTimeChange }: Step3Props) {
  return (
    <div className={styles.step}>
      <div className={styles.stepMeta}>ШАГ 3 ИЗ 3</div>
      <h1 className={styles.stepTitle}>Когда напоминать?</h1>
      <p className={styles.stepDesc}>Необязательно — можно пропустить</p>

      <div className={styles.timeList}>
        {TIMES.map((time) => (
          <button
            key={time.id}
            className={`${styles.timeOption} ${reminder === time.id ? styles.selected : ''}`}
            onClick={() => onReminderChange(time.id)}
          >
            <div>
              <div className={styles.timeTitle}>{time.title}</div>
              <div className={styles.timeSub}>
                {time.id === 'custom' && reminder === 'custom' ? reminderTime : time.sub}
              </div>
            </div>
            <span className={styles.timeCheck} style={{ opacity: reminder === time.id ? 1 : 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                check
              </span>
            </span>
          </button>
        ))}

        {reminder === 'custom' && (
          <div className={styles.customTimeRow}>
            <input
              type="time"
              className={styles.customTimeInput}
              value={reminderTime}
              onChange={(e) => onReminderTimeChange?.(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
