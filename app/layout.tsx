import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { GLProvider } from "@/components/gl/context"
import { GL } from "@/components/gl"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Skal Ventures",
  description: "Investment strategies that outperform the market",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`} suppressHydrationWarning>
        <GLProvider>
          <GL />
          <Header />
          {children}
          <Footer />
        </GLProvider>
      </body>
    </html>
  )
}
