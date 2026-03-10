import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, animate, motion, useReducedMotion } from 'framer-motion'
import type { Habit, HabitLog } from '@/types'
import { parseKey, toKey } from '@/lib/date'
import styles from './AnalyticsScreen.module.css'

interface AnalyticsScreenProps {
  habits: Habit[]
  logs: HabitLog[]
  getStreak: (habit: Habit) => number
  getBestStreak: (habit: Habit) => number
  onClose: () => void
}

type Period = 'week' | 'month'

type PeriodRange = {
  start: Date
  end: Date
  days: string[]
}

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const RU_MONTHS_CAP = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEK_DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const floorDate = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date: Date, amount: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

const listDays = (start: Date, end: Date): string[] => {
  const out: string[] = []
  const d = new Date(start)
  while (d <= end) {
    out.push(toKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const getWeekRange = (offset: number): PeriodRange => {
  const now = floorDate(new Date())
  const dayOfWeek = now.getDay()
  const monday = addDays(now, -((dayOfWeek + 6) % 7) + offset * 7)
  const sunday = addDays(monday, 6)
  return { start: monday, end: sunday, days: listDays(monday, sunday) }
}

const getMonthRange = (offset: number): PeriodRange => {
  const now = new Date()
  const start = floorDate(new Date(now.getFullYear(), now.getMonth() + offset, 1))
  const end = floorDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0))
  return { start, end, days: listDays(start, end) }
}

const formatRangeShort = (start: Date, end: Date): string => {
  return `${start.getDate()}–${end.getDate()} ${RU_MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`
}

const percentDiff = (current: number, previous: number): string => {
  const diff = current - previous
  return diff > 0 ? `+${diff}%` : `${diff}%`
}

const getStreakUnit = (habit: Habit): string => {
  return habit.type === 'periodic' ? 'нед' : 'дн'
}

const ANALYTICS_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const sectionVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
}

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const previousRef = useRef(value)

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value)
      previousRef.current = value
      return
    }

    const controls = animate(previousRef.current, value, {
      duration: 0.52,
      ease: ANALYTICS_EASE,
      onUpdate: (latest) => {
        setDisplay(Math.round(latest))
      },
    })

    previousRef.current = value
    return () => controls.stop()
  }, [reduceMotion, value])

  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  )
}

