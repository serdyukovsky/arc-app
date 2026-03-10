import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Habit, HabitType, Category } from '@/types'
import { triggerHaptic } from '@/lib/haptics'
import Step1 from './Step1'
import Step2 from './Step2'
import Step3 from './Step3'
import styles from './CreateHabit.module.css'

interface CreateHabitProps {
  open: boolean
  onClose: () => void
  onCreate: (data: Omit<Habit, 'id' | 'created' | 'isArchived' | 'order' | 'user'>) => Promise<any>
  showToast: (msg: string) => void
}

type Reminder = 'none' | 'morning' | 'day' | 'evening'

const getDefaultGoal = (type: HabitType): number => {
  if (type === 'periodic') return 3
  if (type === 'counter') return 8
  return 1
}

const getDefaultDaysGoal = (type: HabitType): number => (type === 'periodic' ? 8 : 21)

const stepTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export function CreateHabit({ open, onClose, onCreate, showToast }: CreateHabitProps) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [type, setType] = useState<HabitType>('daily')
  const [goal, setGoal] = useState(1)
  const [daysGoal, setDaysGoal] = useState<number | null>(21)
  const [reminder, setReminder] = useState<Reminder>('none')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)

  const reset = () => {
    setStep(1)
    setName('')
    setCategory(null)
    setType('daily')
    setGoal(1)
    setDaysGoal(21)
    setReminder('none')
    setIsSubmitting(false)
    submitLockRef.current = false
  }

  useEffect(() => {
    if (!open) return
    reset()
  }, [open])

  const canGoNext = useMemo(() => {
    if (step === 1) return name.trim().length > 0 && !!category
    return true
  }, [step, name, category])

  const handleTypeChange = (nextType: HabitType) => {
    setType(nextType)
    setGoal(getDefaultGoal(nextType))
    setDaysGoal(getDefaultDaysGoal(nextType))
  }

  const handleNext = async () => {
    if (step < 3) {
      if (!canGoNext) return
      triggerHaptic('light')
      setStep((prev) => prev + 1)
      return
    }

    if (!category || !name.trim() || isSubmitting || submitLockRef.current) return

    submitLockRef.current = true
    triggerHaptic('success')
    setIsSubmitting(true)
    const created = await onCreate({
      name: name.trim(),
      category,
      type,
      goal: type === 'daily' ? 1 : goal,
      daysGoal,
      reminder,
    })

    if (created) {
      showToast(`«${name.trim()}» добавлено ✓`)
      onClose()
      return
    }

    submitLockRef.current = false
    setIsSubmitting(false)
  }

  const handleBack = () => {
    if (isSubmitting) return
    triggerHaptic('light')
    if (step === 1) {
      onClose()
      return
    }
    setStep((prev) => prev - 1)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{
            opacity: { duration: 0.14, ease: 'linear' },
            y: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
          }}
        >
          <div className={styles.header}>
            <button className={styles.backBtn} onClick={handleBack} disabled={isSubmitting}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
            </button>

            <div className={styles.dots}>
              {[1, 2, 3].map((s) => (
                <div key={s} className={`${styles.stepDot} ${s === step ? styles.activeDot : ''}`} />
              ))}
            </div>

            <button className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Отмена
            </button>
          </div>

          <div className={styles.body}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                className={styles.stepPane}
                variants={stepTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {step === 1 && (
                  <Step1
                    name={name}
                    onNameChange={setName}
                    category={category}
                    onCategoryChange={setCategory}
                  />
                )}
                {step === 2 && (
                  <Step2
                    type={type}
                    onTypeChange={handleTypeChange}
                    goal={goal}
                    onGoalChange={setGoal}
                    daysGoal={daysGoal}
                    onDaysGoalChange={setDaysGoal}
                  />
                )}
                {step === 3 && <Step3 reminder={reminder} onReminderChange={setReminder} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className={styles.footer}>
            <button
              className={styles.nextBtn}
              disabled={!canGoNext || isSubmitting}
              onClick={() => void handleNext()}
            >
              {step === 3 ? (isSubmitting ? 'Создаём...' : 'Создать привычку ✓') : 'Далее →'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
