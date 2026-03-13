import type { Habit } from '@/types'
import { useLongPress } from '@/hooks/useLongPress'
import { triggerHaptic } from '@/lib/haptics'
import { CounterCard } from './CounterCard'
import { PeriodicCard } from './PeriodicCard'
import { DailyCard } from './DailyCard'

interface HabitCardProps {
  habit: Habit
  todayValue: number
  isDoneToday: boolean
  doneDates: Set<string>
  streak: number
  weekDoneCount: number
  onTap: () => void
  onDayPress?: (day: string) => void
  onLongPress: () => void
  pulse?: boolean
}

export function HabitCard({
  habit,
  todayValue,
  isDoneToday,
  doneDates,
  streak,
  weekDoneCount,
  onTap,
  onDayPress,
  onLongPress,
  pulse = false,
}: HabitCardProps) {
  const bindLongPress = useLongPress(onLongPress, () => {
    triggerHaptic('light')
    onTap()
  })

  const commonProps = { habit, bindLongPress }

  switch (habit.type) {
    case 'counter':
      return (
        <CounterCard
          {...commonProps}
          value={todayValue}
          streak={streak}
        />
      )
    case 'periodic':
      return (
        <PeriodicCard
          {...commonProps}
          isDone={isDoneToday}
          weekDoneCount={weekDoneCount}
          doneDates={doneDates}
          streak={streak}
          onDayPress={onDayPress}
        />
      )
    case 'daily':
    default:
      return (
        <DailyCard
          {...commonProps}
          isDone={isDoneToday}
          doneDates={doneDates}
          streak={streak}
          onDayPress={onDayPress}
          pulse={pulse}
        />
      )
  }
}
