/**
 * Shared static configuration constants.
 * Values that never change at runtime belong here, not inside component bodies.
 */

export interface TopKOption {
  value: number
  label: string
  desc: string
}

export const TOP_K_OPTIONS: TopKOption[] = [
  { value: 3, label: '3 条', desc: '快速精准，适合简单问题' },
  { value: 5, label: '5 条', desc: '默认推荐，平衡速度与质量' },
  { value: 8, label: '8 条', desc: '广泛检索，适合复杂问题' },
  { value: 10, label: '10 条', desc: '深度搜索，覆盖更多内容' },
  { value: 15, label: '15 条', desc: '全面检索，适合对比分析' },
  { value: 20, label: '20 条', desc: '最大范围，响应较慢' },
]
