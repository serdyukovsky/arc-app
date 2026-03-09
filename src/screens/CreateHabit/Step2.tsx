import type { HabitType } from '@/types'
import { HABIT_TYPES } from '@/types'
import { Icon } from '@/components/Icon/Icon'
import styles from './CreateHabit.module.css'

interface Step2Props {
  type: HabitType
  onTypeChange: (v: HabitType) => void
  goal: number
  onGoalChange: (v: number) => void
  daysGoal: number | null
  onDaysGoalChange: (v: number | null) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function Step2({
  type,
  onTypeChange,
  goal,
  onGoalChange,
  daysGoal,
  onDaysGoalChange,
}: Step2Props) {
  const daysRangeMax = type === 'periodic' ? 52 : 365
  const daysDefault = type === 'periodic' ? 8 : 21

  const goalConfig = {
    daily: { min: 1, max: 1, unit: 'раз в день', label: 'Сколько раз в день?' },
    periodic: { min: 1, max: 7, unit: 'раз в неделю', label: 'Сколько раз в неделю?' },
    counter: { min: 1, max: 999, unit: 'единиц в день', label: 'Цель на день' },
  }[type]

  return (
    <div className={styles.step}>
      <div className={styles.stepMeta}>ШАГ 2 ИЗ 3</div>
      <h1 className={styles.stepTitle}>Как отслеживать?</h1>

      <div className={styles.typeList}>
        {HABIT_TYPES.map((ht) => (
          <button
            key={ht.id}
            className={`${styles.typeCard} ${type === ht.id ? styles.selected : ''}`}
            onClick={() => onTypeChange(ht.id)}
          >
            <div className={styles.typeIcon}>
              <Icon name={ht.icon} size={20} />
            </div>
            <div>
              <div className={styles.typeName}>{ht.label}</div>
              <div className={styles.typeDesc}>{ht.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {type !== 'daily' && (
        <div className={styles.goalBlock}>
          <div className={styles.sectionTitle}>{goalConfig.label}</div>
          <div className={styles.stepper}>
            <button
              className={styles.stepperBtn}
              onClick={() => onGoalChange(clamp(goal - 1, goalConfig.min, goalConfig.max))}
            >
              −
            </button>
            <div style={{ textAlign: 'center' }}>
              <div className={styles.stepperVal}>{goal}</div>
              <div className={styles.stepperUnit}>{goalConfig.unit}</div>
            </div>
            <button
              className={styles.stepperBtn}
              onClick={() => onGoalChange(clamp(goal + 1, goalConfig.min, goalConfig.max))}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className={styles.daysBlock}>
        <div className={styles.daysHead}>
          <div className={styles.sectionTitle}>
            {type === 'periodic' ? 'Сколько недель для формирования?' : 'Сколько дней для формирования?'}
          </div>
          {daysGoal !== null && (
            <button className={styles.skipBtn} onClick={() => onDaysGoalChange(null)}>
              Пропустить
            </button>
          )}
        </div>

        {daysGoal !== null ? (
          <div className={styles.stepper}>
            <button
              className={styles.stepperBtn}
              onClick={() => onDaysGoalChange(clamp(daysGoal - 1, 1, daysRangeMax))}
            >
              −
            </button>
            <div style={{ textAlign: 'center' }}>
              <div className={styles.stepperVal}>{daysGoal}</div>
              <div className={styles.stepperUnit}>{type === 'periodic' ? 'недель' : 'дней'}</div>
            </div>
            <button
              className={styles.stepperBtn}
              onClick={() => onDaysGoalChange(clamp(daysGoal + 1, 1, daysRangeMax))}
            >
              +
            </button>
          </div>
        ) : (
          <div className={styles.skipState}>
            <div>
              <div className={styles.skipTitle}>Без цели</div>
              <div className={styles.skipSub}>Автоматические milestone-ы: 7→14→21→30…</div>
            </div>
            <button className={styles.skipSetBtn} onClick={() => onDaysGoalChange(daysDefault)}>
              Задать
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
