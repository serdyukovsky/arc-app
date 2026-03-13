import type { Habit, HabitType } from '@/types'

const DAILY_ANCHORS = [3, 7, 14, 21, 30, 60, 90, 180, 365]
const PERIODIC_ANCHORS = [1, 2, 4, 8, 13, 26, 52]

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const getAnchorsForType = (habitType: HabitType): number[] =>
  habitType === 'periodic' ? PERIODIC_ANCHORS : DAILY_ANCHORS

export const getAnchorStepForType = (habitType: HabitType): number =>
  habitType === 'periodic' ? 52 : 365

export function buildMilestones(goalDays: number | null, habitType: HabitType): number[] | null {
  if (goalDays === null) return null

  if (habitType === 'periodic') {
    if (goalDays <= 1) return []
    if (goalDays === 2) return [2]
    const anchors = getAnchorsForType(habitType)
    return [...anchors.filter((a) => a < goalDays), goalDays]
  }

  if (goalDays <= 3) return []
  if (goalDays <= 5) return [goalDays]
  if (goalDays <= 7) return [3, goalDays]

  const anchors = getAnchorsForType(habitType)
  return [...anchors.filter((a) => a < goalDays), goalDays]
}

export function getMilestoneValueByIndex(
  index: number,
  habitType: HabitType,
  milestones: number[] | null
): number | null {
  if (index < 0) return null
  if (milestones) return milestones[index] ?? null

  const anchors = getAnchorsForType(habitType)
  if (index < anchors.length) return anchors[index]

  const last = anchors[anchors.length - 1]
  const step = getAnchorStepForType(habitType)
  return last + step * (index - anchors.length + 1)
}

export function getCurrentMilestoneIndex(
  streak: number,
  habitType: HabitType,
  milestones: number[] | null
): number {
  if (!milestones) {
    const anchors = getAnchorsForType(habitType)
    const last = anchors[anchors.length - 1]
    const reached = anchors.filter((a) => a <= streak).length
    if (streak < last) return reached

    const step = getAnchorStepForType(habitType)
    const extra = Math.floor((streak - last) / step)
    return anchors.length + extra
  }

  return milestones.filter((m) => m <= streak).length
}

export function getMilestoneProgress(habit: Pick<Habit, 'type' | 'streak' | 'goalDays' | 'milestones'>): {
  progress: number
  nextMilestone: number
  prevMilestone: number
} {
  const streak = Math.max(0, habit.streak ?? 0)
  const goalDays = habit.goalDays ?? null
  const milestones = habit.milestones ?? buildMilestones(goalDays, habit.type)

  if (goalDays === null) {
    const anchors = getAnchorsForType(habit.type)
    const step = getAnchorStepForType(habit.type)

    let next = anchors.find((a) => a > streak)
    let prev = 0

    if (next === undefined) {
      const last = anchors[anchors.length - 1]
      const extra = Math.floor((streak - last) / step)
      prev = last + step * extra
      next = prev + step
    } else {
      const idx = anchors.indexOf(next)
      prev = idx > 0 ? anchors[idx - 1] : 0
    }

    const progress = next > prev ? (streak - prev) / (next - prev) : 0
    return { progress: clamp(progress), nextMilestone: next, prevMilestone: prev }
  }

  if (!milestones || milestones.length === 0) {
    const nextMilestone = Math.max(1, goalDays)
    const progress = nextMilestone > 0 ? (streak / nextMilestone) : 0
    return { progress: clamp(progress), nextMilestone, prevMilestone: 0 }
  }

  const next = milestones.find((m) => m > streak)
  if (!next) {
    const last = milestones[milestones.length - 1]
    const prev = milestones[milestones.length - 2] ?? 0
    return { progress: 1, nextMilestone: last, prevMilestone: prev }
  }

  const idx = milestones.indexOf(next)
  const prev = idx > 0 ? milestones[idx - 1] : 0
  const progress = next > prev ? (streak - prev) / (next - prev) : 0
  return { progress: clamp(progress), nextMilestone: next, prevMilestone: prev }
}
