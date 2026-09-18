import { Routes, Route, Navigate } from 'react-router-dom'

import MainLayout from '../layouts/MainLayout'
import ScannerPage from '../pages/ScannerPage'
import RecordsPage from '../pages/RecordsPage'
import ManualEntryPage from '../pages/ManualEntryPage'
import LoginPage from '../pages/LoginPage.jsx'
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx'
import AdminUploadPage from '../pages/AdminUploadPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'

import ProtectedRoute from '../components/auth/ProtectedRoute.jsx'
import { useAuthStore } from '../store/authStore'

function DefaultRedirect() {
  const { user } = useAuthStore()

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Navigate to="/scanner" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/upload-records"
        element={
          <ProtectedRoute adminOnly>
            <AdminUploadPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRedirect />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/manual-entry" element={<ManualEntryPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}