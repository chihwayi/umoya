#!/usr/bin/env ts-node

/**
 * RxNorm Drug Import Script (Standalone)
 * 
 * Imports drugs from RxNorm "Current Prescribable Content" subset
 * into the medicore drugs table using raw SQL.
 * 
 * Usage:
 *   npx ts-node scripts/import-rxnorm-drugs-standalone.ts [path-to-rxnorm-rrf-folder]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

interface RxNormConcept {
  rxcui: string;
  name: string;
  tty: string;
  code: string;
}

interface RxNormAttribute {
  rxcui: string;
  atn: string;
  atv: string;
}

class RxNormImporter {
  private client: Client;
  private concepts: Map<string, RxNormConcept> = new Map();
  private attributes: Map<string, Map<string, string>> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  parseRXNCONSO(filePath: string): void {
    console.log(`📖 Parsing RXNCONSO.RRF from ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let count = 0;
    const targetTTYs = ['SCD', 'SCDC', 'SCDF', 'SCDG'];
    
    for (const line of lines) {
      const fields = line.split('|');
      if (fields.length < 15) continue;
      
      const rxcui = fields[0]?.trim();
      const sab = fields[11]?.trim();
      const tty = fields[12]?.trim();
      const code = fields[13]?.trim();
      const str = fields[14]?.trim();
      const suppress = fields[16]?.trim();
      
      if (rxcui && sab === 'RXNORM' && targetTTYs.includes(tty) && suppress !== 'Y' && suppress !== 'E') {
        const existing = this.concepts.get(rxcui);
        if (!existing || (tty === 'SCD' && existing.tty !== 'SCD')) {
          this.concepts.set(rxcui, {
            rxcui,
            name: str || code || rxcui,
            tty,
            code: code || rxcui,
          });
          count++;
        }
      }
    }
    
    console.log(`✅ Parsed ${count} RxNorm concepts (${this.concepts.size} unique RXCUIs)`);
  }

  parseRXNSAT(filePath: string): void {
    console.log(`📖 Parsing RXNSAT.RRF from ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let count = 0;
    const targetATNs = ['STRENGTH', 'DOSE_FORM', 'RXN_ROUTE', 'NDC'];
    
    for (const line of lines) {
      const fields = line.split('|');
      if (fields.length < 12) continue;
      
      const rxcui = fields[0]?.trim();
      const atn = fields[8]?.trim();
      const sab = fields[9]?.trim();
      const atv = fields[10]?.trim();
      const suppress = fields[11]?.trim();
      
      if (rxcui && sab === 'RXNORM' && targetATNs.includes(atn) && suppress !== 'Y' && suppress !== 'E' && atv) {
        if (!this.attributes.has(rxcui)) {
          this.attributes.set(rxcui, new Map());
        }
        if (!this.attributes.get(rxcui)!.has(atn)) {
          this.attributes.get(rxcui)!.set(atn, atv);
          count++;
        }
      }
    }
    
    console.log(`✅ Parsed ${count} RxNorm attributes`);
  }

  private parseStrength(strengthStr?: string): { strength?: string; unit?: string } {
    if (!strengthStr) return {};
    const match = strengthStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (match) {
      return { strength: match[1], unit: match[2].toUpperCase() };
    }
    return { strength: strengthStr };
  }

  private mapTTYToDosageForm(tty: string): string[] {
    const ttyMap: Record<string, string[]> = {
      'SCD': ['tablet', 'capsule'],
      'SCDF': ['tablet', 'capsule'],
      'SCDG': ['gel', 'cream'],
      'SCDC': ['capsule'],
    };
    return ttyMap[tty] || ['tablet'];
  }

  async importDrugs(batchSize: number = 1000): Promise<number> {
    console.log(`\n💾 Importing drugs into database...`);
    
    let imported = 0;
    let skipped = 0;
    const batch: any[] = [];
    
    for (const [rxcui, concept] of this.concepts.entries()) {
      // Check if exists
      const existsResult = await this.client.query(
        'SELECT id FROM drugs WHERE rxnorm_code = $1',
        [rxcui]
      );
      
      if (existsResult.rows.length > 0) {
        skipped++;
        continue;
      }
      
      // Get attributes
      const attrs = this.attributes.get(rxcui) || new Map();
      const strengthStr = attrs.get('STRENGTH');
      const doseForm = attrs.get('DOSE_FORM');
      const route = attrs.get('RXN_ROUTE');
      const ndc = attrs.get('NDC');
      
      const { strength, unit } = this.parseStrength(strengthStr);
      
      // Extract generic name - clean up the RxNorm name
      let genericName = concept.name;
      // Remove strength patterns (e.g., "300 MG/ML", "50 MG")
      genericName = genericName.replace(/\d+(\.\d+)?\s*(MG|ML|G|MCG|UNITS?|%|MEQ)\/?\s*(MG|ML|G|MCG|UNITS?|%|MEQ)?/gi, '').trim();
      // Remove common dosage form suffixes
      genericName = genericName.replace(/\s+(Tablet|Capsule|Injection|Solution|Ointment|Cream|Gel|Syringe|Liquid|Suspension|Drops|Inhaler|Patch)$/gi, '').trim();
      // Remove route of administration
      genericName = genericName.replace(/\s+(Oral|Topical|Intravenous|Intramuscular|Subcutaneous|Rectal|Vaginal|Ophthalmic|Otic|Nasal)$/gi, '').trim();
      
      // Fallback: if name is too long or empty, use first part
      if (!genericName || genericName.length > 200) {
        genericName = concept.name.split(' ').slice(0, 5).join(' ').trim();
      }
      
      // Ensure it's not empty
      if (!genericName) {
        genericName = concept.name.substring(0, 200);
      }
      
      // Truncate fields to match database constraints
      const safeGenericName = genericName.substring(0, 255).toLowerCase();
      const safeRxnormName = concept.name.substring(0, 1000); // TEXT field, but limit for safety
      const safeTty = (concept.tty || '').substring(0, 20);
      const safeNdc = ndc ? ndc.substring(0, 50) : null;
      const safeStrength = strength ? strength.substring(0, 100) : null;
      const safeUnit = unit ? unit.substring(0, 50) : null;
      
      batch.push({
        generic_name: safeGenericName,
        rxnorm_code: rxcui,
        rxnorm_name: safeRxnormName,
        rxnorm_tty: safeTty,
        ndc_code: safeNdc,
        strength: safeStrength,
        unit: safeUnit,
        dosage_forms: doseForm ? [doseForm.toLowerCase()] : this.mapTTYToDosageForm(concept.tty),
        route_of_administration: route ? [route.toLowerCase()] : ['oral'],
        description: `RxNorm: ${concept.name.substring(0, 500)} (${concept.tty})`,
        is_active: true,
        status: 'active',
      });
      
      if (batch.length >= batchSize) {
        await this.insertBatch(batch);
        imported += batch.length;
        console.log(`  ✅ Imported ${imported} drugs...`);
        batch.length = 0;
      }
    }
    
    if (batch.length > 0) {
      await this.insertBatch(batch);
      imported += batch.length;
    }
    
    console.log(`\n✅ Import complete!`);
    console.log(`   - Imported: ${imported} drugs`);
    console.log(`   - Skipped (already exists): ${skipped} drugs`);
    
    return imported;
  }

  private async insertBatch(batch: any[]): Promise<void> {
    if (batch.length === 0) return;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    for (const drug of batch) {
      const ph: string[] = [];
      ph.push(`$${paramIndex++}`); // generic_name
      ph.push(`$${paramIndex++}`); // rxnorm_code
      ph.push(`$${paramIndex++}`); // rxnorm_name
      ph.push(`$${paramIndex++}`); // rxnorm_tty
      ph.push(`$${paramIndex++}`); // ndc_code
      ph.push(`$${paramIndex++}`); // strength
      ph.push(`$${paramIndex++}`); // unit
      ph.push(`$${paramIndex++}`); // dosage_forms
      ph.push(`$${paramIndex++}`); // route_of_administration
      ph.push(`$${paramIndex++}`); // description
      ph.push(`$${paramIndex++}`); // is_active
      ph.push(`$${paramIndex++}`); // status
      
      values.push(
        drug.generic_name,
        drug.rxnorm_code,
        drug.rxnorm_name,
        drug.rxnorm_tty,
        drug.ndc_code,
        drug.strength,
        drug.unit,
        drug.dosage_forms,
        drug.route_of_administration,
        drug.description,
        drug.is_active,
        drug.status
      );
      
      placeholders.push(`(${ph.join(', ')})`);
    }
    
    const query = `
      INSERT INTO drugs (
        generic_name, rxnorm_code, rxnorm_name, rxnorm_tty, ndc_code,
        strength, unit, dosage_forms, route_of_administration,
        description, is_active, status
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;
    
    await this.client.query(query, values);
  }

  async import(rrfFolder: string): Promise<number> {
    const consoPath = path.join(rrfFolder, 'RXNCONSO.RRF');
    const satPath = path.join(rrfFolder, 'RXNSAT.RRF');
    
    if (!fs.existsSync(consoPath)) {
      throw new Error(`RXNCONSO.RRF not found at ${consoPath}`);
    }
    
    this.parseRXNCONSO(consoPath);
    
    if (fs.existsSync(satPath)) {
      this.parseRXNSAT(satPath);
    } else {
      console.log(`⚠️  RXNSAT.RRF not found, skipping attributes`);
    }
    
    return await this.importDrugs();
  }
}

async function main() {
  const rrfFolder = process.argv[2] || '/tmp/rxnorm_prescribe/rrf';
  
  if (!fs.existsSync(rrfFolder)) {
    console.error(`❌ Error: RRF folder not found: ${rrfFolder}`);
    process.exit(1);
  }
  
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: process.env.DB_NAME || 'tenant_bulawayo_general',
  });
  
  try {
    await client.connect();
    console.log('✅ Database connected');
    
    const importer = new RxNormImporter(client);
    const count = await importer.import(rrfFolder);
    
    console.log(`\n🎉 Successfully imported ${count} drugs!`);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run main
main();

