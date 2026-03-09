import { AnimatePresence, motion } from 'framer-motion'
import type { ToastData } from '@/hooks/useToast'
import styles from './Toast.module.css'

interface ToastProps {
  toast: ToastData | null
  onHide: () => void
}

export function Toast({ toast, onHide }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={styles.toast}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <span className={styles.message}>{toast.message}</span>
          {toast.onUndo && (
            <button
              className={styles.undo}
              onClick={() => {
                toast.onUndo?.()
                onHide()
              }}
            >
              Отменить
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
