type IconProps = {
  className?: string;
  size?: number;
};

const base = (size: number) => ({ width: size, height: size });

/**
 * One stroke style throughout: 24-unit grid, 1.7 weight, rounded joins. The
 * wedge stands in for a cheese wherever the full colour mark would turn to mush.
 */
export function WedgeIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 18 L4 11.6 L14.2 5.8C17.4 7.3 20 9.6 20 12.6L20 18Z" />
      <circle cx="14.6" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.2" cy="15.2" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShopIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 8.5 9 6l6 2.5L20 6v11l-5 2.5L9 17l-5 2.5Z" />
      <path d="M9 6v11M15 8.5v11" />
    </svg>
  );
}

export function BookIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 4h13a1 1 0 0 1 1 1v15H6a1 1 0 0 1-1-1Z" />
      <path d="M9 8.5h6M9 12h6" />
    </svg>
  );
}

export function PinIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 10a6 6 0 1 1 12 0l-5.2 9a1 1 0 0 1-1.6 0Z" />
    </svg>
  );
}

export function SearchIcon({ className, size = 17 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className, size = 13 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function WarningIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.6" />
    </svg>
  );
}

/** Sliders rather than a cog: the administration moves settings, it is not one. */
export function SlidersIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      {/* The rails break around each knob rather than being masked by a filled
          circle: this icon sits on the dark rail, on paper and on orange. */}
      <path d="M4 7.5h2.6M12.4 7.5H20M4 16.5h8.1M17.9 16.5H20" />
      <circle cx="9.5" cy="7.5" r="2.4" />
      <circle cx="15" cy="16.5" r="2.4" />
    </svg>
  );
}

/**
 * The gap is what makes the rotation visible, so it stays a partial ring rather
 * than a full circle. Purely decorative: whatever is waiting says so itself,
 * through `aria-busy` and a disabled control.
 */
export function SpinnerIcon({ className, size = 13 }: IconProps) {
  return (
    <svg
      {...base(size)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
      className={`animate-spin motion-reduce:animate-none ${className ?? ""}`}
    >
      <path d="M12 3a9 9 0 1 1-6.4 2.6" />
    </svg>
  );
}
