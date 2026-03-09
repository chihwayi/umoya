import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { CodeSuggestion } from './encounter-coding.service';

export interface TrainResult {
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  sampleCount: number;
}

export interface CodingTrainResult {
  corpusSize: number;
  vocabularySize: number;
  version: string;
}

@Injectable()
export class MlModelsService {
  private readonly logger = new Logger(MlModelsService.name);
  private readonly MIN_TRAINING_SAMPLES = 50;
  private readonly MIN_CODING_SAMPLES = 20;
  private readonly LEARNING_RATE = 0.01;
  private readonly EPOCHS = 100;

  private readonly STOPWORDS = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'was', 'are', 'were',
    'been', 'has', 'had', 'but', 'not', 'all', 'can', 'her', 'his', 'one',
    'our', 'out', 'its', 'also', 'will', 'just', 'more', 'some', 'than',
    'them', 'then', 'what', 'when', 'who', 'how', 'each', 'she', 'which',
    'their', 'time', 'very', 'your', 'they', 'have', 'does', 'did', 'get',
    'may', 'new', 'now', 'way', 'use', 'any', 'about', 'there', 'other',
    'into', 'could', 'these', 'would', 'being', 'over', 'after', 'patient',
  ]);

  private readonly APT_TYPE_MAP: Record<string, number> = {
    consultation: 0.2, follow_up: 0.4, follow_up_visit: 0.4, emergency: 0.6,
    new_patient: 0.3, routine: 0.35, physical: 0.35, telehealth: 0.5, other: 0.5,
  };

  // ─── Logistic Regression: No-Show Prediction ───

  async trainNoShowModel(tenantDb: DataSource): Promise<TrainResult | null> {
    const rows = await tenantDb.query(`
      SELECT
        p.no_show_probability, p.actual_outcome, p.risk_factors,
        a.appointment_date, a.appointment_type, a.created_at, a.patient_id,
        (SELECT COUNT(*) FROM appointments a2
         WHERE a2.patient_id = a.patient_id AND a2.status = 'no_show'
         AND a2.appointment_date < a.appointment_date) as prev_no_shows,
        (SELECT COUNT(*) FROM appointments a3
         WHERE a3.patient_id = a.patient_id
         AND a3.appointment_date < a.appointment_date) as total_past,
        (SELECT COUNT(*) FROM appointments a4
         WHERE a4.patient_id = a.patient_id AND a4.status = 'cancelled'
         AND a4.appointment_date < a.appointment_date) as cancelled_count
      FROM appointment_no_show_predictions p
      JOIN appointments a ON a.id = p.appointment_id
      WHERE p.actual_outcome IS NOT NULL
        AND p.actual_outcome IN ('attended', 'no_show')
    `);

    if (!rows?.length || rows.length < this.MIN_TRAINING_SAMPLES) {
      this.logger.warn(`Not enough training data for no-show model: ${rows?.length || 0} samples (need ${this.MIN_TRAINING_SAMPLES})`);
      return null;
    }

    const features: number[][] = [];
    const labels: number[] = [];

    for (const r of rows) {
      const totalPast = parseInt(r.total_past, 10) || 0;
      const prevNoShows = parseInt(r.prev_no_shows, 10) || 0;
      const cancelledCount = parseInt(r.cancelled_count, 10) || 0;
      const appointmentDate = new Date(r.appointment_date);
      const createdAt = new Date(r.created_at);
      const leadDays = Math.max(0, (appointmentDate.getTime() - createdAt.getTime()) / 86400000);

      features.push([
        totalPast > 0 ? prevNoShows / totalPast : 0.15,
        Math.min(leadDays, 90) / 90,
        appointmentDate.getDay() / 6,
        appointmentDate.getHours() / 23,
        totalPast === 0 ? 1 : 0,
        totalPast > 0 ? cancelledCount / totalPast : 0,
        Math.min(prevNoShows, 10) / 10,
        this.APT_TYPE_MAP[(r.appointment_type || 'other').toLowerCase()] || 0.5,
      ]);
      labels.push(r.actual_outcome === 'no_show' ? 1 : 0);
    }

    const { means, stds } = this.computeMeansAndStds(features);
    const normalized = this.zScoreNormalize(features, means, stds);

    const splitIdx = Math.floor(normalized.length * 0.8);
    const trainX = normalized.slice(0, splitIdx);
    const trainY = labels.slice(0, splitIdx);
    const testX = normalized.slice(splitIdx);
    const testY = labels.slice(splitIdx);

    const numFeatures = trainX[0]?.length || 8;
    const weights = new Array(numFeatures).fill(0);
    let intercept = 0;

    for (let epoch = 0; epoch < this.EPOCHS; epoch++) {
      for (let i = 0; i < trainX.length; i++) {
        const z = this.dot(weights, trainX[i]) + intercept;
        const pred = this.sigmoid(z);
        const error = pred - trainY[i];
        for (let j = 0; j < weights.length; j++) {
          weights[j] -= this.LEARNING_RATE * error * trainX[i][j];
        }
        intercept -= this.LEARNING_RATE * error;
      }
    }

    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < testX.length; i++) {
      const z = this.dot(weights, testX[i]) + intercept;
      const predicted = this.sigmoid(z) >= 0.5 ? 1 : 0;
      const actual = testY[i];
      if (predicted === 1 && actual === 1) tp++;
      else if (predicted === 1 && actual === 0) fp++;
      else if (predicted === 0 && actual === 0) tn++;
      else fn++;
    }

    const total = tp + fp + tn + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;

    const version = `lr_v${Date.now()}`;
    const featureNames = [
      'historical_no_show_rate', 'lead_days_norm', 'day_of_week_norm',
      'hour_of_day_norm', 'is_new_patient', 'cancellation_rate',
      'previous_no_shows_norm', 'appointment_type_encoded',
    ];

    await tenantDb.query(
      `UPDATE ml_training_snapshots SET is_active = false WHERE model_name = 'no_show_logistic'`,
    );

    const dataHash = createHash('sha256').update(JSON.stringify(features.slice(0, 10))).digest('hex').substring(0, 16);
    await tenantDb.query(
      `INSERT INTO ml_training_snapshots
        (model_name, model_version, training_data_hash, feature_names, feature_weights,
         feature_means, feature_stds, intercept, performance_metrics, training_sample_count, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        'no_show_logistic', version, dataHash,
        JSON.stringify(featureNames), JSON.stringify(weights),
        JSON.stringify(means), JSON.stringify(stds),
        intercept, JSON.stringify({ accuracy, precision, recall, tp, fp, tn, fn }),
        rows.length,
      ],
    );

    this.logger.log(`Trained no-show model ${version}: accuracy=${accuracy.toFixed(3)}, precision=${precision.toFixed(3)}, recall=${recall.toFixed(3)}, samples=${rows.length}`);
    return { version, accuracy, precision, recall, sampleCount: rows.length };
  }

  async predictNoShowMl(tenantDb: DataSource, appointmentId: string, patientId: string): Promise<number | null> {
    const snapshot = await tenantDb.query(
      `SELECT feature_weights, feature_means, feature_stds, intercept
       FROM ml_training_snapshots
       WHERE model_name = 'no_show_logistic' AND is_active = true
       LIMIT 1`,
    );
    if (!snapshot?.length) return null;

    const weights: number[] = typeof snapshot[0].feature_weights === 'string'
      ? JSON.parse(snapshot[0].feature_weights) : snapshot[0].feature_weights;
    const means: number[] = typeof snapshot[0].feature_means === 'string'
      ? JSON.parse(snapshot[0].feature_means) : snapshot[0].feature_means;
    const stds: number[] = typeof snapshot[0].feature_stds === 'string'
      ? JSON.parse(snapshot[0].feature_stds) : snapshot[0].feature_stds;
    const intercept: number = parseFloat(snapshot[0].intercept) || 0;

    const aptRows = await tenantDb.query(`
      SELECT a.appointment_date, a.appointment_type, a.created_at,
        (SELECT COUNT(*) FROM appointments a2
         WHERE a2.patient_id = $1 AND a2.status = 'no_show'
         AND a2.appointment_date < a.appointment_date) as prev_no_shows,
        (SELECT COUNT(*) FROM appointments a3
         WHERE a3.patient_id = $1
         AND a3.appointment_date < a.appointment_date) as total_past,
        (SELECT COUNT(*) FROM appointments a4
         WHERE a4.patient_id = $1 AND a4.status = 'cancelled'
         AND a4.appointment_date < a.appointment_date) as cancelled_count
      FROM appointments a WHERE a.id = $2 LIMIT 1
    `, [patientId, appointmentId]);

    if (!aptRows?.length) return null;

    const r = aptRows[0];
    const totalPast = parseInt(r.total_past, 10) || 0;
    const prevNoShows = parseInt(r.prev_no_shows, 10) || 0;
    const cancelledCount = parseInt(r.cancelled_count, 10) || 0;
    const appointmentDate = new Date(r.appointment_date);
    const createdAt = new Date(r.created_at);
    const leadDays = Math.max(0, (appointmentDate.getTime() - createdAt.getTime()) / 86400000);

    const raw = [
      totalPast > 0 ? prevNoShows / totalPast : 0.15,
      Math.min(leadDays, 90) / 90,
      appointmentDate.getDay() / 6,
      appointmentDate.getHours() / 23,
      totalPast === 0 ? 1 : 0,
      totalPast > 0 ? cancelledCount / totalPast : 0,
      Math.min(prevNoShows, 10) / 10,
      this.APT_TYPE_MAP[(r.appointment_type || 'other').toLowerCase()] || 0.5,
    ];

    const normalized = raw.map((v, i) => (stds[i] || 1) !== 0 ? (v - (means[i] || 0)) / (stds[i] || 1) : 0);
    const z = this.dot(weights, normalized) + intercept;
    return Math.max(0.01, Math.min(0.99, this.sigmoid(z)));
  }

  // ─── TF-IDF: Encounter Coding ───

  async trainCodingModel(tenantDb: DataSource): Promise<CodingTrainResult | null> {
    const rows = await tenantDb.query(
      `SELECT id, clinical_text, accepted_icd_codes, accepted_cpt_codes FROM ml_coding_corpus`,
    );

    if (!rows?.length || rows.length < this.MIN_CODING_SAMPLES) {
      this.logger.warn(`Not enough coding corpus: ${rows?.length || 0} (need ${this.MIN_CODING_SAMPLES})`);
      return null;
    }

    const docs: { id: string; tokens: string[]; icd: string[]; cpt: string[] }[] = [];
    const docFreq: Record<string, number> = {};

    for (const r of rows) {
      const tokens = this.tokenize(r.clinical_text);
      const icd = typeof r.accepted_icd_codes === 'string' ? JSON.parse(r.accepted_icd_codes) : (r.accepted_icd_codes || []);
      const cpt = typeof r.accepted_cpt_codes === 'string' ? JSON.parse(r.accepted_cpt_codes) : (r.accepted_cpt_codes || []);
      docs.push({ id: r.id, tokens, icd, cpt });

      const uniqueTokens = new Set(tokens);
      for (const t of uniqueTokens) {
        docFreq[t] = (docFreq[t] || 0) + 1;
      }
    }

    const totalDocs = docs.length;
    const idf: Record<string, number> = {};
    for (const [token, df] of Object.entries(docFreq)) {
      idf[token] = Math.log(totalDocs / df);
    }

    for (const doc of docs) {
      const tf: Record<string, number> = {};
      for (const t of doc.tokens) {
        tf[t] = (tf[t] || 0) + 1;
      }
      const totalTokens = doc.tokens.length || 1;
      const vector: Record<string, number> = {};
      for (const [token, count] of Object.entries(tf)) {
        if (idf[token]) {
          vector[token] = (count / totalTokens) * idf[token];
        }
      }

      await tenantDb.query(
        `UPDATE ml_coding_corpus SET tfidf_vector = $1 WHERE id = $2`,
        [JSON.stringify(vector), doc.id],
      );
    }

    await tenantDb.query(
      `UPDATE ml_training_snapshots SET is_active = false WHERE model_name = 'coding_tfidf'`,
    );

    const version = `tfidf_v${Date.now()}`;
    await tenantDb.query(
      `INSERT INTO ml_training_snapshots
        (model_name, model_version, feature_weights, training_sample_count, is_active,
         performance_metrics)
       VALUES ($1, $2, $3, $4, true, $5)`,
      [
        'coding_tfidf', version, JSON.stringify(idf), totalDocs,
        JSON.stringify({ vocabularySize: Object.keys(idf).length, corpusSize: totalDocs }),
      ],
    );

    this.logger.log(`Trained coding TF-IDF model ${version}: corpus=${totalDocs}, vocab=${Object.keys(idf).length}`);
    return { corpusSize: totalDocs, vocabularySize: Object.keys(idf).length, version };
  }

  async suggestCodesMl(
    tenantDb: DataSource,
    clinicalText: string,
  ): Promise<{ icd10: CodeSuggestion[]; cpt: CodeSuggestion[] } | null> {
    const snapshot = await tenantDb.query(
      `SELECT feature_weights FROM ml_training_snapshots
       WHERE model_name = 'coding_tfidf' AND is_active = true LIMIT 1`,
    );
    if (!snapshot?.length) return null;

    const idf: Record<string, number> = typeof snapshot[0].feature_weights === 'string'
      ? JSON.parse(snapshot[0].feature_weights) : snapshot[0].feature_weights;

    const inputTokens = this.tokenize(clinicalText);
    if (!inputTokens.length) return null;

    const inputTf: Record<string, number> = {};
    for (const t of inputTokens) {
      inputTf[t] = (inputTf[t] || 0) + 1;
    }
    const totalTokens = inputTokens.length;
    const inputVector: Record<string, number> = {};
    for (const [token, count] of Object.entries(inputTf)) {
      if (idf[token]) {
        inputVector[token] = (count / totalTokens) * idf[token];
      }
    }

    const corpus = await tenantDb.query(
      `SELECT id, tfidf_vector, accepted_icd_codes, accepted_cpt_codes
       FROM ml_coding_corpus WHERE tfidf_vector IS NOT NULL`,
    );
    if (!corpus?.length) return null;

    const similarities: { sim: number; icd: string[]; cpt: string[] }[] = [];
    for (const row of corpus) {
      const docVector: Record<string, number> = typeof row.tfidf_vector === 'string'
        ? JSON.parse(row.tfidf_vector) : (row.tfidf_vector || {});
      const sim = this.cosineSimilarity(inputVector, docVector);
      if (sim > 0.05) {
        const icd = typeof row.accepted_icd_codes === 'string' ? JSON.parse(row.accepted_icd_codes) : (row.accepted_icd_codes || []);
        const cpt = typeof row.accepted_cpt_codes === 'string' ? JSON.parse(row.accepted_cpt_codes) : (row.accepted_cpt_codes || []);
        similarities.push({ sim, icd, cpt });
      }
    }

    similarities.sort((a, b) => b.sim - a.sim);
    const top5 = similarities.slice(0, 5);
    if (!top5.length) return null;

    const icdScores: Record<string, { score: number; count: number }> = {};
    const cptScores: Record<string, { score: number; count: number }> = {};

    for (const entry of top5) {
      for (const code of entry.icd) {
        if (!icdScores[code]) icdScores[code] = { score: 0, count: 0 };
        icdScores[code].score += entry.sim;
        icdScores[code].count++;
      }
      for (const code of entry.cpt) {
        if (!cptScores[code]) cptScores[code] = { score: 0, count: 0 };
        cptScores[code].score += entry.sim;
        cptScores[code].count++;
      }
    }

    const icd10: CodeSuggestion[] = Object.entries(icdScores)
      .filter(([, v]) => v.score > 0.3)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 10)
      .map(([code, v]) => ({
        code,
        description: `ML-suggested (${v.count} similar encounters)`,
        confidence: Math.min(0.95, v.score / top5.length),
      }));

    const cpt: CodeSuggestion[] = Object.entries(cptScores)
      .filter(([, v]) => v.score > 0.3)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 10)
      .map(([code, v]) => ({
        code,
        description: `ML-suggested (${v.count} similar encounters)`,
        confidence: Math.min(0.95, v.score / top5.length),
      }));

    if (icd10.length === 0 && cpt.length === 0) return null;
    return { icd10, cpt };
  }

  // ─── Utility functions ───

  sigmoid(z: number): number {
    const clamped = Math.max(-500, Math.min(500, z));
    return 1 / (1 + Math.exp(-clamped));
  }

  dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * (b[i] || 0);
    }
    return sum;
  }

  cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (const key of Object.keys(a)) {
      magA += a[key] * a[key];
      if (b[key]) dotProduct += a[key] * b[key];
    }
    for (const key of Object.keys(b)) {
      magB += b[key] * b[key];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
  }

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length >= 3 && !this.STOPWORDS.has(t));
  }

  zScoreNormalize(data: number[][], means: number[], stds: number[]): number[][] {
    return data.map((row) =>
      row.map((val, col) => {
        const std = stds[col] || 1;
        return std !== 0 ? (val - (means[col] || 0)) / std : 0;
      }),
    );
  }

  computeMeansAndStds(data: number[][]): { means: number[]; stds: number[] } {
    if (!data.length) return { means: [], stds: [] };
    const numCols = data[0].length;
    const means = new Array(numCols).fill(0);
    const stds = new Array(numCols).fill(0);

    for (const row of data) {
      for (let c = 0; c < numCols; c++) {
        means[c] += row[c];
      }
    }
    for (let c = 0; c < numCols; c++) {
      means[c] /= data.length;
    }

    for (const row of data) {
      for (let c = 0; c < numCols; c++) {
        stds[c] += (row[c] - means[c]) ** 2;
      }
    }
    for (let c = 0; c < numCols; c++) {
      stds[c] = Math.sqrt(stds[c] / data.length);
    }

    return { means, stds };
  }
}
