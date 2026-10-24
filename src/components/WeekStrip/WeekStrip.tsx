import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
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

// неделя тянется за пальцем; отпустил дальше порога (или быстро смахнул) — уезжает целиком, новая въезжает с другой стороны
const SWIPE_OFFSET = 60
const SWIPE_VELOCITY = 350
const spring = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 }

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0.4 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0.4 }),
}

// Неделя Пн–Вс; свайп влево/вправо — следующая/предыдущая неделя.
export function WeekStrip({ selectedDay, onDayPress }: WeekStripProps) {
  const todayKey = today()
  const [anchor, setAnchor] = useState(selectedDay)
  const [direction, setDirection] = useState(0)
  const dragged = useRef(false)

  // выбранный день вне показанной недели — показать его неделю
  useEffect(() => {
    setAnchor((a) => (getWeekDays(a).includes(selectedDay) ? a : selectedDay))
  }, [selectedDay])

  const weekDays = getWeekDays(anchor)
  const todayTime = parseKey(todayKey).getTime()

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = Math.abs(info.offset.x) > SWIPE_OFFSET || Math.abs(info.velocity.x) > SWIPE_VELOCITY
    if (!swipe) return
    const dir = info.offset.x < 0 ? 1 : -1
    setDirection(dir)
    setAnchor((a) => shiftWeek(a, dir))
  }

  return (
    <div className={styles.viewport}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={weekDays[0]}
          className={styles.week}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          dragMomentum={false}
          onDragStart={() => (dragged.current = true)}
          onDragEnd={onDragEnd}
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
                onPointerDown={() => (dragged.current = false)}
                onClick={() => {
                  if (dragged.current) return // это был свайп, не тап
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
  )
}
