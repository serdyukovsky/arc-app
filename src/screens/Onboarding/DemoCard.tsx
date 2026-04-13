import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { DailyCard } from '@/components/HabitCard/DailyCard'
import { buildMilestones } from '@/lib/milestones'
import { today } from '@/lib/date'
import type { Habit } from '@/types'
import { triggerHaptic } from '@/lib/haptics'
import styles from './Onboarding.module.css'

type Mode = 'tap' | 'undo' | 'longpress'

interface DemoCardProps {
  mode: Mode
  onSheetChange?: (open: boolean) => void
}

export const BASE_STREAK = 4
export const BASE_LIFETIME = 12
const GOAL_DAYS = 21

const buildDemoHabit = (): Habit => ({
  id: 'onboarding-demo',
  user: 'demo',
  name: 'Читать 20 страниц',
  category: 'read',
  type: 'daily',
  goal: 1,
  goalDays: GOAL_DAYS,
  daysGoal: GOAL_DAYS,
  streak: BASE_STREAK,
  bestStreak: BASE_STREAK,
  lifetimeDays: BASE_LIFETIME,
  goalCompleted: false,
  currentMilestoneIndex: 1,
  milestones: buildMilestones(GOAL_DAYS, 'daily'),
  firstCompleted: true,
  lastStreakLostShown: null,
  lastFreezeOfferShown: null,
  milestonePopupCount: 0,
  freezesAvailable: 0,
  reminder: 'none',
  created: new Date().toISOString(),
  isArchived: false,
  order: 0,
})

const HABIT = buildDemoHabit()
const TODAY = today()

const buildDoneDates = (includeToday: boolean): Set<string> => {
  const set = new Set<string>()
  // 3 days before today, to make the strip look like a real streak
  const base = new Date()
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    set.add(`${y}-${m}-${day}`)
  }
  if (includeToday) set.add(TODAY)
  return set
}

