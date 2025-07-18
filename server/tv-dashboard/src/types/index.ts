export interface Call {
  id: string
  extension: string
  agentName?: string
  callerNumber: string
  callerName?: string
  direction: 'Inbound' | 'Outbound'
  duration: number
  startTime: string
  queueTime?: number
}

export interface Ticket {
  id: string
  ticketNumber: string
  title: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  status: string
  agentName?: string
  createdAt: string
  callDuration?: number
}

export interface Stats {
  totalCallsToday: number
  averageCallDuration: number
  ticketsCreated: number
  pendingDrafts: number
}

export interface WebSocketMessage {
  type: string
  data: any
  timestamp?: string
}