interface IconProps {
  name: string
  size?: number
  fill?: boolean
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 24, fill = false, className, style }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ''}`}
      style={{
        fontSize: size,
        fontVariationSettings: fill
          ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
          : undefined,
        lineHeight: 1,
        ...style,
      }}
    >
      {name}
    </span>
  )
}
