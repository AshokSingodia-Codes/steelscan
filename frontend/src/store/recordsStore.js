import { create } from 'zustand'
import { scannerApi } from '../api/scannerApi'
import { toast } from './toastStore'

export const useRecordsStore = create((set, get) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async () => {
    set({
      loading: true,
      error: null,
    })

    try {
      const data = await scannerApi.getRecords()
      const records = Array.isArray(data) ? data : []

      set({
        records,
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error(err)

      const msg = err.isNetworkError
        ? 'Backend offline — cannot fetch records'
        : err.response?.data?.detail || 'Failed to fetch records'

      set({
        records: [],
        loading: false,
        error: msg,
      })

      toast.error(msg)
    }
  },

  deleteRecord: async (id) => {
    if (!id) {
      toast.error('Invalid record ID')
      return
    }

    try {
      await scannerApi.deleteRecord(id)

      set((state) => ({
        records: state.records.filter(
          (record) => record.id !== id
        ),
      }))

      toast.success('Record deleted')
    } catch (err) {
      console.error(err)

      const msg = err.isNetworkError
        ? 'Backend offline'
        : err.response?.status === 403
          ? err.response?.data?.detail || 'You can delete only your own records'
          : err.response?.data?.detail || 'Delete failed'

      toast.error(msg)
      throw err
    }
  },

  deleteRecordsByMonth: async ({ year, month }) => {
    try {
      const result = await scannerApi.deleteRecordsByMonth({
        year,
        month,
      })

      toast.success(result.message || 'Month records deleted')

      await get().fetchRecords()

      return result
    } catch (err) {
      console.error(err)

      const msg = err.isNetworkError
        ? 'Backend offline'
        : err.response?.data?.detail || 'Month delete failed'

      toast.error(msg)
      throw err
    }
  },

  deleteRecordsByDate: async ({ date }) => {
    try {
      const result = await scannerApi.deleteRecordsByDate({
        date,
      })

      toast.success(result.message || 'Date records deleted')

      await get().fetchRecords()

      return result
    } catch (err) {
      console.error(err)

      const msg = err.isNetworkError
        ? 'Backend offline'
        : err.response?.data?.detail || 'Date delete failed'

      toast.error(msg)
      throw err
    }
  },

  clearRecords: () =>
    set({
      records: [],
      loading: false,
      error: null,
    }),
}))