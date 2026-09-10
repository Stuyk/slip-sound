import { JSX } from 'solid-js'

export interface IconProps {
  size?: number | string
  class?: string
  strokeWidth?: number
  style?: JSX.CSSProperties | string
}

const defaultProps = {
  size: 16,
  strokeWidth: 2
}

export function FolderIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )
}

export function FolderOpenIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function RefreshCwIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

export function SearchIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function XIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function PlayIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      class={props.class}
      style={props.style}
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function PauseIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      class={props.class}
      style={props.style}
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export function FileAudioIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M17.5 22h.5c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4V7.5L14.5 2H6c-.5 0-1 .2-1.4.6C4.2 3 4 3.5 4 4v3" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10 20v-1a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0Z" />
      <path d="M6 20v-1a2 2 0 1 0-4 0v1a2 2 0 1 0 4 0Z" />
      <path d="M2 19v-3a6 6 0 0 1 12 0v3" />
    </svg>
  )
}

export function ClockIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function LayersIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

export function ActivityIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

export function HardDriveIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <line x1="22" x2="2" y1="12" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" x2="6.01" y1="16" y2="16" />
      <line x1="10" x2="10.01" y1="16" y2="16" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

export function GripVerticalIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      class={props.class}
      style={props.style}
    >
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

export function Trash2Icon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ChevronUpIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

export function FilterXIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
      <path d="m22 3-5 5" />
      <path d="m17 3 5 5" />
    </svg>
  )
}

export function Volume2Icon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

export function VolumeXIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  )
}

export function SlidersIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  )
}

export function WaveformIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M2 10v4" />
      <path d="M6 6v12" />
      <path d="M10 3v18" />
      <path d="M14 8v8" />
      <path d="M18 5v14" />
      <path d="M22 10v4" />
    </svg>
  )
}

export function DatabaseIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

export function KeyboardIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M6 12h.001" />
      <path d="M10 12h.001" />
      <path d="M14 12h.001" />
      <path d="M18 12h.001" />
      <path d="M7 16h10" />
    </svg>
  )
}

export function HelpCircleIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function MousePointerIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="m13 13 6 6" />
    </svg>
  )
}

export function ArrowRightIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export function ZapIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function PanelLeftIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </svg>
  )
}

export function TagIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

export function ChevronsUpDownIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

export function InfinityIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    </svg>
  )
}

export function CheckCircleIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}

export function AlertCircleIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function StarIcon(props: IconProps & { filled?: boolean }): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill={props.filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function TagPlusIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.42 0l3.592-3.592" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M16 15h6" />
      <path d="M19 12v6" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function CopyIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

export function EyeIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon(props: IconProps): JSX.Element {
  const s = () => props.size ?? defaultProps.size
  const sw = () => props.strokeWidth ?? defaultProps.strokeWidth
  return (
    <svg
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={sw()}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      style={props.style}
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61C3.78 8.36 2 12 2 12a13 13 0 0 0 3.87 4.48A9.12 9.12 0 0 0 12 19c1.16 0 2.24-.19 3.22-.55" />
      <path d="m2 2 20 20" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    </svg>
  )
}


