export interface Call3CX {
    id: string;
    callId: string;
    extension: string;
    agentEmail: string;
    caller: string;
    callee: string;
    direction: 'inbound' | 'outbound';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'ringing' | 'active' | 'completed' | 'missed';
}
export interface Transcription {
    callId: string;
    text: string;
    segments: TranscriptionSegment[];
    language: string;
    startTime: Date;
    endTime: Date;
    confidence: number;
}
export interface TranscriptionSegment {
    id: string;
    start: number;
    end: number;
    text: string;
    speaker: 'agent' | 'caller' | 'unknown';
    confidence: number;
    timestamp: Date;
}
export interface RealtimeTranscription {
    callId: string;
    segment: TranscriptionSegment;
    isFinal: boolean;
}
export interface CallAnalysis {
    callId: string;
    summary: string;
    mainIssue: string;
    customerSentiment: 'positive' | 'neutral' | 'negative';
    actionItems: string[];
    category: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    suggestedTitle: string;
    keywords: string[];
    confidence: number;
}
export interface NinjaTicket {
    id?: number;
    boardId: number;
    contactId?: number;
    assignedUserId?: number;
    statusId: number;
    priorityId: number;
    title: string;
    description: string;
    customFields?: Record<string, any>;
}
export interface Agent {
    id: string;
    email: string;
    extension: string;
    name: string;
    status: 'online' | 'busy' | 'offline';
    currentCall?: Call3CX;
}
export interface AudioChunk {
    callId: string;
    agentId: string;
    data: Buffer;
    timestamp: number;
    sequence: number;
}
export interface SystemHealth {
    service: string;
    status: 'healthy' | 'degraded' | 'down';
    cpu: number;
    memory: number;
    uptime: number;
    activeConnections: number;
    transcriptionQueue: number;
    timestamp: Date;
}
export interface WSEvents {
    'agent:connect': {
        agentId: string;
        email: string;
        extension: string;
    };
    'agent:disconnect': {
        agentId: string;
    };
    'call:start': {
        call: Call3CX;
    };
    'call:end': {
        callId: string;
    };
    'audio:chunk': AudioChunk;
    'ticket:create': {
        ticket: NinjaTicket;
        callId: string;
    };
    'ticket:update': {
        ticketId: number;
        updates: Partial<NinjaTicket>;
    };
    'transcription:partial': RealtimeTranscription;
    'transcription:final': Transcription;
    'analysis:complete': CallAnalysis;
    'agent:status': {
        agents: Agent[];
    };
    'call:update': Call3CX;
    'system:health': SystemHealth;
    'notification': {
        type: string;
        message: string;
        data?: any;
    };
}
export interface ServerConfig {
    port: number;
    redis: {
        url: string;
    };
    whisper: {
        model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
        language: string;
        device: 'cpu' | 'cuda';
    };
    ninja: {
        apiUrl: string;
        clientId: string;
        clientSecret: string;
        refreshToken: string;
    };
    security: {
        apiKey: string;
        corsOrigins: string[];
    };
}
export interface AgentConfig {
    agent: {
        id: string;
        email: string;
        extension: string;
        name: string;
    };
    server: {
        url: string;
        apiKey: string;
    };
    audio: {
        device: string;
        sampleRate: number;
        channels: number;
        chunkSize: number;
    };
    ui: {
        autoPopup: boolean;
        theme: 'light' | 'dark';
        position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    };
}
//# sourceMappingURL=index.d.ts.map