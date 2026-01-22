import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { BatchDetailsModal } from '../components/BatchDetailsModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Batch {
    id: number
    name: string
    created_at: string
    payment_date?: string
    status: string
    total_amount?: number
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    // Calculate month boundaries
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    // API Query for Batches in range
    const { data: batches, isLoading } = useQuery({
        queryKey: ['batches-calendar', currentDate.getMonth(), currentDate.getFullYear()],
        queryFn: async () => {
            // Fetch a bit wider range to be safe, or just filter all and let backend paginate (ideally backend should accept exact range)
            // For now, fetching first 100 which is enough for small scale, or use our new filters
            const startDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
            const endDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]

            // Using the new filter params we just added!
            const params = new URLSearchParams()
            params.append('payment_date_start', startDateStr)
            params.append('payment_date_end', endDateStr)
            params.append('limit', '100') // Increase limit for calendar view

            const token = localStorage.getItem('auth_token')
            const res = await axios.get(`${API_URL}/batches/?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data.items as Batch[]
        }
    })

    // Selected Batch Details Query (Reuse logic from HistoryPage)
    const { data: selectedBatchData, isLoading: loadingSelectedBatch } = useQuery({
        queryKey: ['batch', selectedBatchId],
        queryFn: async () => {
            if (!selectedBatchId) return null
            const token = localStorage.getItem('auth_token')
            const res = await axios.get(`${API_URL}/batches/${selectedBatchId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data
        },
        enabled: !!selectedBatchId
    })

    const handleViewBatch = (id: number) => {
        setSelectedBatchId(id)
        setIsDetailsOpen(true)
    }

    // Calendar Grid Logic
    const calendarDays = useMemo(() => {
        const days = []
        const startPadding = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1 // Start Monday

        // Previous month padding
        for (let i = 0; i < startPadding; i++) {
            days.push(null)
        }

        // Days of current month
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
        }

        return days
    }, [currentDate])

    // Group batches by date
    const batchesByDate = useMemo(() => {
        const grouping: Record<string, Batch[]> = {}
        batches?.forEach(batch => {
            if (batch.payment_date) {
                const dateKey = new Date(batch.payment_date).toDateString()
                if (!grouping[dateKey]) grouping[dateKey] = []
                grouping[dateKey].push(batch)
            }
        })
        return grouping
    }, [batches])

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CalendarIcon className="text-orange-500" />
                    Calendario de Pagos
                </h2>
                <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[140px] text-center capitalize">
                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                        <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[140px] divide-x divide-y divide-slate-100 dark:divide-slate-800">
                    {calendarDays.map((date, idx) => {
                        if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/50 dark:bg-slate-950/20" />

                        const dateKey = date.toDateString()
                        const dayBatches = batchesByDate[dateKey] || []
                        const totalAmount = dayBatches.reduce((sum, b) => sum + (b.total_amount || 0), 0)
                        const isToday = new Date().toDateString() === dateKey

                        return (
                            <div
                                key={date.toISOString()}
                                className={`p-3 relative group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`
                                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                                        ${isToday
                                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                                            : 'text-slate-700 dark:text-slate-300'}
                                    `}>
                                        {date.getDate()}
                                    </span>
                                    {totalAmount > 0 && (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalAmount)}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1.5 overflow-y-auto max-h-[90px] pr-1 custom-scrollbar">
                                    {isLoading ? (
                                        <div className="flex justify-center py-2"><Loader2 className="animate-spin text-slate-300" size={16} /></div>
                                    ) : dayBatches.map(batch => (
                                        <button
                                            key={batch.id}
                                            onClick={() => handleViewBatch(batch.id)}
                                            className="w-full text-left text-xs p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors group/btn"
                                        >
                                            <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{batch.name}</div>
                                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                <span>#{batch.id}</span>
                                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(batch.total_amount || 0)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <BatchDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => {
                    setIsDetailsOpen(false)
                    setSelectedBatchId(null)
                }}
                batch={selectedBatchData}
                loading={loadingSelectedBatch}
            />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #e2e8f0;
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                }
                @media (prefers-color-scheme: dark) {
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: #334155;
                    }
                    .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                        background-color: #475569;
                    }
                }
            `}</style>
        </div>
    )
}
