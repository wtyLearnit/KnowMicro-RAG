/* 苏格拉底之窗 - Home Page */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, MessageSquare, TrendingUp, Upload,
  Sparkles, ArrowRight, Database, Zap,
} from 'lucide-react'
import { getStats, listCollections } from '../services/api'
import type { Stats, Collection } from '../types'

/* ── Animated counter hook ── */
function useAnimatedCounter(target: number | null, duration = 1200) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (target === null || target === 0) {
      setDisplay(target ?? 0)
      return
    }
    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}

export function HomePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentCollections, setRecentCollections] = useState<Collection[]>([])

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    listCollections().then(cols => setRecentCollections(cols.slice(0, 4))).catch(() => {})
  }, [])

  const animatedCollections = useAnimatedCounter(stats?.collection_count ?? null)
  const animatedDocuments = useAnimatedCounter(stats?.document_count ?? null)
  const animatedVectors = useAnimatedCounter(stats?.vector_count ?? null)
  const animatedConversations = useAnimatedCounter(stats?.conversation_count ?? null)

  const statCards = [
    { label: '知识库', value: animatedCollections, icon: Database, color: 'var(--accent-blue)' },
    { label: '文档数', value: animatedDocuments, icon: Upload, color: 'var(--accent-cyan)' },
    { label: '向量片段', value: animatedVectors, icon: Zap, color: 'var(--accent-purple)' },
    { label: '对话', value: animatedConversations, icon: MessageSquare, color: 'var(--accent-gold)' },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-10"
    >
      {/* Hero */}
      <motion.div variants={item} className="text-center py-12">
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mb-6"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            color: 'var(--accent-blue)',
          }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={14} />
          RAG 驱动的智能学习系统
        </motion.div>
        <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-5 leading-tight gradient-text">
          苏格拉底之窗
        </h1>
        <p className="text-lg font-light max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。
          <br />
          上传你的学习材料，与苏格拉底对话，让知识从被动接收变为主动发现。
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary flex items-center gap-2 text-base px-7 py-3"
          >
            <MessageSquare size={18} />
            开始对话
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/knowledge')}
            className="btn-secondary flex items-center gap-2 text-base px-7 py-3"
          >
            <BookOpen size={18} />
            管理知识库
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="glass-card glass-card-shimmer glow-ring text-center group cursor-default">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                   style={{
                     background: `color-mix(in srgb, ${card.color} 12%, transparent)`,
                     border: `1px solid color-mix(in srgb, ${card.color} 25%, transparent)`,
                   }}>
                <Icon size={22} style={{ color: card.color }} className="transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div className="text-3xl font-bold font-serif tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {card.value}
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{card.label}</div>
            </div>
          )
        })}
      </motion.div>

      {/* Recent Collections */}
      {recentCollections.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-lg font-serif font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen size={18} className="text-[var(--accent-blue)]" />
            最近的知识库
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {recentCollections.map((col, i) => (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                onClick={() => navigate(`/chat/${col.id}`)}
                className="glass-card-hover group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 group-hover:scale-110"
                       style={{
                         background: 'var(--bg-input)',
                         border: '1px solid var(--border-glass)',
                       }}>
                    {col.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate transition-colors group-hover:text-[var(--accent-blue)]"
                        style={{ color: 'var(--text-primary)' }}>
                      {col.name}
                    </h3>
                    <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {col.description || '暂无描述'} · {col.document_count} 份文档
                    </p>
                  </div>
                  <ArrowRight size={16} className="transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--accent-blue)]"
                              style={{ color: 'var(--text-dim)' }} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {recentCollections.length === 0 && (
        <motion.div variants={item}>
          <div className="glass-card text-center py-16">
            <motion.div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BookOpen size={32} style={{ color: 'var(--text-dim)' }} />
            </motion.div>
            <h3 className="text-lg font-serif mb-2" style={{ color: 'var(--text-secondary)' }}>
              知识库还是空的
            </h3>
            <p className="mb-8 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              去知识库页面创建一个知识库，上传你的学习资料，然后就可以和苏格拉底对话了。
            </p>
            <button onClick={() => navigate('/knowledge')} className="btn-primary">
              去创建知识库
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
