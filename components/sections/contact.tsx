"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Pill } from "@/components/pill"
import { GL } from "@/components/gl"
import { useState } from "react"

export function ContactSection() {
  const [hovering, setHovering] = useState(false)
  
  return (
    <section id="contact" className="container py-24 relative">
      <GL hovering={hovering} />
      <div className="relative z-10">
        <Pill className="mb-6">GET IN TOUCH</Pill>
        <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl">Join the waitlist</h2>
        <p className="font-mono text-sm sm:text-base text-foreground/60 mt-6 max-w-2xl">
          Building an agent, protocol, or AI product? Get early access to Shadow Protocol and help define the intelligence
          liquidity layer.
        </p>
        <div className="mt-8">
          <Link href="mailto:team@skal.ai?subject=Shadow%20Protocol%20Waitlist" className="inline-block">
            <Button onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
              [Email team@skal.ai]
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
