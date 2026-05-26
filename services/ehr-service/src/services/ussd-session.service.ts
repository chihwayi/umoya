import { Injectable, Logger } from '@nestjs/common';

export type UssdState =
  | 'MAIN_MENU'
  | 'APPOINTMENTS_VIEW'
  | 'APPOINTMENTS_CONFIRM'
  | 'APPOINTMENTS_RESCHEDULE_REASON'
  | 'REFILL_VIEW'
  | 'REFILL_CONFIRM'
  | 'OPT_OUT_CONFIRM';

interface UssdSession {
  session_id: string;
  phone_number: string;
  patient_id: string | null;
  current_state: UssdState;
  context: Record<string, unknown>;
  is_active: boolean;
}

export interface UssdResponse {
  text: string;
  continueSession: boolean;
}

@Injectable()
export class UssdSessionService {
  private readonly logger = new Logger(UssdSessionService.name);

  async handleCallback(
    sessionId: string,
    phoneNumber: string,
    text: string,
    db: any,
  ): Promise<UssdResponse> {
    await db.query(
      `UPDATE ussd_sessions SET is_active = false WHERE expires_at < NOW() AND is_active = true`,
    );

    let session = await this.getOrCreateSession(sessionId, phoneNumber, db);
    const patient = await this.lookupPatientByPhone(phoneNumber, db);
    if (patient && !session.patient_id) {
      session = await this.updateSessionPatient(session.session_id, patient.id, db);
    }

    const userInput = text.split('*').pop()?.trim() ?? '';
    return this.dispatch(session, userInput, db);
  }

  private async dispatch(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    switch (session.current_state) {
      case 'MAIN_MENU':
        return this.handleMainMenu(session, input, db);
      case 'APPOINTMENTS_VIEW':
        return this.handleAppointmentsView(session, input, db);
      case 'APPOINTMENTS_CONFIRM':
        return this.handleAppointmentsConfirm(session, input, db);
      case 'APPOINTMENTS_RESCHEDULE_REASON':
        return this.handleRescheduleReason(session, input, db);
      case 'REFILL_VIEW':
        return this.handleRefillView(session, input, db);
      case 'REFILL_CONFIRM':
        return this.handleRefillConfirm(session, input, db);
      case 'OPT_OUT_CONFIRM':
        return this.handleOptOutConfirm(session, input, db);
      default:
        await this.endSession(session.session_id, db);
        return { text: 'END Thank you for contacting Newlands Clinic.', continueSession: false };
    }
  }

  private async handleMainMenu(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    if (!input) {
      return {
        text: `CON Welcome to Newlands Clinic\n1. My next appointment\n2. Request medication refill\n3. My recent results\n4. Stop SMS reminders\n99. Exit`,
        continueSession: true,
      };
    }
    switch (input) {
      case '1':
        await this.transitionState(session.session_id, 'APPOINTMENTS_VIEW', {}, db);
        return this.handleAppointmentsView({ ...session, current_state: 'APPOINTMENTS_VIEW', context: {} }, '', db);
      case '2':
        await this.transitionState(session.session_id, 'REFILL_VIEW', {}, db);
        return this.handleRefillView({ ...session, current_state: 'REFILL_VIEW', context: {} }, '', db);
      case '3':
        return this.showLabResults(session, db);
      case '4':
        await this.transitionState(session.session_id, 'OPT_OUT_CONFIRM', {}, db);
        return {
          text: 'CON Are you sure you want to stop SMS reminders?\n1. Yes, stop reminders\n2. No, keep them',
          continueSession: true,
        };
      case '99':
        await this.endSession(session.session_id, db);
        return { text: 'END Thank you. Goodbye.', continueSession: false };
      default:
        return {
          text: 'CON Invalid option. Please try again:\n1. My next appointment\n2. Request medication refill\n3. My recent results\n4. Stop SMS reminders\n99. Exit',
          continueSession: true,
        };
    }
  }

