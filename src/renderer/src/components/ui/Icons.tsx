import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

function CheckIcon(props: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  )
}

function WarningIcon(props: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 2 18 17H2Z" />
      <path d="M10 8v4" />
      <circle cx="10" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CloseIcon(props: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 5 15 15M15 5 5 15" />
    </svg>
  )
}

function ChevronDownIcon(props: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}

function HamburgerIcon(props: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  )
}

export { CheckIcon, WarningIcon, CloseIcon, ChevronDownIcon, HamburgerIcon }
