import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MinioService } from './minio.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(private readonly minioService: MinioService) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  // ==================== DOCUMENT CRUD ====================

  async uploadDocument(patientId: string, documentData: any, userId: string, tenantDb: DataSource, fileBuffer?: Buffer) {
    this.ensureTenantDb(tenantDb);

    let filePath = documentData.filePath;
    
    // Upload to MinIO if file buffer is provided
    if (fileBuffer) {
      const tenantId = 'bulawayo-general'; // TODO: Get from context
      const fileKey = this.minioService.generateFileKey(tenantId, patientId, documentData.documentName);
      await this.minioService.uploadFile(fileKey, fileBuffer, documentData.mimeType);
      filePath = fileKey;
    }

    const result = await tenantDb.query(
      `INSERT INTO patient_documents (
        patient_id, document_type, document_name, file_path, file_url,
        file_size, mime_type, description, uploaded_by, uploaded_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        documentData.documentType,
        documentData.documentName,
        filePath,
        documentData.fileUrl || null,
        documentData.fileSize || null,
        documentData.mimeType || null,
        documentData.description || null,
        userId,
      ],
    );

    const document = result[0];

    // Create initial version
    await this.createVersion(document.id, 1, { ...documentData, filePath }, userId, tenantDb);

    // Log access
    await this.logAccess(document.id, userId, 'view', null, null, tenantDb);

    return document;
  }

  async getDocuments(patientId: string, filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `
      SELECT d.*, 
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name,
        (SELECT COUNT(*) FROM document_versions WHERE document_id = d.id) as version_count,
        (SELECT COUNT(*) FROM document_signatures WHERE document_id = d.id) as signature_count,
        (SELECT array_agg(tag_name) FROM document_tags WHERE document_id = d.id) as tags
      FROM patient_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (filters.documentType) {
      query += ` AND d.document_type = $${paramIndex++}`;
      params.push(filters.documentType);
    }

    if (filters.startDate) {
      query += ` AND d.uploaded_at >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND d.uploaded_at <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.tag) {
      query += ` AND EXISTS (SELECT 1 FROM document_tags WHERE document_id = d.id AND tag_name = $${paramIndex++})`;
      params.push(filters.tag);
    }

    query += ` ORDER BY d.uploaded_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    return tenantDb.query(query, params);
  }

  async getDocumentById(documentId: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT d.*, 
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name,
        p.first_name as patient_first_name, p.last_name as patient_last_name,
        (SELECT array_agg(tag_name) FROM document_tags WHERE document_id = d.id) as tags
      FROM patient_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN patients p ON d.patient_id = p.id
      WHERE d.id = $1`,
      [documentId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Document not found');
    }

    // Log access
    await this.logAccess(documentId, userId, 'view', null, null, tenantDb);

    return result[0];
  }

  async viewDocument(documentId: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const document = await this.getDocumentById(documentId, userId, tenantDb);
    
    if (!document.file_path) {
      throw new NotFoundException('Document file not found');
    }

    // Generate signed URL for secure access
    const signedUrl = await this.minioService.getSignedUrl(document.file_path, 3600);
    
    return {
      url: signedUrl,
      mimeType: document.mime_type,
      fileName: document.document_name
    };
  }

  async updateDocument(documentId: string, updates: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      documentType: 'document_type',
      documentName: 'document_name',
      mimeType: 'mime_type',
    };

    for (const [key, dbColumn] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updateFields.length === 0) {
      return this.getDocumentById(documentId, userId, tenantDb);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(documentId);

    await tenantDb.query(
      `UPDATE patient_documents SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );

    // Log access
    await this.logAccess(documentId, userId, 'edit', null, null, tenantDb);

    return this.getDocumentById(documentId, userId, tenantDb);
  }

  async deleteDocument(documentId: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Log before deleting
    await this.logAccess(documentId, userId, 'delete', null, null, tenantDb);

    const result = await tenantDb.query(
      `DELETE FROM patient_documents WHERE id = $1 RETURNING *`,
      [documentId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Document not found');
    }

    return { success: true, message: 'Document deleted' };
  }

  async searchDocuments(query: string, filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let sql = `
      SELECT d.*, 
        u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name,
        p.first_name as patient_first_name, p.last_name as patient_last_name
      FROM patient_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN patients p ON d.patient_id = p.id
      WHERE (
        LOWER(d.document_name) LIKE LOWER($1) OR
        LOWER(d.description) LIKE LOWER($1)
      )
    `;

    const params: any[] = [`%${query}%`];
    let paramIndex = 2;

    if (filters.patientId) {
      sql += ` AND d.patient_id = $${paramIndex++}`;
      params.push(filters.patientId);
    }

    if (filters.documentType) {
      sql += ` AND d.document_type = $${paramIndex++}`;
      params.push(filters.documentType);
    }

    sql += ` ORDER BY d.uploaded_at DESC LIMIT 50`;

    return tenantDb.query(sql, params);
  }

  // ==================== VERSIONING ====================

  private async createVersion(documentId: string, versionNumber: number, fileData: any, userId: string, tenantDb: DataSource) {
    await tenantDb.query(
      `INSERT INTO document_versions (
        document_id, version_number, file_path, file_url, file_size,
        mime_type, change_summary, uploaded_by, uploaded_at, is_current, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true, NOW())`,
      [
        documentId,
        versionNumber,
        fileData.filePath || null,
        fileData.fileUrl || null,
        fileData.fileSize || null,
        fileData.mimeType || null,
        fileData.changeSummary || 'Initial version',
        userId,
      ],
    );
  }

  async getDocumentVersions(documentId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT v.*, u.first_name, u.last_name
       FROM document_versions v
       LEFT JOIN users u ON v.uploaded_by = u.id
       WHERE v.document_id = $1
       ORDER BY v.version_number DESC`,
      [documentId],
    );
  }

  async uploadNewVersion(documentId: string, fileData: any, changeSummary: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get current version number
    const versions = await tenantDb.query(
      `SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = $1`,
      [documentId],
    );

    const newVersionNumber = (versions[0].max_version || 0) + 1;

    // Mark all previous versions as not current
    await tenantDb.query(
      `UPDATE document_versions SET is_current = false WHERE document_id = $1`,
      [documentId],
    );

    // Create new version
    await this.createVersion(documentId, newVersionNumber, { ...fileData, changeSummary }, userId, tenantDb);

    // Update main document record
    await tenantDb.query(
      `UPDATE patient_documents 
       SET file_path = $1, file_url = $2, file_size = $3, updated_at = NOW()
       WHERE id = $4`,
      [fileData.filePath, fileData.fileUrl, fileData.fileSize, documentId],
    );

    return this.getDocumentById(documentId, userId, tenantDb);
  }

  async restoreVersion(documentId: string, versionId: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const version = await tenantDb.query(
      `SELECT * FROM document_versions WHERE id = $1 AND document_id = $2`,
      [versionId, documentId],
    );

    if (version.length === 0) {
      throw new NotFoundException('Version not found');
    }

    // Mark all as not current
    await tenantDb.query(
      `UPDATE document_versions SET is_current = false WHERE document_id = $1`,
      [documentId],
    );

    // Mark selected version as current
    await tenantDb.query(
      `UPDATE document_versions SET is_current = true WHERE id = $1`,
      [versionId],
    );

    // Update main document
    await tenantDb.query(
      `UPDATE patient_documents 
       SET file_path = $1, file_url = $2, file_size = $3, updated_at = NOW()
       WHERE id = $4`,
      [version[0].file_path, version[0].file_url, version[0].file_size, documentId],
    );

    return this.getDocumentById(documentId, userId, tenantDb);
  }

  // ==================== SHARING ====================

  async shareDocument(documentId: string, shareData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO document_sharing (
        document_id, shared_with_user_id, shared_with_role, permission_level,
        shared_by, shared_at, expires_at, is_active, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, true, NOW())
      RETURNING *`,
      [
        documentId,
        shareData.sharedWithUserId || null,
        shareData.sharedWithRole || null,
        shareData.permissionLevel || 'view',
        userId,
        shareData.expiresAt || null,
      ],
    );

    // Log access
    await this.logAccess(documentId, userId, 'share', null, null, tenantDb);

    return result[0];
  }

  async getSharedDocuments(userId: string, role: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const results = await tenantDb.query(
      `SELECT 
        ds.id,
        ds.document_id,
        ds.permission_level,
        ds.shared_at,
        ds.expires_at,
        ds.shared_with_role,
        d.id as doc_id,
        d.document_name as file_name,
        d.document_type,
        d.description,
        d.file_size,
        d.uploaded_at,
        d.uploaded_by,
        d.patient_id,
        u.id as shared_by_id,
        u.first_name as shared_by_first_name,
        u.last_name as shared_by_last_name,
        u.role as shared_by_role,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_number,
        (SELECT json_agg(json_build_object('tag_name', tag_name))
         FROM document_tags dt 
         WHERE dt.document_id = d.id) as tags
       FROM document_sharing ds
       JOIN patient_documents d ON ds.document_id = d.id
       LEFT JOIN users u ON ds.shared_by = u.id
       LEFT JOIN patients p ON d.patient_id = p.id
       WHERE ds.is_active = true
         AND (ds.shared_with_user_id = $1 OR ds.shared_with_role = $2)
         AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
       ORDER BY ds.shared_at DESC`,
      [userId, role],
    );

    // Transform results to match frontend expected format
    return results.map((row: any) => ({
      id: row.id,
      document_id: row.document_id,
      document: {
        id: row.doc_id,
        file_name: row.file_name,
        document_type: row.document_type,
        description: row.description,
        file_size: row.file_size,
        uploaded_at: row.uploaded_at,
        uploaded_by: row.uploaded_by,
        patient_id: row.patient_id,
        tags: row.tags || [],
      },
      shared_by: {
        id: row.shared_by_id,
        first_name: row.shared_by_first_name,
        last_name: row.shared_by_last_name,
        role: row.shared_by_role,
      },
      shared_at: row.shared_at,
      permission_level: row.permission_level,
      expires_at: row.expires_at,
      patient: row.patient_first_name ? {
        first_name: row.patient_first_name,
        last_name: row.patient_last_name,
        patient_number: row.patient_number,
      } : null,
    }));
  }

  async revokeSharing(sharingId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `UPDATE document_sharing SET is_active = false WHERE id = $1`,
      [sharingId],
    );

    return { success: true, message: 'Sharing revoked' };
  }

  // ==================== SIGNATURES ====================

  async signDocument(documentId: string, signatureData: any, userId: string, ipAddress: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO document_signatures (
        document_id, signer_id, signature_type, signature_data, signed_at, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, NOW())
      RETURNING *`,
      [
        documentId,
        userId,
        signatureData.signatureType || 'electronic',
        signatureData.signatureData,
        ipAddress,
      ],
    );

    // Log access
    await this.logAccess(documentId, userId, 'sign', ipAddress, null, tenantDb);

    return result[0];
  }

  async getDocumentSignatures(documentId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT s.*, u.first_name, u.last_name, u.role
       FROM document_signatures s
       LEFT JOIN users u ON s.signer_id = u.id
       WHERE s.document_id = $1
       ORDER BY s.signed_at DESC`,
      [documentId],
    );
  }

  // ==================== TAGS ====================

  async addTag(documentId: string, tagName: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    try {
      await tenantDb.query(
        `INSERT INTO document_tags (document_id, tag_name, created_by, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [documentId, tagName.toLowerCase().trim(), userId],
      );
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation - tag already exists
        return { success: true, message: 'Tag already exists' };
      }
      throw error;
    }

    return { success: true, message: 'Tag added' };
  }

  async removeTag(documentId: string, tagName: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `DELETE FROM document_tags WHERE document_id = $1 AND tag_name = $2`,
      [documentId, tagName.toLowerCase().trim()],
    );

    return { success: true, message: 'Tag removed' };
  }

  async getAllTags(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT tag_name, COUNT(*) as usage_count
       FROM document_tags
       GROUP BY tag_name
       ORDER BY usage_count DESC, tag_name ASC
       LIMIT 50`,
    );

    return result.map((r: any) => ({ tag: r.tag_name, count: parseInt(r.usage_count) }));
  }

  // ==================== ACCESS LOGGING ====================

  private async logAccess(
    documentId: string,
    userId: string,
    accessType: string,
    ipAddress: string | null,
    userAgent: string | null,
    tenantDb: DataSource,
  ) {
    await tenantDb.query(
      `INSERT INTO document_access_log (document_id, accessed_by, access_type, ip_address, user_agent, accessed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [documentId, userId, accessType, ipAddress, userAgent],
    );
  }

  async getDocumentAccessLog(documentId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT l.*, u.first_name, u.last_name, u.role
       FROM document_access_log l
       LEFT JOIN users u ON l.accessed_by = u.id
       WHERE l.document_id = $1
       ORDER BY l.accessed_at DESC
       LIMIT 100`,
      [documentId],
    );
  }

  // ==================== ANALYTICS ====================

  async getDocumentStats(patientId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const stats = await tenantDb.query(
      `SELECT 
        COUNT(*) as total_documents,
        COUNT(DISTINCT document_type) as document_types,
        SUM(file_size) as total_size,
        COUNT(*) FILTER (WHERE uploaded_at >= NOW() - INTERVAL '30 days') as recent_uploads
       FROM patient_documents
       WHERE patient_id = $1`,
      [patientId],
    );

    const byType = await tenantDb.query(
      `SELECT document_type, COUNT(*) as count
       FROM patient_documents
       WHERE patient_id = $1
       GROUP BY document_type
       ORDER BY count DESC`,
      [patientId],
    );

    return {
      summary: stats[0],
      byType,
    };
  }
}

