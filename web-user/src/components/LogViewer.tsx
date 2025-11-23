import { useState, useEffect } from 'react'
import { 
  getCoordinateTraceLogs, 
  clearCoordinateTraceLogs, 
  exportCoordinateTraceLogsAsText 
} from '../utils/logCollector'

interface LogEntry {
  timestamp: string
  step: string
  data: any
  type: 'log' | 'warn' | 'error'
}

export const LogViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    // Refresh logs every second
    const interval = setInterval(() => {
      setLogs(getCoordinateTraceLogs())
    }, 1000)

    // Initial load
    setLogs(getCoordinateTraceLogs())

    return () => clearInterval(interval)
  }, [])

  const filteredLogs = logs.filter(log => 
    !filter || log.step.toLowerCase().includes(filter.toLowerCase())
  )

  const handleExport = () => {
    const text = exportCoordinateTraceLogsAsText()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coordinate-trace-logs-${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = () => {
    const text = exportCoordinateTraceLogsAsText()
    navigator.clipboard.writeText(text).then(() => {
      alert('Logs copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy logs')
    })
  }

  const handleClear = () => {
    if (confirm('Clear all logs? This cannot be undone.')) {
      clearCoordinateTraceLogs()
      setLogs([])
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
          padding: '12px 20px',
          backgroundColor: '#E53935',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        📊 View Logs ({logs.length})
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 10001,
        padding: '20px',
        overflow: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '800px',
          margin: '0 auto',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📊 Coordinate Trace Logs ({logs.length})</h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ccc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter logs (e.g., 'Step 1', 'Device GPS')..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📥 Export
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📋 Copy
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear
          </button>
        </div>

        {filteredLogs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            {filter ? 'No logs match your filter' : 'No logs captured yet. Trigger an emergency to start capturing logs.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '12px',
                  backgroundColor: log.type === 'error' ? '#ffebee' : log.type === 'warn' ? '#fff3e0' : '#f5f5f5'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#E53935' }}>{log.step}</strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    backgroundColor: 'white',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


