import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from 'sonner'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/UploadPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

import CalendarPage from './pages/CalendarPage'
import ProvidersPage from './pages/ProvidersPage'
import ProviderDetailsPage from './pages/ProviderDetailsPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="providers" element={<ProvidersPage />} />
              <Route path="providers/:cif" element={<ProviderDetailsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
