import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import styles from './Drawer.module.css'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  fullScreen?: boolean
  hideHandle?: boolean
}

export function Drawer({
  open,
  onClose,
  children,
  title,
  fullScreen = false,
  hideHandle = false,
}: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheetViewport}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            <motion.div
              layout
              className={`${styles.sheet} ${fullScreen ? styles.sheetFull : ''}`}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {!hideHandle && <div className={styles.handle} />}
              {title && <div className={styles.title}>{title}</div>}
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
