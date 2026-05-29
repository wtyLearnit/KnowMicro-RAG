/* 柏拉图之窗 - Settings Page */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu, Brain, Scissors, Server, AlertCircle,
  Database, Zap, MessageSquare, BookOpen, FileText,
} from 'lucide-react'
import { getStats, getConfig } from '../services/api'
import type { Stats, SystemConfig } from '../types'

export function SettingsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [envMissing, setEnvMissing] = useState(false)

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
        <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
          <Cpu size={24} className="text-nebula-blue" />
          系统设置
        </h1>
        <p className="text-cosmos-500 text-sm mt-1">
          查看当前配置和系统状态。修改配置请编辑后端 .env 文件。
        </p>
      </motion.div>

      {/* Connection Status */}
      {envMissing && (
        <motion.div
          variants={item}
          className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">
            无法连接到后端服务。请确保后端已启动，且环境变量配置正确。
          </p>
        </motion.div>
      )}

      {/* Config Cards */}
      <motion.div variants={item} className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card group hover:border-nebula-blue/20">
          <div className="w-10 h-10 rounded-lg bg-nebula-blue/10 flex items-center justify-center mb-3
                        border border-nebula-blue/20 group-hover:border-nebula-blue/30 transition-colors">
            <Cpu size={20} className="text-nebula-blue" />
          </div>
          <h3 className="text-xs font-medium text-cosmos-500 mb-1">LLM 模型</h3>
          <p className="text-lg font-mono text-white">
            {config?.llm_model ?? '未配置'}
          </p>
          <p className="text-xs text-cosmos-600 mt-1">
            对话生成使用的大语言模型
          </p>
        </div>

        <div className="glass-card group hover:border-nebula-purple/20">
          <div className="w-10 h-10 rounded-lg bg-nebula-purple/10 flex items-center justify-center mb-3
                        border border-nebula-purple/20 group-hover:border-nebula-purple/30 transition-colors">
            <Brain size={20} className="text-nebula-purple" />
          </div>
          <h3 className="text-xs font-medium text-cosmos-500 mb-1">Embedding 模型</h3>
          <p className="text-lg font-mono text-white">
            {config?.embed_model ?? '未配置'}
          </p>
          <p className="text-xs text-cosmos-600 mt-1">
            {config?.embed_dimensions ?? '?'} 维向量
          </p>
        </div>

        <div className="glass-card group hover:border-nebula-cyan/20">
          <div className="w-10 h-10 rounded-lg bg-nebula-cyan/10 flex items-center justify-center mb-3
                        border border-nebula-cyan/20 group-hover:border-nebula-cyan/30 transition-colors">
            <Scissors size={20} className="text-nebula-cyan" />
          </div>
          <h3 className="text-xs font-medium text-cosmos-500 mb-1">分块设置</h3>
          <p className="text-lg font-mono text-white">
            {config?.chunk_size ?? '?'} / {config?.chunk_overlap ?? '?'}
          </p>
          <p className="text-xs text-cosmos-600 mt-1">
            分块大小 / 重叠字符数
          </p>
        </div>

        <div className="glass-card group hover:border-nebula-gold/20">
          <div className="w-10 h-10 rounded-lg bg-nebula-gold/10 flex items-center justify-center mb-3
                        border border-nebula-gold/20 group-hover:border-nebula-gold/30 transition-colors">
            <Server size={20} className="text-nebula-gold" />
          </div>
          <h3 className="text-xs font-medium text-cosmos-500 mb-1">向量数据库</h3>
          <p className="text-lg font-mono text-white">
            ChromaDB
          </p>
          <p className="text-xs text-cosmos-600 mt-1">
            {stats?.vector_count ?? 0} 个向量片段
          </p>
        </div>
      </motion.div>

      {/* Stats Summary */}
      {stats && (
        <motion.div variants={item} className="glass-card">
          <h3 className="text-sm font-medium text-cosmos-300 mb-5 flex items-center gap-2">
            <Zap size={16} className="text-nebula-gold" />
            系统概览
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { label: '知识库', value: stats.collection_count, icon: Database, color: 'text-nebula-blue' },
              { label: '文档', value: stats.document_count, icon: FileText, color: 'text-nebula-cyan' },
              { label: '向量片段', value: stats.vector_count, icon: Zap, color: 'text-nebula-purple' },
              { label: '对话', value: stats.conversation_count, icon: MessageSquare, color: 'text-nebula-gold' },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="space-y-2">
                  <Icon size={20} className={`mx-auto ${s.color}`} />
                  <div className="text-2xl font-serif font-bold text-white">
                    {s.value}
                  </div>
                  <div className="text-xs text-cosmos-500">{s.label}</div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* System Prompt Preview */}
      <motion.div variants={item} className="glass-card">
        <h3 className="text-sm font-medium text-cosmos-300 mb-4 flex items-center gap-2">
          <BookOpen size={16} className="text-nebula-blue" />
          系统提示词 · 柏拉图的教学之道
        </h3>
        <div className="bg-cosmos-950 rounded-lg p-5 text-sm text-cosmos-400 leading-relaxed max-h-64
                      overflow-y-auto border border-glass-border">
          <p className="mb-3 text-cosmos-300">
            「你是「柏拉图」，一位生活在数字时代的古希腊哲人导师。」
          </p>
          <p className="mb-3">
            <strong className="text-nebula-blue">苏格拉底式追问</strong>：当学习者提问，先不给出完整答案，
            用层层递进的问题引导对方自己发现答案。
          </p>
          <p className="mb-3">
            <strong className="text-nebula-cyan">从具体升到抽象</strong>：将具体问题与底层原理联系起来。
          </p>
          <p className="mb-3">
            <strong className="text-nebula-purple">跨域联结</strong>：主动指出当前知识与其它领域的同构关系。
          </p>
          <p className="mb-3">
            <strong className="text-nebula-gold">知晓无知</strong>：遇到不确定的内容时坦然承认。
          </p>
          <p>
            <strong className="text-nebula-blue">对话式节奏</strong>：有温度、有停顿、有留白。
          </p>
        </div>
        <p className="text-xs text-cosmos-600 mt-3">
          完整提示词见 backend/app/config.py 中的 system_prompt 配置
        </p>
      </motion.div>
    </motion.div>
  )
}
