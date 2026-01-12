import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Users, Plus, Trash2, Key, RefreshCw, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../lib/auth'
import { ConfirmationModal } from './ConfirmationModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface UserData {
    id: number
    username: string
    email: string | null
    is_active: boolean
    created_at: string
}

export default function UsersHelper() {
    const queryClient = useQueryClient()
    const { logout } = useAuth()

    // --- STATE ---
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newUser, setNewUser] = useState({ username: '', password: '', email: '' })

    const [deleteId, setDeleteId] = useState<number | null>(null)

    const [resetId, setResetId] = useState<number | null>(null)
    const [newPassword, setNewPassword] = useState('')

    const [changeMyOpen, setChangeMyOpen] = useState(false)
    const [myPasswords, setMyPasswords] = useState({ old: '', new: '' })

    // --- QUERIES ---
    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            // Retrieve token automatically handled by axios interceptor? 
            // Wait, we don't have an interceptor yet! We need to add auth headers manually or setup interceptor.
            // For now, let's grab token from localStorage manually in the fetch.
            // Ideally we should have a global axios instance.
            const token = localStorage.getItem('auth_token')
            const res = await axios.get(`${API_URL}/auth/users`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            return res.data as UserData[]
        }
    })

    // --- MUTATIONS ---
    const token = localStorage.getItem('auth_token')
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } }

    const createMutation = useMutation({
        mutationFn: async () => {
            await axios.post(`${API_URL}/auth/register`, newUser, authHeaders)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setIsCreateOpen(false)
            setNewUser({ username: '', password: '', email: '' })
            toast.success('Usuario creado correctamente')
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'Error creando usuario')
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await axios.delete(`${API_URL}/auth/users/${id}`, authHeaders)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setDeleteId(null)
            toast.success('Usuario eliminado')
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'Error eliminando usuario')
    })

    const resetMutation = useMutation({
        mutationFn: async () => {
            if (!resetId) return
            await axios.put(`${API_URL}/auth/users/${resetId}/reset-password`, { new_password: newPassword }, authHeaders)
        },
        onSuccess: () => {
            setResetId(null)
            setNewPassword('')
            toast.success('Contraseña reseteada')
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'Error reseteando contraseña')
    })

    const changeMyPasswordMutation = useMutation({
        mutationFn: async () => {
            await axios.post(`${API_URL}/auth/change-password`, {
                old_password: myPasswords.old,
                new_password: myPasswords.new
            }, authHeaders)
        },
        onSuccess: () => {
            setChangeMyOpen(false)
            setMyPasswords({ old: '', new: '' })
            toast.success('Tu contraseña ha sido actualizada. Por favor inicia sesión de nuevo.')
            logout()
        },
        onError: (err: any) => toast.error(err.response?.data?.detail || 'Error cambiando contraseña')
    })

    if (isLoading) return <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>

    return (
        <div className="space-y-8">

            {/* --- LISTA DE USUARIOS --- */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Users size={18} /> Gestión de Usuarios
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Administra quién tiene acceso a la aplicación.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> Nuevo Usuario
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-3">Usuario</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">Fecha Alta</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users?.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                                        {user.username}
                                        {user.username === 'admin' && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full border border-yellow-200">Admin</span>}
                                    </td>
                                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{user.email || '-'}</td>
                                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-3 flex justify-end gap-2">
                                        <button
                                            title="Resetear Contraseña"
                                            onClick={() => setResetId(user.id)}
                                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        >
                                            <Key size={16} />
                                        </button>
                                        <button
                                            title="Eliminar Usuario"
                                            onClick={() => setDeleteId(user.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- CAMBIAR MI CONTRASEÑA --- */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Shield size={18} /> Seguridad Personal
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Cambia tu contraseña actual para mantener segura tu cuenta.
                    </p>
                </div>
                <button
                    onClick={() => setChangeMyOpen(true)}
                    className="border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    Cambiar Mi Contraseña
                </button>
            </div>


            {/* --- MODALS --- */}

            {/* CREATE USER MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-semibold text-lg">Crear Nuevo Usuario</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Nombre de Usuario</label>
                                <input
                                    value={newUser.username}
                                    onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Email (Opcional)</label>
                                <input
                                    value={newUser.email}
                                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Contraseña Inicial</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                                    className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3">
                            <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancelar</button>
                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={!newUser.username || !newUser.password}
                                className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                            >
                                Crear Usuario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RESET PASSWORD MODAL */}
            {resetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="p-6">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                <RefreshCw size={20} />
                            </div>
                            <h3 className="font-semibold text-lg mb-2">Resetear Contraseña</h3>
                            <p className="text-sm text-slate-500 mb-4">Introduce la nueva contraseña para este usuario.</p>

                            <input
                                type="text"
                                placeholder="Nueva contraseña..."
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            />

                            <div className="flex justify-end gap-3">
                                <button onClick={() => { setResetId(null); setNewPassword('') }} className="px-4 py-2 text-sm font-medium text-slate-600">Cancelar</button>
                                <button
                                    onClick={() => resetMutation.mutate()}
                                    disabled={!newPassword}
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Confirmar Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CHANGE MY PASSWORD MODAL */}
            {changeMyOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="p-6">
                            <h3 className="font-semibold text-lg mb-4">Cambiar Contraseña</h3>

                            <div className="space-y-3 mb-6">
                                <div>
                                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Contraseña Actual</label>
                                    <input
                                        type="password"
                                        value={myPasswords.old}
                                        onChange={e => setMyPasswords(p => ({ ...p, old: e.target.value }))}
                                        className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        value={myPasswords.new}
                                        onChange={e => setMyPasswords(p => ({ ...p, new: e.target.value }))}
                                        className="w-full border rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button onClick={() => setChangeMyOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancelar</button>
                                <button
                                    onClick={() => changeMyPasswordMutation.mutate()}
                                    disabled={!myPasswords.old || !myPasswords.new}
                                    className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                                >
                                    Actualizar Contraseña
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId) }}
                title="Eliminar Usuario"
                description="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
                confirmText="Sí, eliminar"
                isDestructive={true}
            />
        </div>
    )
}
