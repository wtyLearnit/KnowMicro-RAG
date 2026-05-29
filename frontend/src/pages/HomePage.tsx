/* 柏拉图之窗 - Home Page */
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
    { label: '知识库', value: stats?.collection_count ?? '-', icon: Database, color: 'from-nebula-blue/20 to-nebula-blue/5' },
    { label: '文档数', value: stats?.document_count ?? '-', icon: Upload, color: 'from-nebula-cyan/20 to-nebula-cyan/5' },
    { label: '向量片段', value: stats?.vector_count ?? '-', icon: Zap, color: 'from-nebula-purple/20 to-nebula-purple/5' },
    { label: '对话', value: stats?.conversation_count ?? '-', icon: MessageSquare, color: 'from-nebula-gold/20 to-nebula-gold/5' },
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                      bg-nebula-blue/10 border border-nebula-blue/20 text-nebula-blue text-sm mb-6">
          <Sparkles size={14} />
          RAG 驱动的智能学习系统
        </div>
        <h1 className="text-4xl lg:text-6xl font-serif font-bold text-white mb-5 leading-tight">
          柏拉图之窗
        </h1>
        <p className="text-lg text-cosmos-400 font-light max-w-2xl mx-auto leading-relaxed">
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
            <div key={card.label} className="glass-card text-center group hover:border-nebula-blue/20">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${card.color}
                            flex items-center justify-center border border-glass-border
                            group-hover:border-nebula-blue/20 transition-colors`}>
                <Icon size={22} className="text-cosmos-300 group-hover:text-nebula-blue transition-colors" />
              </div>
              <div className="text-3xl font-bold text-white font-serif">
                {card.value}
              </div>
              <div className="text-sm text-cosmos-500 mt-1">{card.label}</div>
            </div>
          )
        })}
      </motion.div>

      {/* Recent Collections */}
      {recentCollections.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-lg font-serif font-semibold text-cosmos-200 mb-4 flex items-center gap-2">
            <BookOpen size={18} className="text-nebula-blue" />
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
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nebula-blue/15 to-nebula-purple/15
                                flex items-center justify-center text-2xl border border-glass-border
                                group-hover:border-nebula-blue/25 transition-colors">
                    {col.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white truncate group-hover:text-nebula-blue transition-colors">
                      {col.name}
                    </h3>
                    <p className="text-sm text-cosmos-500 truncate mt-0.5">
                      {col.description || '暂无描述'} · {col.document_count} 份文档
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-cosmos-600 group-hover:text-nebula-blue
                                                   group-hover:translate-x-1 transition-all" />
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cosmos-800 to-cosmos-900
                          flex items-center justify-center border border-glass-border">
              <BookOpen size={32} className="text-cosmos-600" />
            </div>
            <h3 className="text-lg font-serif text-cosmos-300 mb-2">
              知识库还是空的
            </h3>
            <p className="text-cosmos-500 mb-8 max-w-md mx-auto">
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
