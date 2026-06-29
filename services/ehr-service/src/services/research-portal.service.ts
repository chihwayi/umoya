import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ResearchDeidentificationService } from './research-deidentification.service';

export interface ResearchQueryDto {
  name: string;
  description?: string;
  ethics_reference: string;
  institution: string;
  principal_investigator: string;
  permitted_fields: string[];
  cohort_definition: {
    conditions?: string[];
    age_bands?: string[];
    sex?: string;
    period_start?: string;
    period_end?: string;
    hiv_status?: string;
    encounter_type?: string;
    min_records?: number;
  };
}

export interface IssueTokenDto {
  query_id: string;
  researcher_email: string;
  valid_hours?: number;
  max_uses?: number;
  ethics_ref?: string;
}

export interface ResearchTokenContext {
  queryId: string;
  tenantId: string;
  expiresAt: Date;
  usesRemaining: number;
}

@Injectable()
export class ResearchPortalService {
  constructor(private readonly deid: ResearchDeidentificationService) {}

  async createQuery(
    db: any,
    dto: ResearchQueryDto,
    requestedBy: string,
  ): Promise<{ query_id: string }> {
    if (!dto.ethics_reference) {
      throw new BadRequestException('ethics_reference is required');
    }
    const [row] = await db.query(
      `INSERT INTO research_queries
         (name, description, ethics_reference, institution, principal_investigator,
          permitted_fields, cohort_definition, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING id`,
      [
        dto.name,
        dto.description ?? null,
        dto.ethics_reference,
        dto.institution,
        dto.principal_investigator,
        JSON.stringify(dto.permitted_fields),
        JSON.stringify(dto.cohort_definition),
        requestedBy,
      ],
    );
    return { query_id: row.id };
  }

