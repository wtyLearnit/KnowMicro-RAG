/**
 * 供应商预设配置
 */
export interface ProviderDef {
  id: string
  name: string
  icon: string        // emoji 图标
  base_url: string
  requires_api_key: boolean
  api_key_label: string | null
  api_key_placeholder: string | null
  supports_model_list: boolean
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    base_url: 'https://api.openai.com/v1',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: 'sk-...',
    supports_model_list: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔵',
    base_url: 'https://api.deepseek.com/v1',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: 'sk-...',
    supports_model_list: true,
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    icon: '🟣',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: '输入智谱 API Key',
    supports_model_list: true,
  },
  {
    id: 'qwen',
    name: '通义千问',
    icon: '🟠',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: 'sk-...',
    supports_model_list: true,
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    icon: '🌙',
    base_url: 'https://api.moonshot.cn/v1',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: 'sk-...',
    supports_model_list: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '🦙',
    base_url: 'http://localhost:11434/v1',
    requires_api_key: false,
    api_key_label: null,
    api_key_placeholder: null,
    supports_model_list: true,
  },
  {
    id: 'custom',
    name: '自定义',
    icon: '⚙️',
    base_url: '',
    requires_api_key: true,
    api_key_label: 'API Key',
    api_key_placeholder: '输入 API Key',
    supports_model_list: true,
  },
]

const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]))

/** 根据 provider id 获取预设定义，未知 id 返回 custom */
export function getProvider(id: string): ProviderDef {
  return PROVIDER_MAP[id] || PROVIDERS[PROVIDERS.length - 1]
}
