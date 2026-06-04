/**
 * CourseManagerModal — manage courses, import from Excel/ICS/text.
 */
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  X, Upload, FileSpreadsheet, Calendar, ClipboardList,
  Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  createCourse, updateCourse, deleteCourse, toggleCourse,
  parseExcel, parseIcs, parseText, importCourses,
} from '../../services/api'
import type { Course, ParsedCourseRecord, PeriodMapping } from '../../types'
import { ImportPreviewModal } from './ImportPreviewModal'

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface CourseManagerModalProps {
  courses: Course[]
  onClose: () => void
  onChanged: () => void
}

export function CourseManagerModal({ courses, onClose, onChanged }: CourseManagerModalProps) {
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState<{
    records: ParsedCourseRecord[]; periodMapping: PeriodMapping[]; format?: string
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Manual add form
  const [formName, setFormName] = useState('')
  const [formDay, setFormDay] = useState(1)
  const [formStart, setFormStart] = useState('08:00')
  const [formEnd, setFormEnd] = useState('09:40')
  const [formLocation, setFormLocation] = useState('')
  const [formTeacher, setFormTeacher] = useState('')
  const [formWeeks, setFormWeeks] = useState('1-16')
  const [formSemesterStart, setFormSemesterStart] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File import handlers ──

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const result = await parseExcel(file)
      setImportData({ records: result.records, periodMapping: result.period_mapping, format: result.format })
      setShowImport(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Excel 解析失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleIcsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const result = await parseIcs(file)
      setImportData({ records: result.records, periodMapping: result.period_mapping })
      setShowImport(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ICS 解析失败')
    }
  }

  const handlePasteImport = async () => {
    const text = prompt('请粘贴课表表格内容（从教务系统复制）：')
    if (!text) return
    setError(null)
    try {
      const result = await parseText(text)
      setImportData({ records: result.records, periodMapping: result.period_mapping })
      setShowImport(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail || '文本解析失败')
    }
  }

  const handleConfirmImport = async (records: ParsedCourseRecord[], semesterStart: string, periodMapping: PeriodMapping[]) => {
    setImporting(true)
    try {
      const result = await importCourses({ records, semester_start: semesterStart, period_mapping: periodMapping })
      setShowImport(false)
      setImportData(null)
      onChanged()
      alert(`导入完成：${result.created} 条新增，${result.skipped} 条跳过`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || '导入失败')
    }
    setImporting(false)
  }

  // ── Manual add ──

  const handleManualAdd = async () => {
    if (!formName.trim()) return
    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, {
          name: formName.trim(), day_of_week: formDay, start_time: formStart, end_time: formEnd,
          location: formLocation, teacher: formTeacher, weeks: formWeeks, semester_start: formSemesterStart,
        })
      } else {
        await createCourse({
          name: formName.trim(), day_of_week: formDay, start_time: formStart, end_time: formEnd,
          location: formLocation, teacher: formTeacher, weeks: formWeeks, semester_start: formSemesterStart,
        })
      }
      setShowManualAdd(false)
      setEditingCourse(null)
      resetForm()
      onChanged()
    } catch (err: any) {
      setError(err?.response?.data?.detail || '保存失败')
    }
  }

  const resetForm = () => {
    setFormName(''); setFormDay(1); setFormStart('08:00'); setFormEnd('09:40')
    setFormLocation(''); setFormTeacher(''); setFormWeeks('1-16'); setFormSemesterStart('')
  }

  const openEditForm = (c: Course) => {
    setEditingCourse(c)
    setFormName(c.name); setFormDay(c.day_of_week); setFormStart(c.start_time); setFormEnd(c.end_time)
    setFormLocation(c.location); setFormTeacher(c.teacher); setFormWeeks(c.weeks); setFormSemesterStart(c.semester_start)
    setShowManualAdd(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此课程？')) return
    try { await deleteCourse(id); onChanged() } catch { /* */ }
  }

  const handleToggle = async (id: string) => {
    try { await toggleCourse(id); onChanged() } catch { /* */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold" style={{ color: 'var(--text-primary)' }}>
            课表管理
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={20} /></button>
        </div>

        {/* Import buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <label className="btn-secondary !py-2 !px-3 text-xs cursor-pointer flex items-center gap-1.5">
            <FileSpreadsheet size={14} />
            上传 Excel
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
          </label>
          <label className="btn-secondary !py-2 !px-3 text-xs cursor-pointer flex items-center gap-1.5">
            <Calendar size={14} />
            上传 ICS
            <input type="file" accept=".ics" className="hidden" onChange={handleIcsUpload} />
          </label>
          <button onClick={handlePasteImport}
                  className="btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5">
            <ClipboardList size={14} />
            粘贴表格
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-sm"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgb(252,165,165)' }}>
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* Course list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 mb-4">
          {courses.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-dim)' }}>
              <p className="text-sm">还没有课程</p>
              <p className="text-xs mt-1">通过上方按钮导入，或手动添加</p>
            </div>
          ) : (
            courses.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200"
                   style={{ background: 'var(--bg-input)', border: '1px solid var(--border-glass)' }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    {DAY_NAMES[c.day_of_week]} {c.start_time}-{c.end_time}
                  </span>
                  {c.location && (
                    <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>
                      {c.location}
                    </span>
                  )}
                </div>
                <button onClick={() => handleToggle(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title={c.is_active ? '点击禁用' : '点击启用'}>
                  {c.is_active
                    ? <ToggleRight size={20} style={{ color: 'var(--accent-blue)' }} />
                    : <ToggleLeft size={20} style={{ color: 'var(--text-dim)' }} />}
                </button>
                <button onClick={() => openEditForm(c)}
                        className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil size={14} style={{ color: 'var(--text-dim)' }} />
                </button>
                <button onClick={() => handleDelete(c.id)}
                        className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} style={{ color: 'var(--text-dim)' }} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Manual add */}
        {showManualAdd ? (
          <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border-glass)' }}>
            <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {editingCourse ? '编辑课程' : '手动添加课程'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                     placeholder="课程名称" className="input-field" />
              <select value={formDay} onChange={e => setFormDay(Number(e.target.value))}
                      className="input-field">
                {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
              <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className="input-field" />
              <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="input-field" />
              <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)}
                     placeholder="上课地点" className="input-field" />
              <input type="text" value={formTeacher} onChange={e => setFormTeacher(e.target.value)}
                     placeholder="授课教师" className="input-field" />
              <input type="text" value={formWeeks} onChange={e => setFormWeeks(e.target.value)}
                     placeholder="周次 (如 1-16)" className="input-field" />
              <input type="date" value={formSemesterStart} onChange={e => setFormSemesterStart(e.target.value)}
                     placeholder="学期起始日期" className="input-field" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowManualAdd(false); setEditingCourse(null); resetForm() }}
                      className="btn-secondary !py-1.5 text-xs">取消</button>
              <button onClick={handleManualAdd} className="btn-primary !py-1.5 text-xs">
                {editingCourse ? '保存' : '添加'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setEditingCourse(null); resetForm(); setShowManualAdd(true) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs transition-all duration-200"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px dashed var(--border-glass)',
                    color: 'var(--text-muted)',
                  }}>
            <Plus size={14} />
            手动添加一门课
          </button>
        )}
      </motion.div>

      {/* Import preview modal */}
      {showImport && importData && (
        <ImportPreviewModal
          records={importData.records}
          periodMapping={importData.periodMapping}
          format={importData.format}
          importing={importing}
          onConfirm={handleConfirmImport}
          onCancel={() => { setShowImport(false); setImportData(null) }}
        />
      )}
    </motion.div>
  )
}
