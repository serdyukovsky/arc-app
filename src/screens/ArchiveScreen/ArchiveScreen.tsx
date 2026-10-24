import { AnimatePresence, motion } from 'framer-motion'
import type { Habit } from '@/types'
import { CATEGORIES } from '@/types'
import { Icon } from '@/components/Icon/Icon'
import styles from './ArchiveScreen.module.css'

interface ArchiveScreenProps {
  open: boolean
  onClose: () => void
  habits: Habit[]
  onUnarchive: (id: string) => void
  showToast: (msg: string) => void
}

// Архив открывается из профиля — экраном поверх (как «Уведомления»)
export function ArchiveScreen({ open, onClose, habits, onUnarchive, showToast }: ArchiveScreenProps) {
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
            <button className={styles.backBtn} onClick={onClose}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
            </button>
            <span className={styles.headerTitle}>Архив</span>
          </div>

          <div className={styles.body}>
            {habits.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="archive" size={48} style={{ opacity: 0.2 }} />
                <p>Нет архивированных привычек</p>
              </div>
            ) : (
              <div className={styles.list}>
                {habits.map((h) => {
                  const cat = CATEGORIES.find((c) => c.id === h.category)
                  return (
                    <div key={h.id} className={styles.card}>
                      <div className={styles.info}>
                        <span className={styles.category}>{cat?.label ?? h.category}</span>
                        <span className={styles.name}>{h.name}</span>
                      </div>
                      <button
                        className={styles.restoreBtn}
                        onClick={() => {
                          onUnarchive(h.id)
                          showToast('Привычка восстановлена')
                        }}
                      >
                        <Icon name="unarchive" size={20} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
