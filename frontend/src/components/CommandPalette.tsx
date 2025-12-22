import { Fragment, useState, useEffect } from 'react'
import { Combobox, Dialog, Transition } from '@headlessui/react'
import { Search, Loader2, FileText, Users, FileSpreadsheet, Hash } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface SearchResult {
    type: 'batch' | 'provider' | 'invoice'
    id: string
    title: string
    subtitle: string
    url: string
}

export default function CommandPalette() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const navigate = useNavigate()

    // Query Search
    const { data: results, isLoading } = useQuery({
        queryKey: ['search', query],
        queryFn: async () => {
            if (query.length < 2) return []
            const res = await axios.get(`${API_URL}/search/?q=${query}`)
            return res.data as SearchResult[]
        },
        enabled: query.length >= 2,
        staleTime: 5000
    })

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        window.addEventListener('keydown', onKeydown)
        return () => window.removeEventListener('keydown', onKeydown)
    }, [])

    const handleSelect = (result: SearchResult | null) => {
        if (!result) return
        setOpen(false)
        navigate(result.url)
    }

    return (
        <Transition.Root show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={setOpen}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-500/25 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto max-w-2xl transform divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 transition-all">
                            <Combobox onChange={handleSelect}>
                                <div className="relative">
                                    <Search
                                        className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400"
                                        aria-hidden="true"
                                    />
                                    <Combobox.Input
                                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 sm:text-sm"
                                        placeholder="Buscar proveedores, remesas, facturas..."
                                        onChange={(event) => setQuery(event.target.value)}
                                        displayValue={(item: any) => item?.title}
                                        autoComplete="off"
                                    />
                                    {isLoading && (
                                        <div className="absolute right-4 top-3.5">
                                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                {(results || []).length > 0 && (
                                    <Combobox.Options static className="max-h-96 scroll-py-3 overflow-y-auto p-3">
                                        {results?.map((item) => (
                                            <Combobox.Option
                                                key={item.id + item.type}
                                                value={item}
                                                className={({ active }) =>
                                                    `flex cursor-default select-none rounded-xl p-3 transition-colors ${active ? 'bg-slate-100 dark:bg-slate-800' : ''
                                                    }`
                                                }
                                            >
                                                {({ active }) => (
                                                    <>
                                                        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${item.type === 'provider' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                                            item.type === 'batch' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                                                'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                            }`}>
                                                            {item.type === 'provider' ? <Users size={20} /> :
                                                                item.type === 'batch' ? <FileSpreadsheet size={20} /> :
                                                                    <FileText size={20} />}
                                                        </div>
                                                        <div className="ml-4 flex-auto">
                                                            <p className={`text-sm font-medium ${active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {item.title}
                                                            </p>
                                                            <p className={`text-sm ${active ? 'text-slate-700 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                                                {item.subtitle}
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </Combobox.Option>
                                        ))}
                                    </Combobox.Options>
                                )}

                                {query !== '' && results?.length === 0 && !isLoading && (
                                    <div className="px-6 py-14 text-center text-sm sm:px-14">
                                        <Hash className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                                        <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">No se encontraron resultados</p>
                                        <p className="mt-2 text-slate-500">No hemos encontrado nada con "{query}". Intenta buscar por CIF o ID.</p>
                                    </div>
                                )}

                                {query === '' && (
                                    <div className="px-6 py-14 text-center text-sm sm:px-14">
                                        <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-500">
                                            <kbd className="font-sans">Ctrl</kbd> + <kbd className="font-sans">K</kbd>
                                        </div>
                                        <p className="mt-4 text-slate-500">Escribe para buscar al instante</p>
                                    </div>
                                )}
                            </Combobox>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
