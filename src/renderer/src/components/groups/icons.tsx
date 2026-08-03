import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

function EditIcon(props: IconProps): React.JSX.Element {
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
      <path d="M13.5 4.5 15.5 6.5 6 16H4v-2L13.5 4.5Z" />
    </svg>
  )
}

function DeleteIcon(props: IconProps): React.JSX.Element {
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
      <path d="M4 6h12" />
      <path d="M8 6V4h4v2" />
      <path d="M6 6l1 10h6l1-10" />
    </svg>
  )
}

function PlusIcon(props: IconProps): React.JSX.Element {
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
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export { EditIcon, DeleteIcon, PlusIcon }
