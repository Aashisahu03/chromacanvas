import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

// ─────────────────────────────────────────────────────────────────────────────
// SETUP:
// 1. Create a free account at https://liveblocks.io
// 2. Create a project and get your public key
// 3. Replace "pk_YOUR_PUBLIC_KEY" below with your actual key
// 4. Set VITE_LIVEBLOCKS_KEY=pk_your_key in your .env file
// ─────────────────────────────────────────────────────────────────────────────
interface UserPresence {
  [key: string]: any;
  cursor: {
    x: number
    y: number
  } | null
}
const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_KEY || 'pk_dev_placeholder',
})

export const {
  RoomProvider,
  useMyPresence,
  useOthers,
  useStorage,
  useMutation,
  useUpdateMyPresence,
} = createRoomContext<UserPresence>(client)

// Random pastel cursor colors for presence
const COLORS = [
  '#f472b6', '#a78bfa', '#60a5fa', '#34d399',
  '#fbbf24', '#f87171', '#c084fc', '#38bdf8',
]

export function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export function getRandomName() {
  const adjectives = ['Quick', 'Bright', 'Cool', 'Bold', 'Sharp', 'Swift', 'Calm', 'Wild']
  const nouns = ['Fox', 'Star', 'Wave', 'Pixel', 'Spark', 'Dot', 'Arc', 'Ray']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}
