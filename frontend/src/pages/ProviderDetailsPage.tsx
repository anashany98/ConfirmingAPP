import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ChevronLeft, Building2, Euro, CheckCircle, Clock, AlertTriangle, FileText, Zap } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ProviderStats {
    cif: string
    name: string
    total_amount: number
    total_invoices: number
    last_payment_date?: string
    average_amount: number
    insights?: { type: 'positive' | 'warning' | 'info', message: string }[]
}

interface Invoice {
    id: number
    cif: string
    nombre: string
    factura: string
    importe: number
    fecha_vencimiento: string
    status: string
    batch_id?: number
}

export default function ProviderDetailsPage() {
    const { cif } = useParams()
    const navigate = useNavigate()

    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ['provider', cif, 'stats'],
        queryFn: async () => {
            const token = localStorage.getItem('auth_token')
            const res = await axios.get(`${API_URL}/providers/${cif}/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data as ProviderStats
        }
    })

    const { data: invoices, isLoading: loadingInvoices } = useQuery({
        queryKey: ['provider', cif, 'invoices'],
        queryFn: async () => {
            const token = localStorage.getItem('auth_token')
            const res = await axios.get(`${API_URL}/providers/${cif}/invoices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data as Invoice[]
        }
    })

    if (loadingStats) return <div className="p-8"><Skeleton className="h-48 w-full rounded-xl" /></div>

    if (!stats) return <div className="p-8 text-center">Proveedor no encontrado</div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
                >
                    <ChevronLeft size={16} /> Volver
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Building2 className="text-blue-500" size={32} />
                            {stats.name}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-mono">{stats.cif}</p>
                    </div>
                </div>
            </div>

            {/* Smart Insights */}
            {stats.insights && stats.insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.insights.map((insight, idx) => (
                        <div key={idx} className={`
                            p-4 rounded-xl border flex items-start gap-3 shadow-sm
                            ${insight.type === 'positive' ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' :
                                insight.type === 'warning' ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800' :
                                    'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'}
                        `}>
                            <div className={`mt-0.5
                                ${insight.type === 'positive' ? 'text-green-600 dark:text-green-400' :
                                    insight.type === 'warning' ? 'text-orange-600 dark:text-orange-400' :
                                        'text-blue-600 dark:text-blue-400'}
                            `}>
                                {insight.type === 'positive' ? <CheckCircle size={18} /> :
                                    insight.type === 'warning' ? <AlertTriangle size={18} /> :
                                        <Zap size={18} />}
                            </div>
                            <div>
                                <p className={`text-sm font-medium
                                    ${insight.type === 'positive' ? 'text-green-900 dark:text-green-100' :
                                        insight.type === 'warning' ? 'text-orange-900 dark:text-orange-100' :
                                            'text-blue-900 dark:text-blue-100'}
                                `}>
                                    {insight.message}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Euro size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Pagado</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.total_amount)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Facturas</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {stats.total_invoices}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Último Pago</p>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {stats.last_payment_date ? new Date(stats.last_payment_date).toLocaleDateString('es-ES') : '-'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Euro size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Importe Medio</p>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.average_amount)}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de Facturas</h3>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Nº Factura</th>
                            <th className="px-6 py-4">Importe</th>
                            <th className="px-6 py-4">Vencimiento</th>
                            <th className="px-6 py-4">Remesa</th>
                            <th className="px-6 py-4">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loadingInvoices ? (
                            <tr><td colSpan={5} className="p-4 text-center">Cargando...</td></tr>
                        ) : invoices?.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{inv.factura}</td>
                                <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(inv.importe)}
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                    {new Date(inv.fecha_vencimiento).toLocaleDateString('es-ES')}
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                    {inv.batch_id ? `#${inv.batch_id}` : '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`
                                        px-2 py-1 rounded text-xs font-bold uppercase
                                        ${inv.status === 'VALID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'}
                                    `}>
                                        {inv.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
