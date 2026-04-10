import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  AlertTriangle,
  BanknoteArrowDown,
  BarChart3,
  Copy,
  Download,
  FileCheck,
  FileText,
  LayoutGrid,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import TreasurySimulator from '../components/TreasurySimulator'
import { AnimatedCounter } from '../components/ui/AnimatedCounter'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const DASHBOARD_MODE_KEY = 'dashboard_mode'

type DashboardMode = 'simple' | 'advanced'

interface DashboardStats {
  processed_batches: number
  total_amount: number
  issues_count: number
  duplicate_invoices_count: number
  status_distribution: { name: string; value: number; color: string }[]
  monthly_volume: { name: string; full_date: string; amount: number }[]
  cash_flow_projection: { name: string; range: string; amount: number; full_date: string }[]
}

interface BatchItem {
  id: number
  name: string
  created_at: string
  payment_date?: string | null
  status: string
  total_amount?: number
}

interface PaginatedBatches {
  items: BatchItem[]
  total: number
}

interface TreasuryWeek {
  label: string
  range: string
  scheduled_amount: number
  delayed_amount: number
  stressed_amount: number
  scheduled_balance: number
  delayed_balance: number
  stressed_balance: number
  available_after_reserve: number
  providers: { cif?: string; name: string; amount: number; invoices: number }[]
}

interface TreasuryData {
  opening_balance: number
  reserve_balance: number
  payment_delay_days: number
  stress_pct: number
  weeks: TreasuryWeek[]
  summary: {
    scheduled_total: number
    delayed_total: number
    stressed_total: number
    final_balance: number
    peak_week?: TreasuryWeek | null
  }
  top_exposures: { cif?: string; name: string; amount: number; invoices: number }[]
  alerts: { type: 'critical' | 'warning' | 'info'; message: string }[]
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
const tooltipCount = (value: number | string | undefined) => [Number(value || 0), 'Facturas'] as [number, string]

export default function Dashboard() {
  const [mode, setMode] = useState<DashboardMode>(() => {
    if (typeof window === 'undefined') return 'simple'
    return (window.localStorage.getItem(DASHBOARD_MODE_KEY) as DashboardMode) || 'simple'
  })

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_MODE_KEY, mode)
  }, [mode])

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const { data } = await axios.get<DashboardStats>(`${API_URL}/batches/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return data
    },
  })

  const { data: recentBatches = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['dashboard-recent-batches'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const { data } = await axios.get<PaginatedBatches>(`${API_URL}/batches/?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return data.items
    },
  })

  const { data: treasury, isLoading: loadingTreasury } = useQuery({
    queryKey: ['dashboard-treasury-summary'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const { data } = await axios.get<TreasuryData>(`${API_URL}/batches/treasury-simulator`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return data
    },
  })

  const triggerDownload = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const getFilenameFromHeader = (headerValue?: string, fallback = 'descarga') => {
    if (!headerValue) return fallback
    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
    const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
    return plainMatch?.[1] || fallback
  }

  const downloadAuthenticatedFile = async (url: string, fallbackFilename: string) => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      toast.error('Tu sesión ha expirado. Inicia sesión de nuevo.')
      return
    }

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      const filename = getFilenameFromHeader(response.headers['content-disposition'], fallbackFilename)
      triggerDownload(response.data, filename)
    } catch {
      toast.error('No se pudo descargar el informe')
    }
  }

  const handleDownloadReport = async () => {
    const today = new Date()
    const month = today.getMonth() + 1
    const year = today.getFullYear()
    await downloadAuthenticatedFile(`${API_URL}/reports/monthly-pdf?month=${month}&year=${year}`, `Informe_Teso_${month}_${year}.pdf`)
  }

  const handleDownloadExcel = async () => {
    await downloadAuthenticatedFile(`${API_URL}/reports/excel/dashboard`, 'Dashboard_Confirming.xlsx')
  }

  const simpleSummary = useMemo(() => {
    const currentMonth = stats?.monthly_volume?.at(-1)?.amount ?? 0
    const previousMonth = stats?.monthly_volume?.at(-2)?.amount ?? 0
    const monthlyTrendPct = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0
    const nextWeek = treasury?.weeks?.[0]
    const reserveRisk = treasury?.weeks?.find((week) => week.available_after_reserve < 0)
    return {
      currentMonth,
      previousMonth,
      monthlyTrendPct,
      nextWeek,
      reserveRisk,
      primaryAlert: treasury?.alerts?.[0],
      peakWeek: treasury?.summary?.peak_week,
    }
  }, [stats, treasury])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">Centro de control</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {mode === 'simple' ? 'Vista rapida del negocio' : 'Analitica avanzada de confirming'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
            {mode === 'simple'
              ? 'Una lectura ejecutiva para detectar tension de caja, incidencias y actividad sin perder tiempo.'
              : 'Panel completo para analizar tesoreria, calidad de datos, volumen y comportamiento operativo en detalle.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 xl:items-center">
          <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900 p-1 shadow-sm shadow-slate-950/5">
            <ModeButton active={mode === 'simple'} onClick={() => setMode('simple')} icon={LayoutGrid} label="Simple" />
            <ModeButton active={mode === 'advanced'} onClick={() => setMode('advanced')} icon={BarChart3} label="Avanzado" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              <Download size={18} /> Excel
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm"
            >
              <FileText size={18} /> Informe mensual
            </button>
          </div>
        </div>
      </div>

      {mode === 'simple' ? (
        <SimpleDashboardView
          stats={stats}
          treasury={treasury}
          recentBatches={recentBatches}
          loading={loadingStats || loadingTreasury || loadingRecent}
          summary={simpleSummary}
        />
      ) : (
        <AdvancedDashboardView
          stats={stats}
          treasury={treasury}
          recentBatches={recentBatches}
          loading={loadingStats || loadingTreasury || loadingRecent}
        />
      )}
    </motion.div>
  )
}

