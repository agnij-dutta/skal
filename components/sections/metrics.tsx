import { Pill } from "@/components/pill"
import { Card } from "@/components/ui/card"

const METRICS = [
  { value: "100+", label: "Validated trades across 5+ markets" },
  { value: "<5s", label: "Oracle verification latency" },
  { value: "≤10%", label: "Dispute rate target" },
  { value: "20+", label: "Active Flow Agents" },
  { value: "10+", label: "External teams using SDK" },
]

export function MetricsSection() {
  return (
    <section id="metrics" className="container py-24">
      <Pill className="mb-6">METRICS</Pill>
      <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl">What success looks like</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
        {METRICS.map((m) => (
          <Card key={m.label} className="p-6 border-border glassmorphic">
            <div className="text-3xl font-sentient">{m.value}</div>
            <p className="font-mono text-sm text-foreground/60 mt-2 text-readable">{m.label}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
