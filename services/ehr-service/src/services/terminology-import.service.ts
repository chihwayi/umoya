
import { Injectable, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import * as readline from 'readline';
import { getMasterDbConfig } from '../utils/runtime-env';

export interface ImportStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  progress: number;
  totalRows?: number;
  processedRows?: number;
  error?: string;
  fileName?: string;
  type?: 'snomed' | 'icd10' | 'icd11';
  startTime?: Date;
  endTime?: Date;
}

@Injectable()
export class TerminologyImportService implements OnModuleDestroy {
  private readonly logger = new Logger(TerminologyImportService.name);
  private jobs: Map<string, ImportStatus> = new Map();
  private masterDb: DataSource | null = null;

  constructor() {
    this.initializeMasterDb();
  }

  async onModuleDestroy() {
    if (this.masterDb && this.masterDb.isInitialized) {
      await this.masterDb.destroy();
      this.logger.log('Master database connection closed');
    }
  }

  private async initializeMasterDb() {
    try {
      const cfg = getMasterDbConfig(process.env.MASTER_POSTGRES_DB || process.env.POSTGRES_DB || 'medicore');
      this.masterDb = new DataSource({
        type: 'postgres',
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        password: cfg.password,
        database: cfg.database,
      });
      await this.masterDb.initialize();
      this.logger.log('✅ Master database connected for Terminology Import');
      await this.initializeSchema();
    } catch (error: any) {
      this.logger.error(`❌ Failed to connect to master DB for Terminology Import: ${error.message}`);
    }
  }

  private async initializeSchema() {
    if (!this.masterDb || !this.masterDb.isInitialized) return;

    try {
      // Check if tables exist
      const tableExists = await this.masterDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'snomed_concepts'
        );
      `);

      const jobsTableExists = await this.masterDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'terminology_import_jobs'
        );
      `);

      if (tableExists[0].exists && jobsTableExists[0].exists) {
        this.logger.log('✅ SNOMED schema and jobs table already exist.');
        return;
      }

      this.logger.log('⚠️ Schema or jobs table missing. Initializing...');

      // Try to find the SQL file
      let sqlPath = path.resolve(__dirname, '../../../../database/schemas/snomed-rf2.sql'); // Local dev path
      
      if (!fs.existsSync(sqlPath)) {
        // Try Docker volume path
        sqlPath = '/app/database/schemas/snomed-rf2.sql';
      }

      if (!fs.existsSync(sqlPath)) {
        this.logger.warn(`⚠️ Could not find snomed-rf2.sql at ${sqlPath}. Skipping schema initialization.`);
        return;
      }

