import { Card } from "@/components/ui/card"
import { Pill } from "@/components/pill"

const STEPS = [
  { n: "01", title: "Commit", desc: "Provider hashes a model output and commits it onchain." },
  { n: "02", title: "Buy", desc: "Buyer escrows tokens by calling buy_signal()." },
  { n: "03", title: "Reveal", desc: "Provider uploads encrypted data to IPFS and reveals the CID." },
  { n: "04", title: "Verify", desc: "Verifier agents evaluate accuracy using deterministic metrics." },
  { n: "05", title: "Reward", desc: "Contracts release escrow to the provider based on results." },
  { n: "06", title: "Reputation", desc: "Onchain scores update to inform future trades and filtering." },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="container py-24">
      <Pill className="mb-6">HOW IT WORKS</Pill>
      <h2 className="font-sentient text-3xl sm:text-4xl md:text-5xl">Trustless exchange lifecycle</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">
        {STEPS.map((s) => (
          <Card key={s.n} className="p-6 border-border glassmorphic">
            <div className="font-mono text-primary">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
            <p className="font-mono text-sm text-foreground/60 mt-3">{s.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
