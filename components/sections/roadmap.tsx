import { Pill } from "@/components/pill"
import { Card } from "@/components/ui/card"

const PHASES = [
  {
    tag: "v1.0 • 6 weeks",
    title: "Core Exchange + Oracle + Somnia MVP",
    desc: "Commit–Reveal, Escrow, and Validation live on Somnia Testnet.",
  },
  {
    tag: "v1.1 • 10 weeks",
    title: "AMM + Liquidity Engine",
    desc: "Dynamic pricing, LP rewards, and per-category pools.",
  },
  {
    tag: "v1.2 • 14 weeks",
    title: "Reputation Graph + SDK",
    desc: "Network-wide reputation visualizer and developer SDK.",
  },
  {
    tag: "v1.3 • 18 weeks",
    title: "Shadow Agents + Automation",
    desc: "Autonomous Somnia agents trading and verifying at scale.",
  },
  {
    tag: "v2.0 • Launch",
    title: "Mainnet + Token",
    desc: "Governance, staking, open market rollout.",
  },
]

export function RoadmapSection() {
  return (
    <section id="roadmap" className="container py-24">
      <Pill className="mb-6">ROADMAP</Pill>
      <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl">Build path to mainnet</h2>
      <div className="mt-10 grid gap-6">
        {PHASES.map((p) => (
          <Card key={p.tag} className="p-6 border-border glassmorphic">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-sm text-foreground/60">{p.tag}</div>
                <h3 className="text-lg font-semibold mt-1">{p.title}</h3>
              </div>
            </div>
            <p className="font-mono text-sm text-foreground/60 mt-3">{p.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
