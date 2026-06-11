/* KnowMicro - App Shell */
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'

// Non-critical pages loaded on demand (reduces initial bundle size)
const SettingsPage = lazy(() => import('./pages/SettingsPage.lazy'))
const TrashPage = lazy(() => import('./pages/TrashPage.lazy'))
const CalendarPage = lazy(() => import('./pages/CalendarPage.lazy'))

/** Minimal fallback shown while lazy-loaded pages are downloading. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div
        className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{
          borderColor: 'var(--border-glass)',
          borderTopColor: 'var(--accent-blue)',
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat/:collectionId?" element={<ChatPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/schedule" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/trash" element={<TrashPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </ThemeProvider>
  )
}
