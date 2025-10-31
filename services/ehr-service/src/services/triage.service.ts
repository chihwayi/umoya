import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { TenantService } from './tenant.service';
import { AllergyService } from './allergy.service';

@Injectable()
export class TriageService {
  constructor(
    private tenantService: TenantService,
    private allergyService: AllergyService
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<TriageAssessment>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(TriageAssessment);
  }

  /**
   * Parse allergies text into structured allergy objects
   * Supports formats like: "Penicillin (rash)", "Aspirin: severe", "None", "NKDA"
   */
  private parseAllergiesText(allergiesText: string): Array<{ allergen: string; reaction?: string; severity?: string }> {
    if (!allergiesText || !allergiesText.trim()) {
      return [];
    }

    const normalized = allergiesText.trim().toUpperCase();
    
    // Handle common "no allergies" indicators
    if (normalized === 'NONE' || normalized === 'NKA' || normalized === 'NKDA' || normalized === 'NO KNOWN ALLERGIES') {
      return [];
    }

    const allergies: Array<{ allergen: string; reaction?: string; severity?: string }> = [];
    const lines = allergiesText.split(/[,;\n\r]+/).map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      if (!line) continue;

      let allergen = line;
      let reaction: string | undefined;
      let severity: string | undefined;

      // Try to extract reaction and severity from patterns like:
      // "Penicillin (rash)" or "Aspirin: severe" or "Latex - severe reaction"
      const parenMatch = line.match(/^(.+?)\s*\((.+?)\)$/);
      const colonMatch = line.match(/^(.+?):\s*(.+)$/);
      const dashMatch = line.match(/^(.+?)\s*-\s*(.+)$/);

      if (parenMatch) {
        allergen = parenMatch[1].trim();
        const details = parenMatch[2].trim();
        // Check if it's severity or reaction
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (colonMatch) {
        allergen = colonMatch[1].trim();
        const details = colonMatch[2].trim();
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (dashMatch) {
        allergen = dashMatch[1].trim();
        const details = dashMatch[2].trim();
        if (details.toLowerCase().includes('severe')) {
          severity = 'severe';
          reaction = details;
        } else if (details.toLowerCase().includes('moderate')) {
          severity = 'moderate';
          reaction = details;
        } else if (details.toLowerCase().includes('mild')) {
          severity = 'mild';
          reaction = details;
        } else {
          reaction = details;
        }
      }

      if (allergen) {
        allergies.push({
          allergen: allergen.trim(),
          reaction: reaction || undefined,
          severity: severity as 'mild' | 'moderate' | 'severe' | undefined
        });
      }
    }

    return allergies;
  }

  async recordAssessment(data: Partial<TriageAssessment>, tenantId: string): Promise<TriageAssessment> {
    const repo = await this.getRepository(tenantId);
    const entity = repo.create(data as TriageAssessment);
    const saved = await repo.save(entity);

    // Sync allergies from triage text to structured allergies table
    if (data.allergies && data.patientId && data.recordedBy) {
      try {
        const parsedAllergies = this.parseAllergiesText(data.allergies);
        
        // Only update if there are actually parsed allergies (avoid clearing existing)
        // If text is empty or "none", we don't overwrite existing structured allergies
        if (parsedAllergies.length > 0) {
          await this.allergyService.replaceForPatient(
            data.patientId as string,
            parsedAllergies,
            data.recordedBy as string,
            tenantId
          );
        }
      } catch (e) {
        // Log but don't fail triage save if allergy sync fails
        console.error('Failed to sync allergies from triage:', e);
      }
    }

    return saved;
  }

  async getByPatient(patientId: string, tenantId: string): Promise<TriageAssessment[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}


