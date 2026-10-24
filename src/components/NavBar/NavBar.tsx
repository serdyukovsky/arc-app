import { Icon } from '@/components/Icon/Icon'
import styles from './NavBar.module.css'

export type Screen = 'home' | 'analytics' | 'tasks' | 'profile'

interface NavBarProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

// «home» — экран привычек (исторический id); новая привычка — кнопкой «+» в карточке дня на этом экране
const TABS: { id: Screen; icon: string; label: string }[] = [
  { id: 'home', icon: 'routine', label: 'Привычки' },
  { id: 'tasks', icon: 'checklist', label: 'Задачи' },
  { id: 'analytics', icon: 'analytics', label: 'Аналитика' },
  { id: 'profile', icon: 'person', label: 'Профиль' },
]

export function NavBar({ active, onNavigate }: NavBarProps) {
  return (
    <nav className={styles.nav}>
      <div className={styles.bar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
            onClick={() => onNavigate(tab.id)}
            aria-label={tab.label}
          >
            <Icon name={tab.icon} size={22} />
          </button>
        ))}
      </div>
    </nav>
  )
}
