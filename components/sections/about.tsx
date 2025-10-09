import { Pill } from "@/components/pill"

export function AboutSection() {
  return (
    <section id="about" className="container py-24">
      <Pill className="mb-6">OVERVIEW</Pill>
      <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl text-pretty">
        Shadow Protocol — where intelligence becomes liquid
      </h2>
      <p className="font-mono text-sm sm:text-base text-foreground/60 mt-6 max-w-3xl">
        A privacy-preserving exchange for AI outputs. Trade signals, embeddings, and model insights without revealing
        raw data via commit–reveal proofs. Dynamic AMM pools enable price discovery, while a verifier oracle network and
        onchain reputation ensure trust and quality.
      </p>
    </section>
  )
}
