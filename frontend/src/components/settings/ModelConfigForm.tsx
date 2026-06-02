/**
 * ModelConfigForm — LLM / Embedding 模型配置
 * 已配置列表 + 两步弹窗（选供应商 → 配置详情）
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Brain, Eye, EyeOff, Loader2, Check, X,
  Wifi, WifiOff, Save, Trash2, List, Plus, ArrowLeft, XCircle,
} from 'lucide-react'
import {
  getModelConfigs, createModelConfig, updateModelConfig,
  deleteModelConfig, testModelConfig, fetchModels, batchAddModels,
} from '../../services/api'
import { PROVIDERS, getProvider } from '../../utils/providers'
import type { UserModelConfig, ModelTestResult, ModelInfo } from '../../types'
import type { ProviderDef } from '../../utils/providers'

const DOTS = '••••••••'

interface Props {
  configType: 'llm' | 'embedding'
  title: string
  icon: 'cpu' | 'brain'
}

export function ModelConfigForm({ configType, title, icon }: Props) {
  const [configs, setConfigs] = useState<UserModelConfig[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null)

  // Form state (step 2)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [modelName, setModelName] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [batchSize, setBatchSize] = useState('10')
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  // Fetch models state
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showModelList, setShowModelList] = useState(false)
  const [batchAdding, setBatchAdding] = useState(false)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  const Icon = icon === 'cpu' ? Cpu : Brain
  const accentColor = icon === 'cpu' ? 'var(--accent-blue)' : 'var(--accent-purple)'
  const existingNames = new Set(configs.map(c => c.model_name))

  useEffect(() => { loadConfigs() }, [configType])

  async function loadConfigs() {
    setLoading(true)
    try { setConfigs(await getModelConfigs(configType)) } catch { /* ignore */ } finally { setLoading(false) }
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
    setHasExistingKey(false)
    setShowKey(false)
    setTestResult(null)
    setFetchedModels([])
    setShowModelList(false)
    setFetchError(null)
    // Embedding 默认维度
    if (configType === 'embedding') {
      const defaults: Record<string, string> = {
        openai: '1536', deepseek: '', zhipu: '', qwen: '2048',
        moonshot: '', ollama: '', custom: '',
      }
      setDimensions(defaults[p.id] || '')
      setBatchSize(p.id === 'qwen' ? '6' : '10')
    }
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
    setHasExistingKey(false)
    setShowKey(false)
    setModelName('')
    setDimensions('')
    setBatchSize('10')
    setTestResult(null)
    setFetchedModels([])
    setShowModelList(false)
    setSelectedModels(new Set())
    setFetchError(null)
  }

  // ── Computed ─────────────────────────────────────
  const effectiveKey = apiKey.trim()
  const needsKey = selectedProvider?.requires_api_key ?? true
  const hasKey = !needsKey || !!effectiveKey
  const canFetch = baseUrl.trim() && hasKey && (selectedProvider?.supports_model_list ?? false)
  const effectiveModelName = modelName.trim() || (configs.length > 0 ? configs[0].model_name : '')
  const canTest = baseUrl.trim() && !!effectiveModelName && hasKey

  function getApiKeyForRequest(): string { return effectiveKey }
  function getConfigIdForRequest(): string | undefined {
    return !effectiveKey && configs.length > 0 ? configs[0].id : undefined
  }

  // ── Fetch models ─────────────────────────────────
  async function handleFetchModels() {
    setFetching(true); setFetchError(null); setFetchedModels([]); setSelectedModels(new Set())
    try {
      const result = await fetchModels({
        config_type: configType, base_url: baseUrl.trim(),
        api_key: getApiKeyForRequest() || undefined, config_id: getConfigIdForRequest(),
      })
      if (result.success) {
        setFetchedModels(result.models); setShowModelList(true)
        if (result.models.length === 0) showToast('未获取到可用模型')
      } else {
        setFetchError(result.error || '获取失败')
        showToast('获取失败: ' + (result.error || '未知错误'))
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '网络错误'
      setFetchError(msg); showToast('获取失败: ' + msg)
    } finally { setFetching(false) }
  }

  function toggleModel(id: string) {
    setSelectedModels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() { setSelectedModels(new Set(fetchedModels.filter(m => !existingNames.has(m.id)).map(m => m.id))) }
  function deselectAll() { setSelectedModels(new Set()) }

  // ── Batch add ────────────────────────────────────
  async function handleBatchAdd() {
    if (selectedModels.size === 0) return
    setBatchAdding(true)
    try {
      const extra: Record<string, unknown> = {}
      if (configType === 'embedding') {
        if (dimensions.trim()) extra.dimensions = parseInt(dimensions, 10)
        if (batchSize.trim()) extra.batch_size = parseInt(batchSize, 10)
      }
      const result = await batchAddModels({
        config_type: configType, provider: selectedProvider?.id || 'custom',
        base_url: baseUrl.trim(), api_key: getApiKeyForRequest(),
        models: Array.from(selectedModels),
        extra_params: Object.keys(extra).length > 0 ? extra : undefined,
      })
      let msg = `成功添加 ${result.created} 个模型`
      if (result.skipped > 0) msg += `，${result.skipped} 个已存在`
      showToast(msg); setSelectedModels(new Set()); await loadConfigs()
    } catch (e: any) {
      showToast('批量添加失败: ' + (e?.response?.data?.detail || e?.message || '未知错误'))
    } finally { setBatchAdding(false) }
  }

  // ── Test ─────────────────────────────────────────
  async function handleTest() {
    setTesting(true); setTestResult(null)
    try {
      const result = await testModelConfig({
        config_type: configType, base_url: baseUrl.trim(),
        api_key: getApiKeyForRequest() || undefined,
        model_name: effectiveModelName, config_id: getConfigIdForRequest(),
      })
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ success: false, latency_ms: 0, message: '请求失败', error: e?.message || '未知错误' })
    } finally { setTesting(false) }
  }

  // ── Save single ──────────────────────────────────
  async function handleSave() {
    if (!effectiveModelName) return
    setSaving(true)
    try {
      const extra: Record<string, unknown> = {}
      if (configType === 'embedding') {
        if (dimensions.trim()) extra.dimensions = parseInt(dimensions, 10)
        if (batchSize.trim()) extra.batch_size = parseInt(batchSize, 10)
      }
      const payload: any = {
        config_type: configType, provider: selectedProvider?.id || 'custom',
        base_url: baseUrl.trim(), model_name: effectiveModelName,
        is_active: configs.length === 0,
        extra_params: extra,
      }
      if (effectiveKey) payload.api_key = effectiveKey
      await createModelConfig(payload)
      showToast('配置已保存'); setModelName(''); setApiKey(''); setShowKey(false)
      await loadConfigs()
    } catch (e: any) {
      showToast('保存失败: ' + (e?.response?.data?.detail || e?.message || '未知错误'))
    } finally { setSaving(false) }
  }

  // ── Config management ────────────────────────────
  async function handleSetActive(id: string) {
    try { await updateModelConfig(id, { is_active: true }); await loadConfigs() } catch { showToast('操作失败') }
  }
  async function handleDeleteConfig(config: UserModelConfig) {
    if (!confirm(`确定删除模型「${config.model_name}」的配置吗？`)) return
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
            <Icon size={16} style={{ color: accentColor }} />
          </div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ background: `linear-gradient(135deg, ${accentColor}, var(--accent-cyan))`, color: '#fff' }}>
          <Plus size={14} /> 添加模型
        </button>
      </div>

      {/* Configured Models List */}
      {configs.length === 0 ? (
        <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">暂无配置，点击「添加模型」开始</p>
        </div>
      ) : (
        <div className="space-y-1">
          {configs.map(c => {
            const prov = getProvider(c.provider)
            return (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                   style={{ background: c.is_active ? `${accentColor}08` : 'var(--bg-input)',
                            border: `1px solid ${c.is_active ? `${accentColor}30` : 'var(--border-glass)'}` }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.is_active ? '#22c55e' : 'var(--text-dim)' }} />
                <span className="text-base shrink-0" title={prov.name}>{prov.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono truncate block" style={{ color: 'var(--text-primary)' }}>{c.model_name}</span>
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>{prov.name}</span>
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
                      {step === 1 ? '选择模型供应商' : `配置 ${selectedProvider?.name}`}
                    </h3>
                  </div>
                  <button onClick={closeModal} className="p-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors">
                    <XCircle size={18} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>

                {/* Step 1: Provider selection */}
                {step === 1 && (
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-3 gap-2.5">
                      {PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => selectProvider(p)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-[1.02]"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.background = `${accentColor}08` }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.background = 'var(--bg-input)' }}>
                          <span className="text-2xl">{p.icon}</span>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
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
                      <span className="text-xs ml-auto cursor-pointer" style={{ color: accentColor }} onClick={backToStep1}>更换供应商</span>
                    </div>

                    {/* Base URL */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>API 地址</label>
                      <input type="text" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); setTestResult(null) }}
                        placeholder="https://api.example.com/v1" className="w-full input-field text-sm" />
                    </div>

                    {/* API Key */}
                    {selectedProvider.requires_api_key && (
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          {selectedProvider.api_key_label || 'API Key'}
                        </label>
                        <div className="relative">
                          {showKey ? (
                            <input type="text" value={apiKey}
                              onChange={e => { setApiKey(e.target.value); setHasExistingKey(false); setTestResult(null) }}
                              placeholder={selectedProvider.api_key_placeholder || 'sk-...'}
                              className="w-full input-field text-sm pr-10" />
                          ) : (
                            <input type="text" value={hasExistingKey && !apiKey ? DOTS : apiKey}
                              onChange={e => { setApiKey(e.target.value); setHasExistingKey(false); setTestResult(null) }}
                              onFocus={() => { if (hasExistingKey && !apiKey) setShowKey(true) }}
                              placeholder={selectedProvider.api_key_placeholder || 'sk-...'}
                              className="w-full input-field text-sm pr-10"
                              style={{ letterSpacing: hasExistingKey && !apiKey ? '2px' : 'normal' }}
                              onCopy={e => { if (hasExistingKey && !apiKey) e.preventDefault() }}
                              onCut={e => { if (hasExistingKey && !apiKey) e.preventDefault() }} />
                          )}
                          <button type="button" onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                            style={{ color: 'var(--text-muted)' }}>
                            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Embedding 特有参数 */}
                    {configType === 'embedding' && (
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>向量维度</label>
                          <input type="number" value={dimensions} onChange={e => setDimensions(e.target.value)}
                            placeholder="如 2048" className="w-full input-field text-sm" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>批处理大小</label>
                          <input type="number" value={batchSize} onChange={e => setBatchSize(e.target.value)}
                            placeholder="10" className="w-full input-field text-sm" />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {selectedProvider.supports_model_list && (
                        <button onClick={handleFetchModels} disabled={!canFetch || fetching}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: !canFetch || fetching ? 'var(--bg-card)' : `${accentColor}15`,
                            border: `1px solid ${!canFetch || fetching ? 'var(--border-glass)' : accentColor}`,
                            color: !canFetch || fetching ? 'var(--text-dim)' : accentColor,
                            cursor: !canFetch || fetching ? 'not-allowed' : 'pointer',
                          }} title={!canFetch ? '请先填写 API 地址和密钥' : ''}>
                          {fetching ? <Loader2 size={14} className="animate-spin" /> : <List size={14} />}
                          {fetching ? '正在获取...' : '获取模型列表'}
                        </button>
                      )}

                      <button onClick={handleTest} disabled={!canTest || testing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: !canTest || testing ? 'var(--bg-card)' : `${accentColor}15`,
                          border: `1px solid ${!canTest || testing ? 'var(--border-glass)' : accentColor}`,
                          color: !canTest || testing ? 'var(--text-dim)' : accentColor,
                          cursor: !canTest || testing ? 'not-allowed' : 'pointer',
                        }} title={!canTest ? '请先填写完整配置' : ''}>
                        {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                        {testing ? '正在测试...' : '测试连接'}
                      </button>

                      <AnimatePresence>
                        {testResult && (
                          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-sm">
                            {testResult.success ? (
                              <span className="text-green-400 flex items-center gap-1"><Check size={14} /> 连接成功 ({testResult.latency_ms}ms)</span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1"><X size={14} /> {testResult.message}</span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Fetch error */}
                    {fetchError && (
                      <div className="text-xs rounded-lg p-3"
                           style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-muted)' }}>
                        {fetchError} — 请手动输入模型名称后保存
                      </div>
                    )}

                    {/* Available Models Panel */}
                    <AnimatePresence>
                      {showModelList && fetchedModels.length > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
                          <div className="p-3 space-y-2" style={{ background: 'var(--bg-input)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>可用模型 ({fetchedModels.length} 个)</span>
                              <div className="flex items-center gap-2">
                                <button onClick={selectAll} className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card-hover)]" style={{ color: 'var(--text-muted)' }}>全选</button>
                                <button onClick={deselectAll} className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card-hover)]" style={{ color: 'var(--text-muted)' }}>取消</button>
                              </div>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                              {fetchedModels.map(m => {
                                const exists = existingNames.has(m.id); const checked = selectedModels.has(m.id)
                                return (
                                  <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                    style={{ cursor: exists ? 'not-allowed' : 'pointer', opacity: exists ? 0.5 : 1,
                                             background: checked && !exists ? `${accentColor}10` : 'transparent' }}>
                                    <input type="checkbox" checked={checked} disabled={exists} onChange={() => toggleModel(m.id)} style={{ accentColor }} />
                                    <span className="text-sm font-mono flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{m.id}</span>
                                    {exists && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}>已添加</span>}
                                  </label>
                                )
                              })}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>已选 {selectedModels.size} 个</span>
                              <button onClick={handleBatchAdd} disabled={selectedModels.size === 0 || batchAdding}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: selectedModels.size === 0 || batchAdding ? 'var(--bg-card)' : `linear-gradient(135deg, ${accentColor}, var(--accent-cyan))`,
                                  color: '#fff', cursor: selectedModels.size === 0 || batchAdding ? 'not-allowed' : 'pointer',
                                  opacity: selectedModels.size === 0 || batchAdding ? 0.5 : 1,
                                }}>
                                {batchAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                {batchAdding ? '正在添加...' : '批量添加选中模型'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Manual input (always available as fallback) */}
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-muted)' }}>模型名称</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={modelName} onChange={e => setModelName(e.target.value)}
                            placeholder={configType === 'llm' ? 'gpt-4o' : 'text-embedding-3-small'}
                            className="flex-1 input-field text-sm" />
                          <button onClick={handleSave} disabled={saving || !modelName.trim() || !baseUrl.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0"
                            style={{
                              background: saving ? 'var(--bg-card)' : `linear-gradient(135deg, ${accentColor}, var(--accent-cyan))`,
                              color: '#fff', cursor: saving || !modelName.trim() || !baseUrl.trim() ? 'not-allowed' : 'pointer',
                              opacity: saving || !modelName.trim() || !baseUrl.trim() ? 0.5 : 1,
                            }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            保存
                          </button>
                        </div>
                      </div>

                    {/* Done button */}
                    <div className="flex justify-end pt-2">
                      <button onClick={closeModal}
                        className="px-5 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, var(--accent-cyan))`, color: '#fff' }}>
                        完成
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast — 在 portal 内，确保不被弹窗遮挡 */}
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
