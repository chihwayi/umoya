import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { TrialMatch } from '../entities/trial-match.entity';
import axios from 'axios';

@Injectable()
export class ClinicalTrialMatchingService {
  private readonly logger = new Logger(ClinicalTrialMatchingService.name);
  private clinicalTrialsUrl = 'https://clinicaltrials.gov/api/v2/studies';

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Match patient to trials ────────────────────────────────────────────────

  async matchTrials(subdomain: string, patientId: string, condition?: string): Promise<TrialMatch[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);

    // Get patient clinical profile
    const profile = await this.buildPatientProfile(ds, patientId);
    const searchCondition = condition || profile.primaryDiagnosis;
    if (!searchCondition) return [];

    // Fetch trials from ClinicalTrials.gov
    const trials = await this.fetchTrials(searchCondition);
    if (!trials.length) return [];

    // AI eligibility scoring via CDSS (circuit breaker + retry)
    let scored: any[] = [];
    try {
      const result = await this.cdssService.diagnosisAssist({
        patientProfile: profile,
        trials: trials.slice(0, 20),
        context: 'clinical_trial_eligibility',
        specialty: 'oncology',
        module: 'clinical_trials',
      }, true);
      scored = (result as any)?.matches || (result as any)?.recommendations || [];
      if (!scored.length) throw new Error('Empty matches');
    } catch (e: any) {
      this.logger.warn(`Trial matching CDSS unavailable, using basic scoring: ${e?.message}`);
      scored = trials.slice(0, 10).map((t: any) => ({
        nctId: t.nctId,
        eligibilityScore: 0.5,
        inclusionMet: [],
        exclusionFlags: [],
      }));
    }

    const repo = ds.getRepository(TrialMatch);
    const saved: TrialMatch[] = [];

    for (const match of scored) {
      const trial = trials.find(t => t.nctId === match.nctId);
      if (!trial || match.eligibilityScore < 0.3) continue;

      // Upsert — don't duplicate if already matched
      const existing = await repo.findOneBy({ patientId, nctId: match.nctId });
      if (existing) continue;

      const newMatch = repo.create({
        patientId,
        nctId: match.nctId,
        trialTitle: trial.title,
        phase: trial.phase,
        condition: searchCondition,
        eligibilityScore: match.eligibilityScore,
        inclusionMet: match.inclusionMet || [],
        exclusionFlags: match.exclusionFlags || [],
        sponsor: trial.sponsor,
        locations: trial.locations || [],
        status: 'matched',
        contactEmail: trial.contactEmail,
      } as any) as unknown as TrialMatch;
      saved.push(await repo.save(newMatch));
    }

