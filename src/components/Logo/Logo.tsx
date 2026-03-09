interface LogoProps {
  size?: number
  opacity?: number
  stroke?: string
}

export function Logo({ size = 22, opacity = 0.45, stroke = '#000' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      style={{ opacity, display: 'block' }}
      aria-hidden="true"
    >
      <path d="M107.99,59.16 A48,48 0 1,1 77.2,15.19" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
      <path d="M89.52,78.81 A35,35 0 1,1 89.52,41.19" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
      <path d="M69.3,79.94 A22,22 0 1,1 81.92,61.92" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
    </svg>
  )
}
