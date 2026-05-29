/* 苏格拉底之窗 - App Shell */
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat/:collectionId?" element={<ChatPage />} />
          <Route path="/knowledge" element={<KnowledgeBasePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}
