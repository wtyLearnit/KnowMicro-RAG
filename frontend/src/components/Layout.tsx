/* 柏拉图之窗 - Layout */
import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, MessageSquare, BookOpen, Settings, Menu, X,
  Sparkles,
} from 'lucide-react'

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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-academia-800/95 backdrop-blur-xl border-r border-parchment-700/30
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-parchment-700/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-parchment-400 to-parchment-600
                          flex items-center justify-center shadow-lg shadow-parchment-400/20">
              <Sparkles size={20} className="text-academia-900" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg text-parchment-100 leading-tight">
                柏拉图之窗
              </h1>
              <p className="text-xs text-parchment-500 font-light">
                Plato&apos;s Window
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
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
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  font-medium text-sm transition-all duration-200
                  ${active
                    ? 'bg-parchment-400/15 text-parchment-200 border border-parchment-400/30'
                    : 'text-parchment-400 hover:text-parchment-200 hover:bg-academia-700/50'
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-parchment-700/30">
          <p className="text-xs text-parchment-600 text-center font-light">
            知识经由理性之光 · 折射为真知
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-parchment-700/30 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden btn-ghost mr-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="text-sm text-parchment-500 font-light tracking-wide">
            柏拉图之窗
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
