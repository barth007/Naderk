export interface HeroCTA {
  label: string
  href: string
}

export interface HeroContent {
  badge: string
  title: {
    first: string
    highlight: string
    second: string
  }
  description: string
  ctas: {
    primary: HeroCTA
    secondary: HeroCTA
  }
  trust: {
    count: string
    message: string
    rating: string
    avatars: string[]
  }
  features: {
    icon: string
    label: string
  }[]
}
