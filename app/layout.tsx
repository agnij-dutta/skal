import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { GLProvider } from "@/components/gl/context"
import { GL } from "@/components/gl"
import { Web3Provider } from "@/lib/web3-provider"
import { UserSignalsProvider } from "@/lib/contexts/UserSignalsContext"
import { Toaster } from "sonner"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Shadow Protocol - AI Intelligence Marketplace",
  description: "Privacy-preserving marketplace for trading AI outputs on Somnia blockchain",
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
        <Web3Provider>
          <UserSignalsProvider>
            <GLProvider>
              <GL />
              <Header />
              {children}
              <Footer />
              <Toaster />
            </GLProvider>
          </UserSignalsProvider>
        </Web3Provider>
      </body>
    </html>
  )
}
