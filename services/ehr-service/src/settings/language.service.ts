import { Injectable } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';
import { UserLanguagePreference } from './entities/user-language-preference.entity';

const SUPPORTED_LANGUAGES = ['en', 'pt', 'fr', 'sw', 'zu', 'af', 'sn', 'nd'];

@Injectable()
export class LanguageService {
  constructor(private readonly tenantService: TenantService) {}

  async getUserLanguage(tenantId: string, userId: string): Promise<UserLanguagePreference> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UserLanguagePreference);
    let pref = await repo.findOne({ where: { userId } });
    if (!pref) {
      pref = await repo.save(
        repo.create({
          userId,
          preferredLanguage: 'en',
          uiLanguage: 'en',
          clinicalNoteLanguage: 'en',
          lastUpdatedAt: new Date(),
        }),
      );
    }
    return pref;
  }

  async setUserLanguage(
    tenantId: string,
    userId: string,
    uiLanguage: string,
    clinicalNoteLanguage?: string,
  ): Promise<UserLanguagePreference> {
    if (!SUPPORTED_LANGUAGES.includes(uiLanguage)) {
      throw new Error(`Unsupported language: ${uiLanguage}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    }
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(UserLanguagePreference);
    const existing = await repo.findOne({ where: { userId } });
    if (existing) {
      existing.uiLanguage = uiLanguage;
      existing.preferredLanguage = uiLanguage;
      existing.clinicalNoteLanguage = clinicalNoteLanguage ?? uiLanguage;
      existing.lastUpdatedAt = new Date();
      return repo.save(existing);
    }
    return repo.save(
      repo.create({
        userId,
        preferredLanguage: uiLanguage,
        uiLanguage,
        clinicalNoteLanguage: clinicalNoteLanguage ?? uiLanguage,
        lastUpdatedAt: new Date(),
      }),
    );
  }

  getSupportedLanguages(): object[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
      { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
      { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
      { code: 'sn', name: 'Shona', nativeName: 'chiShona' },
      { code: 'nd', name: 'Ndebele', nativeName: 'isiNdebele' },
    ];
  }
}
