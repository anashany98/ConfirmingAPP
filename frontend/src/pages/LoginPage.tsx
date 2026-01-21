import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Lock, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username,
                    password,
                }),
            });

            if (!response.ok) {
                throw new Error('Credenciales incorrectas');
            }

            const data = await response.json();
            login(data.access_token);
            toast.success('Sesión iniciada correctamente');
            navigate(from, { replace: true });
        } catch (error: any) {
            toast.error(error.message || 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/20">
                            C
                        </div>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Confirming<span className="text-orange-500">APP</span>
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Inicia sesión para gestionar tus remesas bancarias
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 border border-slate-200 dark:border-slate-800 transition-colors duration-200">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                                    Usuario
                                </label>
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="Tu nombre de usuario"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                                    Contraseña
                                </label>
                                <div className="relative mt-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin mr-2" size={18} />
                                ) : null}
                                {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            ¿No tienes acceso? Contacta con el administrador
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-600">
                        ConfirmingAPP v1.2.0 • Sistema de Seguridad Activo
                    </p>
                </div>
            </div>
        </div>
    );
}
