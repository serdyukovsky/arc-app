import { Icon } from '@/components/Icon/Icon'
import styles from './ProfileScreen.module.css'

interface ProfileScreenProps {
  user: { first_name?: string; last_name?: string; photo_url?: string } | null
  totalHabits: number
  bestStreak: number
  onOpenNotifications: () => void
}

export function ProfileScreen({ user, totalHabits, bestStreak, onOpenNotifications }: ProfileScreenProps) {
  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : 'Пользователь'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Профиль</h1>

      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" className={styles.avatarImg} />
          ) : (
            <Icon name="person" size={32} style={{ opacity: 0.4 }} />
          )}
        </div>
        <div className={styles.name}>{name}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{totalHabits}</div>
          <div className={styles.statLabel}>Привычек</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>🔥 {bestStreak}</div>
          <div className={styles.statLabel}>Лучший стрик</div>
        </div>
      </div>

      <div className={styles.section}>
        <button className={styles.settingRow} onClick={onOpenNotifications}>
          <Icon name="notifications" size={22} />
          <span>Уведомления</span>
          <Icon name="chevron_right" size={20} style={{ marginLeft: 'auto', opacity: 0.3 }} />
        </button>
      </div>
    </div>
  )
}
