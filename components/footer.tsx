import Link from "next/link"
import { Logo } from "./logo"

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="container py-12 grid gap-10 md:grid-cols-4">
        <div className="col-span-2">
          <Link href="/" aria-label="Skal home">
            <Logo className="w-[120px]" />
          </Link>
          <p className="font-mono text-sm text-foreground/60 mt-4 text-pretty max-w-md">
            Skal — a privacy-preserving intelligence exchange: commit–reveal, AMM price discovery,
            verifier oracles, and onchain reputation.
          </p>
        </div>
        <div>
          <h3 className="uppercase font-mono text-xs text-foreground/60 mb-3">Product</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="#about" className="hover:text-primary transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link href="#features" className="hover:text-primary transition-colors">
                Features
              </Link>
            </li>
            <li>
              <Link href="#how-it-works" className="hover:text-primary transition-colors">
                How It Works
              </Link>
            </li>
            <li>
              <Link href="#roadmap" className="hover:text-primary transition-colors">
                Roadmap
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="uppercase font-mono text-xs text-foreground/60 mb-3">Company</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="#contact" className="hover:text-primary transition-colors">
                Contact
              </Link>
            </li>
            <li>
              <a href="#contact" className="hover:text-primary transition-colors">
                Careers
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-primary transition-colors">
                Press
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-primary transition-colors">
                Security
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="container py-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-mono text-xs text-foreground/60">© {new Date().getFullYear()} Skal. All rights reserved.</p>
        <div className="flex items-center gap-6 text-xs font-mono">
          <a href="#contact" className="text-foreground/60 hover:text-foreground transition-colors">
            Terms
          </a>
          <a href="#contact" className="text-foreground/60 hover:text-foreground transition-colors">
            Privacy
          </a>
          <a href="#contact" className="text-foreground/60 hover:text-foreground transition-colors">
            Status
          </a>
        </div>
      </div>
    </footer>
  )
}
