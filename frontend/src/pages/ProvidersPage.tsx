import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useDropzone } from 'react-dropzone'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Upload, CheckCircle, AlertCircle, Users, Search, Plus, Trash2, Edit2, X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Provider {
    cif: string
    name: string
    email?: string
    address?: string
    city?: string
    zip_code?: string
    iban?: string
    phone?: string
    country?: string
    swift?: string
}

export default function ProvidersPage() {
    const queryClient = useQueryClient()
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

    // Search & Filter
    const [search, setSearch] = useState('')
    const [filterNoIban, setFilterNoIban] = useState(false)
    const [filterCountry, setFilterCountry] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 12

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
    const [formData, setFormData] = useState<Partial<Provider>>({})

    // Query Providers
    const { data: providers, isLoading } = useQuery({
        queryKey: ['providers'],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/providers/`)
            return data
        }
    })

    // Derived State: Filters
    const filteredProviders = providers?.filter((p: Provider) => {
        const matchesSearch =
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.cif?.toLowerCase().includes(search.toLowerCase())

        const matchesIban = filterNoIban ? !p.iban : true
        const matchesCountry = filterCountry ? p.country?.toLowerCase() === filterCountry.toLowerCase() : true

        return matchesSearch && matchesIban && matchesCountry
    }) || []

    // Derived State: Pagination
    const totalPages = Math.ceil(filteredProviders.length / ITEMS_PER_PAGE)
    const paginatedProviders = filteredProviders.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    // Unique countries for filter
    const countries = Array.from(new Set(providers?.map((p: Provider) => p.country).filter(Boolean) as string[])).sort()

    // Mutations
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData()
            fd.append('file', file)
            const { data } = await axios.post(`${API_URL}/providers/upload`, fd)
            return data
        },
        onSuccess: (data) => {
            setUploadSuccess(`¡Éxito! ${data.message}`)
            queryClient.invalidateQueries({ queryKey: ['providers'] })
            setTimeout(() => setUploadSuccess(null), 5000)
        },
        onError: (err: any) => setUploadError(err.response?.data?.detail || "Error al subir")
    })

    const createMutation = useMutation({
        mutationFn: async (data: Partial<Provider>) => {
            await axios.post(`${API_URL}/providers/`, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
            closeModal()
        }
    })

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Provider>) => {
            await axios.put(`${API_URL}/providers/${data.cif}`, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['providers'] })
            closeModal()
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (cif: string) => {
            if (!confirm(`¿Seguro que quieres borrar al proveedor ${cif}?`)) throw new Error("Cancelled")
            await axios.delete(`${API_URL}/providers/${cif}`)
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers'] })
    })

    // Handlers
    const onDrop = (files: File[]) => { if (files.length) uploadMutation.mutate(files[0]) }
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, maxFiles: 1 })

    const openAddModal = () => {
        setEditingProvider(null)
        setFormData({})
        setIsModalOpen(true)
    }

    const openEditModal = (p: Provider) => {
        setEditingProvider(p)
        setFormData(p)
        setIsModalOpen(true)
    }

    const closeModal = () => {
        setIsModalOpen(false)
        setEditingProvider(null)
        setFormData({})
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editingProvider) {
            updateMutation.mutate(formData)
        } else {
            createMutation.mutate(formData)
        }
    }

    return (
        <div className="space-y-8 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Users className="text-slate-600 dark:text-slate-400" />
                        Gestión de Proveedores
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona tu base de datos de proveedores. Total: {providers?.length || 0}</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus size={20} />
                    Nuevo Proveedor
                </button>
            </div>

            {/* Upload Area (Small) */}
            <div {...getRootProps()} className={clsx("border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors bg-white dark:bg-slate-900", isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-300 dark:border-slate-700 hover:border-blue-400")}>
                <input {...getInputProps()} />
                <div className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                    <Upload size={20} />
                    <span className="text-sm">Arrastra aquí el Excel de Factusol para importar masivamente</span>
                </div>
            </div>

            {(uploadError || uploadSuccess) && (
                <div className={clsx("p-4 rounded-lg flex items-center gap-2 border", uploadError ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900")}>
                    {uploadError ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <span>{uploadError || uploadSuccess}</span>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o CIF..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3">
                        <select
                            className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            value={filterCountry}
                            onChange={e => { setFilterCountry(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="">Todos los Países</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filterNoIban}
                                onChange={e => { setFilterNoIban(e.target.checked); setCurrentPage(1); }}
                                className="rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                            />
                            Solo sin IBAN
                        </label>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-3">CIF</th>
                                <th className="px-4 py-3">Nombre Fiscal</th>
                                <th className="px-4 py-3">Dirección</th>
                                <th className="px-4 py-3">Población / CP</th>
                                <th className="px-4 py-3">País</th>
                                <th className="px-4 py-3">Teléfono</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">IBAN</th>
                                <th className="px-4 py-3">SWIFT</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr><td colSpan={10} className="px-6 py-8 text-center bg-white dark:bg-slate-900">Cargando...</td></tr>
                            ) : paginatedProviders.length === 0 ? (
                                <tr><td colSpan={10} className="px-6 py-8 text-center text-slate-400 bg-white dark:bg-slate-900">No se encontraron proveedores.</td></tr>
                            ) : (
                                paginatedProviders.map((p: Provider) => (
                                    <tr key={p.cif} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.cif}</td>
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                                            <Link to={`/providers/${p.cif}`} className="hover:text-blue-600 hover:underline">
                                                {p.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={p.address}>{p.address}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                            <span>{p.city}</span> <span className="text-slate-400 dark:text-slate-500 text-xs">({p.zip_code})</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.country}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.phone}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={p.email}>{p.email}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.iban}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.swift}</td>

                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEditModal(p)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-400" title="Editar"><Edit2 size={16} /></button>
                                                <button onClick={() => deleteMutation.mutate(p.cif)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400" title="Eliminar"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProviders.length)} de {filteredProviders.length}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors text-slate-700 dark:text-slate-300"
                        >
                            Anterior
                        </button>
                        <span className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 flex items-center bg-slate-50 dark:bg-slate-900 rounded">
                            Página {currentPage} de {totalPages || 1}
                        </span>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors text-slate-700 dark:text-slate-300"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CIF / NIF *</label>
                                <input
                                    required
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.cif || ''}
                                    onChange={e => setFormData({ ...formData, cif: e.target.value })}
                                    disabled={!!editingProvider} // Cannot edit ID
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Fiscal *</label>
                                <input
                                    required
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.address || ''}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Población</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.city || ''}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código Postal</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.zip_code || ''}
                                    onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">País</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.country || ''}
                                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <hr className="col-span-2 my-2 border-slate-100 dark:border-slate-800" />
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IBAN (Cuenta Bancaria) *</label>
                                <input
                                    required
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.iban || ''}
                                    onChange={e => setFormData({ ...formData, iban: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SWIFT / BIC</label>
                                <input
                                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={formData.swift || ''}
                                    onChange={e => setFormData({ ...formData, swift: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2 flex justify-end gap-3 mt-4">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                                    {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar Datos'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
