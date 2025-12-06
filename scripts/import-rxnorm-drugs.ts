#!/usr/bin/env ts-node

/**
 * RxNorm Drug Import Script
 * 
 * Imports drugs from RxNorm "Current Prescribable Content" subset
 * into the medicore drugs table.
 * 
 * Usage:
 *   ts-node scripts/import-rxnorm-drugs.ts [path-to-rxnorm-rrf-folder]
 * 
 * Example:
 *   ts-node scripts/import-rxnorm-drugs.ts /tmp/rxnorm_prescribe/rrf
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Drug } from '../services/ehr-service/src/entities/drug.entity';

interface RxNormConcept {
  rxcui: string;
  name: string;
  tty: string; // Term Type
  sab: string; // Source Abbreviation
  code: string;
  str: string; // String (name)
}

interface RxNormAttribute {
  rxcui: string;
  atn: string; // Attribute Name
  atv: string; // Attribute Value
}

class RxNormImporter {
  private dataSource: DataSource;
  private concepts: Map<string, RxNormConcept> = new Map();
  private attributes: Map<string, Map<string, string>> = new Map(); // RXCUI -> ATN -> ATV

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Parse RXNCONSO.RRF file
   * Format: RXCUI|LAT|TS|LUI|STT|SUI|ISPREF|AUI|SAUI|SCUI|SDUI|SAB|TTY|CODE|STR|SRL|SUPPRESS|CVF
   * Fields: 0=RXCUI, 11=SAB, 12=TTY, 13=CODE, 14=STR
   */
  parseRXNCONSO(filePath: string): void {
    console.log(`📖 Parsing RXNCONSO.RRF from ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let count = 0;
    // Focus on Semantic Clinical Drug (SCD) - these are the prescribable drugs with strength/form
    const targetTTYs = ['SCD', 'SCDC', 'SCDF', 'SCDG']; // Semantic Clinical Drug types
    
    for (const line of lines) {
      const fields = line.split('|');
      if (fields.length < 15) continue;
      
      const rxcui = fields[0]?.trim();
      const sab = fields[11]?.trim(); // Source
      const tty = fields[12]?.trim(); // Term Type
      const code = fields[13]?.trim();
      const str = fields[14]?.trim(); // Name/string
      const suppress = fields[16]?.trim(); // Suppress flag
      
      // Only process RxNorm source (SAB = 'RXNORM'), prescribable drug types, and non-suppressed
      if (rxcui && sab === 'RXNORM' && targetTTYs.includes(tty) && suppress !== 'Y' && suppress !== 'E') {
        // Prefer SCD (Semantic Clinical Drug) over other types
        const existing = this.concepts.get(rxcui);
        if (!existing || (tty === 'SCD' && existing.tty !== 'SCD')) {
          this.concepts.set(rxcui, {
            rxcui,
            name: str || code || rxcui,
            tty,
            sab,
            code: code || rxcui,
            str: str || code || rxcui,
          });
          count++;
        }
      }
    }
    
    console.log(`✅ Parsed ${count} RxNorm concepts (${this.concepts.size} unique RXCUIs)`);
  }

  /**
   * Parse RXNSAT.RRF file for attributes (strength, form, etc.)
   * Format: RXCUI|LUI|SUI|RXAUI|STYPE|CODE|ATN|SAB|ATV|SUPPRESS|CVF
   * Actual format from file: RXCUI|||...|ATN|SAB|ATV|SUPPRESS|CVF
   * Fields: 0=RXCUI, 8=ATN (after empty fields), 9=SAB, 10=ATV, 11=SUPPRESS
   */
  parseRXNSAT(filePath: string): void {
    console.log(`📖 Parsing RXNSAT.RRF from ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let count = 0;
    const targetATNs = ['STRENGTH', 'DOSE_FORM', 'RXN_ROUTE', 'NDC']; // Attributes we care about
    
    for (const line of lines) {
      const fields = line.split('|');
      if (fields.length < 12) continue;
      
      const rxcui = fields[0]?.trim();
      const atn = fields[8]?.trim(); // Attribute Name (adjusted for actual file format)
      const sab = fields[9]?.trim(); // Source (adjusted)
      const atv = fields[10]?.trim(); // Attribute Value (adjusted)
      const suppress = fields[11]?.trim();
      
      // Only process RxNorm source and non-suppressed attributes
      if (rxcui && sab === 'RXNORM' && targetATNs.includes(atn) && suppress !== 'Y' && suppress !== 'E' && atv) {
        if (!this.attributes.has(rxcui)) {
          this.attributes.set(rxcui, new Map());
        }
        // Keep the first value or prefer certain sources
        if (!this.attributes.get(rxcui)!.has(atn)) {
          this.attributes.get(rxcui)!.set(atn, atv);
          count++;
        }
      }
    }
    
    console.log(`✅ Parsed ${count} RxNorm attributes`);
  }

  /**
   * Extract strength and unit from strength string
   * Example: "500 MG" -> strength: "500", unit: "MG"
   */
  private parseStrength(strengthStr?: string): { strength?: string; unit?: string } {
    if (!strengthStr) return {};
    
    // Match patterns like "500 MG", "10 ML", "0.5 MG", etc.
    const match = strengthStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (match) {
      return {
        strength: match[1],
        unit: match[2].toUpperCase(),
      };
    }
    
    return { strength: strengthStr };
  }

  /**
   * Map RxNorm TTY to dosage form
   */
  private mapTTYToDosageForm(tty: string): string[] {
    const ttyMap: Record<string, string[]> = {
      'SCD': ['tablet', 'capsule'], // Semantic Clinical Drug
      'SCDF': ['tablet', 'capsule'], // Semantic Clinical Drug Form
      'SCDG': ['gel', 'cream'], // Semantic Clinical Drug Group
      'SCDC': ['capsule'], // Semantic Clinical Drug Component
    };
    return ttyMap[tty] || ['tablet'];
  }

  /**
   * Import drugs into database
   */
  async importDrugs(tenantDb: DataSource, batchSize: number = 1000): Promise<number> {
    console.log(`\n💾 Importing drugs into database...`);
    
    const drugRepository = tenantDb.getRepository(Drug);
    const drugsToInsert: Partial<Drug>[] = [];
    let imported = 0;
    let skipped = 0;
    
    // Process each concept
    for (const [rxcui, concept] of this.concepts.entries()) {
      // Skip if already exists
      const existing = await drugRepository.findOne({
        where: { rxnormCode: rxcui },
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Get attributes for this RXCUI
      const attrs = this.attributes.get(rxcui) || new Map();
      const strengthStr = attrs.get('STRENGTH');
      const doseForm = attrs.get('DOSE_FORM');
      const route = attrs.get('RXN_ROUTE');
      const ndc = attrs.get('NDC');
      
      // Parse strength
      const { strength, unit } = this.parseStrength(strengthStr);
      
      // Extract generic name (usually the name without strength/form)
      let genericName = concept.name;
      if (strengthStr) {
        genericName = genericName.replace(new RegExp(strengthStr, 'gi'), '').trim();
      }
      if (doseForm) {
        genericName = genericName.replace(new RegExp(doseForm, 'gi'), '').trim();
      }
      
      // Build drug object
      const drug: Partial<Drug> = {
        genericName: genericName.toLowerCase(),
        rxnormCode: rxcui,
        rxnormName: concept.name,
        rxnormTty: concept.tty,
        ndcCode: ndc,
        strength,
        unit,
        dosageForms: doseForm ? [doseForm.toLowerCase()] : this.mapTTYToDosageForm(concept.tty),
        routeOfAdministration: route ? [route.toLowerCase()] : ['oral'],
        description: `RxNorm: ${concept.name} (${concept.tty})`,
        isActive: true,
        status: 'active',
      };
      
      drugsToInsert.push(drug);
      
      // Insert in batches
      if (drugsToInsert.length >= batchSize) {
        await drugRepository.save(drugsToInsert.map(d => drugRepository.create(d)));
        imported += drugsToInsert.length;
        console.log(`  ✅ Imported ${imported} drugs...`);
        drugsToInsert.length = 0;
      }
    }
    
    // Insert remaining
    if (drugsToInsert.length > 0) {
      await drugRepository.save(drugsToInsert.map(d => drugRepository.create(d)));
      imported += drugsToInsert.length;
    }
    
    console.log(`\n✅ Import complete!`);
    console.log(`   - Imported: ${imported} drugs`);
    console.log(`   - Skipped (already exists): ${skipped} drugs`);
    
    return imported;
  }

  /**
   * Main import process
   */
  async import(rrfFolder: string, tenantDb: DataSource): Promise<number> {
    const consoPath = path.join(rrfFolder, 'RXNCONSO.RRF');
    const satPath = path.join(rrfFolder, 'RXNSAT.RRF');
    
    if (!fs.existsSync(consoPath)) {
      throw new Error(`RXNCONSO.RRF not found at ${consoPath}`);
    }
    
    // Parse files
    this.parseRXNCONSO(consoPath);
    
    if (fs.existsSync(satPath)) {
      this.parseRXNSAT(satPath);
    } else {
      console.log(`⚠️  RXNSAT.RRF not found, skipping attributes`);
    }
    
    // Import to database
    return await this.importDrugs(tenantDb);
  }
}

// Main execution
async function main() {
  const rrfFolder = process.argv[2] || '/tmp/rxnorm_prescribe/rrf';
  
  if (!fs.existsSync(rrfFolder)) {
    console.error(`❌ Error: RRF folder not found: ${rrfFolder}`);
    console.error(`Usage: ts-node scripts/import-rxnorm-drugs.ts [path-to-rrf-folder]`);
    process.exit(1);
  }
  
  // Create database connection
  // Use Docker connection details or environment variables
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  const dbUser = process.env.DB_USER || 'medicore';
  // Default password for Docker setup
  const dbPassword = process.env.DB_PASSWORD || (dbHost === 'localhost' ? 'medicore_password' : 'medicore');
  const dbName = process.env.DB_NAME || 'tenant_bulawayo_general';
  
  console.log(`🔌 Connecting to database: ${dbName}@${dbHost}:${dbPort} as ${dbUser}`);
  
  const dataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUser,
    password: dbPassword,
    database: dbName,
    entities: [Drug],
    synchronize: false,
    logging: false,
  });
  
  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    
    const importer = new RxNormImporter(dataSource);
    const count = await importer.import(rrfFolder, dataSource);
    
    console.log(`\n🎉 Successfully imported ${count} drugs!`);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}

export { RxNormImporter };

