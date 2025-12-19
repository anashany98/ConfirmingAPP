import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Upload, History, FileText, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: any[]) {
    return twMerge(clsx(inputs))
}

export default function Layout() {
    const location = useLocation()

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Proveedores', path: '/providers', icon: Users },
        { name: 'Nueva Remesa', path: '/upload', icon: Upload },
        { name: 'Histórico', path: '/history', icon: History },
        { name: 'Ajustes', path: '/settings', icon: FileText },
    ]

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                        C
                    </div>
                    <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">Confirming<span className="text-orange-500">APP</span></span>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                )}
                            >
                                <Icon size={20} />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <a
                        href="/manual_usuario.pdf"
                        download="manual_confirming_app.pdf"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                        <FileText size={20} />
                        Descargar Manual PDF
                    </a>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400">
                        <p>v1.0.0</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
                <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-8 justify-between sticky top-0 z-10 transition-colors duration-200">
                    <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {navItems.find(i => i.path === location.pathname)?.name || 'Confirming'}
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 border border-white dark:border-slate-600 shadow-sm"></div>
                    </div>
                </header>

                <div className="p-8 max-w-[1900px] mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
