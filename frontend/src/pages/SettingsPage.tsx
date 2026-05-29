/* 柏拉图之窗 - Settings Page */
import { useEffect, useState } from 'react'
import { Cpu, Brain, Scissors, Server } from 'lucide-react'
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

  return (
    <div className="animate-fade-in max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-parchment-100">系统设置</h1>
        <p className="text-parchment-500 text-sm mt-1">
          查看当前配置和系统状态。修改配置请编辑后端 .env 文件。
        </p>
      </div>

      {/* Connection Status */}
      {envMissing && (
        <div className="bg-red-900/20 border border-red-400/30 rounded-xl p-4">
          <p className="text-red-300 text-sm">
            无法连接到后端服务。请确保后端已启动，且环境变量配置正确。
          </p>
        </div>
      )}

      {/* Config Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <Cpu size={20} className="text-parchment-400 mb-3" />
          <h3 className="text-sm font-medium text-parchment-300 mb-1">LLM 模型</h3>
          <p className="text-lg font-mono text-parchment-100">
            {config?.llm_model ?? '未配置'}
          </p>
          <p className="text-xs text-parchment-600 mt-1">
            对话生成使用的大语言模型
          </p>
        </div>

        <div className="card">
          <Brain size={20} className="text-parchment-400 mb-3" />
          <h3 className="text-sm font-medium text-parchment-300 mb-1">Embedding 模型</h3>
          <p className="text-lg font-mono text-parchment-100">
            {config?.embed_model ?? '未配置'}
          </p>
          <p className="text-xs text-parchment-600 mt-1">
            {config?.embed_dimensions ?? '?'} 维向量
          </p>
        </div>

        <div className="card">
          <Scissors size={20} className="text-parchment-400 mb-3" />
          <h3 className="text-sm font-medium text-parchment-300 mb-1">分块设置</h3>
          <p className="text-lg font-mono text-parchment-100">
            {config?.chunk_size ?? '?'} / {config?.chunk_overlap ?? '?'}
          </p>
          <p className="text-xs text-parchment-600 mt-1">
            分块大小 / 重叠字符数
          </p>
        </div>

        <div className="card">
          <Server size={20} className="text-parchment-400 mb-3" />
          <h3 className="text-sm font-medium text-parchment-300 mb-1">向量数据库</h3>
          <p className="text-lg font-mono text-parchment-100">
            ChromaDB
          </p>
          <p className="text-xs text-parchment-600 mt-1">
            {stats?.vector_count ?? 0} 个向量片段
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="card">
          <h3 className="text-sm font-medium text-parchment-300 mb-4">系统概览</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: '知识库', value: stats.collection_count },
              { label: '文档', value: stats.document_count },
              { label: '向量片段', value: stats.vector_count },
              { label: '对话', value: stats.conversation_count },
            ].map(item => (
              <div key={item.label}>
                <div className="text-2xl font-serif font-bold text-parchment-100">
                  {item.value}
                </div>
                <div className="text-xs text-parchment-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Prompt Preview */}
      <div className="card">
        <h3 className="text-sm font-medium text-parchment-300 mb-3">
          系统提示词 · 柏拉图的教学之道
        </h3>
        <div className="bg-academia-900 rounded-lg p-4 text-sm text-parchment-400 leading-relaxed max-h-64 overflow-y-auto">
          <p className="mb-2">
            「你是「柏拉图」，一位生活在数字时代的古希腊哲人导师。」
          </p>
          <p className="mb-2">
            <strong className="text-parchment-300">苏格拉底式追问</strong>：当学习者提问，先不给出完整答案，
            用层层递进的问题引导对方自己发现答案。
          </p>
          <p className="mb-2">
            <strong className="text-parchment-300">从具体升到抽象</strong>：将具体问题与底层原理联系起来。
          </p>
          <p className="mb-2">
            <strong className="text-parchment-300">跨域联结</strong>：主动指出当前知识与其它领域的同构关系。
          </p>
          <p className="mb-2">
            <strong className="text-parchment-300">知晓无知</strong>：遇到不确定的内容时坦然承认。
          </p>
          <p>
            <strong className="text-parchment-300">对话式节奏</strong>：有温度、有停顿、有留白。
          </p>
        </div>
        <p className="text-xs text-parchment-600 mt-3">
          完整提示词见 backend/app/config.py 中的 system_prompt 配置
        </p>
      </div>
    </div>
  )
}
