import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Home from './pages/Home'
import IndustryDemo from './pages/IndustryDemo'
import NotFound from './pages/NotFound'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo/:slug" element={<IndustryDemo />} />
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
