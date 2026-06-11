/* KnowMicro - Layout */
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, MessageSquare, BookOpen, Settings, Menu, X,
  Sparkles, PanelLeftOpen, PanelLeftClose, Trash2, CalendarDays,
} from 'lucide-react'
import { StarField } from './StarField'
import { useTheme } from './ThemeContext'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/chat', label: '对话', icon: MessageSquare },
  { path: '/knowledge', label: '知识库', icon: BookOpen },
  { path: '/schedule', label: '日程', icon: CalendarDays },
  { path: '/settings', label: '设置', icon: Settings },
]

const sidebarBackgroundByTheme: Record<string, string> = {
  cosmos: 'linear-gradient(180deg, rgba(10,17,40,0.95) 0%, rgba(5,8,20,0.98) 100%)',
  light: 'linear-gradient(180deg, rgba(241,245,249,0.97) 0%, rgba(248,250,252,0.98) 100%)',
  xuan: 'linear-gradient(180deg, rgba(230,216,170,0.97) 0%, rgba(237,225,186,0.98) 100%)',
  forest: 'linear-gradient(180deg, rgba(230,241,232,0.97) 0%, rgba(241,247,237,0.98) 100%)',
  rose: 'linear-gradient(180deg, rgba(255,241,242,0.97) 0%, rgba(255,247,237,0.98) 100%)',
}

const headerBackgroundByTheme: Record<string, string> = {
  cosmos: 'rgba(5,8,20,0.8)',
  light: 'rgba(248,250,252,0.8)',
  xuan: 'rgba(237,225,186,0.85)',
  forest: 'rgba(241,247,237,0.86)',
  rose: 'rgba(255,247,237,0.86)',
}

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()
  const navRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 })

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const activePath = isActive('/trash') ? '/trash' :
    navItems.find(item => isActive(item.path))?.path ?? '/'

  // Update nav indicator position
  useEffect(() => {
    if (!navRef.current || sidebarCollapsed) return
    const activeBtn = navRef.current.querySelector(`[data-nav-path="${activePath}"]`) as HTMLElement
    if (activeBtn) {
      const navRect = navRef.current.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      setIndicatorStyle({
        top: btnRect.top - navRect.top,
        height: btnRect.height,
      })
    }
  }, [activePath, sidebarCollapsed, location.pathname])

  const toggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebarCollapsed', String(next))
      window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
      return next
    })
  }

  const isCollapsed = sidebarCollapsed && !sidebarOpen

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
          fixed lg:static inset-y-0 left-0 z-50 glass-panel border-r flex flex-col
          transition-all duration-300
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${!sidebarOpen ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        `}
        style={{
          background: sidebarBackgroundByTheme[theme] ?? sidebarBackgroundByTheme.cosmos,
          borderColor: 'var(--border-glass)',
        }}
      >
        {/* Logo */}
        <div className={`border-b transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-5'}`}
             style={{ borderColor: 'var(--border-glass)' }}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="relative">
              <img src="/logo.png" alt="KnowMicro"
                   className={`rounded-xl object-cover shadow-lg transition-all duration-300 ${isCollapsed ? 'w-9 h-9' : 'w-10 h-10'}`} />
              {/* Logo glow ring */}
              <div className="absolute inset-0 rounded-xl animate-glow-pulse"
                   style={{ boxShadow: '0 0 12px rgba(59,130,246,0.2)' }} />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-serif font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                  KnowMicro
                </h1>
                <p className="text-xs font-light tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  知微
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav ref={navRef} className={`flex-1 space-y-1 transition-all duration-300 relative ${isCollapsed ? 'p-1.5' : 'p-3'}`}>
          {/* Sliding active indicator */}
          {!isCollapsed && (
            <div
              className="nav-indicator"
              style={{
                top: indicatorStyle.top,
                height: indicatorStyle.height,
                opacity: indicatorStyle.height > 0 ? 1 : 0,
              }}
            />
          )}

          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                data-nav-path={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`flex items-center rounded-lg font-medium text-sm transition-all duration-200 ${
                  isCollapsed ? 'w-full justify-center px-0 py-3' : 'w-full gap-3 px-4 py-3'
                }`}
                style={{
                  color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: active && isCollapsed ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: active && isCollapsed ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                  boxShadow: active && isCollapsed ? '0 2px 8px rgba(59,130,246,0.1)' : 'none',
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
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} />
                {!isCollapsed && item.label}
              </button>
            )
          })}
        </nav>

        {/* Trash entry */}
        <div className={`border-t transition-all ${isCollapsed ? 'p-1.5' : 'p-3'}`}
             style={{ borderColor: 'var(--border-glass)' }}>
          <button
            onClick={() => {
              navigate('/trash')
              setSidebarOpen(false)
            }}
            data-nav-path="/trash"
            className={`flex items-center rounded-lg font-medium text-sm transition-all duration-200 ${
              isCollapsed ? 'w-full justify-center px-0 py-3' : 'w-full gap-3 px-4 py-3'
            }`}
            style={{
              color: isActive('/trash') ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: isActive('/trash') && isCollapsed ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: isActive('/trash') && isCollapsed ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
            }}
            title={isCollapsed ? '回收站' : undefined}
          >
            <Trash2 size={18} />
            {!isCollapsed && '回收站'}
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border-glass)' }}>
            <p className="text-xs text-center font-light" style={{ color: 'var(--text-dim)' }}>
              知识经由理性之光 · 折射为真知
            </p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center px-4 lg:px-6 backdrop-blur-xl header-gradient-border"
                style={{
                  borderColor: 'var(--border-glass)',
                  background: headerBackgroundByTheme[theme] ?? headerBackgroundByTheme.cosmos,
                }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden btn-ghost mr-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex btn-ghost mr-2"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="flex items-center gap-2 text-sm font-light tracking-wide" style={{ color: 'var(--text-muted)' }}>
            <Sparkles size={14} className="text-[var(--accent-blue)] animate-pulse-soft" />
            知微见著，以问求真
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
