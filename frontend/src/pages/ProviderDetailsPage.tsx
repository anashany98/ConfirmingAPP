import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { ComponentType } from 'react'
import {
  Building2,
  ChevronLeft,
  Copy,
  Euro,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '../components/ui/skeleton'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ProviderInsight {
  type: 'positive' | 'warning' | 'info'
  message: string
}

interface DuplicateGroup {
  reference: string
  amount: number
  due_date?: string | null
  occurrences: number
  total_amount: number
  batch_ids: number[]
}

interface MonthlyVolumePoint {
  label: string
  amount: number
  invoices: number
}

interface ProviderStats {
  cif: string
  name: string
  total_amount: number
  total_invoices: number
  last_payment_date?: string
  average_amount: number
  email?: string
  phone?: string
  address?: string
  city?: string
  zip_code?: string
  country?: string
  iban?: string
  swift?: string
  updated_at?: string
  next_due_date?: string
  upcoming_due_amount: number
  upcoming_invoices_count: number
  overdue_invoices_count: number
  duplicate_invoices_count: number
  duplicate_groups: DuplicateGroup[]
  monthly_volume: MonthlyVolumePoint[]
  insights: ProviderInsight[]
}

interface ProviderInvoice {
  id: number
  cif: string
  nombre?: string
  factura?: string
  importe: number
  fecha_vencimiento?: string
  status: string
  batch_id?: number
  batch_name?: string
  payment_date?: string
  duplicate_status?: string
  duplicate_message?: string
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

const tooltipCurrency = (value: number | string | undefined) => formatCurrency(Number(value || 0))

export default function ProviderDetailsPage() {
  const { cif } = useParams()
  const navigate = useNavigate()

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['provider', cif, 'stats'],
    enabled: !!cif,
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const res = await axios.get(`${API_URL}/providers/${cif}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data as ProviderStats
    },
  })

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['provider', cif, 'invoices'],
    enabled: !!cif,
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const res = await axios.get(`${API_URL}/providers/${cif}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data as ProviderInvoice[]
    },
  })

  if (loadingStats) {
    return <div className="p-8"><Skeleton className="h-72 w-full rounded-2xl" /></div>
  }

  if (!stats) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Proveedor no encontrado</div>
  }

  const today = new Date()
  const upcomingInvoices = (invoices || [])
    .filter((invoice) => invoice.fecha_vencimiento && new Date(invoice.fecha_vencimiento) >= today)
    .sort((left, right) => new Date(left.fecha_vencimiento || 0).getTime() - new Date(right.fecha_vencimiento || 0).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
          >
            <ChevronLeft size={16} /> Volver
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">Ficha avanzada de proveedor</p>
          <div className="flex items-start gap-4 mt-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
              <Building2 size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{stats.name}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-mono">{stats.cif}</p>
              {stats.updated_at ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Ultima actualizacion: {new Date(stats.updated_at).toLocaleString('es-ES')}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full xl:w-auto xl:min-w-[420px]">
          <HeaderMetric label="Proximo vencimiento" value={stats.next_due_date ? new Date(stats.next_due_date).toLocaleDateString('es-ES') : 'Sin fecha'} />
          <HeaderMetric label="Exposicion 30 dias" value={formatCurrency(stats.upcoming_due_amount)} />
          <HeaderMetric label="Facturas duplicadas" value={String(stats.duplicate_invoices_count)} />
          <HeaderMetric label="Facturas vencidas" value={String(stats.overdue_invoices_count)} />
        </div>
      </div>

      {stats.insights.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.insights.map((insight) => (
            <div
              key={insight.message}
              className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
                insight.type === 'positive'
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                  : insight.type === 'warning'
                    ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
              }`}
            >
              <div className={`mt-0.5 ${
                insight.type === 'positive'
                  ? 'text-green-600 dark:text-green-400'
                  : insight.type === 'warning'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-blue-600 dark:text-blue-400'
              }`}>
                {insight.type === 'positive' ? <CheckCircle size={18} /> : insight.type === 'warning' ? <AlertTriangle size={18} /> : <Zap size={18} />}
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{insight.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total pagado" value={formatCurrency(stats.total_amount)} icon={Euro} tone="emerald" />
        <StatCard title="Facturas" value={String(stats.total_invoices)} icon={FileText} tone="blue" />
        <StatCard title="Ticket medio" value={formatCurrency(stats.average_amount)} icon={TrendingUp} tone="violet" />
        <StatCard title="Ultimo pago" value={stats.last_payment_date ? new Date(stats.last_payment_date).toLocaleDateString('es-ES') : '-'} icon={CalendarClock} tone="orange" />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.1fr,0.9fr] gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Perfil maestro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={Mail} label="Email" value={stats.email || 'No informado'} />
            <InfoRow icon={Phone} label="Telefono" value={stats.phone || 'No informado'} />
            <InfoRow icon={MapPin} label="Direccion" value={[stats.address, stats.city, stats.zip_code].filter(Boolean).join(', ') || 'No informada'} />
            <InfoRow icon={Landmark} label="Pais / SWIFT" value={[stats.country, stats.swift].filter(Boolean).join(' · ') || 'No informado'} />
            <div className="md:col-span-2">
              <InfoRow icon={ShieldAlert} label="IBAN maestro" value={stats.iban || 'No informado'} mono />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Radar de duplicados</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Facturas historicas con la misma referencia, importe y vencimiento.</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50 text-sm font-semibold">
              {stats.duplicate_invoices_count} detectadas
            </div>
          </div>
          <div className="space-y-3">
            {stats.duplicate_groups.length ? stats.duplicate_groups.map((group) => (
              <div key={`${group.reference}-${group.due_date}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{group.reference}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {group.occurrences} ocurrencias · {group.due_date ? new Date(group.due_date).toLocaleDateString('es-ES') : 'Sin fecha'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(group.total_amount)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Lotes {group.batch_ids.map((batchId) => `#${batchId}`).join(', ') || '-'}</p>
                  </div>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500 dark:text-slate-400">No hay duplicados historicos para este proveedor.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.3fr,0.7fr] gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Evolucion mensual</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Volumen pagado y ritmo de facturacion del proveedor.</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly_volume} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={tooltipCurrency} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Proximos vencimientos</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">Las siguientes facturas te ayudan a anticipar riesgo y tesoreria.</p>
          <div className="space-y-3">
            {upcomingInvoices.length ? upcomingInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{invoice.factura || 'Sin referencia'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Vence el {invoice.fecha_vencimiento ? new Date(invoice.fecha_vencimiento).toLocaleDateString('es-ES') : 'sin fecha'}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(invoice.importe)}</p>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500 dark:text-slate-400">No hay vencimientos futuros para este proveedor.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historico de facturas</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Vista operativa con remesa asociada y banderas de duplicidad.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Factura</th>
                <th className="px-6 py-4">Importe</th>
                <th className="px-6 py-4">Vencimiento</th>
                <th className="px-6 py-4">Remesa</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Deteccion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingInvoices ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500 dark:text-slate-400">Cargando...</td></tr>
              ) : invoices?.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-top">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{invoice.factura || 'Sin referencia'}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{formatCurrency(invoice.importe)}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{invoice.fecha_vencimiento ? new Date(invoice.fecha_vencimiento).toLocaleDateString('es-ES') : '-'}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {invoice.batch_name || (invoice.batch_id ? `#${invoice.batch_id}` : '-')}
                    {invoice.payment_date ? <div className="text-xs text-slate-400 mt-1">Pago {new Date(invoice.payment_date).toLocaleDateString('es-ES')}</div> : null}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                      invoice.status === 'VALID'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : invoice.status === 'WARNING'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {invoice.duplicate_status ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-semibold dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50">
                        <Copy size={12} />
                        {invoice.duplicate_message}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Sin coincidencias</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  icon: ComponentType<{ size?: number }>
  tone: 'emerald' | 'blue' | 'violet' | 'orange'
}) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${tones[tone]}`}>
          <Icon size={22} />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: ComponentType<{ size?: number }>
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 flex items-start gap-3">
      <div className="mt-0.5 text-slate-400 dark:text-slate-500"><Icon size={18} /></div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className={`text-sm text-slate-900 dark:text-slate-100 mt-1 ${mono ? 'font-mono break-all' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
