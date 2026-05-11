import Image from "next/image"
import { cn } from "@/lib/cn"

export const ANIMATED_ICONS = {
  calendar: "/animated-icons/animated-calendar.svg",
  shield: "/animated-icons/animated-shield-tick.svg",
  video: "/animated-icons/animated-video.svg",
  screen: "/animated-icons/animated-mirroring-screen.svg",
  electricity: "/animated-icons/animated-electricity.svg",
  like: "/animated-icons/animated-like.svg",
  phone: "/animated-icons/animated-phone.svg",
  mail: "/animated-icons/animated-mail.svg",
  clock: "/animated-icons/animated-clock.svg",
  upload: "/animated-icons/animated-upload.svg",
  users: "/animated-icons/animated-users.svg",
  microscope: "/animated-icons/animated-microscope.svg",
  check: "/animated-icons/animated-check.svg",
  eye: "/animated-icons/animated-eye.svg",
  stethoscope: "/animated-icons/animated-stethoscope.svg",
  globe: "/animated-icons/animated-globe.svg",
  mapPin: "/animated-icons/animated-map-pin.svg",
  cart: "/animated-icons/animated-cart.svg",
  zoom: "/animated-icons/animated-zoom.svg",
  search: "/animated-icons/animated-search.svg",
  star: "/animated-icons/animated-star.svg",
  plus: "/animated-icons/animated-plus.svg",
  minus: "/animated-icons/animated-minus.svg",
  glasses: "/animated-icons/animated-glasses.svg",
  quote: "/animated-icons/animated-quote.svg",
  linkedin: "/animated-icons/animated-social-icon.svg",
  social: "/animated-icons/animated-social-icon-1.svg",
  x: "/animated-icons/animated-icons8-x.svg",
} as const

export type AnimatedIconName = keyof typeof ANIMATED_ICONS

interface AnimatedIconProps {
  name: AnimatedIconName
  className?: string
  size?: number
}

export function AnimatedIcon({ name, className, size = 24 }: AnimatedIconProps) {
  const src = ANIMATED_ICONS[name]

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={`${name} icon`}
        fill
        className="object-contain"
        unoptimized
      />
    </div>
  )
}
