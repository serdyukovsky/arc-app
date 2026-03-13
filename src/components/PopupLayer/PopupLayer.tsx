import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { PopupEvent, PopupType } from '@/lib/popups'
import { FIRST_COMPLETE_TIPS, POPUP_TEXTS } from '@/lib/popupTexts'
import styles from './PopupLayer.module.css'

interface PopupLayerProps {
  event: PopupEvent | null
  onClose: () => void
  onPrimaryAction?: (event: PopupEvent) => void
  onSecondaryAction?: (event: PopupEvent) => void
}

const BANNER_TYPES: PopupType[] = ['streak_lost', 'milestone_reached', 'freeze_offer']

const isBannerType = (type: PopupType): boolean => BANNER_TYPES.includes(type)

const getTag = (type: PopupType): string => {
  if (type === 'all_done') return 'ИТОГ ДНЯ'
  if (type === 'first_complete') return 'ПЕРВЫЙ ШАГ'
  if (type === 'goal_reached') return 'ЦЕЛЬ ДОСТИГНУТА'
  return 'СОБЫТИЕ'
}

const getSymbolId = (type: PopupType): string => {
  if (type === 'milestone_reached') return '#illo-ok'
  if (type === 'streak_lost') return '#illo-sad'
  if (type === 'freeze_offer') return '#illo-freeze'
  return '#illo-celebrate'
}

const bannerTransition = { duration: 0.4, ease: [0.34, 1.4, 0.64, 1] as [number, number, number, number] }

