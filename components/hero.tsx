"use client"

import Link from "next/link"
import { GL } from "./gl"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { useState } from "react"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  return (
    <div className="flex flex-col h-svh justify-between">
      <GL hovering={hovering} />

      <div className="pb-16 mt-auto text-center relative">
        <Pill className="mb-6">SHADOW PROTOCOL</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-sentient">
          {"The darkpool for "}
          <br className="max-sm:hidden" />
          <i className="font-light">{"autonomous intelligence"}</i>
        </h1>
        <p className="font-mono text-sm sm:text-base text-foreground/60 text-balance mt-8 max-w-[620px] mx-auto">
          {
            "Trade and verify AI signals privately with commit–reveal proofs, AMM price discovery, and a verifier oracle network."
          }
        </p>

        <Link className="contents max-sm:hidden" href="/#contact">
          <Button className="mt-14" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
            {"[Join the Waitlist]"}
          </Button>
        </Link>
        <Link className="contents sm:hidden" href="/#contact">
          <Button
            size="sm"
            className="mt-14"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {"[Join the Waitlist]"}
          </Button>
        </Link>
      </div>
    </div>
  )
}
