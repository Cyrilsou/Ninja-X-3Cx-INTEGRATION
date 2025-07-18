import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DraftTicketData } from '../types/draft.types';

export interface Agent {
  id: number;
  extension: string;
  agent_name?: string;
  jwt_token_hash: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  last_activity: Date;
  expires_at: Date;
}

export class DatabaseService {
  private static pool: Pool;

  static async initialize(): Promise<void> {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
    } catch (error) {
      logger.error('Database connection failed', error);
      throw error;
    }
  }

  static async close(): Promise<void> {
    await this.pool.end();
  }

  static async getCall(callId: string): Promise<any> {
    const query = 'SELECT * FROM integration.calls WHERE call_id = $1';
    const result = await this.pool.query(query, [callId]);
    return result.rows[0] || null;
  }

  static async createDraftTicket(draft: DraftTicketData): Promise<any> {
    const query = `
      INSERT INTO integration.draft_tickets (
        call_id, draft_data, agent_extension, status, expires_at
      ) VALUES (
        (SELECT id FROM integration.calls WHERE call_id = $1),
        $2, $3, $4, $5
      )
      RETURNING *
    `;

    const values = [
      draft.callId,
      JSON.stringify(draft),
      draft.agentInfo.extension,
      'PENDING_CONFIRMATION',
      draft.expiresAt
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async updateDraftTicket(
    draftId: string,
    status: string,
    draftData?: any
  ): Promise<any> {
    let query: string;
    let values: any[];

    if (draftData) {
      query = `
        UPDATE integration.draft_tickets
        SET status = $1, draft_data = $2
        WHERE id = $3
        RETURNING *
      `;
      values = [status, JSON.stringify(draftData), draftId];
    } else {
      query = `
        UPDATE integration.draft_tickets
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      values = [status, draftId];
    }

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async getDraftTicket(draftId: string): Promise<any> {
    const query = 'SELECT * FROM integration.draft_tickets WHERE id = $1';
    const result = await this.pool.query(query, [draftId]);
    return result.rows[0];
  }

  static async createTicket(
    draftId: string,
    callId: string,
    ninjaoneTicketId: string,
    ninjaoneTicketNumber: string,
    ticketData: any,
    createdByExtension: string
  ): Promise<any> {
    const query = `
      INSERT INTO integration.tickets (
        draft_id, call_id, ninjaone_ticket_id, ninjaone_ticket_number,
        ticket_data, created_by_extension
      ) VALUES (
        $1,
        (SELECT id FROM integration.calls WHERE call_id = $2),
        $3, $4, $5, $6
      )
      RETURNING *
    `;

    const values = [
      draftId,
      callId,
      ninjaoneTicketId,
      ninjaoneTicketNumber,
      JSON.stringify(ticketData),
      createdByExtension
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async getAgentByExtension(extension: string): Promise<any> {
    const query = `
      SELECT * FROM integration.agent_sessions
      WHERE extension = $1
      AND expires_at > NOW()
      ORDER BY last_activity DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [extension]);
    return result.rows[0];
  }

  static async query(text: string, params?: any[]): Promise<any> {
    const result = await this.pool.query(text, params);
    return result;
  }

  static async updateCall(callId: string, updates: any): Promise<any> {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const query = `UPDATE integration.calls SET ${fields} WHERE call_id = $1 RETURNING *`;
    const values = [callId, ...Object.values(updates)];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async updateAgentActivity(sessionId: number): Promise<void> {
    const query = `UPDATE integration.agent_sessions SET last_activity = NOW() WHERE id = $1`;
    await this.pool.query(query, [sessionId]);
  }

  static async getActiveConnections(): Promise<any[]> {
    const query = `
      SELECT a.*, COUNT(c.id) as active_calls
      FROM integration.agent_sessions a
      LEFT JOIN integration.calls c ON c.extension = a.extension AND c.status = 'active'
      WHERE a.expires_at > NOW()
      GROUP BY a.id
      ORDER BY a.last_activity DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  static async createAgentSession(sessionData: any): Promise<any> {
    const query = `
      INSERT INTO integration.agent_sessions (
        extension, agent_name, jwt_token_hash, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      sessionData.extension,
      sessionData.agentName,
      sessionData.jwtTokenHash,
      sessionData.ipAddress,
      sessionData.userAgent,
      sessionData.expiresAt
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async updateAgentActivity(sessionId: string): Promise<void> {
    const query = `
      UPDATE integration.agent_sessions
      SET last_activity = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [sessionId]);
  }

  static async saveWebSocketConnection(
    connectionType: string,
    connectionId: string,
    extension?: string
  ): Promise<void> {
    const query = `
      INSERT INTO integration.active_connections (
        connection_type, connection_id, extension
      ) VALUES ($1, $2, $3)
      ON CONFLICT (connection_id) DO UPDATE
      SET last_ping = NOW()
    `;

    await this.pool.query(query, [connectionType, connectionId, extension]);
  }

  static async removeWebSocketConnection(connectionId: string): Promise<void> {
    const query = 'DELETE FROM integration.active_connections WHERE connection_id = $1';
    await this.pool.query(query, [connectionId]);
  }

  static async getActiveConnections(type?: string): Promise<any[]> {
    let query = 'SELECT * FROM integration.active_connections';
    const values: any[] = [];

    if (type) {
      query += ' WHERE connection_type = $1';
      values.push(type);
    }

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  static async logAuditEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    actorExtension?: string,
    actorIp?: string,
    eventData?: any
  ): Promise<void> {
    const query = `
      INSERT INTO integration.audit_log (
        event_type, entity_type, entity_id, actor_extension, actor_ip, event_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.pool.query(query, [
      eventType,
      entityType,
      entityId,
      actorExtension,
      actorIp,
      eventData ? JSON.stringify(eventData) : null
    ]);
  }
}