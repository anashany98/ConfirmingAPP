import { useTheme } from '../components/theme-provider'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Save, Building2, CreditCard, Moon, Sun, Mail } from 'lucide-react'
import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Settings {
    codigo_empresa: string
    numero_cuenta_cargo: string
    sufijo: string
    nombre_empresa: string
    cif_empresa: string
    export_path: string
    smtp_server: string
    smtp_port: number
    smtp_user: string
    smtp_password: string
    smtp_from_email: string
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const queryClient = useQueryClient()
    const [formData, setFormData] = useState<Settings>({
        codigo_empresa: '',
        numero_cuenta_cargo: '',
        sufijo: '000',
        nombre_empresa: '',
        cif_empresa: '',
        export_path: '',
        smtp_server: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        smtp_from_email: ''
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/settings/`)
            return res.data as Settings
        }
    })

    useEffect(() => {
        if (data) setFormData(data)
    }, [data])

    const mutation = useMutation({
        mutationFn: async (newData: Settings) => {
            const res = await axios.put(`${API_URL}/settings/`, newData)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] })
            alert('Configuración guardada correctamente')
        }
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        mutation.mutate(formData)
    }

    if (isLoading) return <div className="p-8">Cargando...</div>

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="text-slate-600 dark:text-slate-400" />
                Configuración ConfirmingAPP
            </h2>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            Apariencia
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Cambia entre modo claro y oscuro.
                        </p>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setTheme('light')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'light'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            Claro
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'dark'
                                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            Oscuro
                        </button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 space-y-6">
                    {/* Bank Data */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                <CreditCard size={18} /> Datos Bancarios
                            </h3>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código Empresa Bankinter</label>
                            <input name="codigo_empresa" value={formData.codigo_empresa} onChange={handleChange} placeholder="0000" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Código asignado por el banco</p>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sufijo</label>
                            <input name="sufijo" value={formData.sufijo} onChange={handleChange} placeholder="000" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuenta de Cargo (IBAN)</label>
                            <input name="numero_cuenta_cargo" value={formData.numero_cuenta_cargo} onChange={handleChange} placeholder="ES00 0000 0000 00 0000000000" className="w-full border rounded-lg px-3 py-2 font-mono bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                        </div>
                    </div>

                    {/* Company Data */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Datos Empresa (Opcional)</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Se usarán si faltan en el fichero o para cabeceras.</p>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Empresa</label>
                            <input name="nombre_empresa" value={formData.nombre_empresa} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CIF</label>
                            <input name="cif_empresa" value={formData.cif_empresa} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carpeta de Copia Local (Ruta Absoluta)</label>
                            <input name="export_path" value={formData.export_path} onChange={handleChange} placeholder="Ej: C:\RemesasBanco" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all font-mono text-sm" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Las remesas generadas se guardarán automáticamente en esta carpeta de tu ordenador, además de la descarga normal.</p>
                        </div>
                    </div>

                    {/* SMTP Data */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <Mail size={18} /> Configuración de Correo (SMTP)
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Servidor SMTP</label>
                                <input name="smtp_server" value={formData.smtp_server} onChange={handleChange} placeholder="smtp.gmail.com" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Puerto</label>
                                <input name="smtp_port" type="number" value={formData.smtp_port} onChange={handleChange} placeholder="587" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuario (Email)</label>
                                <input name="smtp_user" value={formData.smtp_user} onChange={handleChange} autoComplete="off" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña (App Password)</label>
                                <input name="smtp_password" type="password" value={formData.smtp_password} onChange={handleChange} autoComplete="new-password" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Remitente ("From")</label>
                                <input name="smtp_from_email" value={formData.smtp_from_email} onChange={handleChange} placeholder="Si es diferente al usuario (ej: facturacion@miempresa.com)" className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex justify-end">
                    <button type="submit" disabled={mutation.isPending} className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 flex items-center gap-2 disabled:opacity-70">
                        {mutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                        <Save size={18} />
                    </button>
                </div>
            </form>
        </div >
    )
}
