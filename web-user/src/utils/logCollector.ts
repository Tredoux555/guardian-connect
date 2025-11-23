// Log Collector - Captures all coordinate trace logs for easy debugging

interface LogEntry {
  timestamp: string
  step: string
  data: any
  type: 'log' | 'warn' | 'error'
}

const MAX_LOGS = 100 // Keep last 100 logs
const STORAGE_KEY = 'coordinate_trace_logs'

class LogCollector {
  private logs: LogEntry[] = []
  private originalLog: typeof console.log
  private originalWarn: typeof console.warn
  private originalError: typeof console.error

  constructor() {
    // Store original console methods BEFORE overriding
    this.originalLog = console.log.bind(console)
    this.originalWarn = console.warn.bind(console)
    this.originalError = console.error.bind(console)
    
    // Load existing logs from localStorage
    this.loadLogs()
    
    // Override console methods to capture coordinate trace logs
    this.setupConsoleCapture()
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Failed to load logs from localStorage', e)
    }
  }

  private saveLogs() {
    try {
      // Keep only last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
    } catch (e) {
      // Use originalWarn to avoid recursion
      this.originalWarn('Failed to save logs to localStorage', e)
    }
  }

  private setupConsoleCapture() {
    console.log = (...args: any[]) => {
      this.originalLog.apply(console, args)
      this.captureLog('log', args)
    }

    console.warn = (...args: any[]) => {
      this.originalWarn.apply(console, args)
      this.captureLog('warn', args)
    }

    console.error = (...args: any[]) => {
      this.originalError.apply(console, args)
      this.captureLog('error', args)
    }
  }

  private captureLog(type: 'log' | 'warn' | 'error', args: any[]) {
    // Only capture coordinate trace logs
    const message = args[0]?.toString() || ''
    
    // IMPORTANT: Skip log collector's own messages to prevent recursion
    if (message.includes('📝 [LOG COLLECTOR]') || message.includes('[LOG COLLECTOR]')) {
      return // Don't capture our own log messages
    }
    
    if (message.includes('[COORDINATE TRACE]') || 
        message.includes('Device GPS') ||
        message.includes('Sending to backend') ||
        message.includes('Backend response') ||
        message.includes('Backend received') ||
        message.includes('Backend parsed') ||
        message.includes('Backend stored') ||
        message.includes('Backend retrieved') ||
        message.includes('Locations received') ||
        message.includes('Parsed coordinates') ||
        message.includes('Sender location') ||
        message.includes('getGoogleMapsUrl') ||
        message.includes('Formatted coordinates') ||
        message.includes('Final Google Maps URL') ||
        message.includes('Map Marker Coordinates') ||
        message.includes('Google Maps URL Coordinates')) {
      
      const step = this.extractStep(message)
      this.addLog({
        timestamp: new Date().toISOString(),
        step,
        data: args.length > 1 ? args[1] : args[0],
        type
      })
    }
  }

  private extractStep(message: string): string {
    // Extract step number and description
    const stepMatch = message.match(/Step (\d+[a-z]?)\s*-?\s*(.+?)(?:\s*:|$)/i)
    if (stepMatch) {
      return `Step ${stepMatch[1]}: ${stepMatch[2].trim()}`
    }
    
    // Fallback to message itself
    return message.substring(0, 100)
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry)
    this.saveLogs()
    
    // Use originalLog to avoid recursion (don't use overridden console.log)
    this.originalLog(`📝 [LOG COLLECTOR] Captured: ${entry.step}`)
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs]
  }

  getLogsByStep(stepPattern: string): LogEntry[] {
    return this.logs.filter(log => 
      log.step.toLowerCase().includes(stepPattern.toLowerCase())
    )
  }

  clearLogs() {
    this.logs = []
    this.saveLogs()
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  exportLogsAsText(): string {
    let text = '=== COORDINATE TRACE LOGS ===\n\n'
    this.logs.forEach((log, index) => {
      text += `[${index + 1}] ${log.timestamp}\n`
      text += `${log.step}\n`
      text += `Type: ${log.type}\n`
      text += `Data: ${JSON.stringify(log.data, null, 2)}\n`
      text += '\n---\n\n'
    })
    return text
  }
}

// Create singleton instance
export const logCollector = new LogCollector()

// Export function to get logs (for React components)
export const getCoordinateTraceLogs = () => logCollector.getAllLogs()
export const clearCoordinateTraceLogs = () => logCollector.clearLogs()
export const exportCoordinateTraceLogs = () => logCollector.exportLogs()
export const exportCoordinateTraceLogsAsText = () => logCollector.exportLogsAsText()


