import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ChatProduct } from './api'

export interface ChatResults {
  title: string
  products: ChatProduct[]
}

interface ChatResultsState {
  results: ChatResults | null
  show: (results: ChatResults) => void
  clear: () => void
}

const ChatResultsContext = createContext<ChatResultsState | null>(null)

// Holds the latest products the chatbot returned so the Products page can render them.
export function ChatResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<ChatResults | null>(null)
  return (
    <ChatResultsContext.Provider value={{ results, show: setResults, clear: () => setResults(null) }}>
      {children}
    </ChatResultsContext.Provider>
  )
}

export function useChatResults() {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside ChatResultsProvider')
  return ctx
}
