import { Injectable } from '@nestjs/common';

const EVENT_COLUMN: Record<string, string> = {
  dispatched:       'dispatched_at',
  arrived_scene:    'arrived_scene_at',
  departed_scene:   'departed_scene_at',
  arrived_hospital: 'arrived_hospital_at',
  cleared:          'cleared_at',
};

@Injectable()
export class PatientTransportService {

  async getFleet(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM transport_vehicles WHERE is_active ORDER BY call_sign`);
  }

  async updateVehicleStatus(db: any, id: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE transport_vehicles SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id],
    );
    return rows[0] ?? null;
  }

  async createJob(db: any, crewLead: string, body: any): Promise<any> {
    const ref = `JOB-${Date.now().toString(36).toUpperCase()}`;
    const rows = await db.query(
      `INSERT INTO transport_jobs (job_ref, patient_id, vehicle_id, priority, incident_type, scene_address, destination, crew_lead)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ref, body.patientId ?? null, body.vehicleId ?? null, body.priority ?? 'p2',
       body.incidentType, body.sceneAddress ?? null, body.destination ?? null, crewLead],
    );
    if (body.vehicleId) {
      await db.query(`UPDATE transport_vehicles SET status='dispatched' WHERE id=$1`, [body.vehicleId]);
    }
    return rows[0] ?? null;
  }

  async updateJobTimeline(db: any, id: string, body: any): Promise<any> {
    const col = EVENT_COLUMN[body.event];
    if (!col) throw new Error(`Unknown event: ${body.event}`);
    const extra = body.outcome ? `, outcome=$2` : '';
    const params: any[] = [id];
    if (body.outcome) params.push(body.outcome);
    const rows = await db.query(
      `UPDATE transport_jobs SET ${col}=NOW()${extra} WHERE id=$1 RETURNING *, response_time_mins, p1_target_met`,
      params,
    );
    const result = rows[0];
    if (body.event === 'cleared' && result?.vehicle_id) {
      await db.query(`UPDATE transport_vehicles SET status='available' WHERE id=$1`, [result.vehicle_id]);
    }
    return result ?? null;
  }

  async getActiveJobs(db: any): Promise<any[]> {
    return db.query(
      `SELECT tj.*, tv.call_sign, p.first_name, p.last_name
       FROM transport_jobs tj
       LEFT JOIN transport_vehicles tv ON tv.id = tj.vehicle_id
       LEFT JOIN patients p ON p.id = tj.patient_id
       WHERE tj.cleared_at IS NULL
       ORDER BY tj.priority ASC, tj.call_received_at ASC`,
    );
  }

  async recordMistHandover(db: any, handoverTo: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO transport_mist_handovers
         (job_id, patient_id, mechanism, injuries_found, signs, treatment_given,
          gcs_at_scene, spo2_at_scene, rr_at_scene, bp_systolic_scene, bp_diastolic_scene,
          iv_access, iv_fluids_ml, airway_adjunct, handover_to)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [body.jobId, body.patientId ?? null, body.mechanism, body.injuriesFound,
       JSON.stringify(body.signs ?? {}), JSON.stringify(body.treatmentGiven ?? []),
       body.gcsAtScene ?? null, body.spo2AtScene ?? null, body.rrAtScene ?? null,
       body.bpSystolicScene ?? null, body.bpDiastolicScene ?? null,
       body.ivAccess ?? false, body.ivFluidsMl ?? null, body.airwayAdjunct ?? null, handoverTo],
    );
    return rows[0] ?? null;
  }

  async recordInterFacilityTransfer(db: any, acceptedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO inter_facility_transfers
         (patient_id, job_id, referring_facility, referring_clinician,
          receiving_facility, receiving_clinician, transfer_indication, transfer_level,
          gcs_at_departure, spo2_at_departure, bp_systolic_departure,
          iv_access_confirmed, monitoring_during, accepted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [body.patientId, body.jobId ?? null, body.referringFacility,
       body.referringClinician ?? null, body.receivingFacility,
       body.receivingClinician ?? null, body.transferIndication, body.transferLevel,
       body.gcsAtDeparture ?? null, body.spo2AtDeparture ?? null,
       body.bpSystolicDeparture ?? null, body.ivAccessConfirmed ?? false,
       body.monitoringDuring ?? null, acceptedBy],
    );
    return rows[0] ?? null;
  }

  async getQualityMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM transport_response_quality LIMIT 24`);
  }
}
