import type { Habit } from '@/types'
import { DAY_NAMES_SHORT, getWeekDays, isToday, parseKey } from '@/lib/date'
import { getMilestoneProgress } from '@/lib/milestones'
import styles from './HabitCard.module.css'

interface DailyCardProps {
  habit: Habit
  isDone: boolean
  doneDates: Set<string>
  streak: number
  bindLongPress: Record<string, any>
  pulse: boolean
  onDayPress?: (day: string) => void
}

const RING_SIZE = 70
const CENTER = RING_SIZE / 2
const OUTER_RADIUS = 31
const INNER_RADIUS = 24
const GAP_RATIO = 0.08
const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS
const OUTER_GAP = OUTER_CIRCUMFERENCE * GAP_RATIO
const INNER_GAP = INNER_CIRCUMFERENCE * GAP_RATIO
const OUTER_VISIBLE = OUTER_CIRCUMFERENCE - OUTER_GAP
const INNER_VISIBLE = INNER_CIRCUMFERENCE - INNER_GAP

export function DailyCard({
  habit,
  isDone,
  doneDates,
  streak,
  bindLongPress,
  pulse,
  onDayPress,
}: DailyCardProps) {
  const weekDays = getWeekDays()
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const goalDays = habit.goalDays ?? null
  const goalCompleted = habit.goalCompleted ?? false
  const lifetimeDays = habit.lifetimeDays ?? 0
  const { progress, nextMilestone } = getMilestoneProgress({ ...habit, streak })
  const outerProgress = goalCompleted ? 1 : Math.min(1, Math.max(0, progress))
  const outerOffset = OUTER_VISIBLE * (1 - outerProgress)

  const lifetimeRemainder = lifetimeDays % 100
  const lifetimeProgress = lifetimeDays > 0 && lifetimeRemainder === 0
    ? 1
    : lifetimeRemainder / 100
  const innerOffset = INNER_VISIBLE * (1 - Math.min(1, Math.max(0, lifetimeProgress)))
  const goalCurrent = goalDays === null ? streak : Math.min(streak, goalDays)
  const milestoneCurrent = Math.min(streak, nextMilestone)
  const goalProgressText = goalDays === null
    ? `${goalCurrent}/∞`
    : goalCompleted
      ? '✓'
      : `${goalCurrent}/${goalDays}`
  const milestoneProgressText = `${milestoneCurrent}/${nextMilestone}`

  return (
    <div className={`${styles.card} ${isDone ? styles.done : ''}`} {...bindLongPress}>
      <div className={styles.content}>
        <div className={styles.dailyTop}>
          <div className={styles.left}>
            <div className={styles.dim}>{habit.name}</div>
            <div className={styles.metric}>
              <span className={styles.big}>{streak}</span>
              <span className={styles.sub}>дней подряд</span>
            </div>
          </div>

          <div className={`${styles.arcRing} ${pulse ? styles.ringPulse : ''}`}>
            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className={styles.arcSvg}>
              <circle
                className={styles.arcTrack}
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                strokeDasharray={`${OUTER_VISIBLE} ${OUTER_GAP}`}
              />
              <circle
                className={styles.arcFill}
                cx={CENTER}
                cy={CENTER}
                r={OUTER_RADIUS}
                strokeDasharray={`${OUTER_VISIBLE} ${OUTER_GAP}`}
                strokeDashoffset={outerOffset}
              />
              <circle
                className={styles.arcTrackInner}
                cx={CENTER}
                cy={CENTER}
                r={INNER_RADIUS}
                strokeDasharray={`${INNER_VISIBLE} ${INNER_GAP}`}
              />
              <circle
                className={styles.arcFillInner}
                cx={CENTER}
                cy={CENTER}
                r={INNER_RADIUS}
                strokeDasharray={`${INNER_VISIBLE} ${INNER_GAP}`}
                strokeDashoffset={innerOffset}
              />
            </svg>
            <div className={styles.arcText}>
              <div className={styles.arcTextLine}>{goalProgressText}</div>
              <div className={styles.arcTextLine}>{milestoneProgressText}</div>
            </div>
          </div>
        </div>

        <div className={styles.weekRow}>
          {weekDays.map((day, i) => (
            <button
              key={day}
              type="button"
              data-interactive="true"
              className={`${styles.dayCol} ${styles.dayButton}`}
              onClick={(event) => {
                event.stopPropagation()
                onDayPress?.(day)
              }}
            >
              <div
                className={[
                  styles.dayDot,
                  doneDates.has(day) ? styles.dayDotFilled : styles.dayDotEmpty,
                  isToday(day) ? styles.dayDotToday : '',
                ].join(' ')}
              />
              <span
                className={[
                  styles.dayLabel,
                  isToday(day) ? styles.dayLabelToday : '',
                  parseKey(day).getTime() > todayDate.getTime() ? styles.dayLabelFuture : '',
                ].join(' ')}
              >
                {DAY_NAMES_SHORT[i]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
