import { AnimatedIconName } from "@/components/ui/AnimatedIcon"

export interface WhyChooseFeature {
  title: string
  description: string
  icon: AnimatedIconName
}

export interface WhyChooseCardProps {
  feature: WhyChooseFeature
  index?: number
}

export interface WhyChooseSectionProps {
  title?: string
  description?: string
  features?: readonly WhyChooseFeature[]
}
