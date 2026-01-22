import { X, Calendar, FileText, Mail } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface InvoiceType {
    cif: string
    nombre: string
    importe: number
    fecha_vencimiento: string
    factura: string
    status: string
    validation_message?: string
}

interface BatchType {
    id: number
    name: string
    created_at: string
    payment_date?: string
    status: string
    total_amount?: number
    invoices: InvoiceType[]
}

interface BatchDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    batch: BatchType | null
    loading: boolean
}

export function BatchDetailsModal({ isOpen, onClose, batch, loading }: BatchDetailsModalProps) {
    const [notifying, setNotifying] = useState(false)
    const navigate = useNavigate()

    if (!isOpen) return null

    // Calculate total always from invoices to ensure accuracy
    const calculatedTotal = batch?.invoices?.reduce((sum, inv) => sum + (inv.importe || 0), 0) || 0

    const handleNotify = async () => {
        if (!batch) return
        setNotifying(true)
        try {
            const token = localStorage.getItem('auth_token')
            const res = await axios.post(`${API_URL}/batches/${batch.id}/notify`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            alert(`✅ ${res.data.message}`)
        } catch (e) {
            console.error(e)
            alert("❌ Error al enviar notificaciones. Comprueba la conexión.")
        } finally {
            setNotifying(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="text-blue-500" />
                            Detalles de la Remesa #{batch?.id}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {batch?.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : batch ? (
                        <div className="space-y-6">
                            {/* Batch Info Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">IMPORTE TOTAL</div>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(calculatedTotal)}
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">FECHA VENCIMIENTO</div>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Calendar size={16} className="text-slate-400" />
                                        {batch.payment_date
                                            ? new Date(batch.payment_date).toLocaleDateString('es-ES')
                                            : "N/A"
                                        }
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">TOTAL FACTURAS</div>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                                        {batch.invoices?.length || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Invoices Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3">Proveedor</th>
                                            <th className="px-4 py-3">CIF</th>
                                            <th className="px-4 py-3">Nº Factura</th>
                                            <th className="px-4 py-3 text-right">Importe</th>
                                            <th className="px-4 py-3">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                        {batch.invoices?.map((inv, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                    <button
                                                        onClick={() => {
                                                            onClose()
                                                            navigate(`/providers/${inv.cif.trim()}`)
                                                        }}
                                                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left text-sm font-semibold"
                                                    >
                                                        {inv.nombre}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                                    {inv.cif}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                    {inv.factura}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(inv.importe)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`
                                                        px-2 py-0.5 rounded text-[10px] font-bold uppercase
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
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            No se encontraron detalles.
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                    {batch && (
                        <button
                            onClick={handleNotify}
                            disabled={notifying}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all
                                ${notifying
                                    ? 'bg-blue-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                                }
                            `}
                        >
                            {notifying ? (
                                <>Enviando...</>
                            ) : (
                                <><Mail size={18} /> Notificar Proveedores</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
