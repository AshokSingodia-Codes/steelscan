export function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return String(ts)
  }
}

export function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined) return 'N/A'
  return `${Math.round(confidence * 100)}%`
}

export function confidenceLevel(confidence) {
  if (confidence === null || confidence === undefined) return 'unknown'
  const pct = confidence * 100
  if (pct >= 90) return 'high'
  if (pct >= 70) return 'medium'
  return 'low'
}

export function dataUrlToFile(dataUrl, filename = 'capture.jpg') {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}
