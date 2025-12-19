
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'sonner'
import { CheckCircle, AlertTriangle, XCircle, Upload as UploadIcon, FileSpreadsheet, ArrowRight, Edit2, X, Mail, Plus, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Invoice {
    id: number
    cif: string
    nombre: string
    cuenta: string
    importe: number
    email?: string
    status: 'VALID' | 'WARNING' | 'ERROR'
    validation_message: string
    iban_mismatch?: boolean
    db_iban?: string
    [key: string]: any
}

export default function UploadPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [step, setStep] = useState<'upload' | 'review' | 'success'>('upload')

    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
    const [fileHash, setFileHash] = useState<string>("")
    const [emailResolutionQueue, setEmailResolutionQueue] = useState<Invoice[]>([])
    const [showEmailModal, setShowEmailModal] = useState(false)

    // Missing Email Handling
    const [missingEmailQueue, setMissingEmailQueue] = useState<Invoice[]>([])
    const [showMissingEmailModal, setShowMissingEmailModal] = useState(false)

    // IBAN Mismatch Handling
    const [ibanMismatchQueue, setIbanMismatchQueue] = useState<Invoice[]>([])
    const [showIbanMismatchModal, setShowIbanMismatchModal] = useState(false)

    // Batch Settings
    const [batchDueDate, setBatchDueDate] = useState("")

    // Duplicate Hash Handling
    const [showDuplicateModal, setShowDuplicateModal] = useState(false)
    const [duplicateMessage, setDuplicateMessage] = useState("")
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0) // 0-100

    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Add Provider Update Mutation (Email)
    const updateProviderMutation = useMutation({
        mutationFn: async ({ cif, email }: { cif: string, email: string }) => {
            await axios.put(`${API_URL}/providers/${cif}`, { email, cif })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
        }
    })

    // Add Provider Update Mutation (IBAN)
    const updateProviderIbanMutation = useMutation({
        mutationFn: async ({ cif, iban }: { cif: string, iban: string }) => {
            await axios.put(`${API_URL}/providers/${cif}`, { iban, cif })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
        }
    })

    const runValidationSequence = (currentInvoices: Invoice[]) => {
        // 1. Multiple Emails
        const multipleEmails = currentInvoices.filter((inv: Invoice) => inv.email && (inv.email.includes(',') || inv.email.includes(';')))
        if (multipleEmails.length > 0) {
            setEmailResolutionQueue(multipleEmails)
            setShowEmailModal(true)
            return
        }

        // 2. Missing Emails
        // Filter for valid CIF but missing email
        const missingEmails = currentInvoices.filter((inv: Invoice) => (!inv.email || inv.email.trim() === "") && inv.cif)
        if (missingEmails.length > 0) {
            setMissingEmailQueue(missingEmails)
            setShowMissingEmailModal(true)
            return
        }

        // 3. IBAN Mismatch
        const ibanMismatches = currentInvoices.filter((inv: Invoice) => inv.iban_mismatch)
        if (ibanMismatches.length > 0) {
            setIbanMismatchQueue(ibanMismatches)
            setShowIbanMismatchModal(true)
            return
        }

        // All good
        setStep('review')
    }

    const uploadMutation = useMutation({
        mutationFn: async ({ file, force }: { file: File, force?: boolean }) => {
            setUploadProgress(0)
            const formData = new FormData()
            formData.append('file', file)
            const res = await axios.post(`${API_URL}/import/upload${force ? '?force=true' : ''}`, formData, {
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        setUploadProgress(percent)
                    }
                }
            })
            return res.data
        },
        onSuccess: (data) => {
            setInvoices(data.invoices)
            setFileHash(data.file_hash)
            setPendingFile(null)
            setShowDuplicateModal(false)

            runValidationSequence(data.invoices)
        },
        onError: (error: any) => {
            console.error(error)
            if (error.response?.status === 409) {
                setDuplicateMessage(error.response.data.detail)
                setShowDuplicateModal(true)
                return
            }
            const msg = error.response?.data?.detail || error.message
            toast.error(`Error: ${msg}`)
        }
    })

    const createBatchMutation = useMutation({
        mutationFn: async () => {
            const batchData = {
                name: `Remesa ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`,
                invoices: invoices,
                file_hash: fileHash,
                payment_date: batchDueDate || null
            }
            const res = await axios.post(`${API_URL}/batches/`, batchData)
            return res.data
        },
        onSuccess: () => {
            navigate('/history')
        }
    })

    const onDrop = useCallback((acceptedFiles: File[]) => {
        console.log("Files dropped:", acceptedFiles)
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0]
            console.log("Processing file:", file.name)
            setPendingFile(file)
            uploadMutation.mutate({ file })
        } else {
            console.warn("No accepted files")
        }
    }, [uploadMutation])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected: (fileRejections) => {
            console.log("File rejected:", fileRejections)
            const errors = fileRejections.map(f => f.errors.map(e => e.message).join(', ')).join('; ')
            toast.error(`Archivo no válido: ${errors}`)
        },
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false
    })


    // Generic Provider Update (Name, IBAN, etc.)
    const updateFullProviderMutation = useMutation({
        mutationFn: async (data: { cif: string, name?: string, iban?: string }) => {
            await axios.put(`${API_URL}/providers/${data.cif}`, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
            toast.success("Datos del proveedor actualizados")
        }
    })

    const handleUpdateInvoice = (updated: Invoice) => {
        const original = invoices.find(inv => inv.id === updated.id)

        setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv))
        setEditingInvoice(null)

        // If identity/payment data changed, update the Provider Master Data
        if (original && updated.cif) {
            const hasChanges = original.nombre !== updated.nombre || original.cuenta !== updated.cuenta
            if (hasChanges) {
                updateFullProviderMutation.mutate({
                    cif: updated.cif,
                    name: updated.nombre,
                    iban: updated.cuenta
                })
            }
        }
    }

    const stats = {
        valid: invoices.filter(i => i.status === 'VALID').length,
        warning: invoices.filter(i => i.status === 'WARNING').length,
        error: invoices.filter(i => i.status === 'ERROR').length
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col relative">
            {step === 'upload' ? (
                <div className="max-w-3xl mx-auto pt-10">
                    <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">Nueva Remesa</h2>
                    <div
                        {...getRootProps()}
                        className={`
                            border-2 border-dashed rounded-xl p-24 text-center cursor-pointer transition-colors
                            flex flex-col items-center gap-4 bg-white dark:bg-slate-900 shadow-sm
                            ${isDragActive ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-300 dark:border-slate-700 hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
                        `}
                    >
                        <input {...getInputProps()} />
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isDragActive ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            <UploadIcon size={40} />
                        </div>
                        <div>
                            <p className="text-xl font-medium text-slate-700 dark:text-slate-200">
                                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu Excel aquí'}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Soporta .xlsx y .xls</p>
                        </div>
                        {uploadMutation.isPending && (
                            <div className="mt-6 w-full max-w-xs">
                                <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    <span>Subiendo archivo...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-orange-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600 dark:text-green-400" />
                            Revisión de Remesa
                        </h2>

                        <div className="flex items-center gap-4">
                            <div className="flex gap-2 text-sm font-medium bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full flex gap-1 items-center">
                                    <CheckCircle size={14} /> {stats.valid}
                                </span>
                                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full flex gap-1 items-center">
                                    <AlertTriangle size={14} /> {stats.warning}
                                </span>
                                <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full flex gap-1 items-center">
                                    <XCircle size={14} /> {stats.error}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mr-4">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Calendar size={16} /> Vencimiento:
                                </label>
                                <input
                                    type="date"
                                    className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={batchDueDate}
                                    onChange={(e) => setBatchDueDate(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={() => createBatchMutation.mutate()}
                                disabled={stats.error > 0 || createBatchMutation.isPending}
                                className={`
                                    px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all
                                    ${stats.error > 0
                                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                        : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white/90 shadow-md hover:shadow-lg'
                                    }
                                `}
                            >
                                {createBatchMutation.isPending ? 'Creando...' : 'Confirmar Lote'}
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Total Summary Bar */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-4 flex justify-between items-center">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Facturas a procesar:</span>
                            <span className="ml-2 font-bold text-slate-900 dark:text-slate-100">{invoices.length}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Importe Total:</span>
                            <span className="ml-2 font-mono font-bold text-xl text-slate-900 dark:text-slate-100">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(invoices.reduce((sum, inv) => sum + (inv.importe || 0), 0))}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-sm text-left relative">
                            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Estado</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">CIF</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Nombre</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Email</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Cuenta</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right">Importe</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Mensaje</th>
                                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${inv.status === 'ERROR' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                        <td className="px-4 py-3">
                                            <StatusIcon status={inv.status} />
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{inv.cif}</td>
                                        <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium">{inv.nombre}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={inv.email}>
                                            {inv.email || <span className="text-slate-300 italic">No email</span>}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 text-xs">{inv.cuenta}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-200">
                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(inv.importe)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs" title={inv.validation_message}>
                                            {inv.validation_message && (
                                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                    <AlertTriangle size={12} /> {inv.validation_message}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setEditingInvoice(inv)}
                                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )
            }

            {
                editingInvoice && (
                    <EditModal
                        invoice={editingInvoice}
                        onClose={() => setEditingInvoice(null)}
                        onSave={handleUpdateInvoice}
                    />
                )
            }

            {
                showDuplicateModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3 text-orange-600 dark:text-orange-400 mb-4">
                                <AlertTriangle size={32} />
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Archivo Duplicado</h3>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mb-6">
                                {duplicateMessage || "Este archivo ya ha sido importado anteriormente."}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                ¿Deseas importarlo de todas formas? Esto creará una nueva remesa con el mismo contenido.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDuplicateModal(false)
                                        setPendingFile(null)
                                    }}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        if (pendingFile) {
                                            uploadMutation.mutate({ file: pendingFile, force: true })
                                        }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Importar de todas formas
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showEmailModal && (
                    <EmailResolutionModal
                        invoices={emailResolutionQueue}
                        onResolve={(resolvedMap, updates) => {
                            const nextInvoices = invoices.map(inv => {
                                if (resolvedMap[inv.id]) {
                                    return { ...inv, email: resolvedMap[inv.id] }
                                }
                                return inv
                            })
                            setInvoices(nextInvoices)

                            updates.forEach(update => {
                                updateProviderMutation.mutate(update)
                            })

                            setShowEmailModal(false)
                            runValidationSequence(nextInvoices)
                        }}
                    />
                )
            }

            {
                showMissingEmailModal && (
                    <MissingEmailModal
                        invoices={missingEmailQueue}
                        onResolve={(resolvedMap, updates) => {
                            const nextInvoices = invoices.map(inv => {
                                if (resolvedMap[inv.id]) {
                                    return { ...inv, email: resolvedMap[inv.id] }
                                }
                                return inv
                            })
                            setInvoices(nextInvoices)

                            updates.forEach(update => {
                                updateProviderMutation.mutate(update)
                            })

                            setShowMissingEmailModal(false)
                            runValidationSequence(nextInvoices)
                        }}
                    />
                )
            }

            {
                showIbanMismatchModal && (
                    <IbanMismatchModal
                        invoices={ibanMismatchQueue}
                        onResolve={(resolvedMap, updates) => {
                            // resolvedMap contains the CHOSEN iban for the invoice
                            const nextInvoices = invoices.map(inv => {
                                if (resolvedMap[inv.id]) {
                                    return {
                                        ...inv,
                                        cuenta: resolvedMap[inv.id],
                                        iban_mismatch: false, // resolved
                                        validation_message: inv.validation_message.replace('IBAN Inválido', '') // Basic cleanup if needed
                                    }
                                }
                                return inv
                            })
                            setInvoices(nextInvoices)

                            updates.forEach(update => {
                                updateProviderIbanMutation.mutate(update)
                            })

                            setShowIbanMismatchModal(false)
                            runValidationSequence(nextInvoices)
                        }}
                    />
                )
            }
        </div >
    )
}

function EmailResolutionModal({ invoices, onResolve }: { invoices: Invoice[], onResolve: (map: Record<number, string>, updates: { cif: string, email: string }[]) => void }) {
    // Map invoice ID -> selected email
    const [selections, setSelections] = useState<Record<number, string>>({})
    // Map invoice ID -> custom new email input value
    const [customInputs, setCustomInputs] = useState<Record<number, string>>({})
    // Set of IDs where "Add New" is active
    const [addingNew, setAddingNew] = useState<Record<number, boolean>>({})

    const handleSelection = (id: number, email: string) => {
        setSelections(prev => ({ ...prev, [id]: email }))
    }

    const toggleAddNew = (id: number) => {
        setAddingNew(prev => ({ ...prev, [id]: !prev[id] }))
        // clear selection if adding new
        if (!addingNew[id]) {
            setSelections(prev => {
                const copy = { ...prev }
                delete copy[id]
                return copy
            })
        }
    }

    const handleConfirm = () => {
        // Build updates
        const updates: { cif: string, email: string }[] = []
        const finalMap: Record<number, string> = { ...selections }

        // Validate all resolved
        for (const inv of invoices) {
            if (addingNew[inv.id]) {
                const newEmail = customInputs[inv.id]
                if (!newEmail || !newEmail.includes('@')) {
                    alert(`Por favor introduce un email válido para ${inv.nombre}`)
                    return
                }
                // Determine new full string to save to DB
                // We take the existing string and append the new one
                const current = inv.email || ""
                const fullString = current ? `${current}, ${newEmail}` : newEmail

                updates.push({ cif: inv.cif, email: fullString })
                finalMap[inv.id] = newEmail // For the batch we use just the new one
            } else if (!finalMap[inv.id]) {
                // Determine default if not selected?
                // The requirements say user MUST select.
                alert(`Por favor selecciona un email para ${inv.nombre}`)
                return
            }
        }

        onResolve(finalMap, updates)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Mail className="text-blue-600" />
                        Resolver Duplicidad de Correos
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Algunos proveedores tienen múltiples correos. Selecciona cuál usar para esta remesa.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {invoices.map(inv => {
                        const options = (inv.email || "").split(/[,;]/).map(s => s.trim()).filter(Boolean)

                        return (
                            <div key={inv.id} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">{inv.nombre}</p>
                                        <p className="text-xs font-mono text-slate-500">{inv.cif}</p>
                                    </div>
                                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                                        ID: {inv.id}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {options.map((opt, idx) => (
                                        <label key={idx} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                            <input
                                                type="radio"
                                                name={`email-${inv.id}`}
                                                value={opt}
                                                checked={selections[inv.id] === opt && !addingNew[inv.id]}
                                                onChange={() => {
                                                    setAddingNew(prev => ({ ...prev, [inv.id]: false }))
                                                    handleSelection(inv.id, opt)
                                                }}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                                        </label>
                                    ))}

                                    {/* Add New Option */}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                                            <input
                                                type="checkbox"
                                                checked={!!addingNew[inv.id]}
                                                onChange={() => toggleAddNew(inv.id)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                <Plus size={14} /> Introducir nuevo correo
                                            </span>
                                        </label>

                                        {addingNew[inv.id] && (
                                            <input
                                                type="email"
                                                placeholder="nuevo@email.com"
                                                className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={customInputs[inv.id] || ""}
                                                onChange={e => setCustomInputs(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                            />
                                        )}
                                        {addingNew[inv.id] && (
                                            <p className="text-xs text-green-600 mt-1">
                                                * Se añadirá a la base de datos de este proveedor.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors" onClick={handleConfirm}>
                        Confirmar Selección
                    </button>
                </div>
            </div>
        </div>
    )
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'VALID') return <CheckCircle size={18} className="text-green-500" />
    if (status === 'WARNING') return <AlertTriangle size={18} className="text-orange-500" />
    return <XCircle size={18} className="text-red-500" />
}

function EditModal({ invoice, onClose, onSave }: { invoice: Invoice, onClose: () => void, onSave: (inv: Invoice) => void }) {
    const [formData, setFormData] = useState(invoice)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSave = () => {
        // Basic re-validation client side or optimistically set to VALID/WARNING
        // For now, we assume user corrected it.
        // In a real app, we would validate again.
        const updated = { ...formData, status: 'VALID', validation_message: 'Corregido manualmente' } as Invoice
        onSave(updated)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Editar Factura</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CIF</label>
                        <input name="cif" value={formData.cif} onChange={handleChange} className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre</label>
                        <input name="nombre" value={formData.nombre} onChange={handleChange} className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cuenta (IBAN)</label>
                        <input name="cuenta" value={formData.cuenta} onChange={handleChange} className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Importe</label>
                        <input name="importe" type="number" value={formData.importe} onChange={handleChange} className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Factura</label>
                        <input name="factura" value={formData.factura} onChange={handleChange} className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={onClose} className="text-slate-600 dark:text-slate-400 font-medium text-sm hover:underline">Cancelar</button>
                    <button onClick={handleSave} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-md font-medium text-sm hover:bg-slate-800 dark:hover:bg-slate-200">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    )
}

function MissingEmailModal({ invoices, onResolve }: { invoices: Invoice[], onResolve: (map: Record<number, string>, updates: { cif: string, email: string }[]) => void }) {
    const [inputs, setInputs] = useState<Record<number, string>>({})

    const handleConfirm = () => {
        const updates: { cif: string, email: string }[] = []
        const finalMap: Record<number, string> = {}

        for (const inv of invoices) {
            const val = inputs[inv.id]
            if (!val || !val.includes('@')) {
                alert(`Introduce un email válido para ${inv.nombre} (${inv.cif})`)
                return
            }
            updates.push({ cif: inv.cif, email: val })
            finalMap[inv.id] = val
        }

        onResolve(finalMap, updates)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Mail className="text-orange-600" />
                        Faltan Correos Electrónicos
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Los siguientes proveedores no tienen email asignado. Por favor, introdúcelos para continuar.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {invoices.map(inv => (
                        <div key={inv.id} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{inv.nombre}</span>
                                <span className="text-xs font-mono text-slate-500">{inv.cif}</span>
                            </div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nuevo Correo (se guardará en BD)</label>
                            <input
                                type="email"
                                placeholder="ejemplo@empresa.com"
                                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                value={inputs[inv.id] || ""}
                                onChange={e => setInputs(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            />
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
                    <button className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded-lg font-medium" onClick={handleConfirm}>
                        Guardar Correos
                    </button>
                </div>
            </div>
        </div>
    )
}

function IbanMismatchModal({ invoices, onResolve }: { invoices: Invoice[], onResolve: (map: Record<number, string>, updates: { cif: string, iban: string }[]) => void }) {
    // Stores the selected IBAN for each invoice
    const [selections, setSelections] = useState<Record<number, string>>({})
    const [customInputs, setCustomInputs] = useState<Record<number, string>>({})
    const [addingNew, setAddingNew] = useState<Record<number, boolean>>({})

    const handleConfirm = () => {
        const updates: { cif: string, iban: string }[] = []
        const finalMap: Record<number, string> = {}

        for (const inv of invoices) {
            let selected = selections[inv.id]

            // If custom is active, take that value
            if (addingNew[inv.id]) {
                const customVal = customInputs[inv.id]
                if (!customVal || customVal.length < 10) { // Basic sanity check
                    alert(`Introduce un IBAN válido para ${inv.nombre}`)
                    return
                }
                selected = customVal
            }

            if (!selected) {
                alert(`Selecciona una cuenta para ${inv.nombre}`)
                return
            }

            finalMap[inv.id] = selected

            // Update logic:
            // If custom NEW: Always update DB.
            // If FILE selected: Update DB (since it differs from DB).
            // If DB selected: Do NOT update.
            const isDbOriginal = selected === inv.db_iban

            if (!isDbOriginal) {
                updates.push({ cif: inv.cif, iban: selected })
            }
        }
        onResolve(finalMap, updates)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" />
                        Conflicto de Cuentas Bancarias (IBAN)
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        El IBAN del archivo no coincide con el de la base de datos para estos proveedores.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {invoices.map(inv => (
                        <div key={inv.id} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="mb-3">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100">{inv.nombre}</h4>
                                <p className="text-xs font-mono text-slate-500">CIF: {inv.cif}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {/* Option 1: From File */}
                                <label className={`
                                    border p-3 rounded cursor-pointer transition-all
                                    ${selections[inv.id] === inv.cuenta && !addingNew[inv.id] ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-700'}
                                `}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="radio"
                                            name={`iban-${inv.id}`}
                                            value={inv.cuenta}
                                            checked={selections[inv.id] === inv.cuenta && !addingNew[inv.id]}
                                            onChange={() => {
                                                setAddingNew(prev => ({ ...prev, [inv.id]: false }))
                                                setSelections(prev => ({ ...prev, [inv.id]: inv.cuenta }))
                                            }}
                                            className="text-orange-600"
                                        />
                                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Usar Factura (Se actualizará BD)</span>
                                    </div>
                                    <p className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">{inv.cuenta}</p>
                                </label>

                                {/* Option 2: From DB */}
                                <label className={`
                                    border p-3 rounded cursor-pointer transition-all
                                    ${selections[inv.id] === (inv.db_iban || "") && !addingNew[inv.id] ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-slate-200 dark:border-slate-700'}
                                `}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="radio"
                                            name={`iban-${inv.id}`}
                                            value={inv.db_iban || ""}
                                            checked={selections[inv.id] === (inv.db_iban || "") && !addingNew[inv.id]}
                                            onChange={() => {
                                                setAddingNew(prev => ({ ...prev, [inv.id]: false }))
                                                setSelections(prev => ({ ...prev, [inv.id]: inv.db_iban || "" }))
                                            }}
                                            className="text-green-600"
                                        />
                                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Usar Base de Datos</span>
                                    </div>
                                    <p className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">{inv.db_iban}</p>
                                </label>
                            </div>

                            {/* Option 3: Custom */}
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input
                                        type="radio"
                                        name={`iban-${inv.id}`}
                                        checked={!!addingNew[inv.id]}
                                        onChange={() => {
                                            setAddingNew(prev => ({ ...prev, [inv.id]: true }))
                                            // clear other selections visually if needed
                                        }}
                                        className="text-blue-600"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                        <Plus size={14} /> Introducir Otro IBAN (Se actualizará BD)
                                    </span>
                                </label>

                                {addingNew[inv.id] && (
                                    <input
                                        type="text"
                                        placeholder="ES00 0000 0000 0000 0000 0000"
                                        className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={customInputs[inv.id] || ""}
                                        onChange={e => setCustomInputs(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
                    <button className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded-lg font-medium" onClick={handleConfirm}>
                        Confirmar Selección
                    </button>
                </div>
            </div>
        </div>
    )
}
