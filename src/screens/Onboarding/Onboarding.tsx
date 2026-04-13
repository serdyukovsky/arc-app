import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Category, HabitType, ReminderSlot } from '@/types'
import { triggerHaptic } from '@/lib/haptics'
import type { CreateHabitData } from '@/screens/CreateHabit/CreateHabit'
import { BASE_STREAK, DemoCard } from './DemoCard'
import styles from './Onboarding.module.css'

interface OnboardingProps {
  onComplete: (habits: CreateHabitData[]) => Promise<void> | void
}

interface Preset {
  id: string
  name: string
  category: Category
  type: HabitType
  goal: number
  goalDays: number | null
  icon: string
}

const PRESETS: Preset[] = [
  { id: 'water', name: 'Вода', category: 'body', type: 'counter', goal: 8, goalDays: 21, icon: 'water_drop' },
  { id: 'workout', name: 'Тренировка', category: 'move', type: 'periodic', goal: 3, goalDays: 8, icon: 'fitness_center' },
  { id: 'steps', name: '8 000 шагов', category: 'move', type: 'counter', goal: 8, goalDays: 21, icon: 'directions_walk' },
  { id: 'read', name: 'Чтение', category: 'read', type: 'daily', goal: 1, goalDays: 21, icon: 'menu_book' },
  { id: 'meditate', name: 'Медитация', category: 'mind', type: 'daily', goal: 1, goalDays: 21, icon: 'self_improvement' },
  { id: 'sleep', name: 'Сон вовремя', category: 'body', type: 'daily', goal: 1, goalDays: 21, icon: 'bedtime' },
  { id: 'journal', name: 'Дневник', category: 'focus', type: 'daily', goal: 1, goalDays: 14, icon: 'edit_note' },
  { id: 'english', name: 'Английский', category: 'focus', type: 'periodic', goal: 4, goalDays: 10, icon: 'translate' },
  { id: 'nosugar', name: 'Без сахара', category: 'food', type: 'daily', goal: 1, goalDays: 21, icon: 'no_food' },
  { id: 'stretch', name: 'Растяжка', category: 'body', type: 'daily', goal: 1, goalDays: 21, icon: 'accessibility_new' },
  { id: 'cold', name: 'Холодный душ', category: 'body', type: 'daily', goal: 1, goalDays: 21, icon: 'shower' },
  { id: 'call', name: 'Близким', category: 'social', type: 'periodic', goal: 2, goalDays: 8, icon: 'call' },
]

const TOTAL_STEPS = 5

const stepVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('09:00')
  const [submitting, setSubmitting] = useState(false)
  const [longPressSheetOpen, setLongPressSheetOpen] = useState(false)

  const next = useCallback(() => {
    triggerHaptic('light')
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))
  }, [])

  const back = useCallback(() => {
    triggerHaptic('light')
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const togglePreset = useCallback((id: string) => {
    triggerHaptic('light')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const finish = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    triggerHaptic('success')

    const reminderSlot: ReminderSlot = reminderEnabled ? 'custom' : 'none'
    const habits: CreateHabitData[] = PRESETS.filter((p) => selected.has(p.id)).map((p) => ({
      name: p.name,
      category: p.category,
      type: p.type,
      goal: p.type === 'daily' ? 1 : p.goal,
      goalDays: p.goalDays,
      reminder: reminderSlot,
      ...(reminderSlot === 'custom' ? { reminderTime } : {}),
    }))

    await onComplete(habits)
  }, [submitting, reminderEnabled, reminderTime, selected, onComplete])

  const canGoNext = useMemo(() => {
    if (step === 3) return selected.size >= 1
    return true
  }, [step, selected])

  const isFinalStep = step === TOTAL_STEPS - 1

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={back}
          disabled={step === 0}
          aria-label="Назад"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            arrow_back
          </span>
        </button>

        <div className={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${
                i < step ? styles.dotPast : ''
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.skipBtn}
          onClick={finish}
          disabled={submitting}
        >
          Пропустить
        </button>
      </div>

      <div className={styles.body}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className={styles.pane}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && <WelcomeStep />}
            {step === 1 && <TapDemoStep />}
            {step === 2 && (
              <LongPressDemoStep onSheetChange={setLongPressSheetOpen} />
            )}
            {step === 3 && (
              <PresetsStep selected={selected} onToggle={togglePreset} />
            )}
            {step === 4 && (
              <ReminderStep
                enabled={reminderEnabled}
                time={reminderTime}
                onEnabledChange={setReminderEnabled}
                onTimeChange={setReminderTime}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.footer}>
        {isFinalStep ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={finish}
            disabled={submitting}
          >
            {submitting ? 'Запускаем…' : 'Поехали'}
          </button>
        ) : step === 3 ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={next}
            disabled={!canGoNext}
          >
            {selected.size > 0 ? `Далее · ${selected.size}` : 'Выбери привычку'}
          </button>
        ) : (
          <button
            type="button"
            className={styles.circleBtn}
            onClick={next}
            aria-label="Далее"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              arrow_forward
            </span>
          </button>
        )}
      </div>

      {step === 2 && (
        <p className={styles.demoSubOverlay}>
          Стрик, рекорд, % выполнения — по каждой привычке.
        </p>
      )}

      <div
        className={`${styles.miniSheet} ${longPressSheetOpen ? styles.miniSheetOpen : ''}`}
        aria-hidden
      >
        <div className={styles.miniSheetHandle} />
        <div className={styles.miniSheetRow}>
          <div className={styles.miniSheetCell}>
            <div className={styles.miniSheetVal}>{BASE_STREAK}</div>
            <div className={styles.miniSheetLabel}>дней стрика</div>
          </div>
          <div className={styles.miniSheetCell}>
            <div className={styles.miniSheetVal}>17</div>
            <div className={styles.miniSheetLabel}>лучший рекорд</div>
          </div>
          <div className={styles.miniSheetCell}>
            <div className={styles.miniSheetVal}>72%</div>
            <div className={styles.miniSheetLabel}>выполнено</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className={styles.heroPane}>
      <h1 className={styles.heroTitle}>
        Привычки.
        <br />
        Один тап.
      </h1>
      <p className={styles.heroSub}>
        Никаких сложных настроек. Только ты и твой стрик.
      </p>
    </div>
  )
}