      const sql = fs.readFileSync(sqlPath, 'utf8');
      await this.masterDb.query(sql);
      this.logger.log('✅ SNOMED schema initialized successfully.');

    } catch (error: any) {
      this.logger.error(`❌ Failed to initialize SNOMED schema: ${error.message}`);
    }
  }

  private async getMasterDb(): Promise<DataSource> {
    if (!this.masterDb || !this.masterDb.isInitialized) {
        await this.initializeMasterDb();
    }
    if (!this.masterDb || !this.masterDb.isInitialized) {
        throw new Error('Master database connection not available for import.');
    }
    return this.masterDb;
  }

  async getImportStatus(jobId: string): Promise<ImportStatus | undefined> {
    if (!this.masterDb || !this.masterDb.isInitialized) return undefined;
    const res = await this.masterDb.query('SELECT * FROM terminology_import_jobs WHERE job_id = $1', [jobId]);
    if (res.length === 0) return undefined;
    const row = res[0];
    return {
        jobId: row.job_id,
        status: row.status,
        message: row.message,
        progress: row.progress,
        totalRows: row.total_rows,
        processedRows: row.processed_rows,
        fileName: row.file_name,
        type: row.type,
        error: row.error,
        startTime: row.start_time,
        endTime: row.end_time
    };
  }

  async getAllJobs(): Promise<ImportStatus[]> {
    if (!this.masterDb || !this.masterDb.isInitialized) return [];
    const res = await this.masterDb.query('SELECT * FROM terminology_import_jobs ORDER BY start_time DESC');
    return res.map((row: any) => ({
        jobId: row.job_id,
        status: row.status,
        message: row.message,
        progress: row.progress,
        totalRows: row.total_rows,
        processedRows: row.processed_rows,
        fileName: row.file_name,
        type: row.type,
        error: row.error,
        startTime: row.start_time,
        endTime: row.end_time
    }));
  }

  async getStats() {
    if (!this.masterDb || !this.masterDb.isInitialized) return { snomedConcepts: 0, icd10Codes: 0, icd11Codes: 0 };

    try {
        const snomedCount = await this.masterDb.query('SELECT count(*) as count FROM snomed_concepts');
        const icd10Count  = await this.masterDb.query('SELECT count(*) as count FROM icd10_codes');
        const icd11Exists = await this.masterDb.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'icd11_codes'
            )`);
        let icd11Count = 0;
        if (icd11Exists[0].exists) {
            const res = await this.masterDb.query('SELECT count(*) as count FROM icd11_codes');
            icd11Count = parseInt(res[0].count);
        }
        return {
            snomedConcepts: parseInt(snomedCount[0].count),
            icd10Codes:     parseInt(icd10Count[0].count),
            icd11Codes:     icd11Count,
        };
    } catch (e) {
        this.logger.error('Failed to get stats', e);
        return { snomedConcepts: 0, icd10Codes: 0, icd11Codes: 0 };
    }
  }

  private async saveJob(job: ImportStatus) {
    if (!this.masterDb || !this.masterDb.isInitialized) return;
    
    try {
        await this.masterDb.query(`
            INSERT INTO terminology_import_jobs (
                job_id, status, message, progress, total_rows, processed_rows, 
                file_name, type, error, start_time, end_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (job_id) DO UPDATE SET
                status = EXCLUDED.status,
                message = EXCLUDED.message,
                progress = EXCLUDED.progress,
                total_rows = EXCLUDED.total_rows,
                processed_rows = EXCLUDED.processed_rows,
                error = EXCLUDED.error,
                end_time = EXCLUDED.end_time
        `, [
            job.jobId, job.status, job.message, job.progress, job.totalRows || 0, job.processedRows || 0,
            job.fileName, job.type, job.error, job.startTime, job.endTime
        ]);
    } catch (e) {
        this.logger.error(`Failed to save job ${job.jobId}`, e);
    }
  }

  async importFile(file: Express.Multer.File, type: 'snomed' | 'icd10' | 'icd11', replace = false): Promise<string> {
    const jobId = Math.random().toString(36).substring(7);
    const tempPath = file.path; // Multer saves to a temp path

    const job: ImportStatus = {
      jobId,
      status: 'pending',
      progress: 0,
      fileName: file.originalname,
      type,
      startTime: new Date(),
    };

    await this.saveJob(job);

    // Start processing in background
    this.processImport(job, tempPath, type, replace, file.originalname).catch(async err => {
      this.logger.error(`Import job ${jobId} failed: ${err.message}`, err.stack);
      job.status = 'failed';
      job.error = err.message;
      job.endTime = new Date();
      await this.saveJob(job);
    });

    return jobId;
  }

  private async processImport(job: ImportStatus, filePath: string, type: 'snomed' | 'icd10' | 'icd11', replace = false, originalName = '') {
    job.status = 'processing';
    job.message = 'Extracting and analyzing file...';
    await this.saveJob(job);

    try {
        const isZip = originalName.toLowerCase().endsWith('.zip') || filePath.endsWith('.zip');
        const isTxt = originalName.toLowerCase().endsWith('.txt');

        if (replace) {
            job.message = 'Clearing existing data...';
            await this.saveJob(job);
            const masterDb = await this.getMasterDb();
            if (type === 'snomed') {
                await masterDb.query('TRUNCATE snomed_to_icd10_map, snomed_relationships, snomed_descriptions, snomed_concepts CASCADE');
            } else if (type === 'icd11') {
                await masterDb.query('TRUNCATE snomed_to_icd11_map, icd11_codes CASCADE');
            } else {
                await masterDb.query('TRUNCATE icd10_codes');
            }
            job.message = 'Existing data cleared. Importing...';
            await this.saveJob(job);
        }

        if (isZip) {
            await this.processZipFile(job, filePath, type);
        } else if (isTxt && type === 'icd10') {
            // ICD-10 plain text file — process directly without zip extraction
            const masterDb = await this.getMasterDb();
            const queryRunner = masterDb.createQueryRunner();
            await queryRunner.connect();
            try {
                const totalBytes = fs.statSync(filePath).size;
                job.message = 'Importing ICD-10 Codes...';
                await this.processFile(queryRunner, filePath, this.processors.icd10, job, false, totalBytes, 0);
            } finally {
                await queryRunner.release();
            }
        } else {
            const hint = type === 'icd10'
                ? 'Please upload a .zip or .txt file for ICD-10.'
                : type === 'icd11'
                ? 'Please upload a .zip file (ICD-11 MMS linearization JSON).'
                : 'Please upload a .zip file (SNOMED CT RF2 release).';
            throw new BadRequestException(hint);
        }

        job.status = 'completed';
        job.message = 'Import completed successfully.';
        job.progress = 100;
        job.endTime = new Date();
        await this.saveJob(job);

    } catch (err: any) {
        this.logger.error(`Error in job ${job.jobId}:`, err);
        job.status = 'failed';
        job.error = err.message;
        job.endTime = new Date();
        await this.saveJob(job);
    } finally {
        // Cleanup temp file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
  }

  private async processZipFile(job: ImportStatus, zipPath: string, type: 'snomed' | 'icd10' | 'icd11') {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    const extractPath = path.join(path.dirname(zipPath), `extract_${job.jobId}`);
    const maxEntries = 10000;
    
    if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath);
    }

    try {
        if (zipEntries.length > maxEntries) {
          throw new Error(`Zip contains too many entries (${zipEntries.length}). Maximum allowed is ${maxEntries}.`);
        }
        job.message = `Extracting ${zipEntries.length} files...`;
        const extractRoot = path.resolve(extractPath);
        for (const entry of zipEntries) {
          const entryName = String(entry.entryName || '').replace(/\\/g, '/');
          if (!entryName || entryName.endsWith('/')) {
            continue;
          }
          const destination = path.resolve(extractRoot, entryName);
          if (!destination.startsWith(`${extractRoot}${path.sep}`)) {
            throw new Error(`Unsafe zip entry path detected: ${entryName}`);
          }
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.writeFileSync(destination, entry.getData());
        }

        if (type === 'snomed') {
            await this.importSnomedFromFolder(job, extractPath);
        } else if (type === 'icd10') {
            await this.importIcd10FromFolder(job, extractPath);
        } else if (type === 'icd11') {
            await this.importIcd11FromFolder(job, extractPath);
        }

    } finally {
        // Cleanup extracted files
        fs.rmSync(extractPath, { recursive: true, force: true });
    }
  }

  private async importSnomedFromFolder(job: ImportStatus, folderPath: string) {
    // Find relevant files
    const files = this.findFilesRecursively(folderPath);
    const conceptFile = files.find(f => f.match(/sct2_Concept_Snapshot_.*\.txt$/));
    const descriptionFile = files.find(f => f.match(/sct2_Description_Snapshot-en_.*\.txt$/));
    const relationshipFile = files.find(f => f.match(/sct2_Relationship_Snapshot_.*\.txt$/)); // If needed
    const mappingFile = files.find(f => f.match(/der2_iisssccRefset_ExtendedMapSnapshot_.*\.txt$/)); // SNOMED to ICD10 map

    if (!conceptFile && !descriptionFile && !mappingFile && !relationshipFile) {
        throw new Error('No valid SNOMED CT RF2 Snapshot files found (Concept, Description, Relationship, or ExtendedMap).');
    }

    // Calculate total size for progress
    const filePaths = [conceptFile, descriptionFile, relationshipFile, mappingFile].filter(Boolean) as string[];
    const totalBytes = filePaths.reduce((acc, f) => acc + fs.statSync(f).size, 0);
    let processedBytes = 0;

    const masterDb = await this.getMasterDb();
    const queryRunner = masterDb.createQueryRunner();
    await queryRunner.connect();

    try {
        if (conceptFile) {
            job.message = 'Importing Concepts...';
            processedBytes = await this.processFile(queryRunner, conceptFile, this.processors.concepts, job, true, totalBytes, processedBytes);
        }
        if (descriptionFile) {
            job.message = 'Importing Descriptions...';
            processedBytes = await this.processFile(queryRunner, descriptionFile, this.processors.descriptions, job, true, totalBytes, processedBytes);
        }
        if (relationshipFile) {
            job.message = 'Importing Relationships...';
            processedBytes = await this.processFile(queryRunner, relationshipFile, this.processors.relationships, job, true, totalBytes, processedBytes);
        }
        if (mappingFile) {
            job.message = 'Importing Mappings...';
            processedBytes = await this.processFile(queryRunner, mappingFile, this.processors.mappings, job, true, totalBytes, processedBytes);
        }

        job.message = 'Refreshing Materialized Views...';
        // CONCURRENTLY allows reads to continue during refresh (requires unique index on description_id)
        await queryRunner.query('REFRESH MATERIALIZED VIEW CONCURRENTLY snomed_search_view');
        
    } finally {
        await queryRunner.release();
    }
  }

  private async importIcd10FromFolder(job: ImportStatus, folderPath: string) {
      const files = this.findFilesRecursively(folderPath);
      const codeFile = files.find(f => f.match(/icd10cm_order_.*\.txt$/) || f.match(/icd10cm-codes-.*\.txt$/)); 
      
      if (!codeFile) {
          throw new Error('No recognized ICD-10 code file found (expected icd10cm_order_*.txt or icd10cm-codes-*.txt).');
      }

      const totalBytes = fs.statSync(codeFile).size;

      const masterDb = await this.getMasterDb();
      const queryRunner = masterDb.createQueryRunner();
      await queryRunner.connect();

      try {
          job.message = 'Importing ICD-10 Codes...';
          await this.processFile(queryRunner, codeFile, this.processors.icd10, job, false, totalBytes, 0);
      } finally {
          await queryRunner.release();
      }
  }

  private async importIcd11FromFolder(job: ImportStatus, folderPath: string) {
    const files = this.findFilesRecursively(folderPath);
    // WHO distributes ICD-11 as JSON (linearization export) or CSV
    const jsonFile = files.find(f => f.match(/icd11.*\.json$/i) || f.match(/linearization.*\.json$/i));
    const csvFile  = files.find(f => f.match(/icd11.*\.csv$/i)  || f.match(/mms.*\.csv$/i));

    if (!jsonFile && !csvFile) {
      throw new Error('No ICD-11 file found. Expected a JSON linearization export (icd11*.json) or CSV (icd11*.csv) inside the zip.');
    }

    const masterDb = await this.getMasterDb();
    const queryRunner = masterDb.createQueryRunner();
    await queryRunner.connect();

    try {
      if (jsonFile) {
        job.message = 'Parsing ICD-11 JSON...';
        await this.saveJob(job);

        const raw = fs.readFileSync(jsonFile, 'utf8');
        let entities: any[] = [];

        const parsed = JSON.parse(raw);
        // Support both { entities: [] } wrapper and bare array
        if (Array.isArray(parsed)) {
          entities = parsed;
        } else if (Array.isArray(parsed.entities)) {
          entities = parsed.entities;
        } else if (Array.isArray(parsed.linearization)) {
          entities = parsed.linearization;
        }

        if (entities.length === 0) {
          throw new Error('ICD-11 JSON contained no recognisable entities array.');
        }

        job.message = `Importing ${entities.length.toLocaleString()} ICD-11 codes...`;
        await this.saveJob(job);

        const BATCH_SIZE = 2000;
        let batch: any[] = [];
        let count = 0;

        for (const entity of entities) {
          // Normalise: WHO JSON uses @value wrappers on string fields
          const code  = String(entity.code  || '').trim();
          const title = typeof entity.title === 'object'
            ? String((entity.title as any)['@value'] || '')
            : String(entity.title || '').trim();
          if (!code || !title) continue;

          const parentCode = (() => {
            const p = entity.parent;
            if (!p) return null;
            const arr = Array.isArray(p) ? p : [p];
            const uri = String(arr[0] || '');
            const match = uri.match(/entity\/([A-Z0-9.]+)$/);
            return match ? match[1] : null;
          })();

          batch.push({
            tableName: 'icd11_codes',
            columns: ['code', 'title', 'parent_code', 'chapter', 'billable', 'valid_for_coding'],
            values: [code, title, parentCode, entity.chapter || null, true, true],
          });

          if (batch.length >= BATCH_SIZE) {
            await this.insertBatch(queryRunner, batch);
            count += batch.length;
            batch = [];
            job.processedRows = count;
            job.progress = Math.min(Math.round((count / entities.length) * 99), 99);
            if (count % 10000 === 0) {
              job.message = `Importing ICD-11 codes... (${count.toLocaleString()} of ${entities.length.toLocaleString()})`;
              await this.saveJob(job);
            }
          }
        }

        if (batch.length > 0) {
          await this.insertBatch(queryRunner, batch);
          count += batch.length;
          job.processedRows = count;
          await this.saveJob(job);
        }
      } else if (csvFile) {
        // CSV fallback — tab or comma separated: code, title[, parent_code, chapter]
        job.message = 'Importing ICD-11 from CSV...';
        const totalBytes = fs.statSync(csvFile).size;
        await this.processFile(queryRunner, csvFile, (row: string[]) => {
          const code  = (row[0] || '').trim();
          const title = (row[1] || '').trim();
          if (!code || !title) return null;
          return {
            tableName: 'icd11_codes',
            columns: ['code', 'title', 'parent_code', 'chapter', 'billable', 'valid_for_coding'],
            values: [code, title, row[2] || null, row[3] || null, true, true],
          };
        }, job, true, totalBytes, 0);
      }
    } finally {
      await queryRunner.release();
    }
  }

  private findFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(this.findFilesRecursively(file));
        } else {
            results.push(file);
        }
    });
    return results;
  }

  private async processFile(
      queryRunner: any, 
      filePath: string, 
      processor: any, 
      job: ImportStatus, 
      hasHeader: boolean,
      totalJobBytes: number,
      previousBytes: number
    ): Promise<number> {
      
      const BATCH_SIZE = 2000;
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
      });

      const stats = fs.statSync(filePath);
      const fileBytes = stats.size;
      let lastProgressUpdate = Date.now();

      let batch: any[] = [];
      let count = 0;
      let isHeader = hasHeader;

      for await (const line of rl) {
          if (isHeader) {
              isHeader = false;
              continue; 
          }

          if (!line.trim()) continue;
          
          const row = line.split('\t').map(c => c.trim());
          const item = processor(row);
          
          if (item) {
              batch.push(item);
          }

          if (batch.length >= BATCH_SIZE) {
              await this.insertBatch(queryRunner, batch);
              count += batch.length;
              batch = [];
              job.processedRows = (job.processedRows || 0) + BATCH_SIZE;
              
              // Update progress based on total job bytes
              const currentFileBytes = fileStream.bytesRead;
              const totalProcessed = previousBytes + currentFileBytes;
              const progress = Math.min(Math.round((totalProcessed / totalJobBytes) * 100), 99);
              
              // Update status every 1 second max
              if (Date.now() - lastProgressUpdate > 1000) {
                  job.progress = progress;
                  job.message = `Importing... (${(job.processedRows || 0).toLocaleString()} rows)`;
                  await this.saveJob(job);
                  lastProgressUpdate = Date.now();
              }
          }
      }

      if (batch.length > 0) {
          await this.insertBatch(queryRunner, batch);
          count += batch.length;
          job.processedRows = (job.processedRows || 0) + batch.length;
          await this.saveJob(job);
      }
      
      return previousBytes + fileBytes;
  }

  private async insertBatch(queryRunner: any, batch: any[]) {
      if (batch.length === 0) return;

      const tableName = batch[0].tableName;
      const columns = batch[0].columns;
      
      const values: any[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((item, i) => {
          const rowPlaceholders: string[] = [];
          item.values.forEach((val: any, j: number) => {
              values.push(val);
              rowPlaceholders.push(`$${values.length}`);
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
      });

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT DO NOTHING
      `;

      await queryRunner.query(query, values);
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr.length !== 8) return null;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }

  private parseBool(boolStr: string): boolean {
    return boolStr === '1';
  }

  private processors = {
    concepts: (row: string[]) => {
      if (row.length < 5) return null;
      return {
        tableName: 'snomed_concepts',
        columns: ['concept_id', 'effective_time', 'active', 'module_id', 'definition_status_id'],
        values: [
          row[0],
          this.parseDate(row[1]),
          this.parseBool(row[2]),
          row[3],
          row[4]
        ]
      };
    },
    descriptions: (row: string[]) => {
      if (row.length < 9) return null;
      return {
        tableName: 'snomed_descriptions',
        columns: ['description_id', 'effective_time', 'active', 'module_id', 'concept_id', 'language_code', 'type_id', 'term', 'case_significance_id'],
        values: [
          row[0],
          this.parseDate(row[1]),
          this.parseBool(row[2]),
          row[3],
          row[4],
          row[5],
          row[6],
          row[7],
          row[8]
        ]
      };
    },
    relationships: (row: string[]) => {
      if (row.length < 10) return null;
      return {
        tableName: 'snomed_relationships',
        columns: ['relationship_id', 'effective_time', 'active', 'module_id', 'source_id', 'destination_id', 'relationship_group', 'type_id', 'characteristic_type_id', 'modifier_id'],
        values: [
          row[0],
          this.parseDate(row[1]),
          this.parseBool(row[2]),
          row[3],
          row[4],
          row[5],
          parseInt(row[6]),
          row[7],
          row[8],
          row[9]
        ]
      };
    },
    mappings: (row: string[]) => {
      // Extended Map has 13 columns (0-12)
      if (row.length < 13) return null;

      const mapTarget = row[10];
      if (!mapTarget || mapTarget.includes('?')) return null; // Skip unmapped

      let icd10 = mapTarget.replace(/\./g, '');

      return {
        tableName: 'snomed_to_icd10_map',
        columns: ['snomed_code', 'snomed_term', 'icd10_code', 'map_category', 'map_rule', 'map_priority', 'correlation', 'active'],
        values: [
          row[5], // snomed_code
          '', // snomed_term (Not available in map file)
          icd10, // icd10_code
          row[12] || null, // map_category
          row[8] || null, // map_rule
          parseInt(row[7]) || 1, // map_priority
          row[11] || null, // correlation
          this.parseBool(row[2]) // active
        ]
      };
    },
    icd11: (row: any) => {
      // row is a plain object from ICD-11 JSON (not a tab-split string[])
      const code  = String(row.code  || '').trim();
      const title = String(row.title || row.classKind || '').trim();
      if (!code || !title) return null;
      return {
        tableName: 'icd11_codes',
        columns: ['code', 'title', 'parent_code', 'chapter', 'billable', 'valid_for_coding'],
        values: [
          code,
          title,
          row.parentCode || null,
          row.chapter    || null,
          true,
          true,
        ],
      };
    },
    icd10: (row: string[]) => {
        // Handle fixed-width icd10cm_order files
        // These files usually don't contain tabs, so split('\t') returns an array of length 1.
        // Format: Sequence(5) Blank(1) Code(7) Blank(1) Header(1) Blank(1) ShortDesc(60) LongDesc(Variable)
        // Code starts at index 6 (7 chars)
        // Long Description starts at index 77
        
        if (row.length === 1 && row[0].length > 20) {
            const line = row[0];
            const code = line.substring(6, 13).trim(); 
            const desc = line.substring(77).trim(); 
            
            if (code && desc) {
                 return {
                    tableName: 'icd10_codes',
                    columns: ['code', 'description', 'valid_for_coding', 'billable'],
                    values: [code, desc, true, true]
                 };
            }
        }
        
        // Handle tab-separated files (icd10cm-codes-*.txt)
        if (row.length >= 2) {
             return {
                tableName: 'icd10_codes',
                columns: ['code', 'description', 'valid_for_coding', 'billable'],
                values: [row[0], row[1], true, true]
             };
        }
        return null;
    }
  };
}
