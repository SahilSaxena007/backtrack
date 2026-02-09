interface BacktrackMarkProps {
  className?: string;
}

export function BacktrackMark({ className = 'h-6 w-6' }: BacktrackMarkProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 32h40" />
        <path d="M12 32l7-7" />
        <path d="M12 32l7 7" />
        <path d="M52 32l-7-7" />
        <path d="M52 32l-7 7" />
        <path d="M16 12h16v16" />
        <path d="M32 28l-5-5" />
        <path d="M48 52H32V36" />
        <path d="M32 36l5 5" />
      </g>
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <circle cx="54" cy="54" r="4" fill="currentColor" />
    </svg>
  );
}
