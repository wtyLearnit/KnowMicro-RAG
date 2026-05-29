/* 柏拉图之窗 - Layout */
import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, MessageSquare, BookOpen, Settings, Menu, X,
  Sparkles, Orbit,
} from 'lucide-react'
import { StarField } from './StarField'

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
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 glass-panel border-r border-glass-border
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(180deg, rgba(10,17,40,0.95) 0%, rgba(5,8,20,0.98) 100%)',
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nebula-blue to-nebula-purple
                          flex items-center justify-center shadow-lg shadow-nebula-blue/30">
              <Orbit size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg text-white leading-tight">
                柏拉图之窗
              </h1>
              <p className="text-xs text-cosmos-500 font-light tracking-wider">
                Plato&apos;s Window
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
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  font-medium text-sm transition-all duration-200
                  ${active
                    ? 'bg-nebula-blue/15 text-nebula-blue border border-nebula-blue/25 shadow-sm shadow-nebula-blue/10'
                    : 'text-cosmos-400 hover:text-cosmos-200 hover:bg-cosmos-800/50'
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
        <div className="p-4 border-t border-glass-border">
          <p className="text-xs text-cosmos-600 text-center font-light">
            知识经由理性之光 · 折射为真知
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="h-14 border-b border-glass-border flex items-center px-4 lg:px-6
                         bg-cosmos-950/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden btn-ghost mr-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2 text-sm text-cosmos-500 font-light tracking-wide">
            <Sparkles size={14} className="text-nebula-blue" />
            柏拉图之窗
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
