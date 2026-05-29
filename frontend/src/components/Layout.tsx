/* 苏格拉底之窗 - Layout */
import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, MessageSquare, BookOpen, Settings, Menu, X,
  Sparkles, Orbit,
} from 'lucide-react'
import { StarField } from './StarField'
import { useTheme } from './ThemeContext'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/chat', label: '对话', icon: MessageSquare },
  { path: '/knowledge', label: '知识库', icon: BookOpen },
  { path: '/settings', label: '设置', icon: Settings },
]

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <StarField />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed lg:static inset-y-0 left-0 z-50 w-64 glass-panel border-r flex flex-col transition-transform duration-300"
        style={{
          background: theme === 'light'
            ? 'linear-gradient(180deg, rgba(241,245,249,0.97) 0%, rgba(248,250,252,0.98) 100%)'
            : 'linear-gradient(180deg, rgba(10,17,40,0.95) 0%, rgba(5,8,20,0.98) 100%)',
          borderColor: 'var(--border-glass)',
          transform: sidebarOpen ? 'translateX(0)' : undefined,
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border-glass)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)]
                          flex items-center justify-center shadow-lg"
                 style={{ boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
              <Orbit size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                苏格拉底之窗
              </h1>
              <p className="text-xs font-light tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Socrates&apos;s Window
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200"
                style={{
                  color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                  boxShadow: active ? '0 2px 8px rgba(59,130,246,0.1)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.background = 'var(--bg-card)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-glass)' }}>
          <p className="text-xs text-center font-light" style={{ color: 'var(--text-dim)' }}>
            知识经由理性之光 · 折射为真知
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center px-4 lg:px-6 backdrop-blur-xl"
                style={{
                  borderColor: 'var(--border-glass)',
                  background: theme === 'light'
                    ? 'rgba(248,250,252,0.8)'
                    : 'rgba(5,8,20,0.8)',
                }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden btn-ghost mr-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2 text-sm font-light tracking-wide" style={{ color: 'var(--text-muted)' }}>
            <Sparkles size={14} className="text-[var(--accent-blue)]" />
            苏格拉底之窗
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
