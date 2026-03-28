import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/Icon/Icon'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import type { NotificationSettings } from '@/types'
import styles from './NotificationSettings.module.css'

interface Props {
  open: boolean
  onClose: () => void
  token: string | null
}

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`${styles.toggle} ${on ? styles.on : ''}`} onClick={() => onChange(!on)}>
      <div className={styles.toggleKnob} />
    </button>
  )
}

export function NotificationSettingsScreen({ open, onClose, token }: Props) {
  const { settings, isLoading, updateSettings } = useNotificationSettings(token)

  const update = (partial: Partial<NotificationSettings>) => {
    updateSettings(partial)
  }

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
            <span className={styles.headerTitle}>Уведомления</span>
          </div>

          <div className={styles.body}>
            {isLoading ? null : (
              <>
                {/* Master toggle */}
                <div className={styles.section}>
                  <div className={`${styles.row} ${styles.masterToggle}`}>
                    <Icon name="notifications" size={22} />
                    <span className={styles.rowLabel}>Уведомления</span>
                    <Toggle on={settings.enabled} onChange={(v) => update({ enabled: v })} />
                  </div>
                </div>

                <div className={settings.enabled ? '' : styles.disabledOverlay}>
                  {/* Quiet hours */}
                  <div className={styles.sectionTitle}>Тихие часы</div>
                  <div className={styles.section}>
                    <div className={styles.row}>
                      <Icon name="bedtime" size={20} />
                      <span className={styles.rowLabel}>С</span>
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={settings.quietHoursFrom}
                        onChange={(e) => update({ quietHoursFrom: e.target.value })}
                      />
                    </div>
                    <div className={styles.row}>
                      <Icon name="wb_sunny" size={20} />
                      <span className={styles.rowLabel}>До</span>
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={settings.quietHoursTo}
                        onChange={(e) => update({ quietHoursTo: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Digest & summary */}
                  <div className={styles.sectionTitle}>Дайджесты</div>
                  <div className={styles.section}>
                    <div className={styles.row}>
                      <Icon name="wb_sunny" size={20} />
                      <div className={styles.rowLabel}>
                        <div>Утренний дайджест</div>
                        <div className={styles.rowSub}>План на день + результат вчера</div>
                      </div>
                      <Toggle on={settings.morningDigest} onChange={(v) => update({ morningDigest: v })} />
                    </div>
                    {settings.morningDigest && (
                      <div className={styles.row}>
                        <span className={styles.rowLabel}>Время</span>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={settings.morningDigestTime}
                          onChange={(e) => update({ morningDigestTime: e.target.value })}
                        />
                      </div>
                    )}
                    <div className={styles.row}>
                      <Icon name="nights_stay" size={20} />
                      <div className={styles.rowLabel}>
                        <div>Вечерний итог</div>
                        <div className={styles.rowSub}>Что сделано, что осталось</div>
                      </div>
                      <Toggle on={settings.eveningSummary} onChange={(v) => update({ eveningSummary: v })} />
                    </div>
                    {settings.eveningSummary && (
                      <div className={styles.row}>
                        <span className={styles.rowLabel}>Время</span>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={settings.eveningSummaryTime}
                          onChange={(e) => update({ eveningSummaryTime: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Weekly report */}
                  <div className={styles.sectionTitle}>Еженедельный отчёт</div>
                  <div className={styles.section}>
                    <div className={styles.row}>
                      <Icon name="bar_chart" size={20} />
                      <div className={styles.rowLabel}>
                        <div>Отчёт за неделю</div>
                        <div className={styles.rowSub}>Статистика, лучшие серии</div>
                      </div>
                      <Toggle on={settings.weeklyReport} onChange={(v) => update({ weeklyReport: v })} />
                    </div>
                    {settings.weeklyReport && (
                      <div className={styles.row}>
                        <span className={styles.rowLabel}>День</span>
                        <select
                          className={styles.dayPicker}
                          value={settings.weeklyReportDay}
                          onChange={(e) => update({ weeklyReportDay: Number(e.target.value) })}
                        >
                          {DAYS.map((d, i) => (
                            <option key={i} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Streak protection */}
                  <div className={styles.sectionTitle}>Защита стрика</div>
                  <div className={styles.section}>
                    <div className={styles.row}>
                      <Icon name="local_fire_department" size={20} />
                      <div className={styles.rowLabel}>
                        <div>Защита серии</div>
                        <div className={styles.rowSub}>Предупреждение если серия под угрозой</div>
                      </div>
                      <Toggle on={settings.streakProtection} onChange={(v) => update({ streakProtection: v })} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