export function AnalyticsScreen({ habits, logs, getStreak, getBestStreak, onClose }: AnalyticsScreenProps) {
  const [period, setPeriod] = useState<Period>('week')
  const [offset, setOffset] = useState(0)
  const reduceMotion = useReducedMotion()
  const areaGradientId = useId().replace(/:/g, '')
  const viewKey = `${period}:${offset}`

  const todayDate = floorDate(new Date())
  const todayKey = toKey(todayDate)

  const logMap = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach((log) => {
      map.set(`${log.habit}:${log.date}`, log.value)
    })
    return map
  }, [logs])

  const isCompletedOnDay = (habit: Habit, day: string): boolean => {
    const value = logMap.get(`${habit.id}:${day}`) ?? 0
    return habit.type === 'counter' ? value >= habit.goal : value > 0
  }

  const range = useMemo(() => {
    return period === 'week' ? getWeekRange(offset) : getMonthRange(offset)
  }, [period, offset])

  const prevRange = useMemo(() => {
    return period === 'week' ? getWeekRange(offset - 1) : getMonthRange(offset - 1)
  }, [period, offset])

  const rangeDaysPast = useMemo(() => {
    return range.days.filter((day) => parseKey(day) <= todayDate)
  }, [range.days, todayKey])

  const prevRangeDaysPast = useMemo(() => {
    return prevRange.days.filter((day) => parseKey(day) <= todayDate)
  }, [prevRange.days, todayKey])

  const getDayCompletion = (day: string): number | null => {
    if (parseKey(day) > todayDate) return null
    if (habits.length === 0) return 0

    let done = 0
    habits.forEach((habit) => {
      if (isCompletedOnDay(habit, day)) done += 1
    })

    return done / habits.length
  }

  const summary = useMemo(() => {
    const currentTotal = habits.length * rangeDaysPast.length
    const currentDone = rangeDaysPast.reduce((sum, day) => {
      return sum + habits.reduce((n, habit) => n + (isCompletedOnDay(habit, day) ? 1 : 0), 0)
    }, 0)

    const previousTotal = habits.length * prevRangeDaysPast.length
    const previousDone = prevRangeDaysPast.reduce((sum, day) => {
      return sum + habits.reduce((n, habit) => n + (isCompletedOnDay(habit, day) ? 1 : 0), 0)
    }, 0)

    const currentPct = currentTotal > 0 ? Math.round((currentDone / currentTotal) * 100) : 0
    const previousPct = previousTotal > 0 ? Math.round((previousDone / previousTotal) * 100) : 0

    return {
      currentPct,
      previousPct,
      currentDone,
      currentTotal,
      diffText: percentDiff(currentPct, previousPct),
    }
  }, [habits, rangeDaysPast, prevRangeDaysPast, logMap])
  const summaryDiff = summary.currentPct - summary.previousPct

  const perfectDays = useMemo(() => {
    if (habits.length === 0) return 0

    return rangeDaysPast.reduce((count, day) => {
      const allDone = habits.every((habit) => isCompletedOnDay(habit, day))
      return allDone ? count + 1 : count
    }, 0)
  }, [habits, rangeDaysPast, logMap])

  const bestWeekPct = useMemo(() => {
    if (habits.length === 0) return 0

    const dates: Date[] = [todayDate]
    logs.forEach((log) => {
      dates.push(parseKey(log.date))
    })
    habits.forEach((habit) => {
      dates.push(floorDate(new Date(habit.created)))
    })

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const start = floorDate(minDate)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

    let cursor = new Date(start)
    let best = 0

    while (addDays(cursor, 6) <= todayDate) {
      let total = 0
      let done = 0
      for (let i = 0; i < 7; i += 1) {
        const dayKey = toKey(addDays(cursor, i))
        habits.forEach((habit) => {
          total += 1
          if (isCompletedOnDay(habit, dayKey)) done += 1
        })
      }
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      if (pct > best) best = pct
      cursor = addDays(cursor, 7)
    }

    return best
  }, [habits, logs, logMap, todayKey])

  const breakdown = useMemo(() => {
    return habits.map((habit) => {
      const currentDone = rangeDaysPast.reduce(
        (sum, day) => sum + (isCompletedOnDay(habit, day) ? 1 : 0),
        0
      )
      const previousDone = prevRangeDaysPast.reduce(
        (sum, day) => sum + (isCompletedOnDay(habit, day) ? 1 : 0),
        0
      )

      const currentPct = rangeDaysPast.length > 0 ? Math.round((currentDone / rangeDaysPast.length) * 100) : 0
      const previousPct = prevRangeDaysPast.length > 0 ? Math.round((previousDone / prevRangeDaysPast.length) * 100) : 0

      return {
        habit,
        currentPct,
        previousPct,
        diffText: percentDiff(currentPct, previousPct),
        streak: getStreak(habit),
        bestStreak: getBestStreak(habit),
      }
    })
  }, [habits, rangeDaysPast, prevRangeDaysPast, logMap, getStreak, getBestStreak])

  const heading = useMemo(() => {
    if (period === 'week') {
      return {
        label:
          offset === 0
            ? 'Эта неделя'
            : offset === -1
              ? 'Прошлая неделя'
              : formatRangeShort(range.start, range.end),
        subLabel: formatRangeShort(range.start, range.end).toUpperCase(),
      }
    }

    return {
      label: `${RU_MONTHS_CAP[range.start.getMonth()]} ${range.start.getFullYear()}`,
      subLabel: `${range.days.length} дней`,
    }
  }, [period, offset, range])

  const recordHabits = useMemo(() => {
    const best = habits.reduce<{ value: number; name: string }>(
      (acc, habit) => {
        const value = getBestStreak(habit)
        return value > acc.value ? { value, name: habit.name } : acc
      },
      { value: 0, name: '—' }
    )

    const current = habits.reduce<{ value: number; name: string }>(
      (acc, habit) => {
        const value = getStreak(habit)
        return value > acc.value ? { value, name: habit.name } : acc
      },
      { value: 0, name: '—' }
    )

    return { best, current }
  }, [habits, getStreak, getBestStreak])

  const trend = useMemo(() => {
    const rows: Array<{ pct: number; label: string; isLast: boolean }> = []

    for (let w = 7; w >= 0; w -= 1) {
      const end = addDays(todayDate, -w * 7)
      const start = addDays(end, -6)

      let total = 0
      let done = 0

      for (let i = 0; i < 7; i += 1) {
        const day = toKey(addDays(start, i))
        habits.forEach((habit) => {
          total += 1
          if (isCompletedOnDay(habit, day)) done += 1
        })
      }

      rows.push({
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        label: w === 0 ? 'Эта' : `-${w}н`,
        isLast: w === 0,
      })
    }

    return rows
  }, [habits, logMap, todayKey])

  const chartGeometry = useMemo(() => {
    const width = 300
    const height = 100
    const padX = 10
    const padY = 8

    const points = trend.map((item, i) => {
      const x = padX + (i * (width - 2 * padX)) / Math.max(trend.length - 1, 1)
      const y = height - padY - (item.pct / 100) * (height - 2 * padY)
      return { x, y, ...item }
    })

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    const areaPath = points.length > 0
      ? `M${points[0].x},100 ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},100 Z`
      : ''

    return { points, linePath, areaPath }
  }, [trend])

  const weekCells = useMemo(() => {
    return range.days.map((day, index) => {
      const completion = getDayCompletion(day)
      const isFuture = completion === null

      let color = '#f0f0f0'
      if (isFuture) {
        color = '#f8f8f8'
      } else if ((completion ?? 0) > 0.67) {
        color = '#000000'
      } else if ((completion ?? 0) > 0.34) {
        color = 'rgba(0,0,0,0.5)'
      } else if ((completion ?? 0) > 0) {
        color = 'rgba(0,0,0,0.2)'
      }

      return {
        day,
        label: WEEK_DOW[index],
        color,
        isFuture,
        isToday: day === todayKey,
      }
    })
  }, [range.days, logMap, habits, todayKey])

  const monthCells = useMemo(() => {
    const firstDow = (range.start.getDay() + 6) % 7
    const cells: Array<{ key: string; empty?: boolean; date?: string; day?: number }> = []

    for (let i = 0; i < firstDow; i += 1) {
      cells.push({ key: `empty-${i}`, empty: true })
    }

    range.days.forEach((date, i) => {
      cells.push({ key: date, date, day: i + 1 })
    })

    return cells
  }, [range])

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onClose} aria-label="Назад">
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
        </button>

        <LayoutGroup id="analytics-period-toggle">
          <div className={styles.toggle}>
            <button
              className={`${styles.toggleBtn} ${period === 'week' ? styles.activeToggle : ''}`}
              onClick={() => {
                setPeriod('week')
                setOffset(0)
              }}
            >
              {period === 'week' && (
                <motion.span
                  layoutId="analytics-toggle-pill"
                  className={styles.togglePill}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                />
              )}
              <span className={styles.toggleLabel}>Неделя</span>
            </button>
            <button
              className={`${styles.toggleBtn} ${period === 'month' ? styles.activeToggle : ''}`}
              onClick={() => {
                setPeriod('month')
                setOffset(0)
              }}
            >
              {period === 'month' && (
                <motion.span
                  layoutId="analytics-toggle-pill"
                  className={styles.togglePill}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                />
              )}
              <span className={styles.toggleLabel}>Месяц</span>
            </button>
          </div>
        </LayoutGroup>
      </div>

      <div className={styles.body}>
        <div className={styles.periodHead}>
          <div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={viewKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: ANALYTICS_EASE }}
              >
                <div className={styles.periodLabel}>{heading.label}</div>
                <div className={styles.periodSub}>{heading.subLabel}</div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className={styles.periodNav}>
            <button className={styles.navBtn} onClick={() => setOffset((v) => v - 1)} aria-label="Предыдущий период">
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>chevron_left</span>
            </button>
            <button
              className={styles.navBtn}
              onClick={() => setOffset((v) => Math.min(v + 1, 0))}
              disabled={offset >= 0}
              aria-label="Следующий период"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>chevron_right</span>
            </button>
          </div>
        </div>

        <motion.section
          className={styles.trendSection}
          variants={sectionVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: ANALYTICS_EASE, delay: 0.04 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={viewKey}
              className={styles.trendFrame}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: ANALYTICS_EASE }}
            >
              <div className={styles.trendWrap}>
                <div className={styles.yLabels}>
                  <span>100%</span>
                  <span>50%</span>
                  <span>0</span>
                </div>
                <div className={styles.trendSvgWrap}>
                  <svg className={styles.trendSvg} viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#000" stopOpacity="0.16" />
                        <stop offset="65%" stopColor="#000" stopOpacity="0.04" />
                        <stop offset="100%" stopColor="#000" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="0" x2="300" y2="0" stroke="#f0f0f0" strokeWidth="1" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#f0f0f0" strokeWidth="1" />
                    <line x1="0" y1="100" x2="300" y2="100" stroke="#ebebeb" strokeWidth="1" />
                    <path
                      d={chartGeometry.linePath}
                      fill="none"
                      stroke="rgba(0,0,0,0.07)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <motion.path
                      key={`${viewKey}-area`}
                      d={chartGeometry.areaPath}
                      fill={`url(#${areaGradientId})`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.32, ease: ANALYTICS_EASE, delay: 0.08 }}
                    />
                    <motion.path
                      key={`${viewKey}-line`}
                      d={chartGeometry.linePath}
                      fill="none"
                      stroke="#000"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.56, ease: ANALYTICS_EASE, delay: 0.08 }}
                    />
                    {chartGeometry.points.map((point, i) => (
                      <g key={`${point.label}-${i}`}>
                        <motion.circle
                          cx={point.x}
                          cy={point.y}
                          fill={point.isLast ? '#000' : '#fff'}
                          stroke="#000"
                          strokeWidth={point.isLast ? 0 : 1.5}
                          initial={{ opacity: 0, r: 0 }}
                          animate={{ opacity: 1, r: point.isLast ? 5 : 3 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.18,
                            ease: ANALYTICS_EASE,
                            delay: reduceMotion ? 0 : 0.18 + i * 0.04,
                          }}
                        />
                        <motion.text
                          x={point.x}
                          y={point.y - 7}
                          textAnchor="middle"
                          fontSize={point.isLast ? 10 : 8.5}
                          fontWeight={point.isLast ? 800 : 600}
                          fill={point.isLast ? '#000' : 'rgba(0,0,0,0.35)'}
                          fontFamily="Inter, sans-serif"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.18,
                            ease: ANALYTICS_EASE,
                            delay: reduceMotion ? 0 : 0.22 + i * 0.04,
                          }}
                        >
                          {point.pct}%
                        </motion.text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
              <div className={styles.trendLabels}>
                {trend.map((point) => (
                  <span key={point.label} className={point.isLast ? styles.trendLastLabel : styles.trendLabel}>
                    {point.label}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>

        <motion.section
          className={styles.summaryGrid}
          initial="initial"
          animate="animate"
          variants={{
            initial: {},
            animate: {
              transition: {
                delayChildren: reduceMotion ? 0 : 0.08,
                staggerChildren: reduceMotion ? 0 : 0.05,
              },
            },
          }}
        >
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber value={summary.currentPct} suffix="%" />
            </div>
            <div className={styles.infoText}>{summary.currentDone} из {summary.currentTotal}</div>
          </motion.div>
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber
                value={summaryDiff}
                prefix={summaryDiff > 0 ? '+' : ''}
                suffix="%"
              />
            </div>
            <div className={styles.infoText}>vs прошлый</div>
          </motion.div>
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber value={perfectDays} />
            </div>
            <div className={styles.infoText}>идеальных дней</div>
          </motion.div>
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber value={bestWeekPct} suffix="%" />
            </div>
            <div className={styles.infoText}>лучшая неделя</div>
          </motion.div>
        </motion.section>

        <motion.section
          className={styles.section}
          variants={sectionVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: ANALYTICS_EASE, delay: 0.12 }}
        >
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Привычки</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'rgba(0,0,0,0.28)' }}>chevron_right</span>
          </div>
          <div>
            {breakdown.map((row, index) => (
              <motion.div
                key={row.habit.id}
                className={styles.habitRow}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.24,
                  ease: ANALYTICS_EASE,
                  delay: reduceMotion ? 0 : 0.08 + index * 0.035,
                }}
              >
                <div className={styles.habitName}>{row.habit.name}</div>
                <div className={styles.habitLine}>
                  <span className={styles.habitPctLeft}>{row.previousPct}%</span>
                  <div className={styles.habitBarTrack}>
                    <motion.div
                      className={styles.habitBarFill}
                      initial={{ width: `${row.previousPct}%` }}
                      animate={{ width: `${row.currentPct}%` }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.5,
                        ease: ANALYTICS_EASE,
                        delay: reduceMotion ? 0 : 0.12 + index * 0.035,
                      }}
                    />
                  </div>
                  <span className={styles.habitPctRight}>{row.diffText}</span>
                </div>
                <div className={styles.habitMeta}>
                  <span>Стрик: {row.streak} {getStreakUnit(row.habit)}</span>
                  <span>Рекорд: {row.bestStreak} {getStreakUnit(row.habit)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className={styles.recordsGrid}
          initial="initial"
          animate="animate"
          variants={{
            initial: {},
            animate: {
              transition: {
                delayChildren: reduceMotion ? 0 : 0.16,
                staggerChildren: reduceMotion ? 0 : 0.05,
              },
            },
          }}
        >
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber value={recordHabits.best.value} />
            </div>
            <div className={styles.infoText}>рекорд стрика</div>
            <div className={styles.infoSub}>{recordHabits.best.name}</div>
          </motion.div>
          <motion.div
            className={styles.infoCard}
            variants={sectionVariants}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: ANALYTICS_EASE }}
          >
            <div className={styles.infoValue}>
              <AnimatedNumber value={recordHabits.current.value} />
            </div>
            <div className={styles.infoText}>текущий стрик</div>
            <div className={styles.infoSub}>{recordHabits.current.name}</div>
          </motion.div>
        </motion.section>

        <motion.section
          className={styles.activitySection}
          variants={sectionVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: ANALYTICS_EASE, delay: 0.2 }}
        >
          <div className={styles.sectionHeadCompact}>
            <span className={styles.sectionTitle}>Активность</span>
            <div className={styles.legend}>
              <span className={styles.legendBox} style={{ background: '#e8e8e8' }} />
              <span className={styles.legendBox} style={{ background: 'rgba(0,0,0,0.2)' }} />
              <span className={styles.legendBox} style={{ background: 'rgba(0,0,0,0.55)' }} />
              <span className={styles.legendBox} style={{ background: '#000' }} />
            </div>
          </div>

          {period === 'week' ? (
            <motion.div
              key={viewKey}
              className={styles.weekGrid}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: ANALYTICS_EASE }}
            >
              {weekCells.map((cell) => (
                <div key={cell.day} className={styles.weekCol}>
                  <div
                    className={`${styles.weekCell} ${cell.isToday ? styles.todayCell : ''}`}
                    style={{
                      background: cell.color,
                      opacity: cell.isFuture ? 0.4 : 1,
                    }}
                  />
                  <span className={`${styles.weekLabel} ${cell.isToday ? styles.weekLabelToday : ''}`}>{cell.label}</span>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: ANALYTICS_EASE }}
            >
              <div className={styles.monthHead}>
                {WEEK_DOW.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className={styles.monthGrid}>
                {monthCells.map((cell) => {
                  if (cell.empty) {
                    return <div key={cell.key} className={styles.monthEmpty} />
                  }

                  const completion = getDayCompletion(cell.date!)
                  const isFuture = completion === null
                  const isToday = cell.date === todayKey

                  let color = '#f0f0f0'
                  if (isFuture) {
                    color = '#f8f8f8'
                  } else if ((completion ?? 0) > 0.67) {
                    color = '#000'
                  } else if ((completion ?? 0) > 0.34) {
                    color = 'rgba(0,0,0,0.45)'
                  } else if ((completion ?? 0) > 0) {
                    color = 'rgba(0,0,0,0.18)'
                  }

                  return (
                    <div
                      key={cell.key}
                      className={`${styles.monthCell} ${isToday ? styles.todayCell : ''}`}
                      style={{
                        background: color,
                        opacity: isFuture ? 0.35 : 1,
                      }}
                    >
                      <span
                        className={styles.monthNum}
                        style={{ color: completion === 1 && !isFuture ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)' }}
                      >
                        {cell.day}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
