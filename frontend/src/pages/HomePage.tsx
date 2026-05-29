/* 柏拉图之窗 - Home Page */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, MessageSquare, TrendingUp, Upload } from 'lucide-react'
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
    { label: '知识库', value: stats?.collection_count ?? '-', icon: BookOpen },
    { label: '文档数', value: stats?.document_count ?? '-', icon: Upload },
    { label: '向量片段', value: stats?.vector_count ?? '-', icon: TrendingUp },
    { label: '对话', value: stats?.conversation_count ?? '-', icon: MessageSquare },
  ]

  return (
    <div className="animate-fade-in space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl lg:text-5xl font-serif font-bold text-parchment-100 mb-4">
          柏拉图之窗
        </h1>
        <p className="text-lg text-parchment-400 font-light max-w-xl mx-auto leading-relaxed">
          洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。
          <br />
          上传你的学习材料，与苏格拉底对话。
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <button onClick={() => navigate('/chat')} className="btn-primary flex items-center gap-2">
            <MessageSquare size={18} />
            开始对话
          </button>
          <button onClick={() => navigate('/knowledge')} className="btn-secondary flex items-center gap-2">
            <BookOpen size={18} />
            管理知识库
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card text-center">
              <Icon size={24} className="mx-auto mb-2 text-parchment-400" />
              <div className="text-2xl font-bold text-parchment-100 font-serif">
                {card.value}
              </div>
              <div className="text-sm text-parchment-500 mt-1">{card.label}</div>
            </div>
          )
        })}
      </div>

      {/* Recent Collections */}
      {recentCollections.length > 0 && (
        <div>
          <h2 className="text-lg font-serif font-semibold text-parchment-200 mb-4">
            最近的知识库
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {recentCollections.map((col) => (
              <div
                key={col.id}
                onClick={() => navigate(`/chat/${col.id}`)}
                className="card-hover"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{col.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium text-parchment-100 truncate">{col.name}</h3>
                    <p className="text-sm text-parchment-500 truncate">
                      {col.description || '暂无描述'} · {col.document_count} 份文档
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state guidance */}
      {recentCollections.length === 0 && (
        <div className="card text-center py-12">
          <BookOpen size={48} className="mx-auto mb-4 text-parchment-600" />
          <h3 className="text-lg font-serif text-parchment-300 mb-2">
            知识库还是空的
          </h3>
          <p className="text-parchment-500 mb-6 max-w-md mx-auto">
            去知识库页面创建一个知识库，上传你的学习资料，然后就可以和苏格拉底对话了。
          </p>
          <button onClick={() => navigate('/knowledge')} className="btn-primary">
            去创建知识库
          </button>
        </div>
      )}
    </div>
  )
}