export function DemoCard({ mode, onSheetChange }: DemoCardProps) {
  const initiallyDone = mode === 'undo'
  const [isDone, setIsDone] = useState(initiallyDone)
  const [doneDates, setDoneDates] = useState<Set<string>>(() => buildDoneDates(initiallyDone))
  const [pulse, setPulse] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [holding, setHolding] = useState(false)
  const [sheetOpen, setSheetOpenInternal] = useState(false)
  const onSheetChangeRef = useRef(onSheetChange)
  useEffect(() => {
    onSheetChangeRef.current = onSheetChange
  }, [onSheetChange])
  const setSheetOpen = (open: boolean) => {
    setSheetOpenInternal(open)
    onSheetChangeRef.current?.(open)
  }
  useEffect(() => {
    return () => {
      onSheetChangeRef.current?.(false)
    }
  }, [])

  const wrapRef = useRef<HTMLDivElement>(null)
  const controls = useAnimationControls()
  const aliveRef = useRef(true)

  // Targets relative to wrapper. Set by layout effect.
  const [targets, setTargets] = useState<{ tap: { x: number; y: number }; day: { x: number; y: number } } | null>(null)

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const measure = () => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cardEl = el.querySelector(`.${styles.demoCardInner}`) as HTMLElement | null
      if (!cardEl) return
      const cardRect = cardEl.getBoundingClientRect()
      const cardLeft = cardRect.left - rect.left
      const cardTop = cardRect.top - rect.top
      const cardW = cardRect.width
      const cardH = cardRect.height

      // Tap target: roughly the big number / center of upper area
      const tap = {
        x: cardLeft + cardW * 0.32,
        y: cardTop + cardH * 0.42,
      }

      // Day target: today's dot in week row at the bottom
      // Mon-based index of today
      const todayDow = new Date().getDay()
      const dayIdx = (todayDow + 6) % 7
      // weekRow lives inside .content with 1.5rem padding (24px)
      const innerLeft = cardLeft + 24
      const innerW = cardW - 48
      const x = innerLeft + (innerW / 7) * (dayIdx + 0.5)
      const y = cardTop + cardH - 28
      const day = { x, y }

      setTargets({ tap, day })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Auto-demo loop
  useEffect(() => {
    if (!targets) return
    let cancelled = false

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms)
        return () => clearTimeout(t)
      })

    const cycle = async () => {
      while (!cancelled) {
        if (mode === 'tap') {
          // reset
          setIsDone(false)
          setDoneDates(buildDoneDates(false))
          await controls.start({
            x: targets.tap.x + 80,
            y: targets.tap.y + 60,
            opacity: 0,
            scale: 1,
            transition: { duration: 0 },
          })
          if (cancelled) return
          await wait(450)
          // appear off-card
          await controls.start({
            opacity: 1,
            transition: { duration: 0.25 },
          })
          if (cancelled) return
          // glide to tap target
          await controls.start({
            x: targets.tap.x,
            y: targets.tap.y,
            transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          })
          if (cancelled) return
          // press
          setPressing(true)
          await controls.start({
            scale: 0.82,
            transition: { duration: 0.12, ease: 'easeOut' },
          })
          if (cancelled) return
          // commit done
          setIsDone(true)
          setDoneDates(buildDoneDates(true))
          setPulse(true)
          triggerHaptic('medium')
          setTimeout(() => setPulse(false), 500)
          await controls.start({
            scale: 1,
            transition: { duration: 0.18, ease: 'easeOut' },
          })
          setPressing(false)
          if (cancelled) return
          // hold + fade cursor
          await wait(900)
          if (cancelled) return
          await controls.start({
            opacity: 0,
            transition: { duration: 0.3 },
          })
          if (cancelled) return
          await wait(1100)
        } else if (mode === 'longpress') {
          // long-press mode: press and hold, then mock analytics sheet appears
          setSheetOpen(false)
          setHolding(false)
          setPressing(false)
          await controls.start({
            x: targets.tap.x + 80,
            y: targets.tap.y + 60,
            opacity: 0,
            scale: 1,
            transition: { duration: 0 },
          })
          if (cancelled) return
          await wait(450)
          await controls.start({
            opacity: 1,
            transition: { duration: 0.25 },
          })
          if (cancelled) return
          await controls.start({
            x: targets.tap.x,
            y: targets.tap.y,
            transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          })
          if (cancelled) return
          // press down and HOLD
          setPressing(true)
          setHolding(true)
          await controls.start({
            scale: 0.82,
            transition: { duration: 0.12, ease: 'easeOut' },
          })
          if (cancelled) return
          // hold duration — should clearly feel "long" before sheet appears
          await wait(1100)
          if (cancelled) return
          triggerHaptic('medium')
          setSheetOpen(true)
          // fade cursor as sheet covers
          await controls.start({
            opacity: 0,
            scale: 1,
            transition: { duration: 0.25 },
          })
          setPressing(false)
          setHolding(false)
          if (cancelled) return
          // dwell on sheet
          await wait(2200)
          if (cancelled) return
          // close sheet, brief pause, restart
          setSheetOpen(false)
          await wait(700)
        } else {
          // undo mode
          setIsDone(true)
          setDoneDates(buildDoneDates(true))
          await controls.start({
            x: targets.day.x + 60,
            y: targets.day.y + 50,
            opacity: 0,
            scale: 1,
            transition: { duration: 0 },
          })
          if (cancelled) return
          await wait(500)
          await controls.start({
            opacity: 1,
            transition: { duration: 0.25 },
          })
          if (cancelled) return
          await controls.start({
            x: targets.day.x,
            y: targets.day.y,
            transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          })
          if (cancelled) return
          setPressing(true)
          await controls.start({
            scale: 0.82,
            transition: { duration: 0.12, ease: 'easeOut' },
          })
          if (cancelled) return
          setIsDone(false)
          setDoneDates(buildDoneDates(false))
          triggerHaptic('light')
          await controls.start({
            scale: 1,
            transition: { duration: 0.18, ease: 'easeOut' },
          })
          setPressing(false)
          if (cancelled) return
          await wait(900)
          if (cancelled) return
          await controls.start({
            opacity: 0,
            transition: { duration: 0.3 },
          })
          if (cancelled) return
          await wait(1100)
        }
      }
    }

    void cycle()
    return () => {
      cancelled = true
    }
  }, [targets, mode, controls])

  return (
    <>
    <div className={styles.demoStage}>
    <div ref={wrapRef} className={styles.demoWrap}>
      <div
        className={`${styles.demoCardInner} ${pressing || holding ? styles.demoCardInnerPressed : ''}`}
      >
      <div
        className={`${styles.demoScrim} ${sheetOpen ? styles.demoScrimOpen : ''}`}
        aria-hidden
      />
        <DailyCard
          habit={HABIT}
          isDone={isDone}
          doneDates={doneDates}
          streak={isDone ? BASE_STREAK + 1 : BASE_STREAK}
          bindLongPress={{}}
          pulse={pulse}
        />
      </div>

      <motion.div
        className={styles.cursor}
        initial={{ opacity: 0, x: 0, y: 0 }}
        animate={controls}
        aria-hidden
      >
        <div className={`${styles.cursorDot} ${pressing ? styles.cursorDotPress : ''}`}>
          {holding && <div className={styles.cursorRing} />}
        </div>
      </motion.div>

      </div>

    </div>
    </>
  )
}
