import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

export interface ConsentRecord {
  id: string;
  userId: string;
  organizationId: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'third_party';
  status: 'granted' | 'denied' | 'withdrawn';
  grantedAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  ipAddress: string;
  userAgent: string;
  version: string;
  metadata: Record<string, any>;
}

export interface RetentionPolicy {
  id: string;
  organizationId: string;
  dataType: 'sessions' | 'transcripts' | 'metrics' | 'clips' | 'reports' | 'user_data';
  retentionPeriod: number; // days
  deletionStrategy: 'soft_delete' | 'hard_delete' | 'anonymize';
  autoDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  organizationId: string;
  requestType: 'right_to_be_forgotten' | 'data_export' | 'account_deletion';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  dataTypes: string[];
  reason?: string;
  metadata: Record<string, any>;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'ai_coaching',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  // Consent management
  async recordConsent(
    userId: string,
    organizationId: string,
    consentType: ConsentRecord['consentType'],
    status: ConsentRecord['status'],
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>
  ): Promise<ConsentRecord> {
    try {
      const query = `
        INSERT INTO consent_records (
          user_id, organization_id, consent_type, status, granted_at,
          ip_address, user_agent, version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        userId,
        organizationId,
        consentType,
        status,
        new Date(),
        ipAddress,
        userAgent,
        '1.0',
        metadata || {},
      ];

      const result = await this.pool.query(query, values);
      this.logger.log(`Consent recorded for user ${userId}, type: ${consentType}, status: ${status}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to record consent for user ${userId}:`, error);
      throw error;
    }
  }

  async getConsentHistory(userId: string, organizationId: string): Promise<ConsentRecord[]> {
    try {
      const query = `
        SELECT * FROM consent_records
        WHERE user_id = $1 AND organization_id = $2
        ORDER BY granted_at DESC
      `;

      const result = await this.pool.query(query, [userId, organizationId]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get consent history for user ${userId}:`, error);
      return [];
    }
  }

  async withdrawConsent(
    userId: string,
    organizationId: string,
    consentType: ConsentRecord['consentType']
  ): Promise<void> {
    try {
      const query = `
        UPDATE consent_records
        SET status = 'withdrawn', withdrawn_at = $1
        WHERE user_id = $2 AND organization_id = $3 AND consent_type = $4
        AND status = 'granted'
      `;

      await this.pool.query(query, [new Date(), userId, organizationId, consentType]);
      this.logger.log(`Consent withdrawn for user ${userId}, type: ${consentType}`);
    } catch (error) {
      this.logger.error(`Failed to withdraw consent for user ${userId}:`, error);
      throw error;
    }
  }

  async hasValidConsent(
    userId: string,
    organizationId: string,
    consentType: ConsentRecord['consentType']
  ): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) FROM consent_records
        WHERE user_id = $1 AND organization_id = $2 AND consent_type = $3
        AND status = 'granted'
        AND (expires_at IS NULL OR expires_at > $4)
        ORDER BY granted_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, organizationId, consentType, new Date()]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      this.logger.error(`Failed to check consent for user ${userId}:`, error);
      return false;
    }
  }

  // Retention policies
  async createRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetentionPolicy> {
    try {
      const query = `
        INSERT INTO retention_policies (
          organization_id, data_type, retention_period, deletion_strategy, auto_delete
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        policy.organizationId,
        policy.dataType,
        policy.retentionPeriod,
        policy.deletionStrategy,
        policy.autoDelete,
      ];

      const result = await this.pool.query(query, values);
      this.logger.log(`Retention policy created for org ${policy.organizationId}, type: ${policy.dataType}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to create retention policy:`, error);
      throw error;
    }
  }

  async getRetentionPolicies(organizationId: string): Promise<RetentionPolicy[]> {
    try {
      const query = `
        SELECT * FROM retention_policies
        WHERE organization_id = $1
        ORDER BY data_type
      `;

      const result = await this.pool.query(query, [organizationId]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get retention policies for org ${organizationId}:`, error);
      return [];
    }
  }

  async updateRetentionPolicy(
    policyId: string,
    updates: Partial<Pick<RetentionPolicy, 'retentionPeriod' | 'deletionStrategy' | 'autoDelete'>>
  ): Promise<RetentionPolicy> {
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      if (updates.retentionPeriod !== undefined) {
        setClauses.push(`retention_period = $${paramIndex++}`);
        values.push(updates.retentionPeriod);
      }

      if (updates.deletionStrategy !== undefined) {
        setClauses.push(`deletion_strategy = $${paramIndex++}`);
        values.push(updates.deletionStrategy);
      }

      if (updates.autoDelete !== undefined) {
        setClauses.push(`auto_delete = $${paramIndex++}`);
        values.push(updates.autoDelete);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      values.push(policyId);

      const query = `
        UPDATE retention_policies
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      this.logger.log(`Retention policy updated: ${policyId}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update retention policy ${policyId}:`, error);
      throw error;
    }
  }

  // Data deletion requests
  async createDeletionRequest(request: Omit<DataDeletionRequest, 'id' | 'requestedAt' | 'status'>): Promise<DataDeletionRequest> {
    try {
      const query = `
        INSERT INTO data_deletion_requests (
          user_id, organization_id, request_type, data_types, reason, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        request.userId,
        request.organizationId,
        request.requestType,
        request.dataTypes,
        request.reason,
        request.metadata || {},
      ];

      const result = await this.pool.query(query, values);
      this.logger.log(`Deletion request created for user ${request.userId}, type: ${request.requestType}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to create deletion request:`, error);
      throw error;
    }
  }

  async getDeletionRequests(userId: string, organizationId: string): Promise<DataDeletionRequest[]> {
    try {
      const query = `
        SELECT * FROM data_deletion_requests
        WHERE user_id = $1 AND organization_id = $2
        ORDER BY requested_at DESC
      `;

      const result = await this.pool.query(query, [userId, organizationId]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get deletion requests for user ${userId}:`, error);
      return [];
    }
  }

  async updateDeletionRequestStatus(
    requestId: string,
    status: DataDeletionRequest['status'],
    metadata?: Record<string, any>
  ): Promise<DataDeletionRequest> {
    try {
      const query = `
        UPDATE data_deletion_requests
        SET status = $1, completed_at = $2, metadata = $3
        WHERE id = $4
        RETURNING *
      `;

      const completedAt = status === 'completed' ? new Date() : null;
      const updatedMetadata = metadata ? { ...metadata, lastUpdated: new Date() } : { lastUpdated: new Date() };

      const result = await this.pool.query(query, [status, completedAt, updatedMetadata, requestId]);
      this.logger.log(`Deletion request status updated: ${requestId} -> ${status}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update deletion request ${requestId}:`, error);
      throw error;
    }
  }

  // Data deletion execution
  async executeDataDeletion(userId: string, organizationId: string, dataTypes: string[]): Promise<void> {
    try {
      this.logger.log(`Starting data deletion for user ${userId}, types: ${dataTypes.join(', ')}`);

      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'sessions':
            await this.deleteUserSessions(userId, organizationId);
            break;
          case 'transcripts':
            await this.deleteUserTranscripts(userId, organizationId);
            break;
          case 'metrics':
            await this.deleteUserMetrics(userId, organizationId);
            break;
          case 'clips':
            await this.deleteUserClips(userId, organizationId);
            break;
          case 'reports':
            await this.deleteUserReports(userId, organizationId);
            break;
          case 'user_data':
            await this.deleteUserData(userId, organizationId);
            break;
          default:
            this.logger.warn(`Unknown data type for deletion: ${dataType}`);
        }
      }

      this.logger.log(`Data deletion completed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to execute data deletion for user ${userId}:`, error);
      throw error;
    }
  }

  private async deleteUserSessions(userId: string, organizationId: string): Promise<void> {
    const query = `
      UPDATE sessions
      SET deleted_at = $1, deleted_by = $2
      WHERE user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  private async deleteUserTranscripts(userId: string, organizationId: string): Promise<void> {
    const query = `
      UPDATE transcripts
      SET deleted_at = $1, deleted_by = $2
      WHERE user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  private async deleteUserMetrics(userId: string, organizationId: string): Promise<void> {
    const query = `
      UPDATE metrics
      SET deleted_at = $1, deleted_by = $2
      WHERE user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  private async deleteUserClips(userId: string, organizationId: string): Promise<void> {
    const query = `
      UPDATE clips
      SET deleted_at = $1, deleted_by = $2
      WHERE user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  private async deleteUserReports(userId: string, organizationId: string): Promise<void> {
    const query = `
      UPDATE reports
      SET deleted_at = $1, deleted_by = $2
      WHERE user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  private async deleteUserData(userId: string, organizationId: string): Promise<void> {
    // Delete all user-related data
    await this.deleteUserSessions(userId, organizationId);
    await this.deleteUserTranscripts(userId, organizationId);
    await this.deleteUserMetrics(userId, organizationId);
    await this.deleteUserClips(userId, organizationId);
    await this.deleteUserReports(userId, organizationId);

    // Anonymize user record
    const query = `
      UPDATE users
      SET 
        email = 'deleted_' || id || '@deleted.com',
        first_name = 'Deleted',
        last_name = 'User',
        deleted_at = $1,
        deleted_by = $2
      WHERE id = $3 AND organization_id = $4
    `;
    await this.pool.query(query, [new Date(), 'system', userId, organizationId]);
  }

  // Audit trail
  async logAuditEvent(
    userId: string,
    organizationId: string,
    eventType: string,
    resourceType: string,
    resourceId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_log (
          user_id, organization_id, event_type, resource_type, resource_id,
          action, ip_address, user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        userId,
        organizationId,
        eventType,
        resourceType,
        resourceId,
        action,
        metadata?.ipAddress || null,
        metadata?.userAgent || null,
        metadata || {},
      ];

      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error(`Failed to log audit event:`, error);
    }
  }

  async getAuditTrail(
    userId?: string,
    organizationId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      let query = 'SELECT * FROM audit_log WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex++}`;
        values.push(userId);
      }

      if (organizationId) {
        query += ` AND organization_id = $${paramIndex++}`;
        values.push(organizationId);
      }

      if (startDate) {
        query += ` AND created_at >= $${paramIndex++}`;
        values.push(startDate);
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        values.push(endDate);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
      values.push(limit);

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get audit trail:`, error);
      return [];
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const query = 'SELECT 1;';
      await this.pool.query(query);
      return true;
    } catch (error) {
      this.logger.error('Consent service health check failed:', error);
      return false;
    }
  }

  onModuleDestroy() {
    this.pool.end();
  }
}
