"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface GLContextType {
  hovering: boolean
  setHovering: (hovering: boolean) => void
}

const GLContext = createContext<GLContextType | undefined>(undefined)

export function GLProvider({ children }: { children: ReactNode }) {
  const [hovering, setHovering] = useState(false)

  return (
    <GLContext.Provider value={{ hovering, setHovering }}>
      {children}
    </GLContext.Provider>
  )
}

export function useGL() {
  const context = useContext(GLContext)
  if (context === undefined) {
    throw new Error("useGL must be used within a GLProvider")
  }
  return context
}