    this.logger.log(`Matched ${saved.length} trials for patient ${patientId} (${searchCondition})`);
    return saved;
  }

  async getMatches(subdomain: string, patientId: string): Promise<TrialMatch[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(TrialMatch).find({
      where: { patientId },
      order: { eligibilityScore: 'DESC' },
    });
  }

  async updateStatus(subdomain: string, matchId: string, status: string): Promise<TrialMatch | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(TrialMatch);
    await repo.update(matchId, { status });
    return repo.findOneBy({ id: matchId });
  }

  async matchPACTRTrials(subdomain: string, patientId: string, condition?: string): Promise<TrialMatch[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const profile = await this.buildPatientProfile(ds, patientId);
    const searchCondition = condition || profile.primaryDiagnosis;
    if (!searchCondition) return [];

    const trials = await this.fetchPACTRTrials(searchCondition);
    if (!trials.length) return [];

    const repo = ds.getRepository(TrialMatch);
    const saved: TrialMatch[] = [];

    for (const trial of trials.slice(0, 15)) {
      const existing = await repo.findOneBy({ patientId, nctId: trial.registryId });
      if (existing) continue;

      const newMatch = repo.create({
        patientId,
        nctId: trial.registryId,
        trialTitle: trial.title ?? 'Untitled',
        phase: trial.phase ?? null,
        condition: searchCondition,
        eligibilityScore: 0.6,
        inclusionMet: [],
        exclusionFlags: [],
        sponsor: trial.sponsor ?? null,
        locations: trial.locations ?? [],
        status: 'matched',
        contactEmail: trial.contactEmail ?? null,
      } as any) as unknown as TrialMatch;
      saved.push(await repo.save(newMatch));
    }

    for (const record of saved) {
      await ds.query(
        `UPDATE trial_matches SET registry = 'pactr', registry_id = $1 WHERE id = $2`,
        [record.nctId, record.id],
      );
    }

    this.logger.log(`Matched ${saved.length} PACTR trials for patient ${patientId} (${searchCondition})`);
    return saved;
  }

  async searchPACTR(condition: string): Promise<any[]> {
    return this.fetchPACTRTrials(condition);
  }

  // ── Weekly re-match cron ───────────────────────────────────────────────────

  @Cron('0 3 * * 1') // Monday 03:00
  async weeklyTrialMatching() {
    this.logger.log('Running weekly clinical trial matching sweep…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          this.logger.warn('Skipping trial matching sweep for tenant without subdomain');
          continue;
        }
        await this.sweepActivePatients(subdomain).catch(e =>
          this.logger.error(`Trial matching sweep failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) {
      this.logger.error(`Weekly trial matching error: ${e?.message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async buildPatientProfile(ds: any, patientId: string): Promise<Record<string, any>> {
    const [problems, demos, meds] = await Promise.all([
      ds.query(`SELECT description, code FROM problems WHERE patient_id=$1 AND status='active' LIMIT 10`, [patientId]).catch(() => []),
      ds.query(`SELECT date_of_birth, gender FROM patients WHERE id=$1`, [patientId]).catch(() => []),
      ds.query(`SELECT drug_name FROM prescriptions WHERE patient_id=$1 AND status='active' LIMIT 10`, [patientId]).catch(() => []),
    ]);
    const dob = demos[0]?.date_of_birth;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
    return {
      patientId,
      age,
      gender: demos[0]?.gender,
      diagnoses: problems.map((p: any) => ({ description: p.description, code: p.code })),
      primaryDiagnosis: problems[0]?.description,
      currentMedications: meds.map((m: any) => m.drug_name),
    };
  }

  private async fetchTrials(condition: string): Promise<any[]> {
    try {
      const { data } = await axios.get(this.clinicalTrialsUrl, {
        params: {
          'query.cond': condition,
          'filter.overallStatus': 'RECRUITING',
          pageSize: 20,
          format: 'json',
        },
        timeout: 10000,
      });
      return (data.studies || []).map((s: any) => ({
        nctId: s.protocolSection?.identificationModule?.nctId,
        title: s.protocolSection?.identificationModule?.officialTitle || s.protocolSection?.identificationModule?.briefTitle,
        phase: s.protocolSection?.designModule?.phases?.[0],
        sponsor: s.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name,
        contactEmail: s.protocolSection?.contactsLocationsModule?.centralContacts?.[0]?.email,
        locations: (s.protocolSection?.contactsLocationsModule?.locations || [])
          .map((l: any) => `${l.city}, ${l.country}`).slice(0, 3),
      })).filter((t: any) => t.nctId);
    } catch (e: any) {
      this.logger.warn(`ClinicalTrials.gov API unavailable: ${e?.message}`);
      return [];
    }
  }

  private async fetchPACTRTrials(condition: string): Promise<any[]> {
    const ictrpUrl = 'https://trialsearch.who.int/api/search';
    try {
      const { data } = await axios.get(ictrpUrl, {
        params: {
          query: condition,
          registry: 'PACTR',
          recruiting: 'Y',
          format: 'json',
        },
        timeout: 12000,
        headers: { Accept: 'application/json' },
      });
      const trials = Array.isArray(data?.trials) ? data.trials : Array.isArray(data?.result) ? data.result : [];
      return trials
        .map((t: any) => ({
          registryId: t.TrialID || t.trialId || t.id,
          registry: 'pactr',
          title: t.public_title || t.Scientific_title || t.title,
          phase: t.phase || t.Phase || null,
          sponsor: t.Primary_sponsor || t.sponsor || null,
          condition: t.Condition || t.Health_condition || condition,
          contactEmail: t.Contact_email || t.contact_email || null,
          locations: String(t.Countries || t.countries || '')
            .split(';')
            .map((c: string) => c.trim())
            .filter(Boolean),
          url: t.url || `https://pactr.samrc.ac.za/RegistryDisplay.aspx?TrialID=${t.TrialID || t.trialId}`,
        }))
        .filter((trial: any) => trial.registryId);
    } catch (e: any) {
      this.logger.warn(`WHO ICTRP/PACTR API unavailable: ${e?.message}`);
      return [];
    }
  }

  private async sweepActivePatients(subdomain: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const patients = await ds.query(`
      SELECT DISTINCT p.id
      FROM patients p
      INNER JOIN problems pr ON pr.patient_id = p.id
      WHERE pr.status = 'active'
      AND pr.code LIKE 'C%' -- oncology ICD-10
      LIMIT 50
    `).catch(() => []);
    for (const { id } of patients) {
      await this.matchTrials(subdomain, id).catch(() => {});
    }
  }
}
