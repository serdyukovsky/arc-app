import styles from './CreateHabit.module.css'

interface Step3Props {
  reminder: 'none' | 'morning' | 'day' | 'evening'
  onReminderChange: (v: 'none' | 'morning' | 'day' | 'evening') => void
}

const TIMES = [
  {
    id: 'none' as const,
    title: 'Без напоминания',
    sub: 'Открою сам когда нужно',
  },
  {
    id: 'morning' as const,
    title: '☀️ Утро',
    sub: '08:00',
  },
  {
    id: 'day' as const,
    title: '🌤 День',
    sub: '13:00',
  },
  {
    id: 'evening' as const,
    title: '🌙 Вечер',
    sub: '21:00',
  },
]

export default function Step3({ reminder, onReminderChange }: Step3Props) {
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
              <div className={styles.timeSub}>{time.sub}</div>
            </div>
            <span className={styles.timeCheck} style={{ opacity: reminder === time.id ? 1 : 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                check
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