export function PopupLayer({ event, onClose, onPrimaryAction, onSecondaryAction }: PopupLayerProps) {
  const text = useMemo(() => {
    if (!event) return null
    return POPUP_TEXTS[event.type](event.data)
  }, [event?.order])

  useEffect(() => {
    if (!event || !isBannerType(event.type) || event.type === 'freeze_offer') return
    const timeout = window.setTimeout(() => {
      onClose()
    }, 3500)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [event, onClose])

  if (typeof document === 'undefined') return null

  const renderPopup = (popupEvent: PopupEvent) => {
    if (!text) return null
    if (isBannerType(popupEvent.type)) return showBanner(popupEvent, text)
    return showModal(popupEvent, text)
  }

  const showBanner = (
    popupEvent: PopupEvent,
    popupText: { title: string; subtitle: string }
  ) => {
    const symbolId = getSymbolId(popupEvent.type)
    return (
      <div className={styles.bannerHost}>
        <motion.div
          key={`banner-${popupEvent.order}`}
          className={styles.banner}
          initial={{ top: -120, opacity: 0 }}
          animate={{ top: 10, opacity: 1 }}
          exit={{ top: -120, opacity: 0 }}
          transition={bannerTransition}
        >
          <div className={styles.bannerTop}>
            <div className={styles.illoSmallWrap}>
              <svg width="26" height="26" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <use href={symbolId} />
              </svg>
            </div>
            <div className={styles.bannerText}>
              <div className={styles.bannerTitle}>{popupText.title}</div>
              <div className={styles.bannerSubtitle}>{popupText.subtitle}</div>
            </div>
            <button type="button" className={styles.bannerClose} onClick={onClose}>
              ×
            </button>
          </div>

          {popupEvent.type === 'freeze_offer' && (
            <button
              type="button"
              className={styles.bannerAction}
              onClick={() => {
                onPrimaryAction?.(popupEvent)
                onClose()
              }}
            >
              Заморозить
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  const showModal = (
    popupEvent: PopupEvent,
    popupText: { title: string; subtitle: string }
  ) => {
    const symbolId = getSymbolId(popupEvent.type)
    const streaks = popupEvent.data.streaks ?? []
    const completedCount = popupEvent.data.completedCount ?? 0
    const seriesDays = popupEvent.data.seriesDays ?? 0
    const weekCompletion = popupEvent.data.weekCompletion ?? 0
    const goalDays = popupEvent.data.goalDays ?? 0
    const streak = popupEvent.data.streak ?? 0
    const lifetimeDays = popupEvent.data.lifetimeDays ?? 0

    const firstCompleteTips = FIRST_COMPLETE_TIPS[popupEvent.data.habitType ?? 'daily']

    return (
      <motion.div key={`modal-${popupEvent.order}`} className={styles.modalHost}>
        <motion.div
          className={styles.modalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
              onClick={onClose}
        />
        <div className={styles.modalSheetWrap}>
          <motion.div
            className={styles.modalSheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.4, ease: [0.34, 1.2, 0.64, 1] }}
          >
            <div className={styles.illoLargeZone}>
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <use href={symbolId} />
              </svg>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.tag}>{getTag(popupEvent.type)}</div>
              <div className={styles.modalTitle}>{popupText.title}</div>
              <div className={styles.modalSubtitle}>{popupText.subtitle}</div>

              <div className={styles.dataBlock}>
                {popupEvent.type === 'all_done' && (
                  <>
                    <div className={styles.allDoneStats}>
                      <div className={styles.allDoneStat}>
                        <div className={styles.statValue}>{completedCount}</div>
                        <div className={styles.statLabel}>привычки закрыты</div>
                      </div>
                      <div className={styles.allDoneStat}>
                        <div className={styles.statValue}>{seriesDays}</div>
                        <div className={styles.statLabel}>дней подряд</div>
                      </div>
                      <div className={styles.allDoneStat}>
                        <div className={styles.statValue}>{weekCompletion}%</div>
                        <div className={styles.statLabel}>эта неделя</div>
                      </div>
                    </div>
                    <div className={styles.hr} />
                    <div className={styles.streakPills}>
                      {streaks.map((entry, index) => (
                        <div className={styles.streakPill} key={`${entry.name}-${index}`}>
                          <span className={styles.streakName}>{entry.name}</span>
                          <span className={styles.streakVal}>
                            {entry.streak}
                            {entry.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {popupEvent.type === 'first_complete' && (
                  <div className={styles.tipsBox}>
                    {firstCompleteTips.map((tip) => (
                      <div className={styles.tip} key={tip}>
                        <span className={styles.tipDot} />
                        <span className={styles.tipText}>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}

                {popupEvent.type === 'goal_reached' && (
                  <div className={styles.goalStats}>
                    <div className={styles.goalCard}>
                      <div className={styles.goalValue}>{goalDays}</div>
                      <div className={styles.goalLabel}>цель</div>
                    </div>
                    <div className={styles.goalCard}>
                      <div className={styles.goalValue}>{streak}</div>
                      <div className={styles.goalLabel}>текущий стрик</div>
                    </div>
                    <div className={styles.goalCard}>
                      <div className={styles.goalValue}>{lifetimeDays}</div>
                      <div className={styles.goalLabel}>всего выполнено</div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.actions}>
                {popupEvent.type === 'goal_reached' ? (
                  <div className={styles.doubleBtns}>
                    <button
                      type="button"
                      className={styles.singleBtn}
                      onClick={() => {
                        onPrimaryAction?.(popupEvent)
                        onClose()
                      }}
                    >
                      Продолжить
                    </button>
                    <button
                      type="button"
                      className={`${styles.singleBtn} ${styles.secondaryBtn}`}
                      onClick={() => {
                        onSecondaryAction?.(popupEvent)
                        onClose()
                      }}
                    >
                      Завершить
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.singleBtn}
                    onClick={() => {
                      onPrimaryAction?.(popupEvent)
                      onClose()
                    }}
                  >
                    Отлично
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return createPortal(
    <div className={styles.layerRoot}>
      <PopupIllustrationSymbols />
      <AnimatePresence initial={false}>{event ? renderPopup(event) : null}</AnimatePresence>
    </div>,
    document.body
  )
}

function PopupIllustrationSymbols() {
  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="illo-ok" viewBox="0 0 120 120">
          <circle cx="60" cy="30" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M44 62c6-8 26-8 32 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M60 42v23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M45 74l-9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M75 74l9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M39 52l-10-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M81 52l10-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M54 27h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M65 27h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M48 15l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M72 15l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        <symbol id="illo-sad" viewBox="0 0 120 120">
          <circle cx="60" cy="30" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M45 64c7-8 23-8 30 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M60 42v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M44 76l-8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M76 76l8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M52 31h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 31h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M52 39c3-2 11-2 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M26 18l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M31 15l-2 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        <symbol id="illo-freeze" viewBox="0 0 120 120">
          <circle cx="60" cy="32" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M60 44v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M46 60h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M44 76l-8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M76 76l8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 52h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M88 52h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 38l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M96 38l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 66l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M96 66l-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M54 30h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M65 30h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        <symbol id="illo-celebrate" viewBox="0 0 120 120">
          <circle cx="60" cy="32" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M60 44v22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 52l-18-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 52l18-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M46 66h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M46 76l-8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M74 76l8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M28 22l8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M92 22l-8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M37 14l5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M83 14l-5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 10v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  )
}
