export type ClassValue = string | false | null | undefined

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * The one shared keyboard-focus treatment: a violet ring offset from the
 * void canvas. Kept as a single constant so every focusable surface
 * (buttons, nav, cards, tabs, dropzone...) reads identically.
 */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-iris focus-visible:ring-offset-2 focus-visible:ring-offset-void'