  async issueToken(db: any, dto: IssueTokenDto): Promise<{ token: string; expires_at: string }> {
    const validHours = dto.valid_hours ?? 72;
    const maxUses = dto.max_uses ?? 3;
    const token = 'rpt_' + randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + validHours * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO research_portal_tokens
         (token, query_id, researcher_email, expires_at, max_uses, uses_remaining, ethics_ref)
       VALUES ($1,$2,$3,$4,$5,$5,$6)`,
      [token, dto.query_id, dto.researcher_email, expiresAt, maxUses, dto.ethics_ref ?? null],
    );
    return { token, expires_at: expiresAt.toISOString() };
  }

  async validateToken(db: any, token: string): Promise<ResearchTokenContext> {
    const [row] = await db.query(
      `SELECT t.id, t.query_id, t.expires_at, t.uses_remaining, q.tenant_id
         FROM research_portal_tokens t
         JOIN research_queries q ON q.id = t.query_id
        WHERE t.token = $1`,
      [token],
    );
    if (!row) throw new UnauthorizedException('Invalid research token');
    if (new Date(row.expires_at) < new Date()) throw new UnauthorizedException('Research token has expired');
    if (row.uses_remaining <= 0) throw new UnauthorizedException('Research token has no uses remaining');
    return {
      queryId: row.query_id,
      tenantId: row.tenant_id,
      expiresAt: new Date(row.expires_at),
      usesRemaining: row.uses_remaining,
    };
  }

  async executeQuery(
    db: any,
    queryId: string,
    token: string,
  ): Promise<{ records: any[]; cohort_summary: any; query: any }> {
    const ctx = await this.validateToken(db, token);
    if (ctx.queryId !== queryId) throw new UnauthorizedException('Token does not match query');

    const [query] = await db.query(
      `SELECT * FROM research_queries WHERE id = $1`,
      [queryId],
    );
    if (!query) throw new BadRequestException('Research query not found');

    const def = typeof query.cohort_definition === 'string'
      ? JSON.parse(query.cohort_definition)
      : query.cohort_definition;

    const permitted = typeof query.permitted_fields === 'string'
      ? JSON.parse(query.permitted_fields)
      : query.permitted_fields;

    const rows = await this.buildAndRunCohortQuery(db, def);

    const minRecords = def.min_records ?? 5;
    if (rows.length < minRecords) {
      return {
        records: [],
        cohort_summary: { suppressed: true, reason: 're-identification risk: cohort below minimum threshold' },
        query: { name: query.name, ethics_reference: query.ethics_reference },
      };
    }

    const deidentified = this.deid.deidentifyBatch(
      rows.map(r => this.filterToPermittedFields(r, permitted)),
    );

    await this.logAccess(db, queryId, token, deidentified.length, 'json');
    await this.decrementToken(db, token);

    return {
      records: deidentified,
      cohort_summary: {
        total_records: deidentified.length,
        period_start: def.period_start,
        period_end: def.period_end,
        suppressed: false,
      },
      query: {
        name: query.name,
        ethics_reference: query.ethics_reference,
        institution: query.institution,
        principal_investigator: query.principal_investigator,
        permitted_fields: permitted,
      },
    };
  }

  exportToCsv(records: any[]): Buffer {
    if (!records.length) return Buffer.from('');
    const headers = Object.keys(records[0]);
    const rows = records.map(r =>
      headers.map(h => {
        const v = r[h];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(','),
    );
    return Buffer.from([headers.join(','), ...rows].join('\n'), 'utf8');
  }

  async logAccess(db: any, queryId: string, token: string, recordCount: number, exportFormat: string): Promise<void> {
    await db.query(
      `INSERT INTO research_access_log (query_id, token_used, record_count, export_format)
       VALUES ($1,$2,$3,$4)`,
      [queryId, token, recordCount, exportFormat],
    );
  }

  async getAudit(db: any): Promise<any[]> {
    return db.query(
      `SELECT
         l.accessed_at,
         q.name    AS query_name,
         q.ethics_reference,
         q.institution,
         t.researcher_email,
         l.token_used,
         l.record_count,
         l.export_format
       FROM research_access_log l
       JOIN research_queries q  ON q.id = l.query_id
       JOIN research_portal_tokens t ON t.token = l.token_used
       ORDER BY l.accessed_at DESC
       LIMIT 200`,
    );
  }

  async listQueries(db: any): Promise<any[]> {
    return db.query(
      `SELECT
         q.*,
         COUNT(t.id)                                        AS tokens_issued,
         COUNT(t.id) FILTER (WHERE t.expires_at > now())   AS tokens_active,
         COUNT(t.id) FILTER (WHERE t.expires_at <= now())  AS tokens_expired
       FROM research_queries q
       LEFT JOIN research_portal_tokens t ON t.query_id = q.id
       WHERE q.status = 'active'
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
    );
  }

  async getDataDictionary(db: any, queryId: string, token: string): Promise<any> {
    await this.validateToken(db, token);
    const [query] = await db.query(
      `SELECT permitted_fields FROM research_queries WHERE id = $1`,
      [queryId],
    );
    if (!query) throw new BadRequestException('Research query not found');
    const permitted = typeof query.permitted_fields === 'string'
      ? JSON.parse(query.permitted_fields)
      : query.permitted_fields;

    const dictionary: Record<string, any>[] = [
      { name: 'pseudo_id', type: 'string', description: 'Consistent anonymised patient identifier (SHA-256 hash of patient_id + salt)' },
      { name: 'age_band', type: 'string', values: ['<5','5-14','15-24','25-34','35-49','50-64','65+'], description: 'Computed age band (exact DOB suppressed)' },
      { name: 'sex', type: 'string', values: ['M','F'], description: 'Biological sex' },
      { name: 'district', type: 'string', description: 'District level only — facility identity suppressed' },
      { name: 'province', type: 'string', description: 'Province' },
      { name: 'encounter_date', type: 'date (shifted)', description: 'Shifted by consistent random offset (1–365 days per patient); temporal intervals preserved' },
      { name: 'icd10_codes', type: 'string[]', description: 'ICD-10 diagnosis codes at encounter' },
      { name: 'lab_results', type: 'object', description: 'Lab test results (where ethics-permitted)' },
      { name: 'medications', type: 'object', description: 'Medication records (where ethics-permitted)' },
      { name: 'vital_signs', type: 'object', description: 'Vital sign observations (where ethics-permitted)' },
    ].filter(f => permitted.includes(f.name) || ['pseudo_id', 'age_band', 'sex', 'district', 'province'].includes(f.name));

    return { fields: dictionary, de_identification_standard: 'HIPAA Safe Harbor (18 identifiers removed)', cohort_query_id: queryId };
  }

  private async buildAndRunCohortQuery(db: any, def: any): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (def.period_start) {
      conditions.push(`e.encounter_date >= $${idx++}`);
      params.push(def.period_start);
    }
    if (def.period_end) {
      conditions.push(`e.encounter_date <= $${idx++}`);
      params.push(def.period_end);
    }
    if (def.sex) {
      conditions.push(`p.sex = $${idx++}`);
      params.push(def.sex);
    }
    if (def.encounter_type) {
      conditions.push(`e.encounter_type = $${idx++}`);
      params.push(def.encounter_type);
    }
    if (def.conditions?.length) {
      const placeholders = def.conditions.map((_: any, i: number) => `$${idx + i}`).join(', ');
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(e.diagnoses::jsonb) d WHERE d LIKE ANY(ARRAY[${placeholders}])
      )`);
      def.conditions.forEach((c: string) => params.push(c + '%'));
      idx += def.conditions.length;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return db.query(
      `SELECT
         p.id           AS patient_id,
         p.date_of_birth,
         p.sex,
         p.district,
         p.province,
         e.encounter_date,
         e.encounter_type,
         e.diagnoses    AS icd10_codes,
         e.vitals       AS vital_signs,
         e.prescriptions AS medications
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       ${where}
       LIMIT 10000`,
      params,
    );
  }

  private filterToPermittedFields(record: any, permitted: string[]): any {
    const always = ['patient_id', 'date_of_birth', 'sex', 'district', 'province', 'encounter_date'];
    const allowed = new Set([...always, ...permitted]);
    const result: Record<string, any> = {};
    for (const key of Object.keys(record)) {
      if (allowed.has(key)) result[key] = record[key];
    }
    return result;
  }

  private async decrementToken(db: any, token: string): Promise<void> {
    await db.query(
      `UPDATE research_portal_tokens SET uses_remaining = uses_remaining - 1 WHERE token = $1`,
      [token],
    );
  }
}
