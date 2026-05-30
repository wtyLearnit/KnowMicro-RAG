/* 苏格拉底之窗 - Settings Page */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Brain, Scissors, Server, AlertCircle,
  Database, Zap, MessageSquare, BookOpen, FileText,
  Palette, Sun, Moon, ScrollText, Check,
} from 'lucide-react'
import { getStats, getConfig } from '../services/api'
import { useTheme } from '../components/ThemeContext'
import type { Stats, SystemConfig } from '../types'

const themes = [
  {
    id: 'cosmos' as const,
    name: '深邃蓝',
    desc: '宇宙深蓝渐变，沉浸式暗色体验',
    icon: Moon,
    colors: ['#050814', '#0A1128', '#3B82F6', '#A78BFA'],
  },
  {
    id: 'light' as const,
    name: '晨光白',
    desc: '清爽明亮，适合日间使用',
    icon: Sun,
    colors: ['#F8FAFC', '#F1F5F9', '#2563EB', '#7C3AED'],
  },
  {
    id: 'xuan' as const,
    name: '古宣纸',
    desc: '淡黄宣纸质感，仿宋古韵字体',
    icon: ScrollText,
    colors: ['#F4EBC8', '#EDE1BA', '#1A4A6E', '#6B3A5C'],
  },
]

export function SettingsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [envMissing, setEnvMissing] = useState(false)
  const [activeTab, setActiveTab] = useState<'appearance' | 'config' | 'stats' | 'prompt'>('appearance')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    getConfig()
      .then(setConfig)
      .catch(() => setEnvMissing(true))
  }, [])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto px-4 lg:px-8 py-6 space-y-8"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
          <Cpu size={24} className="text-[var(--accent-blue)]" />
          系统设置
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          查看当前配置和系统状态。修改配置请编辑后端 .env 文件。
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div variants={item} className="glass-card !p-1.5">
        <div className="flex rounded-lg" style={{ background: 'var(--bg-input)' }}>
          {[
            { id: 'appearance' as const, label: '外观', icon: Palette },
            { id: 'config' as const, label: '系统配置', icon: Cpu },
            { id: 'stats' as const, label: '系统状态', icon: Zap },
            { id: 'prompt' as const, label: '系统提示词', icon: BookOpen },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200"
                style={{
                  background: isActive ? 'var(--accent-blue)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  boxShadow: isActive ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'appearance' && (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Theme Selection */}
            <div className="glass-card">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-5" style={{ color: 'var(--text-secondary)' }}>
                <Palette size={16} className="text-[var(--accent-purple)]" />
                主题风格
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {themes.map(t => {
                  const Icon = t.icon
                  const isActive = theme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`
                        relative rounded-xl p-4 text-left transition-all duration-300
                        ${isActive
                          ? 'ring-2 ring-[var(--accent-blue)] shadow-lg'
                          : 'hover:scale-[1.02]'
                        }
                      `}
                      style={{
                        background: isActive
                          ? 'var(--bg-card-hover)'
                          : 'var(--bg-card)',
                        border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-glass)'}`,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex gap-1.5">
                          {t.colors.map((c, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border"
                              style={{
                                backgroundColor: c,
                                borderColor: 'var(--border-glass)',
                              }}
                            />
                          ))}
                        </div>
                        {isActive && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-[var(--accent-blue)] flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {t.name}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {envMissing && (
              <div
                className="rounded-xl p-4 flex items-start gap-3"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">
                  无法连接到后端服务。请确保后端已启动，且环境变量配置正确。
                </p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass-card group" style={{ '--hover-border': 'var(--accent-blue)' } as any}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                     style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Cpu size={20} className="text-[var(--accent-blue)]" />
                </div>
                <h3 className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>LLM 模型</h3>
                <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                  {config?.llm_model ?? '未配置'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  对话生成使用的大语言模型
                </p>
              </div>
              <div className="glass-card group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                     style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <Brain size={20} className="text-[var(--accent-purple)]" />
                </div>
                <h3 className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Embedding 模型</h3>
                <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                  {config?.embed_model ?? '未配置'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  {config?.embed_dimensions ?? '?'} 维向量
                </p>
              </div>
              <div className="glass-card group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                     style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <Scissors size={20} className="text-[var(--accent-cyan)]" />
                </div>
                <h3 className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>分块设置</h3>
                <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                  {config?.chunk_size ?? '?'} / {config?.chunk_overlap ?? '?'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  分块大小 / 重叠字符数
                </p>
              </div>
              <div className="glass-card group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                     style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <Server size={20} className="text-[var(--accent-gold)]" />
                </div>
                <h3 className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>向量数据库</h3>
                <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                  ChromaDB
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  {stats?.vector_count ?? 0} 个向量片段
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {stats ? (
              <div className="glass-card">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-5" style={{ color: 'var(--text-secondary)' }}>
                  <Zap size={16} className="text-[var(--accent-gold)]" />
                  系统概览
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                  {[
                    { label: '知识库', value: stats.collection_count, icon: Database, color: 'var(--accent-blue)' },
                    { label: '文档', value: stats.document_count, icon: FileText, color: 'var(--accent-cyan)' },
                    { label: '向量片段', value: stats.vector_count, icon: Zap, color: 'var(--accent-purple)' },
                    { label: '对话', value: stats.conversation_count, icon: MessageSquare, color: 'var(--accent-gold)' },
                  ].map(s => {
                    const Icon = s.icon
                    return (
                      <div key={s.label} className="space-y-2">
                        <Icon size={20} className="mx-auto" style={{ color: s.color }} />
                        <div className="text-2xl font-serif font-bold" style={{ color: 'var(--text-primary)' }}>
                          {s.value}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="glass-card text-center py-12">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center"
                     style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                  <Zap size={28} style={{ color: 'var(--text-dim)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  暂无系统状态数据，请确保后端服务已启动
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'prompt' && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="glass-card">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                <BookOpen size={16} className="text-[var(--accent-blue)]" />
                系统提示词 · 苏格拉底的教学之道
              </h3>
              <div className="rounded-lg p-5 text-sm leading-relaxed max-h-80 overflow-y-auto"
                   style={{
                     background: 'var(--bg-input)',
                     border: '1px solid var(--border-glass)',
                     color: 'var(--text-secondary)',
                   }}>
                <p className="mb-3" style={{ color: 'var(--text-primary)' }}>
                  「你是「苏格拉底」，一位生活在数字时代的古希腊哲人导师。」
                </p>
                <p className="mb-3">
                  <strong className="text-[var(--accent-blue)]">苏格拉底式追问</strong>：当学习者提问，先不给出完整答案，
                  用层层递进的问题引导对方自己发现答案。
                </p>
                <p className="mb-3">
                  <strong className="text-[var(--accent-cyan)]">从具体升到抽象</strong>：将具体问题与底层原理联系起来。
                </p>
                <p className="mb-3">
                  <strong className="text-[var(--accent-purple)]">跨域联结</strong>：主动指出当前知识与其它领域的同构关系。
                </p>
                <p className="mb-3">
                  <strong className="text-[var(--accent-gold)]">知晓无知</strong>：遇到不确定的内容时坦然承认。
                </p>
                <p className="mb-3">
                  <strong className="text-[var(--accent-cyan)]">知识融合</strong>：结合知识库与自身知识，检测过时内容并修正。
                </p>
                <p>
                  <strong className="text-[var(--accent-blue)]">对话式节奏</strong>：有温度、有停顿、有留白。
                </p>
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-dim)' }}>
                完整提示词见 backend/app/config.py 中的 system_prompt 配置
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
