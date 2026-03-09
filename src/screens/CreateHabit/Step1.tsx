import type { Category } from '@/types'
import { CATEGORIES } from '@/types'
import { Icon } from '@/components/Icon/Icon'
import styles from './CreateHabit.module.css'

interface Step1Props {
  name: string
  onNameChange: (v: string) => void
  category: Category | null
  onCategoryChange: (v: Category) => void
}

export default function Step1({ name, onNameChange, category, onCategoryChange }: Step1Props) {
  return (
    <div className={styles.step}>
      <div className={styles.stepMeta}>ШАГ 1 ИЗ 3</div>
      <h1 className={styles.stepTitle}>Что за привычка?</h1>

      <input
        className={styles.input}
        placeholder="Например, медитация"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        autoFocus
        maxLength={40}
      />
      <div className={styles.inputLabel}>Название привычки</div>

      <div className={styles.sectionTitle}>Категория</div>
      <div className={styles.catGrid}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.catItem} ${category === cat.id ? styles.selected : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            <Icon name={cat.icon} size={22} />
            <span className={styles.catLabel}>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
