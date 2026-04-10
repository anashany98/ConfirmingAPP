import { useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { AlertTriangle, BanknoteArrowDown, PiggyBank, ShieldAlert, TrendingDown } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

interface TreasuryResponse {
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

const tooltipCurrency = (value: number | string | undefined) => formatCurrency(Number(value || 0))

export default function TreasurySimulator() {
  const [openingBalance, setOpeningBalance] = useState(180000)
  const [reserveBalance, setReserveBalance] = useState(45000)
  const [paymentDelayDays, setPaymentDelayDays] = useState(5)
  const [horizonWeeks, setHorizonWeeks] = useState(8)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['treasury-simulator', openingBalance, reserveBalance, paymentDelayDays, horizonWeeks],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token')
      const response = await axios.get<TreasuryResponse>(`${API_URL}/batches/treasury-simulator`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          opening_balance: openingBalance,
          reserve_balance: reserveBalance,
          payment_delay_days: paymentDelayDays,
          horizon_weeks: horizonWeeks,
        },
      })
      return response.data
    },
  })

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Simulador de tesoreria</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Escenarios de caja para las proximas semanas</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            Ajusta saldo inicial, reserva minima y retraso esperado para anticipar tensiones de caja y concentracion de pagos.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full xl:w-auto">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo inicial</span>
            <input
              type="number"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(Number(event.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Reserva minima</span>
            <input
              type="number"
              value={reserveBalance}
              onChange={(event) => setReserveBalance(Number(event.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Retraso medio (dias)</span>
            <input
              type="number"
              min={0}
              max={45}
              value={paymentDelayDays}
              onChange={(event) => setPaymentDelayDays(Number(event.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Horizonte</span>
            <select
              value={horizonWeeks}
              onChange={(event) => setHorizonWeeks(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value={6}>6 semanas</option>
              <option value={8}>8 semanas</option>
              <option value={12}>12 semanas</option>
            </select>
          </label>
        </div>
      </div>

      {isLoading ? <div className="text-sm text-slate-500 dark:text-slate-400">Calculando escenario...</div> : null}
      {isError ? <div className="text-sm text-red-600 dark:text-red-400">No se pudo calcular la simulacion.</div> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard title="Saldo final" value={formatCurrency(data.summary.final_balance)} icon={PiggyBank} tone="emerald" />
            <SummaryCard title="Pagos planificados" value={formatCurrency(data.summary.scheduled_total)} icon={BanknoteArrowDown} tone="orange" />
            <SummaryCard title="Escenario estresado" value={formatCurrency(data.summary.stressed_total)} icon={TrendingDown} tone="rose" />
            <SummaryCard
              title="Semana pico"
              value={data.summary.peak_week ? `${data.summary.peak_week.range}` : 'Sin vencimientos'}
              subtitle={data.summary.peak_week ? formatCurrency(data.summary.peak_week.scheduled_amount) : ''}
              icon={ShieldAlert}
              tone="blue"
            />
          </div>

          {data.alerts.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {data.alerts.map((alert) => (
                <div
                  key={alert.message}
                  className={`rounded-xl border p-4 flex gap-3 ${
                    alert.type === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-300'
                      : alert.type === 'warning'
                        ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-900/50 dark:text-orange-300'
                        : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300'
                  }`}
                >
                  <AlertTriangle size={18} className="mt-0.5" />
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 2xl:grid-cols-[2fr,1fr] gap-6">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Saldo proyectado</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Comparativa entre escenario base, retrasado y estresado</p>
                </div>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.weeks} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                    <Tooltip formatter={tooltipCurrency} labelFormatter={(_label, payload) => payload?.[0]?.payload?.range || ''} />
                    <Legend />
                    <Area type="monotone" dataKey="scheduled_balance" name="Base" stroke="#f97316" fill="#fed7aa" fillOpacity={0.35} />
                    <Area type="monotone" dataKey="delayed_balance" name="Con retraso" stroke="#0f766e" fill="#99f6e4" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="stressed_balance" name="Estresado" stroke="#dc2626" fill="#fecaca" fillOpacity={0.18} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Top exposicion 30 dias</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Proveedores que mas presion meten sobre caja en el corto plazo.</p>
              <div className="space-y-3">
                {data.top_exposures.length ? data.top_exposures.map((provider) => (
                  <div key={`${provider.cif}-${provider.name}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{provider.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{provider.invoices} facturas {provider.cif ? `· ${provider.cif}` : ''}</p>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(provider.amount)}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">No hay vencimientos en los proximos 30 dias.</p>}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Calendario semanal de salidas</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">Detalle por semana y presion contra la reserva minima.</p>
              </div>
            </div>
            <div className="h-[280px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeks} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                  <Tooltip formatter={tooltipCurrency} labelFormatter={(_label, payload) => payload?.[0]?.payload?.range || ''} />
                  <Legend />
                  <Bar dataKey="scheduled_amount" name="Planificado" fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="delayed_amount" name="Con retraso" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
              {data.weeks.map((week) => (
                <div key={week.range} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{week.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{week.range}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <MetricLine label="Pagos" value={formatCurrency(week.scheduled_amount)} />
                    <MetricLine label="Saldo" value={formatCurrency(week.scheduled_balance)} />
                    <MetricLine label="Libre sobre reserva" value={formatCurrency(week.available_after_reserve)} tone={week.available_after_reserve < 0 ? 'danger' : 'normal'} />
                  </div>
                  {week.providers.length ? (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {week.providers.map((provider) => (
                        <div key={`${week.range}-${provider.cif}-${provider.name}`} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-600 dark:text-slate-300 truncate">{provider.name}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(provider.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  subtitle?: string
  icon: ComponentType<{ size?: number }>
  tone: 'emerald' | 'orange' | 'rose' | 'blue'
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/50',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50',
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
          {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p> : null}
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function MetricLine({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={tone === 'danger' ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-slate-900 dark:text-slate-100'}>{value}</span>
    </div>
  )
}
