
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
    // const [skippedEmailCheck, setSkippedEmailCheck] = useState(false) // Removed to fix build error

    // Missing Email Handling
    // const [missingEmailQueue, setMissingEmailQueue] = useState<Invoice[]>([]) // Removed to fix build error
    // const [showMissingEmailModal, setShowMissingEmailModal] = useState(false) // Removed to fix build error

    // IBAN Mismatch Handling
    const [ibanMismatchQueue, setIbanMismatchQueue] = useState<Invoice[]>([])
    const [showIbanMismatchModal, setShowIbanMismatchModal] = useState(false)

    // Missing Info Handling
    const [missingInfoQueue, setMissingInfoQueue] = useState<Invoice[]>([])
    const [showMissingInfoModal, setShowMissingInfoModal] = useState(false)

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
            const token = localStorage.getItem('auth_token')
            await axios.put(`${API_URL}/providers/${cif}`, { email, cif }, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
        }
    })

    // Add Provider Update Mutation (IBAN)
    const updateProviderIbanMutation = useMutation({
        mutationFn: async ({ cif, iban }: { cif: string, iban: string }) => {
            const token = localStorage.getItem('auth_token')
            await axios.put(`${API_URL}/providers/${cif}`, { iban, cif }, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
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
        // MERGED into Step 4 (Missing Info)
        /*
        const missingEmails = currentInvoices.filter((inv: Invoice) => (!inv.email || inv.email.trim() === "") && inv.cif)
        if (!skippedEmailCheck && missingEmails.length > 0) {
            setMissingEmailQueue(missingEmails)
            setShowMissingEmailModal(true)
            return
        }
        */

        // 3. IBAN Mismatch
        const ibanMismatches = currentInvoices.filter((inv: Invoice) => inv.iban_mismatch)
        if (ibanMismatches.length > 0) {
            setIbanMismatchQueue(ibanMismatches)
            setShowIbanMismatchModal(true)
            return
        }

        // 4. Missing Info (Address, City, Zip, Country, Email, IBAN, Phone)
        // Check for ANY missing field that we want to enforce for the provider DB
        const missingInfo = currentInvoices.filter((inv: Invoice) => {
            const hasName = inv.nombre && inv.nombre.trim() !== ""
            const hasAddress = inv.direccion && inv.direccion.trim() !== ""
            const hasCity = inv.poblacion && inv.poblacion.trim() !== ""
            const hasZip = inv.cp && inv.cp.trim() !== ""
            const hasCountry = inv.pais && inv.pais.trim() !== ""
            const hasEmail = inv.email && inv.email.trim() !== ""
            const hasIban = inv.cuenta && inv.cuenta.trim() !== ""
            // Phone is now optional
            // const hasPhone = inv.phone && inv.phone.trim() !== "" 

            // If any check fails, add to queue
            return (!hasName || !hasAddress || !hasCity || !hasZip || !hasCountry || !hasEmail || !hasIban) && inv.cif
        })

        if (missingInfo.length > 0) {
            setMissingInfoQueue(missingInfo)
            setShowMissingInfoModal(true)
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
            const token = localStorage.getItem('auth_token')
            const res = await axios.post(`${API_URL}/import/upload${force ? '?force=true' : ''}`, formData, {
                headers: { 'Authorization': `Bearer ${token}` },
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
            const token = localStorage.getItem('auth_token')
            const res = await axios.post(`${API_URL}/batches/`, batchData, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
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
            const token = localStorage.getItem('auth_token')
            await axios.put(`${API_URL}/providers/${data.cif}`, data, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
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

            {/* 
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
                            setSkippedEmailCheck(true)
                            runValidationSequence(nextInvoices)
                        }}
                    />
                )
            */}

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
                                        validation_message: (inv.validation_message || '').replace('IBAN Inválido', '') // Basic cleanup if needed
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
            {
                showMissingInfoModal && (
                    <MissingInfoModal
                        invoices={missingInfoQueue}
                        onResolve={(updates) => {
                            const nextInvoices = invoices.map(inv => {
                                const update = updates.find(u => u.id === inv.id)
                                if (update) {
                                    return { ...inv, ...update }
                                }
                                return inv
                            })
                            setInvoices(nextInvoices)
                            setShowMissingInfoModal(false)
                            runValidationSequence(nextInvoices)
                        }}
                    />
                )
            }
        </div>
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



function IbanMismatchModal({ invoices, onResolve }: { invoices: Invoice[], onResolve: (map: Record<number, string>, updates: { cif: string, iban: string }[]) => void }) {
    // Group invoices by CIF + File IBAN
    // Key: `${inv.cif}-${inv.cuenta}`
    // Value: { representative: Invoice, ids: number[] }
    const groups: Record<string, { representative: Invoice, ids: number[] }> = {}

    invoices.forEach(inv => {
        const key = `${inv.cif}-${inv.cuenta}`
        if (!groups[key]) {
            groups[key] = { representative: inv, ids: [] }
        }
        groups[key].ids.push(inv.id)
    })

    const groupKeys = Object.keys(groups)

    // Stores the selected IBAN for each GROUP KEY
    const [selections, setSelections] = useState<Record<string, string>>({})
    const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
    const [addingNew, setAddingNew] = useState<Record<string, boolean>>({})

    const handleConfirm = () => {
        const updates: { cif: string, iban: string }[] = []
        const finalMap: Record<number, string> = {} // Map InvoiceID -> IBAN

        for (const key of groupKeys) {
            const group = groups[key]
            let selected = selections[key]

            // If custom is active, take that value
            if (addingNew[key]) {
                const customVal = customInputs[key]
                if (!customVal || customVal.length < 10) { // Basic sanity check
                    alert(`Introduce un IBAN válido para ${group.representative.nombre}`)
                    return
                }
                selected = customVal
            }

            if (!selected) {
                alert(`Selecciona una cuenta para ${group.representative.nombre}`)
                return
            }

            // Apply to ALL invoices in this group
            for (const id of group.ids) {
                finalMap[id] = selected
            }

            // Update logic (only once per group):
            // If custom NEW: Always update DB.
            // If FILE selected: Update DB (since it differs from DB).
            // If DB selected: Do NOT update.
            const isDbOriginal = selected === group.representative.db_iban
            if (!isDbOriginal) {
                // Push only one update per unique Provider/IBAN decision
                // Note: If multiple groups exist for same provider (e.g. 2 different file IBANs for same CIF), this still works correctly.
                updates.push({ cif: group.representative.cif, iban: selected })
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
                        El IBAN del archivo no coincide con el de la base de datos.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {groupKeys.map(key => {
                        const group = groups[key]
                        const inv = group.representative

                        return (
                            <div key={key} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="mb-3 flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{inv.nombre}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs font-mono text-slate-500">CIF: {inv.cif}</p>
                                            {group.ids.length > 1 && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                    Afecta a {group.ids.length} facturas
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    {/* Option 1: From File */}
                                    <label className={`
                                        border p-3 rounded cursor-pointer transition-all
                                        ${selections[key] === inv.cuenta && !addingNew[key] ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-700'}
                                    `}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="radio"
                                                name={`iban-${key}`}
                                                value={inv.cuenta}
                                                checked={selections[key] === inv.cuenta && !addingNew[key]}
                                                onChange={() => {
                                                    setAddingNew(prev => ({ ...prev, [key]: false }))
                                                    setSelections(prev => ({ ...prev, [key]: inv.cuenta }))
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
                                        ${selections[key] === (inv.db_iban || "") && !addingNew[key] ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-slate-200 dark:border-slate-700'}
                                    `}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="radio"
                                                name={`iban-${key}`}
                                                value={inv.db_iban || ""}
                                                checked={selections[key] === (inv.db_iban || "") && !addingNew[key]}
                                                onChange={() => {
                                                    setAddingNew(prev => ({ ...prev, [key]: false }))
                                                    setSelections(prev => ({ ...prev, [key]: inv.db_iban || "" }))
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
                                            name={`iban-${key}`}
                                            checked={!!addingNew[key]}
                                            onChange={() => {
                                                setAddingNew(prev => ({ ...prev, [key]: true }))
                                                // clear other selections visually if needed
                                            }}
                                            className="text-blue-600"
                                        />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <Plus size={14} /> Introducir Otro IBAN (Se actualizará BD)
                                        </span>
                                    </label>

                                    {addingNew[key] && (
                                        <input
                                            type="text"
                                            placeholder="ES00 0000 0000 0000 0000 0000"
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={customInputs[key] || ""}
                                            onChange={e => setCustomInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    })}
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

function MissingInfoModal({ invoices, onResolve }: { invoices: Invoice[], onResolve: (updates: any[]) => void }) {
    // Group by CIF
    const groups: Record<string, { representative: Invoice, ids: number[] }> = {}
    invoices.forEach(inv => {
        if (!groups[inv.cif]) {
            groups[inv.cif] = { representative: inv, ids: [] }
        }
        groups[inv.cif].ids.push(inv.id)
    })
    const groupKeys = Object.keys(groups)

    // Form State: Key = CIF
    const [forms, setForms] = useState<Record<string, { nombre: string, direccion: string, poblacion: string, cp: string, pais: string, email: string, cuenta: string }>>({})

    // Init state
    useState(() => {
        const initial: any = {}
        groupKeys.forEach(cif => {
            const rep = groups[cif].representative
            initial[cif] = {
                nombre: rep.nombre || "",
                direccion: rep.direccion || "",
                poblacion: rep.poblacion || "",
                cp: rep.cp || "",
                pais: rep.pais || "ES",
                email: rep.email || "",
                cuenta: rep.cuenta || ""
            }
        })
        setForms(initial)
    })

    const handleChange = (cif: string, field: string, value: string) => {
        setForms(prev => ({
            ...prev,
            [cif]: { ...prev[cif], [field]: value }
        }))
    }

    const handleConfirm = () => {
        // Validation with specific messages
        for (const cif of groupKeys) {
            const form = forms[cif]
            if (!form.nombre) { alert(`Falta Nombre Fiscal para ${cif}`); return; }
            if (!form.direccion) { alert(`Falta Dirección para ${cif}`); return; }
            if (!form.poblacion) { alert(`Falta Población para ${cif}`); return; }
            if (!form.cp) { alert(`Falta Código Postal para ${cif}`); return; }
            if (!form.pais) { alert(`Falta País para ${cif}`); return; }
            if (!form.email) { alert(`Falta Email para ${cif}`); return; }
            if (!form.cuenta) { alert(`Falta Cuenta IBAN para ${cif}`); return; }
            if (!form.cuenta) { alert(`Falta Cuenta IBAN para ${cif}`); return; }
        }

        const updates: any[] = []

        groupKeys.forEach(cif => {
            const form = forms[cif]
            const group = groups[cif]

            // Apply to all IDs in group
            group.ids.forEach(id => {
                updates.push({
                    id,
                    ...form
                })
            })
        })

        onResolve(updates)
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Edit2 className="text-blue-500" />
                        Completar Datos del Proveedor
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Faltan datos obligatorios para registrar estos proveedores. Por favor, rellénalos todos.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {groupKeys.map(cif => {
                        const group = groups[cif]
                        const rep = group.representative
                        const form = forms[cif] || { nombre: '', direccion: '', poblacion: '', cp: '', pais: 'ES', email: '', cuenta: '' }

                        return (
                            <div key={cif} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="mb-4 flex flex-col gap-1">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100">{rep.nombre || 'Nombre Desconocido'}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">CIF</span>
                                        <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{cif}</span>
                                        {group.ids.length > 1 && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">Afecta a {group.ids.length} facturas</span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Fiscal *</label>
                                        <input
                                            type="text"
                                            value={form.nombre}
                                            onChange={e => handleChange(cif, 'nombre', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="Nombre del Proveedor"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Dirección *</label>
                                        <input
                                            type="text"
                                            value={form.direccion}
                                            onChange={e => handleChange(cif, 'direccion', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="Calle..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">CP *</label>
                                        <input
                                            type="text"
                                            value={form.cp}
                                            onChange={e => handleChange(cif, 'cp', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="28000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Población *</label>
                                        <input
                                            type="text"
                                            value={form.poblacion}
                                            onChange={e => handleChange(cif, 'poblacion', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="Ciudad"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">País *</label>
                                        <input
                                            type="text"
                                            value={form.pais}
                                            onChange={e => handleChange(cif, 'pais', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="ES"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => handleChange(cif, 'email', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">IBAN *</label>
                                        <input
                                            type="text"
                                            value={form.cuenta}
                                            onChange={e => handleChange(cif, 'cuenta', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 font-mono"
                                            placeholder="ES..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                        onClick={handleConfirm}
                    >
                        Guardar Datos y Continuar
                    </button>
                </div>
            </div>
        </div >
    )
}