function TapDemoStep() {
  return (
    <div className={styles.demoPane}>
      <div className={styles.demoTextTop}>
        <div className={styles.eyebrow}>Шаг 1</div>
        <h2 className={styles.demoTitle}>
          Один тап —<br />
          привычка сделана
        </h2>
      </div>
      <DemoCard mode="tap" />
      <p className={styles.demoSub}>
        Тапни по карточке. Стрик растёт сам.
      </p>
    </div>
  )
}

function LongPressDemoStep({ onSheetChange }: { onSheetChange: (open: boolean) => void }) {
  return (
    <div className={styles.demoPane}>
      <div className={styles.demoTextTop}>
        <div className={styles.eyebrow}>Шаг 2</div>
        <h2 className={styles.demoTitle}>
          Зажми —<br />
          увидишь аналитику
        </h2>
      </div>
      <DemoCard mode="longpress" onSheetChange={onSheetChange} />
    </div>
  )
}

interface PresetsStepProps {
  selected: Set<string>
  onToggle: (id: string) => void
}

function PresetsStep({ selected, onToggle }: PresetsStepProps) {
  return (
    <div className={styles.presetsPane}>
      <div className={styles.eyebrow}>Шаг 3</div>
      <h2 className={styles.sectionTitle}>
        С чего<br />
        начнём?
      </h2>
      <p className={styles.sectionSub}>
        Выбери привычки, которые хочешь тренировать.
      </p>
      <div className={styles.presetGrid}>
        {PRESETS.map((p) => {
          const isSelected = selected.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              className={`${styles.presetItem} ${isSelected ? styles.presetItemActive : ''}`}
              onClick={() => onToggle(p.id)}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 26 }}
              >
                {p.icon}
              </span>
              <span className={styles.presetLabel}>{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ReminderStepProps {
  enabled: boolean
  time: string
  onEnabledChange: (v: boolean) => void
  onTimeChange: (v: string) => void
}

function ReminderStep({ enabled, time, onEnabledChange, onTimeChange }: ReminderStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    if (!enabled) return
    const el = inputRef.current
    if (!el) return
    triggerHaptic('light')
    const anyEl = el as HTMLInputElement & { showPicker?: () => void }
    if (typeof anyEl.showPicker === 'function') {
      anyEl.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }

  const [hh, mm] = time.split(':')

  return (
    <div className={styles.reminderPane}>
      <div className={styles.eyebrow}>Шаг 4</div>
      <h2 className={styles.sectionTitle}>
        Когда<br />
        напомнить?
      </h2>
      <p className={styles.sectionSub}>
        Одно мягкое напоминание в день. Без спама.
      </p>

      <button
        type="button"
        className={`${styles.timeDisplay} ${!enabled ? styles.timeDisplayOff : ''}`}
        onClick={openPicker}
        disabled={!enabled}
      >
        <span className={styles.timeDigits}>{hh}</span>
        <span className={styles.timeColon}>:</span>
        <span className={styles.timeDigits}>{mm}</span>
        <input
          ref={inputRef}
          type="time"
          className={styles.timeInputHidden}
          value={time}
          onChange={(e) => onTimeChange(e.target.value || time)}
          tabIndex={-1}
          aria-hidden
        />
      </button>

      <button
        type="button"
        className={`${styles.muteBtn} ${!enabled ? styles.muteBtnActive : ''}`}
        onClick={() => {
          triggerHaptic('light')
          onEnabledChange(!enabled)
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {enabled ? 'notifications_off' : 'notifications_active'}
        </span>
        {enabled ? 'Без напоминаний' : 'Включить напоминания'}
      </button>
    </div>
  )
}
