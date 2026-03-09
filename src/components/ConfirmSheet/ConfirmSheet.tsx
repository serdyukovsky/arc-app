import { Drawer } from '@/components/Drawer/Drawer'
import styles from './ConfirmSheet.module.css'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  habitName?: string
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  habitName,
}: ConfirmSheetProps) {
  return (
    <Drawer open={open} onClose={onClose}>
      <div className={styles.content}>
        <h3 className={styles.title}>Удалить привычку?</h3>
        <p className={styles.message}>«{habitName ?? 'Привычка'}» будет удалена навсегда</p>
        <button
          className={styles.danger}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          Удалить
        </button>
        <button className={styles.cancel} onClick={onClose}>
          Отмена
        </button>
      </div>
    </Drawer>
  )
}