  private async handleAppointmentsView(session: UssdSession, _input: string, db: any): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered. Please visit the clinic.', continueSession: false };
    }
    const [appt] = await db.query(
      `SELECT a.id, a.appointment_date::date as date,
              TO_CHAR(a.appointment_time, 'HH24:MI') as time,
              s.first_name || ' ' || s.last_name as provider_name
       FROM appointments a
       JOIN staff s ON s.id = a.provider_id
       WHERE a.patient_id = $1 AND a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled'
       ORDER BY a.appointment_date ASC LIMIT 1`,
      [session.patient_id],
    );
    if (!appt) {
      await this.endSession(session.session_id, db);
      return { text: 'END You have no upcoming appointments. Please call 0800 NEWLANDS to book.', continueSession: false };
    }
    await this.transitionState(session.session_id, 'APPOINTMENTS_CONFIRM', { appointment_id: appt.id }, db);
    return {
      text: `CON Your next appointment:\n${appt.date} at ${appt.time}\nWith: ${appt.provider_name}\n\n1. Confirm I will attend\n2. I cannot make it\n0. Back`,
      continueSession: true,
    };
  }

  private async handleAppointmentsConfirm(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    const apptId = (session.context as any).appointment_id;
    switch (input) {
      case '1':
        await db.query(
          `UPDATE appointments SET patient_confirmed = true, confirmed_at = NOW() WHERE id = $1`,
          [apptId],
        );
        await this.endSession(session.session_id, db);
        return { text: 'END Thank you! Your appointment is confirmed. We look forward to seeing you.', continueSession: false };
      case '2':
        await this.transitionState(session.session_id, 'APPOINTMENTS_RESCHEDULE_REASON', { appointment_id: apptId }, db);
        return {
          text: 'CON Sorry you cannot make it. Reason:\n1. Transport issues\n2. Work commitment\n3. Feeling unwell\n4. Family emergency\n5. Other',
          continueSession: true,
        };
      case '0':
        await this.transitionState(session.session_id, 'MAIN_MENU', {}, db);
        return this.handleMainMenu({ ...session, current_state: 'MAIN_MENU' }, '', db);
      default:
        return {
          text: 'CON Invalid option:\n1. Confirm I will attend\n2. I cannot make it\n0. Back',
          continueSession: true,
        };
    }
  }

  private async handleRescheduleReason(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    const reasons: Record<string, string> = {
      '1': 'Transport issues', '2': 'Work commitment',
      '3': 'Feeling unwell', '4': 'Family emergency', '5': 'Other',
    };
    const apptId = (session.context as any).appointment_id;
    const reason = reasons[input];
    if (!reason) {
      return {
        text: 'CON Invalid option. Select reason:\n1. Transport issues\n2. Work commitment\n3. Feeling unwell\n4. Family emergency\n5. Other',
        continueSession: true,
      };
    }
    await db.query(
      `UPDATE appointments SET status = 'rescheduling_requested', reschedule_reason = $2, reschedule_requested_at = NOW() WHERE id = $1`,
      [apptId, reason],
    );
    await this.endSession(session.session_id, db);
    return {
      text: 'END Your reschedule request has been noted. Our team will call you within 24 hours.',
      continueSession: false,
    };
  }

  private async handleRefillView(session: UssdSession, _input: string, db: any): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered. Please visit the clinic.', continueSession: false };
    }
    const [regimen] = await db.query(
      `SELECT h.current_regimen as regimen,
              m.next_pickup_date::date::text as next_pickup,
              (m.schedule_type IN ('3-month', '6-month')) as mmd_eligible
       FROM hiv_enrollments h
       LEFT JOIN hiv_mmd_schedules m ON m.patient_id = h.patient_id AND m.is_active = true
       WHERE h.patient_id = $1 AND h.status = 'active' LIMIT 1`,
      [session.patient_id],
    );
    if (!regimen) {
      await this.endSession(session.session_id, db);
      return { text: 'END No active regimen found. Please visit the clinic.', continueSession: false };
    }
    const pickupInfo = regimen.next_pickup ? `Next pickup: ${regimen.next_pickup}` : 'Pickup date not set';
    const mmdNote = regimen.mmd_eligible ? ' (Multi-month)' : '';
    await this.transitionState(session.session_id, 'REFILL_CONFIRM', { regimen: regimen.regimen, mmd_eligible: regimen.mmd_eligible }, db);
    return {
      text: `CON Your regimen:\n${regimen.regimen}${mmdNote}\n${pickupInfo}\n\n1. Request refill now\n2. I will come in person\n0. Back`,
      continueSession: true,
    };
  }

  private async handleRefillConfirm(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    switch (input) {
      case '1': {
        const isMmd = (session.context as any).mmd_eligible;
        await db.query(
          `INSERT INTO hiv_mmd_schedules (patient_id, schedule_type, next_pickup_date, requested_via_ussd, is_active, created_at)
           VALUES ($1, $2, CURRENT_DATE + INTERVAL '3 days', true, true, NOW())
           ON CONFLICT (patient_id) DO UPDATE SET next_pickup_date = CURRENT_DATE + INTERVAL '3 days', requested_via_ussd = true, updated_at = NOW()`,
          [session.patient_id, isMmd ? '3-month' : 'standard'],
        );
        await this.endSession(session.session_id, db);
        return { text: 'END Refill request received. Your medication will be ready in 3 days. You will receive an SMS when ready.', continueSession: false };
      }
      case '2':
        await this.endSession(session.session_id, db);
        return { text: 'END Thank you. Please visit us at your convenience.', continueSession: false };
      case '0':
        await this.transitionState(session.session_id, 'MAIN_MENU', {}, db);
        return this.handleMainMenu({ ...session, current_state: 'MAIN_MENU' }, '', db);
      default:
        return {
          text: 'CON Invalid option:\n1. Request refill now\n2. I will come in person\n0. Back',
          continueSession: true,
        };
    }
  }

  private async showLabResults(session: UssdSession, db: any): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered.', continueSession: false };
    }
    const [result] = await db.query(
      `SELECT test_type, result_value, result_date::date::text as result_date
       FROM lab_results WHERE patient_id = $1 AND is_released = true
       ORDER BY result_date DESC LIMIT 1`,
      [session.patient_id],
    );
    await this.endSession(session.session_id, db);
    if (!result) {
      return { text: 'END No recent results available. Please visit the clinic.', continueSession: false };
    }
    return {
      text: `END Your latest result:\n${result.test_type}: ${result.result_value}\nDate: ${result.result_date}\n\nFor details please visit the clinic.`,
      continueSession: false,
    };
  }

  private async handleOptOutConfirm(session: UssdSession, input: string, db: any): Promise<UssdResponse> {
    switch (input) {
      case '1':
        await db.query(
          `INSERT INTO sms_opt_outs (phone_number, patient_id, opted_out_at, reason) VALUES ($1, $2, NOW(), 'USSD opt-out') ON CONFLICT (phone_number) DO NOTHING`,
          [session.phone_number, session.patient_id],
        );
        await db.query(
          `UPDATE adherence_nudge_schedules SET is_active = false WHERE patient_id = $1`,
          [session.patient_id],
        );
        await this.endSession(session.session_id, db);
        return { text: 'END SMS reminders stopped. You can restart them at any time by visiting the clinic.', continueSession: false };
      case '2':
        await this.endSession(session.session_id, db);
        return { text: 'END Your SMS reminders will continue. Thank you.', continueSession: false };
      default:
        return {
          text: 'CON Invalid option:\n1. Yes, stop reminders\n2. No, keep them',
          continueSession: true,
        };
    }
  }

  private async getOrCreateSession(sessionId: string, phoneNumber: string, db: any): Promise<UssdSession> {
    const [existing] = await db.query(
      `SELECT * FROM ussd_sessions WHERE session_id = $1 AND is_active = true`,
      [sessionId],
    );
    if (existing) return existing as UssdSession;
    const [created] = await db.query(
      `INSERT INTO ussd_sessions (session_id, phone_number, current_state, context, expires_at) VALUES ($1, $2, 'MAIN_MENU', '{}', NOW() + INTERVAL '5 minutes') RETURNING *`,
      [sessionId, phoneNumber],
    );
    return created as UssdSession;
  }

  private async lookupPatientByPhone(phone: string, db: any): Promise<{ id: string } | null> {
    const [row] = await db.query(
      `SELECT id FROM patients WHERE phone_hash = encode(sha256($1::bytea), 'hex') LIMIT 1`,
      [phone],
    );
    return row ?? null;
  }

  private async transitionState(sessionId: string, newState: UssdState, context: Record<string, unknown>, db: any): Promise<void> {
    await db.query(
      `UPDATE ussd_sessions SET current_state = $2, context = $3, expires_at = NOW() + INTERVAL '5 minutes', updated_at = NOW() WHERE session_id = $1`,
      [sessionId, newState, JSON.stringify(context)],
    );
  }

  private async endSession(sessionId: string, db: any): Promise<void> {
    await db.query(
      `UPDATE ussd_sessions SET is_active = false, updated_at = NOW() WHERE session_id = $1`,
      [sessionId],
    );
  }

  private async updateSessionPatient(sessionId: string, patientId: string, db: any): Promise<UssdSession> {
    const [updated] = await db.query(
      `UPDATE ussd_sessions SET patient_id = $2, updated_at = NOW() WHERE session_id = $1 RETURNING *`,
      [sessionId, patientId],
    );
    return updated as UssdSession;
  }
}
