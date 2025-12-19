import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { FileCheck, AlertTriangle, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Dashboard() {
    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/batches/stats`)
            return data
        }
    })

    const { data: recentBatches } = useQuery({
        queryKey: ['batches'],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/batches/?limit=5`)
            return data
        }
    })

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Remesas Procesadas"
                    value={stats?.processed_batches ?? 0}
                    icon={FileCheck}
                    color="text-blue-600 dark:text-blue-400"
                    bg="bg-blue-50 dark:bg-blue-950/30"
                />
                <KPICard
                    title="Importe Total"
                    value={formatCurrency(stats?.total_amount ?? 0)}
                    icon={FileText}
                    color="text-green-600 dark:text-green-400"
                    bg="bg-green-50 dark:bg-green-950/30"
                />
                <KPICard
                    title="Incidencias"
                    value={stats?.issues_count ?? 0}
                    icon={AlertTriangle}
                    color="text-orange-600 dark:text-orange-400"
                    bg="bg-orange-50 dark:bg-orange-950/30"
                />
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Volumen Mensual */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-6">Volumen Mensual (€)</h3>
                    <div className="h-[300px] w-full">
                        {stats?.monthly_volume ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.monthly_volume}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        tickFormatter={(value) => `${value / 1000}k`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        formatter={(value: number) => [formatCurrency(value), 'Importe']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="#3b82f6"
                                        radius={[4, 4, 0, 0]}
                                        barSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sin datos suficientes</div>
                        )}
                    </div>
                </div>

                {/* Pie Chart: Status Distribution */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-6">Calidad de Datos</h3>
                    <div className="h-[300px] w-full">
                        {stats?.status_distribution ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.status_distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.status_distribution.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => [value, 'Facturas']} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sin datos suficientes</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4">Actividad Reciente</h3>
                {recentBatches?.length > 0 ? (
                    <div className="space-y-4">
                        {recentBatches.map((batch: any) => (
                            <div key={batch.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">{batch.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(batch.created_at).toLocaleDateString()}</p>
                                </div>
                                <span className="text-sm px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                    {batch.status}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-slate-500 dark:text-slate-400 text-sm">No hay actividad reciente.</div>
                )}
            </div>
        </div>
    )
}

function KPICard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
            </div>
            <div className={`p-3 rounded-lg ${bg} ${color}`}>
                <Icon size={24} />
            </div>
        </div>
    )
}
