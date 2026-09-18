import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react'

import { scannerApi } from '../api/scannerApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

export default function AdminUploadPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin'

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]

    setResult(null)
    setError('')

    if (!selectedFile) {
      setFile(null)
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setError('Only CSV files are allowed.')
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await scannerApi.uploadRecordsCsv(file)

      setResult(data)
      toast.success(data.message || 'CSV uploaded successfully')

      setFile(null)

      const input = document.getElementById('admin-csv-upload')
      if (input) input.value = ''
    } catch (err) {
      console.error(err)

      const message =
        err.response?.data?.detail ||
        err.message ||
        'CSV upload failed.'

      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-industrial-950 text-industrial-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card rounded-2xl p-8 text-center border border-rose-700/40">
          <AlertCircle className="mx-auto text-rose-400" size={44} />

          <h1 className="font-display text-4xl tracking-widest text-rose-300 mt-4">
            ACCESS DENIED
          </h1>

          <p className="font-mono text-sm text-industrial-500 mt-3">
            Only admin users can upload old CSV records.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-industrial-950 text-industrial-100 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 scanline-overlay z-0" />

      <div className="relative z-10 px-6 py-6 max-w-6xl mx-auto space-y-6">
        <header className="glass-card rounded-2xl p-6 border border-industrial-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl border border-scan-cyan bg-scan-cyan/10 text-scan-cyan flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.3)]">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h1 className="font-display text-5xl tracking-widest text-industrial-800 leading-none">
                ADMIN DATA UPLOAD
              </h1>

              <p className="font-mono text-xs text-industrial-400 mt-3 uppercase tracking-wider">
                Import old/past industrial coil records from CSV
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="glass-card rounded-2xl p-6 border border-industrial-700 bg-industrial-900 shadow-card">
            <div className="flex items-center gap-3 mb-5">
              <FileSpreadsheet className="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]" size={22} />

              <div>
                <h2 className="font-display text-3xl tracking-widest text-industrial-100">
                  UPLOAD CSV
                </h2>

                <p className="font-mono text-xs text-industrial-400 mt-1">
                  Only .csv files are accepted.
                </p>
              </div>
            </div>

            <label
              htmlFor="admin-csv-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-industrial-700 bg-industrial-950 shadow-sm p-10 text-center hover:border-scan-cyan hover:bg-industrial-800 transition-all"
            >
              <Upload size={42} className="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]" />

              <div className="font-display text-2xl tracking-widest text-industrial-800 mt-4">
                SELECT CSV FILE
              </div>

              <div className="font-mono text-xs text-industrial-400 mt-2">
                Required: Coil Code, Date, Time
              </div>

              <input
                id="admin-csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {file && (
              <div className="mt-5 rounded-xl border border-scan-cyan/50 bg-scan-cyan/10 p-4">
                <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider">
                  Selected File
                </div>

                <div className="font-mono text-sm text-scan-cyan mt-1 break-all">
                  {file.name}
                </div>

                <div className="font-mono text-xs text-industrial-400 mt-1">
                  {(file.size / 1024).toFixed(2)} KB
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-alert-red/40 bg-alert-red/10 p-4 text-alert-red font-mono text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="mt-6 w-full btn-primary px-5 py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload Records
                </>
              )}
            </button>
          </section>

          <section className="glass-card rounded-2xl p-6 border border-industrial-700 bg-industrial-900 shadow-card">
            <div className="flex items-center gap-3 mb-5">
              <Database className="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]" size={22} />

              <div>
                <h2 className="font-display text-3xl tracking-widest text-industrial-800">
                  CSV FORMAT
                </h2>

                <p className="font-mono text-xs text-industrial-400 mt-1">
                  Keep exported format simple and controlled.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-industrial-700 bg-industrial-950 p-4">
                <div className="font-mono text-xs text-scan-cyan uppercase tracking-wider mb-2 drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]">
                  Required Columns
                </div>

                <div className="font-mono text-sm text-industrial-300">
                  Coil Code, Date, Time
                </div>
              </div>

              <div className="rounded-xl border border-industrial-700 bg-industrial-950 p-4">
                <div className="font-mono text-xs text-molten-amber uppercase tracking-wider mb-2 drop-shadow-[0_0_5px_rgba(255,109,0,0.4)]">
                  Optional Columns
                </div>

                <div className="font-mono text-sm text-industrial-300">
                  ID, Employee ID, Method, Shift, Confidence
                </div>
              </div>

              <div className="rounded-xl border border-industrial-700 bg-industrial-950 p-4 overflow-x-auto">
                <pre className="font-mono text-xs text-industrial-400">
{`ID,Coil Code,Employee ID,Method,Shift,Date,Time,Confidence
114,1121211412,ramu,MANUAL,Shift B,03/06/2026,23:39:19,100%
115,9876543210,employee,OCR,Shift A,04/06/2026,10:20:00,82%`}
                </pre>
              </div>

              <div className="rounded-xl border border-scan-cyan/40 bg-scan-cyan/10 p-4">
                <div className="font-mono text-xs text-scan-cyan uppercase tracking-wider mb-2 drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]">
                  Industrial Mapping
                </div>

                <div className="font-mono text-xs text-industrial-500 leading-6">
                  ID becomes source CSV ID. New MySQL ID remains auto-generated.
                  Employee ID becomes original operator. Uploaded By becomes current admin.
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-6 rounded-xl border border-signal-green/40 bg-signal-green/10 p-5">
                <div className="flex items-center gap-2 text-signal-green drop-shadow-[0_0_5px_rgba(0,230,118,0.4)]">
                  <CheckCircle2 size={18} />

                  <div className="font-display text-2xl tracking-widest">
                    UPLOAD SUCCESS
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-industrial-950 border border-industrial-700 p-3">
                    <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider">
                      Imported
                    </div>

                    <div className="font-display text-3xl text-signal-green tracking-widest drop-shadow-[0_0_5px_rgba(0,230,118,0.4)]">
                      {result.imported_count ?? 0}
                    </div>
                  </div>

                  <div className="rounded-lg bg-industrial-950 border border-industrial-700 p-3">
                    <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider">
                      Skipped
                    </div>

                    <div className="font-display text-3xl text-molten-amber tracking-widest drop-shadow-[0_0_5px_rgba(255,109,0,0.4)]">
                      {result.skipped_count ?? 0}
                    </div>
                  </div>
                </div>

                {Array.isArray(result.errors) && result.errors.length > 0 && (
                  <div className="mt-4 rounded-lg border border-alert-red/40 bg-alert-red/10 p-3">
                    <div className="font-mono text-xs text-alert-red uppercase tracking-wider mb-2 drop-shadow-[0_0_5px_rgba(255,51,102,0.4)]">
                      First errors
                    </div>

                    <ul className="font-mono text-xs text-industrial-400 space-y-1">
                      {result.errors.slice(0, 8).map((item, index) => (
                        <li key={index}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => navigate('/records?category=uploaded')}
                  className="mt-5 w-full btn-ghost px-4 py-3 text-xs"
                >
                  View Uploaded Data
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="btn-ghost px-4 py-2 text-xs"
          >
            Back to Admin Dashboard
          </button>

          <button
            onClick={() => navigate('/records')}
            className="btn-ghost px-4 py-2 text-xs"
          >
            View All Records
          </button>
        </div>
      </div>
    </div>
  )
}