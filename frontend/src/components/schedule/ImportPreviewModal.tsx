/**
 * ImportPreviewModal — preview parsed course data before importing.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check, Loader2 } from 'lucide-react'
import type { ParsedCourseRecord, PeriodMapping } from '../../types'

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface ImportPreviewModalProps {
  records: ParsedCourseRecord[]
  periodMapping: PeriodMapping[]
  format?: string
  importing: boolean
  onConfirm: (records: ParsedCourseRecord[], semesterStart: string, periodMapping: PeriodMapping[]) => void
  onCancel: () => void
}

export function ImportPreviewModal({
  records: initialRecords, periodMapping: initialPeriodMapping, format,
  importing, onConfirm, onCancel,
}: ImportPreviewModalProps) {
  const [records, setRecords] = useState(initialRecords)
  const [periodMapping, setPeriodMapping] = useState(initialPeriodMapping)
  const [semesterStart, setSemesterStart] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set(records.map((_, i) => i)))

  const toggleRow = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === records.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(records.map((_, i) => i)))
    }
  }

  const updateRecord = (index: number, field: keyof ParsedCourseRecord, value: string | number) => {
    setRecords(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const updatePeriodMapping = (index: number, field: keyof PeriodMapping, value: string) => {
    setPeriodMapping(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const handleConfirm = () => {
    const selectedRecords = records.filter((_, i) => selected.has(i))
    onConfirm(selectedRecords, semesterStart, periodMapping)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-serif font-semibold" style={{ color: 'var(--text-primary)' }}>
              导入课表 — 预览
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {format && <span>已识别格式: {format === 'list' ? '列表格式' : '网格格式'} · </span>}
              共解析 {records.length} 条课程记录 · 已选 {selected.size} 条
            </p>
          </div>
          <button onClick={onCancel} className="btn-ghost p-1"><X size={20} /></button>
        </div>

        {/* Preview table */}
        <div className="flex-1 overflow-auto mb-4 border rounded-lg" style={{ borderColor: 'var(--border-glass)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-input)' }}>
                <th className="px-3 py-2 text-left w-8">
                  <input type="checkbox" checked={selected.size === records.length}
                         onChange={toggleAll} className="accent-[var(--accent-blue)]" />
                </th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>课程名称</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>星期</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>节次</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>教师</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>地点</th>
                <th className="px-3 py-2 text-left" style={{ color: 'var(--text-secondary)' }}>周次</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, i) => (
                <tr key={i} className="border-t transition-colors duration-150"
                    style={{
                      borderColor: 'var(--border-glass)',
                      background: selected.has(i) ? 'rgba(59,130,246,0.04)' : 'transparent',
                      opacity: selected.has(i) ? 1 : 0.5,
                    }}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(i)}
                           onChange={() => toggleRow(i)} className="accent-[var(--accent-blue)]" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={rec.name}
                           onChange={e => updateRecord(i, 'name', e.target.value)}
                           className="bg-transparent border-b border-transparent focus:border-[var(--accent-blue)] outline-none text-sm w-full"
                           style={{ color: 'var(--text-primary)' }} />
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {DAY_NAMES[rec.day_of_week] || rec.day_of_week}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {rec.start_period}-{rec.end_period}
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={rec.teacher}
                           onChange={e => updateRecord(i, 'teacher', e.target.value)}
                           className="bg-transparent border-b border-transparent focus:border-[var(--accent-blue)] outline-none text-sm w-full"
                           style={{ color: 'var(--text-secondary)' }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={rec.location}
                           onChange={e => updateRecord(i, 'location', e.target.value)}
                           className="bg-transparent border-b border-transparent focus:border-[var(--accent-blue)] outline-none text-sm w-full"
                           style={{ color: 'var(--text-secondary)' }} />
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {rec.weeks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Period mapping editor */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            节次时间映射
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {periodMapping.map((pm, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                   style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {pm.periods}
                </span>
                <input type="time" value={pm.start_time}
                       onChange={e => updatePeriodMapping(i, 'start_time', e.target.value)}
                       className="bg-transparent text-xs outline-none flex-1" style={{ color: 'var(--text-primary)' }} />
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>—</span>
                <input type="time" value={pm.end_time}
                       onChange={e => updatePeriodMapping(i, 'end_time', e.target.value)}
                       className="bg-transparent text-xs outline-none flex-1" style={{ color: 'var(--text-primary)' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Semester start */}
        <div className="mb-4">
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            学期起始日期 <span style={{ color: 'var(--text-dim)' }}>(用于计算周次)</span>
          </label>
          <input type="date" value={semesterStart} onChange={e => setSemesterStart(e.target.value)}
                 className="input-field max-w-xs" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">取消</button>
          <button onClick={handleConfirm}
                  disabled={importing || selected.size === 0 || !semesterStart}
                  className="btn-primary">
            {importing ? (
              <><Loader2 size={16} className="animate-spin" /> 导入中...</>
            ) : (
              <><Check size={16} /> 确认导入 ({selected.size} 条)</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
