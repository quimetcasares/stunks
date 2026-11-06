// Marca de Stunks: cuadro amarillo con una flecha que sube a tropezones.
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path
        d="M6 22.5 12 16.5l4.5 3.5L25 10"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 9.5H25.5V15.5"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
