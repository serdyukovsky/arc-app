import { useEffect, useMemo, type KeyboardEvent } from 'react'
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

const BANNER_TYPES: PopupType[] = ['streak_lost', 'milestone_reached']

const isBannerType = (type: PopupType): boolean => BANNER_TYPES.includes(type)

const getTag = (type: PopupType): string => {
  if (type === 'all_done') return 'ИТОГ ДНЯ'
  if (type === 'first_complete') return 'ПЕРВЫЙ ШАГ'
  if (type === 'goal_reached') return 'ЦЕЛЬ ДОСТИГНУТА'
  return 'СОБЫТИЕ'
}

const getBannerSymbolId = (type: PopupType): string => {
  if (type === 'milestone_reached') return '#illo-ok'
  return '#illo-sad'
}

const getModalSymbolId = (type: PopupType): string => {
  if (type === 'first_complete') return '#illo-ok-lg'
  return '#illo-celebrate-lg'
}

const bannerTransition = { duration: 0.4, ease: [0.34, 1.4, 0.64, 1] as [number, number, number, number] }

export function PopupLayer({ event, onClose, onPrimaryAction, onSecondaryAction }: PopupLayerProps) {
  const text = useMemo(() => {
    if (!event) return null
    return POPUP_TEXTS[event.type](event.data)
  }, [event?.order])

  useEffect(() => {
    if (!event || !isBannerType(event.type)) return
    const timeout = window.setTimeout(() => {
      onClose()
    }, 3500)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [event, onClose])

  if (typeof document === 'undefined') return null

  const handleCloseKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onClose()
  }

  const renderPopup = (popupEvent: PopupEvent) => {
    if (!text) return null
    if (isBannerType(popupEvent.type)) return showBanner(popupEvent, text)
    return showModal(popupEvent, text)
  }

  const showBanner = (popupEvent: PopupEvent, popupText: { title: string; subtitle: string }) => (
    <div className={styles.bannerHost}>
      <motion.div
        key={`banner-${popupEvent.order}`}
        className={styles.banner}
        initial={{ top: -120, opacity: 0 }}
        animate={{ top: 10, opacity: 1 }}
        exit={{ top: -120, opacity: 0 }}
        transition={bannerTransition}
      >
        <div className={styles.banner__top}>
          <div className={styles.banner__illo}>
            <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <use href={getBannerSymbolId(popupEvent.type)} />
            </svg>
          </div>
          <div className={styles.banner__text}>
            <div className={styles.banner__title}>{popupText.title}</div>
            <div className={styles.banner__subtitle}>{popupText.subtitle}</div>
          </div>
          <div
            className={styles.banner__close}
            role="button"
            tabIndex={0}
            onClick={onClose}
            onKeyDown={handleCloseKeyDown}
          >
            ×
          </div>
        </div>
      </motion.div>
    </div>
  )

  const showModal = (popupEvent: PopupEvent, popupText: { title: string; subtitle: string }) => {
    const streaks = popupEvent.data.streaks ?? []
    const completedCount = popupEvent.data.completedCount ?? 0
    const seriesDays = popupEvent.data.seriesDays ?? 0
    const weekCompletion = popupEvent.data.weekCompletion ?? 0
    const goalDays = popupEvent.data.goalDays ?? 0
    const streak = popupEvent.data.streak ?? 0
    const lifetimeDays = popupEvent.data.lifetimeDays ?? 0
    const firstCompleteTips = FIRST_COMPLETE_TIPS[popupEvent.data.habitType ?? 'daily']

    return (
      <motion.div
        key={`modal-${popupEvent.order}`}
        className={styles['modal-overlay']}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.4, ease: [0.34, 1.2, 0.64, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modal__illo}>
            <svg width="210" height="182" viewBox="0 0 150 130" fill="none" aria-hidden="true">
              <use href={getModalSymbolId(popupEvent.type)} />
            </svg>
          </div>

          <div className={styles.modal__body}>
            <div className={styles.modal__tag}>{getTag(popupEvent.type)}</div>
            <div className={styles.modal__title}>{popupText.title}</div>
            <div className={styles.modal__subtitle}>{popupText.subtitle}</div>

            {popupEvent.type === 'all_done' && (
              <>
                <div className={styles['stats-row']}>
                  <div className={styles['stats-row__item']}>
                    <div className={styles['stats-row__num']}>{completedCount}</div>
                    <div className={styles['stats-row__label']}>привычки закрыты</div>
                  </div>
                  <div className={styles['stats-row__item']}>
                    <div className={styles['stats-row__num']}>{seriesDays}</div>
                    <div className={styles['stats-row__label']}>дней подряд</div>
                  </div>
                  <div className={styles['stats-row__item']}>
                    <div className={styles['stats-row__num']}>{weekCompletion}%</div>
                    <div className={styles['stats-row__label']}>эта неделя</div>
                  </div>
                </div>
                <hr className={styles.modal__divider} />
                <div className={styles['streaks-row']}>
                  {streaks.map((entry, index) => (
                    <div className={styles['streak-pill']} key={`${entry.name}-${index}`}>
                      <span className={styles['streak-pill__name']}>{entry.name}</span>
                      <span className={styles['streak-pill__val']}>
                        {entry.streak}
                        {entry.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {popupEvent.type === 'first_complete' && (
              <div className={styles.tips}>
                {firstCompleteTips.map((tip) => (
                  <div className={styles.tips__item} key={tip}>
                    <span className={styles.tips__dot} />
                    <span className={styles.tips__text}>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            {popupEvent.type === 'goal_reached' && (
              <div className={styles['stats-cards']}>
                <div className={styles['stats-cards__item']}>
                  <div className={styles['stats-cards__num']}>{goalDays}</div>
                  <div className={styles['stats-cards__label']}>цель</div>
                </div>
                <div className={styles['stats-cards__item']}>
                  <div className={styles['stats-cards__num']}>{streak}</div>
                  <div className={styles['stats-cards__label']}>стрик</div>
                </div>
                <div className={styles['stats-cards__item']}>
                  <div className={styles['stats-cards__num']}>{lifetimeDays}</div>
                  <div className={styles['stats-cards__label']}>всего</div>
                </div>
              </div>
            )}

            {popupEvent.type === 'goal_reached' ? (
              <div className={styles['modal__btn-row']}>
                <button
                  type="button"
                  className={styles.modal__btn}
                  onClick={() => {
                    onPrimaryAction?.(popupEvent)
                    onClose()
                  }}
                >
                  Продолжить
                </button>
                <button
                  type="button"
                  className={`${styles.modal__btn} ${styles['modal__btn--ghost']}`}
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
                className={styles.modal__btn}
                onClick={() => {
                  onPrimaryAction?.(popupEvent)
                  onClose()
                }}
              >
                Продолжить
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return createPortal(
    <div className={styles.layerRoot}>
      <PopupIllustrationSymbols />
      <AnimatePresence initial={false} mode="wait">
        {event ? renderPopup(event) : null}
      </AnimatePresence>
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

        <symbol id="illo-ok-lg" viewBox="0 0 150 130">
          <g transform="translate(15 5)">
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
          </g>
        </symbol>

        <symbol id="illo-celebrate-lg" viewBox="0 0 150 130">
          <g transform="translate(15 5)">
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
          </g>
        </symbol>
      </defs>
    </svg>
  )
}
