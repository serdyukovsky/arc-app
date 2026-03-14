import { useEffect, useMemo, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { PopupEvent, PopupType } from '@/lib/popups'
import { FIRST_COMPLETE_TIPS, POPUP_TEXTS } from '@/lib/popupTexts'
import streakLostSvgRaw from '@/assets/peeps-streak-lost.svg?raw'
import freezeOfferSvgRaw from '@/assets/peeps-freeze-offer.svg?raw'
import milestoneSvgRaw from '@/assets/peeps-milestone.svg?raw'
import allDoneSvg from '@/assets/peeps-all-done.svg'
import firstCompleteSvg from '@/assets/peeps-first-complete.svg'
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

const BANNER_VIEWBOX: Record<'streak_lost' | 'freeze_offer' | 'milestone_reached', string> = {
  streak_lost: '200 110 520 520',
  freeze_offer: '200 110 520 520',
  milestone_reached: '130 68 280 280',
}

const BANNER_SVG_RAW: Record<'streak_lost' | 'freeze_offer' | 'milestone_reached', string> = {
  streak_lost: streakLostSvgRaw,
  freeze_offer: freezeOfferSvgRaw,
  milestone_reached: milestoneSvgRaw,
}

const patchSvgViewBox = (svg: string, viewBox: string): string => {
  const withReplacedViewBox = svg.replace(/viewBox=['\"][^'\"]*['\"]/i, `viewBox="${viewBox}"`)
  if (withReplacedViewBox !== svg) return withReplacedViewBox
  return svg.replace(/<svg(\s|>)/i, `<svg viewBox="${viewBox}"$1`)
}

const toSvgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const BANNER_FACE_ILLUSTRATIONS: Record<'streak_lost' | 'freeze_offer' | 'milestone_reached', string> = {
  streak_lost: toSvgDataUrl(patchSvgViewBox(BANNER_SVG_RAW.streak_lost, BANNER_VIEWBOX.streak_lost)),
  freeze_offer: toSvgDataUrl(patchSvgViewBox(BANNER_SVG_RAW.freeze_offer, BANNER_VIEWBOX.freeze_offer)),
  milestone_reached: toSvgDataUrl(
    patchSvgViewBox(BANNER_SVG_RAW.milestone_reached, BANNER_VIEWBOX.milestone_reached)
  ),
}

const getBannerIllustrationSrc = (type: PopupType): string => {
  if (type === 'streak_lost') return BANNER_FACE_ILLUSTRATIONS.streak_lost
  if (type === 'milestone_reached') return BANNER_FACE_ILLUSTRATIONS.milestone_reached
  return BANNER_FACE_ILLUSTRATIONS.freeze_offer
}

const getModalIllustration = (type: PopupType): { src: string; align: 'left' | 'center' } => {
  if (type === 'first_complete') return { src: firstCompleteSvg, align: 'center' }
  return { src: allDoneSvg, align: 'left' }
}

const bannerTransition = {
  duration: 0.4,
  ease: [0.34, 1.4, 0.64, 1] as [number, number, number, number],
}

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

  const showBanner = (popupEvent: PopupEvent, popupText: { title: string; subtitle: string }) => {
    const hasButton = popupEvent.type === 'freeze_offer'
    const topClass = hasButton
      ? `${styles.banner__top} ${styles['banner__top--has-btn']}`
      : styles.banner__top

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
          <div className={topClass}>
            <div className={styles.banner__illo}>
              <img
                src={getBannerIllustrationSrc(popupEvent.type)}
                width={44}
                height={44}
                alt=""
                draggable={false}
              />
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

          {hasButton && (
            <button
              type="button"
              className={styles.banner__btn}
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

  const showModal = (popupEvent: PopupEvent, popupText: { title: string; subtitle: string }) => {
    const streaks = popupEvent.data.streaks ?? []
    const completedCount = popupEvent.data.completedCount ?? 0
    const seriesDays = popupEvent.data.seriesDays ?? 0
    const weekCompletion = popupEvent.data.weekCompletion ?? 0
    const goalDays = popupEvent.data.goalDays ?? 0
    const streak = popupEvent.data.streak ?? 0
    const lifetimeDays = popupEvent.data.lifetimeDays ?? 0
    const firstCompleteTips = FIRST_COMPLETE_TIPS[popupEvent.data.habitType ?? 'daily']

    const illo = getModalIllustration(popupEvent.type)
    const illoAlignClass =
      illo.align === 'left' ? styles['modal__illo--left'] : styles['modal__illo--center']

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
          <div className={`${styles.modal__illo} ${illoAlignClass}`}>
            <img src={illo.src} alt="" draggable={false} />
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
      <AnimatePresence initial={false} mode="wait">
        {event ? renderPopup(event) : null}
      </AnimatePresence>
    </div>,
    document.body
  )
}
