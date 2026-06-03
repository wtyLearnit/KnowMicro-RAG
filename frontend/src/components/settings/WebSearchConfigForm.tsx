/**
 * WebSearchConfigForm — 网络搜索 API 配置
 * 已配置列表 + 两步弹窗（选供应商 → 填 Key）。结构仿 ModelConfigForm，但精简：
 * 网络搜索没有"模型"概念，model_name 自动写入 provider 值。
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Eye, EyeOff, Loader2, Check, X,
  Wifi, Save, Trash2, Plus, ArrowLeft, XCircle,
} from 'lucide-react'
import {
  getModelConfigs, createModelConfig, updateModelConfig,
  deleteModelConfig, testWebSearchConfig,
} from '../../services/api'
import { WEB_SEARCH_PROVIDERS, getWebSearchProvider } from '../../utils/providers'
import type { UserModelConfig, WebSearchTestResult } from '../../types'
import type { ProviderDef } from '../../utils/providers'

const accentColor = 'var(--accent-cyan)'

export function WebSearchConfigForm() {
  const [configs, setConfigs] = useState<UserModelConfig[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null)

  // Form state (step 2)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [maxResults, setMaxResults] = useState('5')
  const [protocol, setProtocol] = useState<'tavily' | 'serper' | 'brave'>('tavily')
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<WebSearchTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { loadConfigs() }, [])

  async function loadConfigs() {
    setLoading(true)
    try { setConfigs(await getModelConfigs('web_search')) } catch { /* ignore */ } finally { setLoading(false) }
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Modal controls ───────────────────────────────
  function openAdd() {
    setStep(1)
    setSelectedProvider(null)
    resetForm()
    setShowModal(true)
  }

  function selectProvider(p: ProviderDef) {
    setSelectedProvider(p)
    setBaseUrl(p.base_url)
    setApiKey('')
    setShowKey(false)
    setMaxResults('5')
    setProtocol('tavily')
    setTestResult(null)
    setStep(2)
  }

  function backToStep1() {
    setStep(1)
    setSelectedProvider(null)
    resetForm()
  }

  function closeModal() {
    setShowModal(false)
    setStep(1)
    setSelectedProvider(null)
    resetForm()
  }

  function resetForm() {
    setBaseUrl('')
    setApiKey('')
    setShowKey(false)
    setMaxResults('5')
    setProtocol('tavily')
    setTestResult(null)
  }

  // ── Computed ─────────────────────────────────────
  const effectiveKey = apiKey.trim()
  const needsKey = selectedProvider?.requires_api_key ?? true
  const hasKey = !needsKey || !!effectiveKey

  // ── Test ─────────────────────────────────────────
  async function handleTest() {
    if (!selectedProvider) return
    setTesting(true); setTestResult(null)
    try {
      const result = await testWebSearchConfig({
        provider: selectedProvider.id,
        base_url: baseUrl.trim() || undefined,
        api_key: effectiveKey || undefined,
        protocol: selectedProvider.id === 'custom' ? protocol : undefined,
      })
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ success: false, latency_ms: 0, result_count: 0, message: '请求失败', error: e?.message || '未知错误' })
    } finally { setTesting(false) }
  }

  // ── Save ─────────────────────────────────────────
  async function handleSave() {
    if (!selectedProvider) return
    setSaving(true)
    try {
      const isCustom = selectedProvider.id === 'custom'
      const extra: Record<string, unknown> = {}
      if (maxResults.trim()) extra.max_results = parseInt(maxResults, 10)
      if (isCustom) extra.protocol = protocol  // 自定义供应商的 API 协议

      // 自定义供应商使用用户输入的端点 URL；预设供应商用其默认 base_url
      const url = isCustom
        ? baseUrl.trim()
        : (baseUrl.trim() || selectedProvider.base_url || 'ddgs://yandex')
      if (!url && isCustom) { showToast('请填写搜索 API 端点地址'); setSaving(false); return }

      const payload: any = {
        config_type: 'web_search',
        provider: selectedProvider.id,
        base_url: url,
        model_name: selectedProvider.id,  // 网络搜索无模型概念，存 provider 满足 NOT NULL
        is_active: configs.length === 0,
        extra_params: extra,
      }
      if (effectiveKey) payload.api_key = effectiveKey
      await createModelConfig(payload)
      showToast('配置已保存')
      await loadConfigs()
      closeModal()
    } catch (e: any) {
      showToast('保存失败: ' + (e?.response?.data?.detail || e?.message || '未知错误'))
    } finally { setSaving(false) }
  }

  // ── Config management ────────────────────────────
  async function handleSetActive(id: string) {
    try { await updateModelConfig(id, { is_active: true }); await loadConfigs() } catch { showToast('操作失败') }
  }
  async function handleDeleteConfig(config: UserModelConfig) {
    const prov = getWebSearchProvider(config.provider)
    if (!confirm(`确定删除「${prov.name}」的网络搜索配置吗？`)) return
    try { await deleteModelConfig(config.id); showToast('已删除'); await loadConfigs() } catch { showToast('删除失败') }
  }

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div className="glass-card space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
            <Globe size={16} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>网络搜索 API</h3>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>未配置时默认使用免费 DuckDuckGo（yandex 引擎）</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ background: `linear-gradient(135deg, ${accentColor}, var(--accent-blue))`, color: '#fff' }}>
          <Plus size={14} /> 添加搜索源
        </button>
      </div>

      {/* Configured List */}
      {configs.length === 0 ? (
        <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">暂无配置，点击「添加搜索源」接入更稳定的搜索 API</p>
        </div>
      ) : (
        <div className="space-y-1">
          {configs.map(c => {
            const prov = getWebSearchProvider(c.provider)
            return (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                   style={{ background: c.is_active ? `${accentColor}08` : 'var(--bg-input)',
                            border: `1px solid ${c.is_active ? `${accentColor}30` : 'var(--border-glass)'}` }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.is_active ? '#22c55e' : 'var(--text-dim)' }} />
                <span className="text-base shrink-0" title={prov.name}>{prov.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>{prov.name}</span>
                </div>
                {c.is_active && <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}>当前使用</span>}
                {!c.is_active && (
                  <button onClick={() => handleSetActive(c.id)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] shrink-0"
                    style={{ color: accentColor, border: `1px solid ${accentColor}30` }}>设为默认</button>
                )}
                <button onClick={() => handleDeleteConfig(c)} className="p-1.5 rounded-md hover:bg-red-500/10 shrink-0" title="删除">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal (Portal to body) ──────────────────── */}
      {createPortal(
        <>
        <AnimatePresence>
          {showModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center p-4"
              style={{ zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

                {/* Modal header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    {step === 2 && (
                      <button onClick={backToStep1} className="p-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                        <ArrowLeft size={16} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    )}
                    <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                      {step === 1 ? '选择搜索源' : `配置 ${selectedProvider?.name}`}
                    </h3>
                  </div>
                  <button onClick={closeModal} className="p-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                    <XCircle size={18} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>

                {/* Step 1: Provider selection */}
                {step === 1 && (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-2 gap-2.5">
                      {WEB_SEARCH_PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => selectProvider(p)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-[1.02]"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.background = `${accentColor}08` }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.background = 'var(--bg-input)' }}>
                          <span className="text-2xl">{p.icon}</span>
                          <span className="text-xs font-medium text-center" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Configuration form */}
                {step === 2 && selectedProvider && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Provider badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                         style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                      <span className="text-lg">{selectedProvider.icon}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedProvider.name}</span>
                      <span className="text-xs ml-auto cursor-pointer" style={{ color: accentColor }} onClick={backToStep1}>更换搜索源</span>
                    </div>

                    {!needsKey && (
                      <div className="text-xs rounded-lg p-3"
                           style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20`, color: 'var(--text-muted)' }}>
                        免费搜索源无需 API Key，使用 yandex 引擎检索（国内可直连）。可直接测试并保存。
                      </div>
                    )}

                    {/* API 协议选择（仅自定义） */}
                    {selectedProvider.id === 'custom' && (
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          API 协议类型
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { id: 'tavily' as const, name: 'Tavily', desc: 'POST + JSON, 兼容 OpenAI 风格' },
                            { id: 'serper' as const, name: 'Serper', desc: 'POST + X-API-KEY 头' },
                            { id: 'brave' as const, name: 'Brave', desc: 'GET + Subscription-Token 头' },
                          ]).map(opt => {
                            const active = protocol === opt.id
                            return (
                              <button key={opt.id} type="button" onClick={() => { setProtocol(opt.id); setTestResult(null) }}
                                className="text-left p-2.5 rounded-lg transition-all border"
                                style={{
                                  background: active ? `${accentColor}10` : 'var(--bg-input)',
                                  borderColor: active ? accentColor : 'var(--border-glass)',
                                }}>
                                <div className="text-xs font-medium" style={{ color: active ? accentColor : 'var(--text-primary)' }}>{opt.name}</div>
                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{opt.desc}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* API Key */}
                    {needsKey && (
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          {selectedProvider.api_key_label || 'API Key'}
                        </label>
                        <div className="relative">
                          <input type={showKey ? 'text' : 'password'} value={apiKey}
                            onChange={e => { setApiKey(e.target.value); setTestResult(null) }}
                            placeholder={selectedProvider.api_key_placeholder || '输入 API Key'}
                            className="w-full input-field text-sm pr-10" />
                          <button type="button" onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                            style={{ color: 'var(--text-muted)' }}>
                            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Base URL / 端点地址 */}
                    {needsKey && (
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          {selectedProvider.id === 'custom' ? '搜索 API 端点地址' : 'API 地址'}
                        </label>
                        {selectedProvider.id === 'custom' ? (
                          <input type="text" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setTestResult(null) }}
                            placeholder={
                              protocol === 'tavily' ? 'https://your-api.com/search' :
                              protocol === 'serper' ? 'https://your-api.com/search' :
                              'https://your-api.com/res/v1/web/search'
                            }
                            className="w-full input-field text-sm" />
                        ) : (
                          <input type="text" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setTestResult(null) }}
                            placeholder="https://api.example.com" className="w-full input-field text-sm" />
                        )}
                      </div>
                    )}

                    {/* Max results */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>返回结果数</label>
                      <input type="number" value={maxResults} onChange={e => setMaxResults(e.target.value)}
                        placeholder="5" min="1" max="20" className="w-full input-field text-sm" />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={handleTest} disabled={!hasKey || testing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: !hasKey || testing ? 'var(--bg-card)' : `${accentColor}15`,
                          border: `1px solid ${!hasKey || testing ? 'var(--border-glass)' : accentColor}`,
                          color: !hasKey || testing ? 'var(--text-dim)' : accentColor,
                          cursor: !hasKey || testing ? 'not-allowed' : 'pointer',
                        }} title={!hasKey ? '请先填写 API Key' : ''}>
                        {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                        {testing ? '正在测试...' : '测试连接'}
                      </button>

                      <AnimatePresence>
                        {testResult && (
                          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-sm">
                            {testResult.success ? (
                              <span className="text-green-400 flex items-center gap-1"><Check size={14} /> 成功 · {testResult.result_count} 条 ({testResult.latency_ms}ms)</span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1"><X size={14} /> {testResult.error || testResult.message}</span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Save */}
                    <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
                      <button onClick={handleSave} disabled={saving || !hasKey}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: saving || !hasKey ? 'var(--bg-card)' : `linear-gradient(135deg, ${accentColor}, var(--accent-blue))`,
                          color: '#fff', cursor: saving || !hasKey ? 'not-allowed' : 'pointer',
                          opacity: saving || !hasKey ? 0.5 : 1,
                        }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        保存
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-6 right-6 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ zIndex: 10000, background: 'var(--bg-card)', border: '1px solid var(--border-glass)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  )
}
