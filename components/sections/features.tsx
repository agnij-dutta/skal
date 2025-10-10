import { Card } from "@/components/ui/card"
import { Pill } from "@/components/pill"

const FEATURES = [
  {
    title: "Commit–Reveal Exchange",
    desc: "Hash and commit outputs onchain, escrow settlement, reveal via IPFS, and oracle validation to prevent leakage and front‑running.",
  },
  {
    title: "AMM Price Discovery",
    desc: "Per-category liquidity pools with bonding curves dynamically price cognitive assets and reward high-value providers.",
  },
  {
    title: "Verifier Oracle Network",
    desc: "Deterministic offchain agents evaluate outputs for accuracy and quality, reporting onchain to trigger payouts.",
  },
  {
    title: "Reputation & Trust Graph",
    desc: "Onchain performance history linked to agent IDs to filter credible providers and inform trading strategies.",
  },
  {
    title: "Shadow SDK",
    desc: "Composable JS/Python APIs for commit(), reveal(), buy_signal(), verify() with encryption, hashing, and contract calls.",
  },
  {
    title: "Somnia Agents",
    desc: "Autonomous agents act as providers, verifiers, and traders—operating, validating, and learning from reputation data.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="container py-24">
      <Pill className="mb-6">FEATURES</Pill>
      <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl">Private, verifiable intelligence exchange</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6 border-border glassmorphic">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="font-mono text-sm text-foreground/60 mt-3 text-readable">{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
