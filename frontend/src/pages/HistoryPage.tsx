import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Skeleton } from '../components/ui/skeleton'
import { Trash2, FileText, CheckCircle, Calendar, FileSpreadsheet, Clock, Download, ChevronLeft, ChevronRight, Eye, Search, X, AlertTriangle } from 'lucide-react'
import { BatchDetailsModal } from '../components/BatchDetailsModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Batch {
    id: number
    name: string
    created_at: string
    payment_date?: string
    status: string
    uploaded_to_bank?: boolean
    total_amount?: number
    invoices: any[] // Just for count
}

interface ImportLog {
    id: number
    timestamp: string
    filename: string
    status: 'SUCCESS' | 'WARNING' | 'ERROR'
    details?: string
    total_invoices: number
}

export default function HistoryPage() {
    const [view, setView] = useState<'batches' | 'logs'>('batches')
    const [batchToDelete, setBatchToDelete] = useState<number | null>(null)
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [page, setPage] = useState(0)
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const pageSize = 10
    const queryClient = useQueryClient()

    // Batches Query
    const { data: batchesData, isLoading: loadingBatches } = useQuery({
        queryKey: ['batches', page, searchTerm, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.append('skip', (page * pageSize).toString())
            params.append('limit', pageSize.toString())
            if (searchTerm) params.append('search', searchTerm)
            if (startDate) params.append('start_date', startDate)
            if (endDate) params.append('end_date', endDate)

            const res = await axios.get(`${API_URL}/batches/?${params.toString()}`)
            return res.data as { items: Batch[], total: number }
        },
        placeholderData: (previousData) => previousData
    })

    // Logs Query
    const { data: logs, isLoading: loadingLogs } = useQuery({
        queryKey: ['logs'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/logs/imports`)
            return res.data as ImportLog[]
        }
    })

    // Selected Batch Details Query
    const { data: selectedBatch, isLoading: loadingSelectedBatch } = useQuery({
        queryKey: ['batch', selectedBatchId],
        queryFn: async () => {
            if (!selectedBatchId) return null
            const res = await axios.get(`${API_URL}/batches/${selectedBatchId}`)
            return res.data
        },
        enabled: !!selectedBatchId
    })

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('es-ES')
    }

    const handleViewBatch = (id: number) => {
        setSelectedBatchId(id)
        setIsDetailsOpen(true)
    }

    const handleDownload = async (id: number) => {
        try {
            toast.info("Generando archivo...")
            const response = await axios.get(`${API_URL}/batches/${id}/export`, {
                responseType: 'blob'
            })

            if (response.data.type === 'application/json') {
                const text = await response.data.text()
                const data = JSON.parse(text)
                toast.success(`Guardado correctamente en: ${data.path}`)
                return
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            const contentDisposition = response.headers['content-disposition'];
            let fileName = 'remesa.xlsx';
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/) ||
                    contentDisposition.match(/filename=([^;]+)/);
                if (fileNameMatch && fileNameMatch.length >= 2)
                    fileName = fileNameMatch[1].replace(/["']/g, "");
            }

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Archivo descargado")
        } catch (error: any) {
            console.error(error)
            toast.error("Error al exportar: " + (error.message || "Error desconocido"))
        }
    }

    const handlePrint = async (id: number) => {
        try {
            toast.info("Generando PDF...")
            const response = await axios.get(`${API_URL}/batches/${id}/export-pdf`, {
                responseType: 'blob'
            })

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Orden_Remesa_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("PDF descargado")
        } catch (error: any) {
            console.error(error)
            toast.error("Error al generar PDF")
        }
    }

    const deleteMutation = useMutation({
        mutationFn: async (batchId: number) => {
            await axios.delete(`${API_URL}/batches/${batchId}`)
        },
        onSuccess: () => {
            toast.success('Remesa eliminada correctamente')
            queryClient.invalidateQueries({ queryKey: ['batches'] })
            setBatchToDelete(null)
        },
        onError: (error: any) => {
            toast.error('Error al eliminar la remesa: ' + error.message)
        }
    })

    const handleConfirmDelete = () => {
        if (batchToDelete) {
            deleteMutation.mutate(batchToDelete)
        }
    }

    const toggleUploadMutation = useMutation({
        mutationFn: async (batchId: number) => {
            await axios.patch(`${API_URL}/batches/${batchId}/toggle-upload`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batches'] })
            toast.success('Estado actualizado')
        },
        onError: () => {
            toast.error('Error al actualizar estado')
        }
    })

    const handleToggleUpload = (id: number) => {
        toggleUploadMutation.mutate(id)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Histórico</h2>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setView('batches')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'batches'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        Remesas Generadas
                    </button>
                    <button
                        onClick={() => setView('logs')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'logs'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        Logs de Importación
                    </button>
                </div>
            </div>

            {view === 'batches' ? (
                // --- BATCHES TABLE ---
                <>
                    {/* Filters Bar */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar remesa..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        {(searchTerm || startDate || endDate) && (
                            <button
                                onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setPage(0) }}
                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Limpiar filtros"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Nombre Remesa</th>
                                    <th className="px-6 py-4">Importe Total</th>
                                    <th className="px-6 py-4">Fecha Vencimiento</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-center">Subido al Banco</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loadingBatches ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                            <td className="px-6 py-4"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-8 w-8 rounded-md" /></div></td>
                                        </tr>
                                    ))
                                ) : batchesData?.items.length === 0 ? (
                                    <tr className="bg-white dark:bg-slate-900">
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                            No hay remesas generadas todavía.
                                        </td>
                                    </tr>
                                ) : (
                                    batchesData?.items.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900">
                                            <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400">#{batch.id}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-slate-400" />
                                                    {batch.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(batch.total_amount || 0)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {batch.payment_date ? (() => {
                                                    const today = new Date()
                                                    today.setHours(0, 0, 0, 0)
                                                    const pDate = new Date(batch.payment_date)
                                                    pDate.setHours(0, 0, 0, 0)
                                                    const diffTime = pDate.getTime() - today.getTime()
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                                    const isExpired = diffDays < 0 && batch.status !== 'SENT'
                                                    const isWarning = diffDays >= 0 && diffDays <= 3 && batch.status !== 'SENT'

                                                    let bgClass = "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50"
                                                    let textClass = "text-indigo-700 dark:text-indigo-300"
                                                    let iconClass = "text-indigo-500 dark:text-indigo-400"
                                                    let IconComp = Calendar

                                                    if (isExpired) {
                                                        bgClass = "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50"
                                                        textClass = "text-red-700 dark:text-red-300"
                                                        iconClass = "text-red-500 dark:text-red-400"
                                                        IconComp = AlertTriangle
                                                    } else if (isWarning) {
                                                        bgClass = "bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/50"
                                                        textClass = "text-orange-700 dark:text-orange-300"
                                                        iconClass = "text-orange-500 dark:text-orange-400"
                                                        IconComp = AlertTriangle
                                                    }

                                                    return (
                                                        <div className={`flex items-center gap-2 w-fit px-2.5 py-1.5 rounded-lg border ${bgClass}`}>
                                                            <IconComp size={14} className={iconClass} />
                                                            <span className={`text-xs font-medium ${textClass}`}>
                                                                {pDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                {isExpired && " (Vencida)"}
                                                                {isWarning && " (Próx.)"}
                                                            </span>
                                                        </div>
                                                    )
                                                })() : (
                                                    <span className="text-slate-400 dark:text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`
                                                px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1
                                                ${batch.status === 'SENT'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}
                                            `}>
                                                    {batch.status === 'SENT' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                    {batch.status === 'SENT' ? 'DESCARGADO' : (batch.status === 'GENERATED' ? 'GENERADO' : batch.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleToggleUpload(batch.id)}
                                                    className={`
                                                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                                        ${batch.uploaded_to_bank ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}
                                                    `}
                                                    title={batch.uploaded_to_bank ? "Subido al banco" : "Pendiente de subir"}
                                                >
                                                    <span
                                                        className={`
                                                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                                            ${batch.uploaded_to_bank ? 'translate-x-6' : 'translate-x-1'}
                                                        `}
                                                    />
                                                </button>
                                                {!batch.uploaded_to_bank && (
                                                    <div className="mt-1 flex items-center justify-center gap-1 text-xs text-red-500 font-medium animate-pulse">
                                                        <AlertTriangle size={12} />
                                                        <span>Pendiente</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewBatch(batch.id)}
                                                        className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Ver Detalles"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrint(batch.id)}
                                                        className="text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 p-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                        title="Imprimir Orden"
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(batch.id)}
                                                        className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Descargar Excel"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setBatchToDelete(batch.id)}
                                                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between px-2 pt-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Mostrando {batchesData?.items.length || 0} de {batchesData?.total || 0} remesas
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0 || loadingBatches}
                                className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Página {page + 1}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!batchesData || (page + 1) * pageSize >= batchesData.total || loadingBatches}
                                className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                // --- LOGS TABLE ---
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    {loadingLogs ? (
                        <div className="p-8 text-center text-slate-500">Cargando logs...</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Archivo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Facturas</th>
                                    <th className="px-6 py-4">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs?.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900">
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <FileSpreadsheet size={16} className="text-slate-400" />
                                            {log.filename}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`
                                            px-2 py-1 rounded text-xs font-bold
                                            ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                            ${log.status === 'WARNING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : ''}
                                            ${log.status === 'ERROR' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                                        `}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {log.total_invoices}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs truncate max-w-xs" title={log.details || ""}>
                                            {log.details || "-"}
                                        </td>
                                    </tr>
                                ))}
                                {logs?.length === 0 && (
                                    <tr className="bg-white dark:bg-slate-900">
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                            No hay registros de importación.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!batchToDelete}
                onClose={() => setBatchToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Eliminar Remesa"
                description="¿Estás seguro de que deseas eliminar esta remesa? Esta acción no se puede deshacer y se perderán todos los datos asociados."
                confirmText="Eliminar"
                isDestructive={true}
            />

            <BatchDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => {
                    setIsDetailsOpen(false)
                    setSelectedBatchId(null)
                }}
                batch={selectedBatch}
                loading={loadingSelectedBatch}
            />
        </div>
    )
}
