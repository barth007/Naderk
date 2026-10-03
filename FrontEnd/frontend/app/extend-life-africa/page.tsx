import PaymentScripts from "@/components/providers/PaymentScripts"
import { ExtendLifeAfricaPage } from "@/components/page/extend-life-africa/ExtendLifeAfricaPage"
import { getSiteBrand } from "@/lib/site-brand"

export async function generateMetadata() {
  const brand = await getSiteBrand()
  return {
    title: "Extend Life Africa",
    description:
      `Extend Life Africa is ${brand.name}'s charity for preventive health: sponsor an early-detection test, ` +
      "fund an intervention, or volunteer an hour a week as a GP, nurse or nutritionist.",
  }
}

export default function ExtendLifeAfricaRoute() {
  return (
    <>
      <PaymentScripts />
      <ExtendLifeAfricaPage />
    </>
  )
}
