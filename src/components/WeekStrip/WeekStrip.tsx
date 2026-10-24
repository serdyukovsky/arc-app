import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DAY_NAMES_SHORT, getWeekDays, isToday, parseKey, toKey, today } from '@/lib/date'
import styles from './WeekStrip.module.css'

interface WeekStripProps {
  selectedDay: string
  onDayPress?: (day: string) => void
}

const shiftWeek = (key: string, weeks: number): string => {
  const d = parseKey(key)
  d.setDate(d.getDate() + 7 * weeks)
  return toKey(d)
}

const SWIPE_PX = 40

// Неделя Пн–Вс; свайп влево/вправо — следующая/предыдущая неделя.
export function WeekStrip({ selectedDay, onDayPress }: WeekStripProps) {
  const todayKey = today()
  const [anchor, setAnchor] = useState(selectedDay)
  const [direction, setDirection] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  // выбранный день вне показанной недели (например, вернулись к сегодня) — показать его неделю
  useEffect(() => {
    setAnchor((a) => (getWeekDays(a).includes(selectedDay) ? a : selectedDay))
  }, [selectedDay])

  const weekDays = getWeekDays(anchor)
  const todayTime = parseKey(todayKey).getTime()

  const go = (weeks: number) => {
    setDirection(weeks)
    setAnchor((a) => shiftWeek(a, weeks))
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.viewport}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY }
          swiped.current = false
        }}
        onPointerUp={(e) => {
          if (!start.current) return
          const dx = e.clientX - start.current.x
          const dy = e.clientY - start.current.y
          start.current = null
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
            swiped.current = true
            go(dx < 0 ? 1 : -1)
          }
        }}
        onPointerCancel={() => (start.current = null)}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={weekDays[0]}
            className={styles.week}
            custom={direction}
            initial={{ opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -48 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {weekDays.map((day, i) => {
              const isCurrentDay = isToday(day)
              const isSelectedDay = day === selectedDay
              const isFuture = parseKey(day).getTime() > todayTime
              return (
                <button
                  key={day}
                  type="button"
                  className={styles.day}
                  onClick={() => {
                    if (swiped.current) return // свайп, не тап
                    onDayPress?.(day)
                  }}
                  disabled={!onDayPress}
                  aria-label={`Открыть день ${day}`}
                >
                  <span className={`${styles.label} ${isCurrentDay || isSelectedDay ? styles.labelStrong : ''}`}>
                    {DAY_NAMES_SHORT[i]}
                  </span>
                  <span
                    className={`${styles.date} ${isFuture ? styles.dateFuture : ''} ${isSelectedDay ? styles.dateSelected : ''}`}
                  >
                    {parseKey(day).getDate()}
                  </span>
                  <span className={`${styles.dot} ${isCurrentDay ? styles.dotVisible : ''}`} />
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  )
}
