import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Call, CallStatus } from '../types/database.types';

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

  static async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async createCall(callData: Partial<Call>): Promise<Call> {
    const query = `
      INSERT INTO integration.calls (
        call_id, extension, agent_name, caller_number, caller_name,
        duration, start_time, end_time, recording_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      callData.callId,
      callData.extension,
      callData.agentName,
      callData.callerNumber,
      callData.callerName,
      callData.duration,
      callData.startTime,
      callData.endTime,
      callData.recordingUrl,
      callData.status || CallStatus.RECEIVED
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  static async updateCall(
    callId: string,
    updates: Partial<Call>
  ): Promise<Call | null> {
    const allowedFields = [
      'status',
      'local_recording_path',
      'transcript',
      'error_message'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbField)) {
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(callId);
    const query = `
      UPDATE integration.calls
      SET ${updateFields.join(', ')}
      WHERE call_id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  static async getCall(callId: string): Promise<Call | null> {
    const query = 'SELECT * FROM integration.calls WHERE call_id = $1';
    const result = await this.pool.query(query, [callId]);
    return result.rows[0] || null;
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