"use client"

import { Hero } from "@/components/hero"
import { Leva } from "leva"
import { AboutSection } from "@/components/sections/about"
import { FeaturesSection } from "@/components/sections/features"
import { HowItWorksSection } from "@/components/sections/how-it-works"
import { RoadmapSection } from "@/components/sections/roadmap"
import { MetricsSection } from "@/components/sections/metrics"
import { ContactSection } from "@/components/sections/contact"

export default function Home() {
  return (
    <>
      <Hero />
      <AboutSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RoadmapSection />
      <MetricsSection />
      <ContactSection />
      <Leva hidden />
    </>
  )
}
