/* 苏格拉底之窗 - Home Page */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, MessageSquare, TrendingUp, Upload,
  Sparkles, ArrowRight, Database, Zap,
} from 'lucide-react'
import { getStats, listCollections } from '../services/api'
import type { Stats, Collection } from '../types'

export function HomePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentCollections, setRecentCollections] = useState<Collection[]>([])

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    listCollections().then(cols => setRecentCollections(cols.slice(0, 4))).catch(() => {})
  }, [])

  const statCards = [
    { label: '知识库', value: stats?.collection_count ?? '-', icon: Database, color: 'var(--accent-blue)' },
    { label: '文档数', value: stats?.document_count ?? '-', icon: Upload, color: 'var(--accent-cyan)' },
    { label: '向量片段', value: stats?.vector_count ?? '-', icon: Zap, color: 'var(--accent-purple)' },
    { label: '对话', value: stats?.conversation_count ?? '-', icon: MessageSquare, color: 'var(--accent-gold)' },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mb-6"
             style={{
               background: 'rgba(59,130,246,0.1)',
               border: '1px solid rgba(59,130,246,0.2)',
               color: 'var(--accent-blue)',
             }}>
          <Sparkles size={14} />
          RAG 驱动的智能学习系统
        </div>
        <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-5 leading-tight" style={{ color: 'var(--text-primary)' }}>
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
            <div key={card.label} className="glass-card text-center group hover:border-[var(--border-hover)]">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-colors"
                   style={{
                     background: `color-mix(in srgb, ${card.color} 10%, transparent)`,
                     border: `1px solid color-mix(in srgb, ${card.color} 20%, transparent)`,
                   }}>
                <Icon size={22} style={{ color: 'var(--text-secondary)' }} className="group-hover:text-[var(--accent-blue)] transition-colors" />
              </div>
              <div className="text-3xl font-bold font-serif" style={{ color: 'var(--text-primary)' }}>
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
            {recentCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => navigate(`/chat/${col.id}`)}
                className="glass-card-hover group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors"
                       style={{
                         background: 'var(--bg-input)',
                         border: '1px solid var(--border-glass)',
                       }}>
                    {col.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-primary)'}>
                      {col.name}
                    </h3>
                    <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {col.description || '暂无描述'} · {col.document_count} 份文档
                    </p>
                  </div>
                  <ArrowRight size={16} className="transition-all group-hover:translate-x-1"
                              style={{ color: 'var(--text-dim)' }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {recentCollections.length === 0 && (
        <motion.div variants={item}>
          <div className="glass-card text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                 style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
              <BookOpen size={32} style={{ color: 'var(--text-dim)' }} />
            </div>
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
