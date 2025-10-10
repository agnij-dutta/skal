"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "./logo"
import { MobileMenu } from "./mobile-menu"
import { WalletConnect } from "./wallet-connect"
import { useEffect, useState } from "react"

export const Header = () => {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const isLandingPage = pathname === '/'

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className={[
        "fixed z-50 top-0 left-0 w-full transition-colors duration-300",
        scrolled ? "backdrop-blur-lg bg-background/55 border-b border-border/60" : "bg-transparent",
      ].join(" ")}
    >
      <header className="flex items-center justify-between container py-4 md:py-6">
        <Link href="/" aria-label="Skal home">
          <Logo className="w-[100px] md:w-[120px]" />
        </Link>
        <nav
          className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10"
          aria-label="Primary"
        >
          {isLandingPage ? (
            <>
              {[
                { label: "About", href: "#about" },
                { label: "Features", href: "#features" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "Roadmap", href: "#roadmap" },
                { label: "Metrics", href: "#metrics" },
                { label: "Contact", href: "#contact" },
              ].map((item) => (
                <Link
                  className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </Link>
              ))}
            </>
          ) : (
            <>
              {[
                { label: "Markets", href: "/markets" },
                { label: "Commit", href: "/commit" },
                { label: "Signals", href: "/signals" },
                { label: "Reputation", href: "/reputation" },
                { label: "Liquidity", href: "/liquidity" },
              ].map((item) => (
                <Link
                  className="uppercase inline-block font-mono text-foreground/60 hover:text-foreground/100 duration-150 transition-colors ease-out"
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <WalletConnect className="max-lg:hidden" />
        <MobileMenu />
      </header>
    </div>
  )
}