function SimpleDashboardView({
  stats,
  treasury,
  recentBatches,
  loading,
  summary,
}: {
  stats?: DashboardStats
  treasury?: TreasuryData
  recentBatches: BatchItem[]
  loading: boolean
  summary: {
    currentMonth: number
    previousMonth: number
    monthlyTrendPct: number
    nextWeek?: TreasuryWeek
    reserveRisk?: TreasuryWeek
    primaryAlert?: TreasuryData['alerts'][number]
    peakWeek?: TreasuryWeek | null
  }
}) {
  const trendTone = summary.monthlyTrendPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SimpleKPICard
          title="Pagos 8 semanas"
          value={formatCurrency(treasury?.summary?.scheduled_total ?? 0)}
          hint={summary.peakWeek ? `Pico ${summary.peakWeek.range}` : 'Sin pico'}
          icon={BanknoteArrowDown}
        />
        <SimpleKPICard
          title="Volumen del mes"
          value={formatCurrency(summary.currentMonth)}
          hint={`${summary.monthlyTrendPct >= 0 ? '+' : ''}${summary.monthlyTrendPct.toFixed(1)}% vs anterior`}
          hintClassName={trendTone}
          icon={summary.monthlyTrendPct >= 0 ? TrendingUp : TrendingDown}
        />
        <SimpleKPICard
          title="Incidencias"
          value={String(stats?.issues_count ?? 0)}
          hint="Warnings + errores"
          icon={AlertTriangle}
        />
        <SimpleKPICard
          title="Duplicados"
          value={String(stats?.duplicate_invoices_count ?? 0)}
          hint="Facturas a revisar"
          icon={Copy}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <SectionCard title="Resumen Financiero" subtitle="Proyeccion de flujo de caja proximas semanas.">
          {stats?.cash_flow_projection ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.cash_flow_projection} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k€`} />
                  <Tooltip content={<AdvancedTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={54}>
                    {stats.cash_flow_projection.map((entry, index) => (
                      <Cell key={`${entry.full_date}-${index}`} fill={index === 0 ? '#f97316' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Calculando...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>

        <SectionCard title="Calidad de Datos" subtitle="Distribucion entre facturas validas e incidencias.">
          {stats?.status_distribution ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.status_distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {stats.status_distribution.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={tooltipCount} />
                  <Legend verticalAlign="bottom" height={32} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Analizando...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Volumen Mensual" subtitle="Evolucion del importe gestionado por mes.">
          {stats?.monthly_volume ? (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly_volume}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip content={<AdvancedTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Cargando...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>

        <SectionCard title="Actividad Reciente" subtitle="Ultimos lotes creados con importe y estado actual.">
          {recentBatches.length ? (
            <div className="space-y-3">
              {recentBatches.slice(0, 4).map((batch) => (
                <div key={batch.id} className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{batch.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(batch.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{formatCurrency(batch.total_amount || 0)}</span>
                    <StatusBadge status={batch.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Cargando...' : 'Sin actividad reciente.'} />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function AdvancedDashboardView({
  stats,
  treasury,
  recentBatches,
  loading,
}: {
  stats?: DashboardStats
  treasury?: TreasuryData
  recentBatches: BatchItem[]
  loading: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title="Remesas procesadas"
          value={<AnimatedCounter value={stats?.processed_batches ?? 0} />}
          icon={FileCheck}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <KPICard
          title="Importe total"
          value={
            <div className="flex gap-1">
              <AnimatedCounter value={stats?.total_amount ?? 0} formatter={(value) => formatCurrency(value).replace('€', '').trim()} />
              <span>€</span>
            </div>
          }
          icon={FileText}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-950/30"
        />
        <KPICard
          title="Incidencias"
          value={<AnimatedCounter value={stats?.issues_count ?? 0} />}
          icon={AlertTriangle}
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
        <KPICard
          title="Duplicados detectados"
          value={<AnimatedCounter value={stats?.duplicate_invoices_count ?? 0} />}
          icon={Copy}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      <TreasurySimulator />

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr,0.75fr] gap-6">
        <SectionCard title="Proyeccion de pagos" subtitle="Vision compacta de las proximas semanas desde el cuadro avanzado.">
          {stats?.cash_flow_projection ? (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.cash_flow_projection} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k€`} />
                  <Tooltip content={<AdvancedTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={54}>
                    {stats.cash_flow_projection.map((entry, index) => (
                      <Cell key={`${entry.full_date}-${index}`} fill={index === 0 ? '#f97316' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Calculando proyeccion...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>

        <SectionCard title="Alertas y presion de caja" subtitle="Lectura avanzada para priorizar acciones.">
          <div className="space-y-3">
            {treasury?.alerts?.length ? treasury.alerts.map((alert) => (
              <div
                key={alert.message}
                className={`rounded-2xl border px-4 py-3 ${
                  alert.type === 'critical'
                    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-300'
                    : alert.type === 'warning'
                      ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-900/60 dark:text-orange-300'
                      : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert size={18} className="mt-0.5" />
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              </div>
            )) : <MutedPlaceholder label="No hay alertas activas." />}

            {treasury?.top_exposures?.slice(0, 3).map((provider) => (
              <div key={`${provider.cif}-${provider.name}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{provider.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{provider.invoices} facturas</p>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(provider.amount)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Volumen mensual" subtitle="Evolucion del importe gestionado por mes.">
          {stats?.monthly_volume ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly_volume}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip content={<AdvancedTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Cargando volumen...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>

        <SectionCard title="Calidad de datos" subtitle="Distribucion entre facturas validas e incidencias.">
          {stats?.status_distribution ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.status_distribution} cx="50%" cy="50%" innerRadius={62} outerRadius={102} paddingAngle={4} dataKey="value">
                    {stats.status_distribution.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={tooltipCount} />
                  <Legend verticalAlign="bottom" height={32} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <MutedPlaceholder label={loading ? 'Analizando calidad...' : 'Sin datos suficientes'} />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Actividad reciente" subtitle="Ultimos lotes creados con importe y estado actual.">
        {recentBatches.length ? (
          <div className="space-y-4">
            {recentBatches.map((batch) => (
              <div key={batch.id} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{batch.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(batch.created_at).toLocaleDateString('es-ES')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatCurrency(batch.total_amount || 0)}</span>
                  <StatusBadge status={batch.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MutedPlaceholder label={loading ? 'Cargando actividad...' : 'No hay actividad reciente.'} />
        )}
      </SectionCard>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ComponentType<{ size?: number }>
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
        active
          ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
          : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/80'
      }`}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-orange-500 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}>
        <Icon size={16} />
      </span>
      <span>{label}</span>
    </button>
  )
}

function SimpleKPICard({
  title,
  value,
  hint,
  icon: Icon,
  hintClassName = 'text-slate-500 dark:text-slate-400',
}: {
  title: string
  value: string
  hint: string
  icon: ComponentType<{ size?: number }>
  hintClassName?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className={`text-xs mt-1 ${hintClassName}`}>{hint}</p>
      </div>
      <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400">
        <Icon size={20} />
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800 p-6">
      <div className="mb-5">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  const classes = normalized === 'SENT'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : normalized === 'GENERATED'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

  return <span className={`text-xs px-3 py-1 rounded-full font-semibold ${classes}`}>{status}</span>
}

function MutedPlaceholder({ label }: { label: string }) {
  return <div className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">{label}</div>
}

function KPICard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  )
}

function AdvancedTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((item: any) => (
            <div key={item.dataKey} className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              <span>{item.name || item.dataKey}: {formatCurrency(Number(item.value || 0))}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}
