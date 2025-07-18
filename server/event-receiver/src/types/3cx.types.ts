export interface CallEndWebhookPayload {
  callId: string;
  sessionId: string;
  partyNumber: string;
  otherPartyNumber: string;
  direction: 'Inbound' | 'Outbound';
  startTime: string;
  endTime: string;
  duration: number;
  reasonTerminated: string;
  recordingUrl?: string;
  extension?: string;
  agentName?: string;
  queueName?: string;
  customData?: Record<string, any>;
}

export interface WebSocketCallEvent {
  eventType: 'CallEstablished' | 'CallEnded' | 'CallUpdated';
  callId: string;
  sessionId: string;
  timestamp: string;
  data: {
    from: string;
    to: string;
    direction: 'Inbound' | 'Outbound';
    extension?: string;
    agentName?: string;
    status: string;
    duration?: number;
    recordingAvailable?: boolean;
  };
}

export interface Recording {
  url: string;
  size?: number;
  duration?: number;
  format: string;
}

export interface AgentInfo {
  extension: string;
  name: string;
  email?: string;
  department?: string;
}