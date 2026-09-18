import { create } from 'zustand'

export const SHIFT_OPTIONS = [
  {
    value: 'Shift A',
    label: 'Shift A',
    time: '06:00 AM – 02:00 PM',
  },
  {
    value: 'Shift B',
    label: 'Shift B',
    time: '02:00 PM – 10:00 PM',
  },
  {
    value: 'Shift C',
    label: 'Shift C',
    time: '10:00 PM – 06:00 AM',
  },
  {
    value: 'General Shift',
    label: 'General Shift',
    time: '09:00 AM – 06:00 PM',
  },
]

const STORAGE_KEY = 'steelscan_current_shift'

const getInitialShift = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'General Shift'
  } catch {
    return 'General Shift'
  }
}

export const useShiftStore = create((set) => ({
  currentShift: getInitialShift(),

  setCurrentShift: (shift) => {
    const finalShift = shift || 'General Shift'

    try {
      localStorage.setItem(STORAGE_KEY, finalShift)
    } catch {
      // ignore storage errors
    }

    set({
      currentShift: finalShift,
    })
  },
}))