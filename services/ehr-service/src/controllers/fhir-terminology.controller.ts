import { Controller, Get, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TerminologyService } from '../services/terminology.service';
import { Icd10Service } from '../services/icd10.service';
import { EclService } from '../services/ecl.service';

const SNOMED_SYSTEM = 'http://snomed.info/sct';
const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-cm';

/**
 * TERM-12: FHIR Terminology Service operations — $lookup, $expand,
 * $validate-code, $subsumes — built on the existing relational SNOMED/ICD-10
 * schema (no Snowstorm/Elasticsearch dependency, per explicit direction).
 * Real FHIR resource shapes (Parameters/ValueSet), a genuine subset of the
 * spec: only SNOMED CT and ICD-10-CM CodeSystems are supported (this
 * platform's actual terminology holdings); no $translate, no ConceptMap
 * resource exposure, no full ValueSet-resource persistence (expand accepts
 * an ECL expression or free-text filter directly, not a stored ValueSet id).
 */
@ApiTags('FHIR Terminology Service')
@ApiBearerAuth()
@Controller('terminology/fhir')
@UseGuards(JwtAuthGuard)
export class FhirTerminologyController {
  constructor(
    private readonly terminologyService: TerminologyService,
    private readonly icd10Service: Icd10Service,
    private readonly eclService: EclService,
  ) {}

  private assertSupportedSystem(system: string) {
    if (system !== SNOMED_SYSTEM && system !== ICD10_SYSTEM) {
      throw new BadRequestException(`Unsupported CodeSystem "${system}" — only ${SNOMED_SYSTEM} and ${ICD10_SYSTEM} are loaded on this platform.`);
    }
  }

  // ── CodeSystem/$lookup ────────────────────────────────────────────────
  @Get('CodeSystem/lookup')
  @ApiOperation({ summary: 'FHIR CodeSystem $lookup — resolve a code to its display term and basic properties' })
  @ApiQuery({ name: 'system', required: true })
  @ApiQuery({ name: 'code', required: true })
  async lookup(
    @Request() req: RequestWithTenant,
    @Query('system') system: string,
    @Query('code') code: string,
  ) {
    if (!system || !code) throw new BadRequestException('system and code are required');
    this.assertSupportedSystem(system);

    const parameters: Array<{ name: string; valueString?: string; valueBoolean?: boolean; valueCode?: string }> = [];

    if (system === SNOMED_SYSTEM) {
      const concept = await this.terminologyService.validateConcept(req.tenantDb, code).catch(() => null);
      if (!concept) {
        return this.notFoundOperationOutcome(`SNOMED CT concept ${code} not found or inactive`);
      }
      parameters.push({ name: 'name', valueString: 'SNOMED CT' });
      parameters.push({ name: 'display', valueString: concept.term });
      parameters.push({ name: 'code', valueCode: code });
      const details = await this.terminologyService.getConceptDetails(req.tenantDb, code).catch(() => null);
      if (details?.concept?.semanticTag) {
        parameters.push({ name: 'property.semanticTag', valueString: details.concept.semanticTag });
      }
      return { resourceType: 'Parameters', parameter: parameters };
    }

    // ICD-10-CM
    const details = await this.icd10Service.getIcd10CodeDetails(code, req.tenantDb).catch(() => null);
    if (!details) {
      return this.notFoundOperationOutcome(`ICD-10-CM code ${code} not found`);
    }
    parameters.push({ name: 'name', valueString: 'ICD-10-CM' });
    parameters.push({ name: 'display', valueString: (details as any).description });
    parameters.push({ name: 'code', valueCode: code });
    parameters.push({ name: 'property.billable', valueBoolean: (details as any).billable });
    return { resourceType: 'Parameters', parameter: parameters };
  }

