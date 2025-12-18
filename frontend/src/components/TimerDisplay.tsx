const TimerIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 12V8" />
    <path d="M12 12l3 2" />
  </svg>
)

type Props = {
  timeLabel: string
}

export function TimerDisplay({ timeLabel }: Props) {
  return (
    <div className="timer-inline">
      <TimerIcon />
      <span className="timer-text">{timeLabel}</span>
    </div>
  )
}
