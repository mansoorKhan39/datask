export type User = { id: string; name: string; email: string }

export type Kind = 'number' | 'date' | 'category' | 'text' | 'boolean'

export type DatasetSummary = { id: string; name: string; rows: number; cols: number; size: number; created: string }

export type ColumnProfile = {
  name: string
  kind: Kind
  nulls: number
  null_pct: number
  unique: number
  samples: (string | number | boolean | null)[]
  stats?: Record<string, number | string | null>
  top?: { value: string | number | boolean | null; count: number }[]
}

export type Profile = { rows: number; cols: number; columns: ColumnProfile[] }

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'number' | 'table'

export type Chart =
  | { type: 'number'; title?: string | null; value: number; label: string }
  | { type: 'table'; title?: string | null }
  | {
      type: 'bar' | 'line' | 'pie' | 'scatter'
      title?: string | null
      x: string
      series: string[]
      data: Record<string, string | number | null>[]
      highlight?: number
      can_switch?: ChartType[]
    }

export type ResultTable = { columns: string[]; rows: (string | number | boolean | null)[][]; truncated?: boolean; row_count: number; steps: string[] }

export type Language = 'en' | 'ur' | 'roman_ur'

export type AnswerData = {
  kind: 'answer' | 'unanswerable'
  question: string
  language: Language
  ms?: number
  plan?: Record<string, unknown>
  result?: ResultTable
  chart?: Chart | null
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  data: AnswerData | null
  created: string
}

export type Usage = { used: number; limit: number; remaining: number }

export type Preview = { columns: string[]; kinds: Kind[]; rows: (string | number | boolean | null)[][]; total: number; offset: number }
