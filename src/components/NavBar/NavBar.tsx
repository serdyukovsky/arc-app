import { Fragment } from 'react'
import { Icon } from '@/components/Icon/Icon'
import styles from './NavBar.module.css'

export type Screen = 'home' | 'analytics' | 'archive' | 'profile'

interface NavBarProps {
  active: Screen
  onNavigate: (screen: Screen) => void
  onFabClick: () => void
}

const TABS: { id: Screen; icon: string; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Главная' },
  { id: 'analytics', icon: 'analytics', label: 'Аналитика' },
  { id: 'archive', icon: 'dataset', label: 'Архив' },
  { id: 'profile', icon: 'person', label: 'Профиль' },
]

export function NavBar({ active, onNavigate, onFabClick }: NavBarProps) {
  return (
    <nav className={styles.nav}>
      <div className={styles.bar}>
        {TABS.map((tab, i) => (
          <Fragment key={tab.id}>
            {i === 2 && (
              <button className={styles.fab} onClick={onFabClick}>
                <Icon name="add" size={24} />
              </button>
            )}
            <button
              className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
              onClick={() => onNavigate(tab.id)}
            >
              <Icon name={tab.icon} size={22} />
            </button>
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