  // ── CodeSystem/$validate-code ───────────────────────────────────────────
  @Get('CodeSystem/validate-code')
  @ApiOperation({ summary: 'FHIR CodeSystem $validate-code — check whether a code is valid/active in the given system' })
  @ApiQuery({ name: 'system', required: true })
  @ApiQuery({ name: 'code', required: true })
  async validateCode(
    @Request() req: RequestWithTenant,
    @Query('system') system: string,
    @Query('code') code: string,
  ) {
    if (!system || !code) throw new BadRequestException('system and code are required');
    this.assertSupportedSystem(system);

    if (system === SNOMED_SYSTEM) {
      const concept = await this.terminologyService.validateConcept(req.tenantDb, code).catch(() => null);
      return {
        resourceType: 'Parameters',
        parameter: [
          { name: 'result', valueBoolean: Boolean(concept) },
          ...(concept ? [{ name: 'display', valueString: concept.term }] : [{ name: 'message', valueString: `Concept ${code} not found or inactive` }]),
        ],
      };
    }

    const details = await this.icd10Service.getIcd10CodeDetails(code, req.tenantDb).catch(() => null);
    return {
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: Boolean(details) },
        ...(details ? [{ name: 'display', valueString: (details as any).description }] : [{ name: 'message', valueString: `Code ${code} not found` }]),
      ],
    };
  }

  // ── ValueSet/$expand ─────────────────────────────────────────────────
  @Get('ValueSet/expand')
  @ApiOperation({ summary: 'FHIR ValueSet $expand — expand an ECL expression or free-text filter into a concept list' })
  @ApiQuery({ name: 'ecl', required: false, description: 'ECL expression, e.g. "<73211009"' })
  @ApiQuery({ name: 'filter', required: false, description: 'Free-text filter (as FHIR ValueSet/$expand uses `filter`)' })
  @ApiQuery({ name: 'count', required: false, type: Number })
  async expand(
    @Request() req: RequestWithTenant,
    @Query('ecl') ecl?: string,
    @Query('filter') filter?: string,
    @Query('count') count?: string,
  ) {
    if (!ecl && !filter) throw new BadRequestException('Either ecl or filter is required');
    const limit = count ? parseInt(count, 10) : 50;

    let contains: Array<{ system: string; code: string; display: string }> = [];

    if (ecl && filter) {
      const result = await this.terminologyService.searchConcepts(req.tenantDb, filter, limit, 0, true, undefined, ecl);
      contains = result.concepts.map((c) => ({ system: SNOMED_SYSTEM, code: c.conceptId, display: c.term }));
    } else if (ecl) {
      const masterDb = await (this.terminologyService as any).getMasterDb();
      const ids = await this.eclService.evaluate(masterDb, ecl, limit);
      const rows = ids.length
        ? await masterDb.query(
            `SELECT d.concept_id, d.term FROM snomed_descriptions d WHERE d.concept_id = ANY($1::text[]) AND d.type_id='900000000000003001' AND d.active=true AND d.language_code='en'`,
            [ids],
          )
        : [];
      contains = rows.map((r: any) => ({ system: SNOMED_SYSTEM, code: r.concept_id, display: r.term }));
    } else {
      const result = await this.terminologyService.searchConcepts(req.tenantDb, filter!, limit, 0, true);
      contains = result.concepts.map((c) => ({ system: SNOMED_SYSTEM, code: c.conceptId, display: c.term }));
    }

    return {
      resourceType: 'ValueSet',
      status: 'active',
      expansion: {
        timestamp: new Date().toISOString(),
        total: contains.length,
        contains,
      },
    };
  }

  // ── CodeSystem/$subsumes ────────────────────────────────────────────────
  @Get('CodeSystem/subsumes')
  @ApiOperation({ summary: 'FHIR CodeSystem $subsumes — test the subsumption relationship between two SNOMED CT concepts' })
  @ApiQuery({ name: 'system', required: true })
  @ApiQuery({ name: 'codeA', required: true })
  @ApiQuery({ name: 'codeB', required: true })
  async subsumes(
    @Request() req: RequestWithTenant,
    @Query('system') system: string,
    @Query('codeA') codeA: string,
    @Query('codeB') codeB: string,
  ) {
    if (!system || !codeA || !codeB) throw new BadRequestException('system, codeA and codeB are required');
    if (system !== SNOMED_SYSTEM) {
      throw new BadRequestException('$subsumes is only supported for SNOMED CT — ICD-10-CM has no subsumption hierarchy in this platform.');
    }

    if (codeA === codeB) {
      return { resourceType: 'Parameters', parameter: [{ name: 'outcome', valueCode: 'equivalent' }] };
    }

    const masterDb = await (this.terminologyService as any).getMasterDb();
    // codeA subsumes codeB if codeB is a descendant of codeA (codeA appears
    // in codeB's ancestor chain).
    const aSubsumesB = await this.isAncestor(masterDb, codeA, codeB);
    if (aSubsumesB) {
      return { resourceType: 'Parameters', parameter: [{ name: 'outcome', valueCode: 'subsumes' }] };
    }
    const bSubsumesA = await this.isAncestor(masterDb, codeB, codeA);
    if (bSubsumesA) {
      return { resourceType: 'Parameters', parameter: [{ name: 'outcome', valueCode: 'subsumed-by' }] };
    }
    return { resourceType: 'Parameters', parameter: [{ name: 'outcome', valueCode: 'not-subsumed' }] };
  }

  private async isAncestor(masterDb: any, ancestorCandidate: string, descendantCandidate: string): Promise<boolean> {
    const rows = await masterDb.query(
      `
      WITH RECURSIVE ancestors AS (
        SELECT r.destination_id AS concept_id FROM snomed_relationships r
        WHERE r.source_id = $1 AND r.type_id = '116680003' AND r.active = true
        UNION
        SELECT r.destination_id FROM snomed_relationships r
        JOIN ancestors a ON r.source_id = a.concept_id
        WHERE r.type_id = '116680003' AND r.active = true
      )
      SELECT 1 FROM ancestors WHERE concept_id = $2 LIMIT 1
      `,
      [descendantCandidate, ancestorCandidate],
    );
    return rows.length > 0;
  }

  private notFoundOperationOutcome(message: string) {
    return {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', diagnostics: message }],
    };
  }
}
