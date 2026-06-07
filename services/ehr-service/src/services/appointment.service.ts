import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { Repository, Between, Not, In } from 'typeorm';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { Vitals } from '../entities/vitals.entity';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from '../dto/appointment.dto';
import { TenantService } from './tenant.service';
import { FinanceService } from './finance.service';
import { DoctorAvailabilityService } from './doctor-availability.service';
import { TelemedicineService } from './telemedicine.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { PatientProService } from './patient-pro.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';
import { SchedulingIntelligenceService } from './scheduling-intelligence.service';
import { MlFeedbackService } from './ml-feedback.service';
import { SmsService } from './sms.service';
import { PAYMENT_STATUS } from '../constants/payment-status';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private tenantService: TenantService,
    private financeService: FinanceService,
    private doctorAvailabilityService: DoctorAvailabilityService,
    private telemedicineService: TelemedicineService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    @Optional() private patientProService?: PatientProService,
    @Optional() private workflowService?: ClinicalWorkflowService,
    @Optional() private schedulingIntelligenceService?: SchedulingIntelligenceService,
    @Optional() private mlFeedbackService?: MlFeedbackService,
    @Optional() private smsService?: SmsService,
  ) {}

  private async getAppointmentRepository(tenantId: string): Promise<Repository<AppointmentSimple>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(AppointmentSimple);
  }

  async create(createAppointmentDto: CreateAppointmentDto, userId: string, tenantId: string): Promise<AppointmentSimple> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    const appointmentRepository = connection.getRepository(AppointmentSimple);
    
    // Check if doctor is unavailable
    const appointmentDate = new Date(createAppointmentDto.appointmentDate);
    const isUnavailable = await this.doctorAvailabilityService.checkDoctorUnavailable(
      createAppointmentDto.doctorId,
      appointmentDate,
      createAppointmentDto.durationMinutes || 30,
      tenantId
    );
    
    if (isUnavailable) {
      throw new ConflictException('Doctor is not available at this time');
    }
    
    // Check for conflicts with other appointments
    await this.checkForConflicts(
      createAppointmentDto.doctorId,
      createAppointmentDto.appointmentDate,
      createAppointmentDto.durationMinutes || 30,
      tenantId
    );

    const defaultConsultationFee =
      process.env.DEFAULT_CONSULTATION_FEE !== undefined
        ? Number(process.env.DEFAULT_CONSULTATION_FEE)
        : 20;
    const amountCandidate =
      typeof createAppointmentDto.feeAmount === 'number'
        ? createAppointmentDto.feeAmount
        : defaultConsultationFee;
    const amount = Number.isFinite(Number(amountCandidate)) ? Number(amountCandidate) : 0;
    let paymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
    let status = 'scheduled';
    let financeTransactionId: string | null = null;

    if (amount > 0) {
      const transaction = await this.financeService.createTransaction(
        connection,
        {
          sourceModule: 'appointments',
          patientId: createAppointmentDto.patientId,
          amount,
          currency: 'USD',
          notes: createAppointmentDto.reason || 'Consultation fee',
          payerType: 'self',
          lineItems: [
            {
              description: createAppointmentDto.appointmentType || 'Consultation',
              billingCode: 'CONSULT',
              unitPrice: amount,
              quantity: 1,
            },
          ],
        },
        userId || createAppointmentDto.patientId,
      );
      financeTransactionId = transaction.id;
      paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
      status = 'awaiting_payment';
      // Update transaction with reference once appointment id is generated later
    }

    const appointment = appointmentRepository.create({
      ...createAppointmentDto,
      appointmentType: createAppointmentDto.appointmentType || 'consultation',
      durationMinutes: createAppointmentDto.durationMinutes || 30,
      createdBy: userId,
      status,
      feeAmount: amount || null,
      financeTransactionId,
      paymentStatus,
    });

    const savedAppointment = await appointmentRepository.save(appointment);

    try {
      let patientPhone = (createAppointmentDto as any).patientPhone ?? (createAppointmentDto as any).phone_number;
      if (!patientPhone) {
        const [patient] = await connection.query(
          `SELECT phone FROM patients WHERE id = $1 LIMIT 1`,
          [createAppointmentDto.patientId],
        );
        patientPhone = patient?.phone;
      }
      if (patientPhone && this.smsService) {
        const apptDate = new Date((createAppointmentDto as any).appointmentDate ?? (createAppointmentDto as any).start_time);
        await this.smsService.send(
          patientPhone,
          `Umoya: Appointment confirmed at ${(createAppointmentDto as any).facilityName ?? 'your clinic'} on ${apptDate.toDateString()} at ${apptDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}. Reply STOP to opt out.`,
        );
      }
    } catch {
      // SMS failure must never break appointment creation
    }

    if (financeTransactionId) {
      await connection.query(
        `UPDATE financial_transactions SET source_reference_id = $1 WHERE id = $2`,
        [savedAppointment.id, financeTransactionId],
      );
    }

    // Trigger workflow for appointment_scheduled
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'appointment_scheduled',
          {
            entityType: 'appointment',
            entityId: savedAppointment.id,
            patientId: savedAppointment.patientId,
            data: {
              appointmentType: savedAppointment.appointmentType,
              priority: savedAppointment.priorityLevel,
              start: savedAppointment.appointmentDate,
              end: new Date(new Date(savedAppointment.appointmentDate).getTime() + savedAppointment.durationMinutes * 60000),
              doctorId: savedAppointment.doctorId,
            },
          },
          connection,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for appointment_scheduled: ${error.message}`);
      }
    }

    // If this is a telehealth appointment, create a telemedicine consultation
    if (createAppointmentDto.isTelehealth) {
      try {
        const appointmentDate = typeof createAppointmentDto.appointmentDate === 'string' 
          ? new Date(createAppointmentDto.appointmentDate)
          : createAppointmentDto.appointmentDate;
        
        const consultation = await this.telemedicineService.createConsultation(
          connection,
          {
            appointmentId: savedAppointment.id,
            patientId: createAppointmentDto.patientId,
            doctorId: createAppointmentDto.doctorId,
            consultationType: 'video',
            scheduledStartTime: appointmentDate.toISOString(),
            notes: createAppointmentDto.reason || createAppointmentDto.notes,
          },
          userId,
        );

        // Update appointment with meeting URL
        if (consultation.meetingUrl) {
          await connection.query(
            `UPDATE appointments SET virtual_meeting_url = $1 WHERE id = $2`,
            [consultation.meetingUrl, savedAppointment.id],
          );
          savedAppointment.virtualMeetingUrl = consultation.meetingUrl;
        }
      } catch (error) {
        this.logger.error(`Failed to create telemedicine consultation for appointment ${savedAppointment.id}:`, error);
        // Don't fail the appointment creation if telemedicine setup fails
      }
    }

    // Auto-assign pre-visit questionnaires based on appointment type
    if (this.patientProService) {
      try {
        const appointmentDate = typeof createAppointmentDto.appointmentDate === 'string' 
          ? new Date(createAppointmentDto.appointmentDate)
          : createAppointmentDto.appointmentDate;
        
        const appointmentDateStr = appointmentDate.toISOString();
        
        await this.patientProService.autoAssignPreVisitQuestionnaires(
          connection,
          createAppointmentDto.patientId,
          savedAppointment.id,
          createAppointmentDto.appointmentType || 'consultation',
          appointmentDateStr,
        );
        this.logger.log(`Pre-visit questionnaires assigned for appointment ${savedAppointment.id}`);
      } catch (error) {
        this.logger.error(`Failed to assign pre-visit questionnaires for appointment ${savedAppointment.id}:`, error);
        // Don't fail the appointment creation if questionnaire assignment fails
      }
    }

    if (this.schedulingIntelligenceService) {
      try {
        await this.schedulingIntelligenceService.predictNoShow(connection, savedAppointment.id, savedAppointment.patientId);
      } catch (error) {
        this.logger.warn(`No-show prediction failed for appointment ${savedAppointment.id}: ${error.message}`);
      }
    }

    return savedAppointment;
  }

  async findAll(query: AppointmentQueryDto, tenantId: string): Promise<{ appointments: any[]; total: number }> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    // Build query
    const queryBuilder = appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.createdByUser', 'createdByUser');

    // Apply filters
    if (query.startDate && query.endDate) {
      // Date range filter (for calendar views)
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      
      queryBuilder.andWhere('appointment.appointmentDate >= :startDate', { startDate })
                  .andWhere('appointment.appointmentDate <= :endDate', { endDate });
    } else if (query.date) {
      // Single date filter
      const startDate = new Date(query.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      queryBuilder.andWhere('appointment.appointmentDate >= :startDate', { startDate })
                  .andWhere('appointment.appointmentDate < :endDate', { endDate });
    }

    if (query.status && query.status !== 'all') {
      queryBuilder.andWhere('appointment.status = :status', { status: query.status });
    }

    if (query.doctorId) {
      queryBuilder.andWhere('appointment.doctorId = :doctorId', { doctorId: query.doctorId });
    }

    if (query.patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', { patientId: query.patientId });
    }

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // Apply sorting
    queryBuilder.orderBy('appointment.appointmentDate', 'ASC');

    // Get appointments and total count
    const [appointments, total] = await queryBuilder.getManyAndCount();

    // Fetch Vitals and Triage for these appointments to support task synchronization
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    let vitalsMap = new Map<string, Vitals[]>();
    let triageMap = new Map<string, TriageAssessment[]>();

    if (appointments.length > 0) {
      const patientIds = [...new Set(appointments.map(a => a.patientId).filter(id => id))];
      
      if (patientIds.length > 0) {
        // Determine date range from the appointments found
        const dates = appointments.map(a => new Date(a.appointmentDate).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Expand range to cover the full day(s)
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(23, 59, 59, 999);

        const vitals = await connection.getRepository(Vitals).find({
          where: {
            patientId: In(patientIds),
            recordedAt: Between(minDate, maxDate)
          }
        });

        const triage = await connection.getRepository(TriageAssessment).find({
          where: {
            patientId: In(patientIds),
            recordedAt: Between(minDate, maxDate)
          }
        });

        // Group by patientId
        vitals.forEach(v => {
          if (!vitalsMap.has(v.patientId)) vitalsMap.set(v.patientId, []);
          vitalsMap.get(v.patientId).push(v);
        });

        triage.forEach(t => {
          if (!triageMap.has(t.patientId)) triageMap.set(t.patientId, []);
          triageMap.get(t.patientId).push(t);
        });
      }
    }

    return {
      appointments: appointments.map(apt => {
        const patientVitals = vitalsMap.get(apt.patientId) || [];
        const patientTriage = triageMap.get(apt.patientId) || [];
        
        // Sort by recordedAt desc to get latest
        patientVitals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        patientTriage.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

        return {
        id: apt.id,
        patient: {
          id: apt.patient?.id,
          firstName: apt.patient?.firstName,
          lastName: apt.patient?.lastName,
          patientNumber: apt.patient?.patientNumber,
          phone: apt.patient?.phone || null,
          email: apt.patient?.email || null
        },
        doctor: {
          id: apt.doctor?.id,
          firstName: apt.doctor?.firstName,
          lastName: apt.doctor?.lastName
        },
        doctorName: apt.doctor ? `${apt.doctor.firstName ?? ''} ${apt.doctor.lastName ?? ''}`.trim() || null : null,
        doctorSpecialty: apt.doctor?.specialization ?? null,
        appointmentDate: apt.appointmentDate,
        appointmentType: apt.appointmentType,
        status: apt.status,
        reason: apt.reason,
        durationMinutes: apt.durationMinutes,
        notes: apt.notes,
        feeAmount: apt.feeAmount !== null && apt.feeAmount !== undefined ? Number(apt.feeAmount) : null,
        paymentStatus: apt.paymentStatus,
        financeTransactionId: apt.financeTransactionId,
        createdBy: apt.createdBy,
        createdAt: apt.createdAt,
        updatedAt: apt.updatedAt,
        vitals: patientVitals[0] || null,
        triage: patientTriage[0] || null
      };
    }),
      total
    };
  }

  async findOne(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    const appointment = await appointmentRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const connection = await this.tenantService.getTenantDatabase(tenantId);

    // Check for conflicts if date is being changed
    if (updateAppointmentDto.appointmentDate) {
      const doctorId = updateAppointmentDto.doctorId || appointment.doctorId;
      const duration = updateAppointmentDto.durationMinutes || appointment.durationMinutes;

      await this.checkForConflicts(doctorId, updateAppointmentDto.appointmentDate, duration, tenantId, id);
    }

    Object.assign(appointment, updateAppointmentDto);
    if (typeof updateAppointmentDto.feeAmount !== 'undefined') {
      appointment.feeAmount = Number(updateAppointmentDto.feeAmount);
    }

    // Handle diagnosis codes - update database directly if provided
    if (updateAppointmentDto.primaryDiagnosisCode || updateAppointmentDto.diagnosisCodes || updateAppointmentDto.diagnosisSnomedCode) {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updateAppointmentDto.primaryDiagnosisCode !== undefined) {
        updates.push(`primary_diagnosis_code = $${paramIndex++}`);
        params.push(updateAppointmentDto.primaryDiagnosisCode);
      }

      if (updateAppointmentDto.primaryDiagnosisDescription !== undefined) {
        updates.push(`primary_diagnosis_description = $${paramIndex++}`);
        params.push(updateAppointmentDto.primaryDiagnosisDescription);
      }

      if (updateAppointmentDto.diagnosisCodes !== undefined) {
        updates.push(`diagnosis_codes = $${paramIndex++}`);
        params.push(updateAppointmentDto.diagnosisCodes);
      }

      if (updateAppointmentDto.diagnosisSnomedCode !== undefined) {
        updates.push(`diagnosis_snomed_code = $${paramIndex++}`);
        params.push(updateAppointmentDto.diagnosisSnomedCode);
      }

      if (updateAppointmentDto.diagnosisSnomedTerm !== undefined) {
        updates.push(`diagnosis_snomed_term = $${paramIndex++}`);
        params.push(updateAppointmentDto.diagnosisSnomedTerm);
      }

      if (updates.length > 0) {
        params.push(id);
        await connection.query(
          `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          params
        );
        this.logger.log(`Updated diagnosis codes for appointment ${id}`);
      }
    }

    // Handle WHO Smart Forms data if provided
    if (updateAppointmentDto.whoSmartFormData !== undefined) {
      await connection.query(
        `UPDATE appointments SET who_smart_form_data = $1::jsonb WHERE id = $2`,
        [JSON.stringify(updateAppointmentDto.whoSmartFormData), id]
      );
      this.logger.log(`Updated WHO Smart Forms data for appointment ${id}`);
    }

    return appointmentRepository.save(appointment);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = 'cancelled';
    await appointmentRepository.save(appointment);

    if (this.mlFeedbackService) {
      try {
        const connection = await this.tenantService.getTenantDatabase(tenantId);
        await this.mlFeedbackService.recordNoShowOutcome(connection, id, 'cancelled');
      } catch (e) { this.logger.warn(`ML feedback failed: ${e.message}`); }
    }
  }

  async updateStatus(id: string, status: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);

    const normalizedStatus = this.normalizeStatus(status);

    if (normalizedStatus !== PAYMENT_STATUS.AWAITING_PAYMENT) {
      this.ensurePaymentCleared(appointment);
    }
    
    appointment.status = normalizedStatus;
    return appointmentRepository.save(appointment);
  }

  async checkInPatient(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    
    this.ensurePaymentCleared(appointment);

    appointment.status = 'confirmed';
    const savedAppointment = await appointmentRepository.save(appointment);

    // Trigger workflow for patient_check_in
    if (this.workflowService && connection) {
      try {
        await this.workflowService.executeWorkflow(
          'patient_check_in',
          {
            entityType: 'appointment',
            entityId: savedAppointment.id,
            patientId: savedAppointment.patientId,
            data: {
              appointmentType: savedAppointment.appointmentType,
              doctorId: savedAppointment.doctorId,
            },
          },
          connection,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for patient_check_in: ${error.message}`);
      }
    }

    return savedAppointment;
  }

  async startAppointment(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    
    this.ensurePaymentCleared(appointment);

    appointment.status = 'in_progress';
    const savedAppointment = await appointmentRepository.save(appointment);

    // Trigger workflow for appointment_started
    if (this.workflowService && connection) {
      try {
        await this.workflowService.executeWorkflow(
          'appointment_started',
          {
            entityType: 'appointment',
            entityId: savedAppointment.id,
            patientId: savedAppointment.patientId,
            data: {
              appointmentType: savedAppointment.appointmentType,
              doctorId: savedAppointment.doctorId,
            },
          },
          connection,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for appointment_started: ${error.message}`);
      }
    }

    return savedAppointment;
  }

  async completeAppointment(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    
    this.ensurePaymentCleared(appointment);

    appointment.status = 'completed';
    const savedAppointment = await appointmentRepository.save(appointment);

    // Trigger workflow for appointment_completed
    if (this.workflowService && connection) {
      try {
        await this.workflowService.executeWorkflow(
          'appointment_completed',
          {
            entityType: 'appointment',
            entityId: savedAppointment.id,
            patientId: savedAppointment.patientId,
            data: {
              appointmentType: savedAppointment.appointmentType,
              doctorId: savedAppointment.doctorId,
            },
          },
          connection,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for appointment_completed: ${error.message}`);
      }
    }

    if (this.mlFeedbackService && connection) {
      try {
        await this.mlFeedbackService.recordNoShowOutcome(connection, id, 'completed');
      } catch (e) { this.logger.warn(`ML feedback failed: ${e.message}`); }
    }

    return savedAppointment;
  }

  async getWaitTimes(doctorId: string, date: string, tenantId: string): Promise<{ average: number; current: number[] }> {
    // Simplified - no wait time tracking in current schema
    return { average: 0, current: [] };
  }

  async createRecurringAppointments(
    baseAppointment: CreateAppointmentDto,
    pattern: string,
    endDate: Date,
    tenantId: string,
    userId?: string,
  ): Promise<AppointmentSimple[]> {
    const appointments = [];
    const startDate = new Date(baseAppointment.appointmentDate);
    
    // Preserve the original time from the base appointment
    const baseTime = new Date(startDate);
    const hours = baseTime.getHours();
    const minutes = baseTime.getMinutes();
    const seconds = baseTime.getSeconds();
    const milliseconds = baseTime.getMilliseconds();
    
    let currentDate = new Date(startDate);
    let createdCount = 0;
    const maxAppointments = 100; // Safety limit
    
    while (currentDate <= endDate && createdCount < maxAppointments) {
      // Preserve the time for each recurring appointment
      currentDate.setHours(hours, minutes, seconds, milliseconds);
      
      try {
        const appointment = await this.create(
          {
            ...baseAppointment,
            appointmentDate: currentDate.toISOString(),
          },
          userId || baseAppointment.patientId,
          tenantId,
        );
        
        appointments.push(appointment);
        createdCount++;
      } catch (error) {
        // Skip appointments that conflict or have other issues, but continue creating others
        console.warn(`Failed to create recurring appointment for ${currentDate.toISOString()}:`, error);
      }
      
      // Increment based on pattern
      if (pattern === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (pattern === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        // Default to weekly if pattern is unknown
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
    
    return appointments;
  }

  async getDoctorSchedule(doctorId: string, date: string, tenantId: string): Promise<AppointmentSimple[]> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return appointmentRepository.find({
      where: {
        doctorId,
        appointmentDate: Between(startDate, endDate),
        status: Not('cancelled'),
      },
      relations: ['patient'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async getAvailableSlots(doctorId: string, date: string, tenantId: string): Promise<string[]> {
    const existingAppointments = await this.getDoctorSchedule(doctorId, date, tenantId);
    const workingHours = this.getWorkingHours();
    const allSlots = this.generateTimeSlots(workingHours.start, workingHours.end, 30);

    // Remove booked slots
    const bookedSlots = existingAppointments.map(apt => {
      const time = new Date(apt.appointmentDate);
      return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    });
    
    // Filter out slots where doctor is unavailable
    const availableSlots = [];
    const appointmentDate = new Date(date);
    
    for (const slot of allSlots) {
      if (bookedSlots.includes(slot)) {
        continue; // Skip already booked slots
      }
      
      // Check if doctor is unavailable at this time
      const [hours, minutes] = slot.split(':').map(Number);
      const slotDateTime = new Date(appointmentDate);
      slotDateTime.setHours(hours, minutes, 0, 0);
      
      const isUnavailable = await this.doctorAvailabilityService.checkDoctorUnavailable(
        doctorId,
        slotDateTime,
        30, // Default 30-minute duration
        tenantId
      );
      
      if (!isUnavailable) {
        availableSlots.push(slot);
      }
    }
    
    return availableSlots;
  }

  private async checkForConflicts(
    doctorId: string,
    appointmentDate: string,
    duration: number,
    tenantId: string,
    excludeId?: string
  ): Promise<void> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(appointmentDate);
    const endDate = new Date(appointmentDate);
    endDate.setDate(endDate.getDate() + 1);

    const queryBuilder = appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.appointmentDate >= :startDate', { startDate })
      .andWhere('appointment.appointmentDate < :endDate', { endDate })
      .andWhere('appointment.status != :cancelledStatus', { cancelledStatus: 'cancelled' });

    if (excludeId) {
      queryBuilder.andWhere('appointment.id != :excludeId', { excludeId });
    }

    const existingAppointments = await queryBuilder.getMany();

    const newAppointmentTime = new Date(appointmentDate);
    for (const existing of existingAppointments) {
      if (
        this.hasTimeConflict(
          newAppointmentTime,
          duration,
          existing.appointmentDate,
          existing.durationMinutes
        )
      ) {
        throw new ConflictException('Doctor is not available at this time');
      }
    }
  }

  private hasTimeConflict(newTime: Date, newDuration: number, existingTime: Date, existingDuration: number): boolean {
    const newStart = newTime.getTime();
    const newEnd = newStart + (newDuration * 60000); // Convert minutes to milliseconds
    const existingStart = existingTime.getTime();
    const existingEnd = existingStart + (existingDuration * 60000);

    return (newStart < existingEnd && newEnd > existingStart);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }



  private getWorkingHours() {
    return { start: '08:00', end: '17:00' };
  }

  private generateTimeSlots(start: string, end: string, intervalMinutes: number): string[] {
    const slots = [];
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }

    return slots;
  }

  private ensurePaymentCleared(appointment: AppointmentSimple) {
    if (appointment.paymentStatus === PAYMENT_STATUS.AWAITING_PAYMENT) {
      throw new BadRequestException('Payment confirmation required before continuing this appointment');
    }
  }

  private normalizeStatus(status: string): string {
    if (!status) {
      return status;
    }
    return status.replace('-', '_');
  }

  async getCalendarView(date: string, view: 'day' | 'week' | 'month' = 'day', tenantId: string): Promise<any[]> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(date);
    let endDate = new Date(date);

    // Calculate date range based on view type
    switch (view) {
      case 'day':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'week':
        // Get start of week (Monday)
        const dayOfWeek = startDate.getDay();
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        // Get end of week (Sunday)
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'month':
        // Get start of month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        // Get end of month
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }

    const appointments = await appointmentRepository.find({
      where: {
        appointmentDate: Between(startDate, endDate),
        status: Not('cancelled'),
      },
      relations: ['patient', 'doctor'],
      order: { appointmentDate: 'ASC' },
    });

    return appointments.map(apt => ({
      id: apt.id,
      title: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
      start: apt.appointmentDate,
      end: new Date(apt.appointmentDate.getTime() + (apt.durationMinutes * 60000)),
      doctor: {
        id: apt.doctor?.id,
        name: `${apt.doctor?.firstName} ${apt.doctor?.lastName}`,
      },
      patient: {
        id: apt.patient?.id,
        name: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
        patientNumber: apt.patient?.patientNumber,
      },
      status: apt.status,
      type: apt.appointmentType,
      reason: apt.reason,
      durationMinutes: apt.durationMinutes,
      priorityLevel: apt.priorityLevel,
      paymentStatus: apt.paymentStatus,
    }));
  }

  async getMonthView(year: number, month: number, tenantId: string): Promise<any> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const appointments = await appointmentRepository.find({
      where: {
        appointmentDate: Between(startDate, endDate),
        status: Not('cancelled'),
      },
      relations: ['patient', 'doctor'],
      order: { appointmentDate: 'ASC' },
    });

    // Group appointments by date
    const appointmentsByDate: Record<string, any[]> = {};
    appointments.forEach(apt => {
      const dateKey = apt.appointmentDate.toISOString().split('T')[0];
      if (!appointmentsByDate[dateKey]) {
        appointmentsByDate[dateKey] = [];
      }
      appointmentsByDate[dateKey].push({
        id: apt.id,
        title: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
        start: apt.appointmentDate,
        end: new Date(apt.appointmentDate.getTime() + (apt.durationMinutes * 60000)),
        doctor: {
          id: apt.doctor?.id,
          name: `${apt.doctor?.firstName} ${apt.doctor?.lastName}`,
        },
        patient: {
          id: apt.patient?.id,
          name: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
          patientNumber: apt.patient?.patientNumber,
        },
        status: apt.status,
        type: apt.appointmentType,
        reason: apt.reason,
        durationMinutes: apt.durationMinutes,
      });
    });

    return {
      year,
      month,
      appointmentsByDate,
      totalAppointments: appointments.length,
    };
  }

  async getWeekView(startDate: string, tenantId: string): Promise<any> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const weekStart = new Date(startDate);
    // Get Monday of the week
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const appointments = await appointmentRepository.find({
      where: {
        appointmentDate: Between(weekStart, weekEnd),
        status: Not('cancelled'),
      },
      relations: ['patient', 'doctor'],
      order: { appointmentDate: 'ASC' },
    });

    // Group by day of week
    const appointmentsByDay: Record<number, any[]> = {};
    appointments.forEach(apt => {
      const dayOfWeek = apt.appointmentDate.getDay();
      if (!appointmentsByDay[dayOfWeek]) {
        appointmentsByDay[dayOfWeek] = [];
      }
      appointmentsByDay[dayOfWeek].push({
        id: apt.id,
        title: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
        start: apt.appointmentDate,
        end: new Date(apt.appointmentDate.getTime() + (apt.durationMinutes * 60000)),
        doctor: {
          id: apt.doctor?.id,
          name: `${apt.doctor?.firstName} ${apt.doctor?.lastName}`,
        },
        patient: {
          id: apt.patient?.id,
          name: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
          patientNumber: apt.patient?.patientNumber,
        },
        status: apt.status,
        type: apt.appointmentType,
        reason: apt.reason,
        durationMinutes: apt.durationMinutes,
      });
    });

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      appointmentsByDay,
      totalAppointments: appointments.length,
    };
  }

  async getAppointmentStats(tenantId: string): Promise<any> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [todayTotal, todayCompleted, todayPending, todayNoShow] = await Promise.all([
      appointmentRepository.count({ where: { appointmentDate: Between(startOfDay, endOfDay) } }),
      appointmentRepository.count({ where: { appointmentDate: Between(startOfDay, endOfDay), status: 'completed' } }),
      appointmentRepository.count({ where: { appointmentDate: Between(startOfDay, endOfDay), status: 'scheduled' } }),
      appointmentRepository.count({ where: { appointmentDate: Between(startOfDay, endOfDay), status: 'no_show' } }),
    ]);

    return {
      today: {
        total: todayTotal,
        completed: todayCompleted,
        pending: todayPending,
        noShow: todayNoShow,
      },
      completionRate: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
      noShowRate: todayTotal > 0 ? Math.round((todayNoShow / todayTotal) * 100) : 0,
    };
  }

  async reschedule(id: string, newDate: string, reason: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);

    // Check for conflicts at new time
    await this.checkForConflicts(
      appointment.doctorId,
      newDate,
      appointment.durationMinutes,
      tenantId,
      id
    );

    appointment.appointmentDate = new Date(newDate);
    appointment.notes = `${appointment.notes || ''} | Rescheduled: ${reason || 'No reason provided'}`;
    
    return appointmentRepository.save(appointment);
  }

  async markNoShow(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);

    appointment.status = 'no_show';
    const saved = await appointmentRepository.save(appointment);

    const connection = await this.tenantService.getTenantDatabase(tenantId).catch(() => null);

    // Follow-up workflow so a missed patient isn't lost — drives contact/rebook tasks.
    if (this.workflowService && connection) {
      try {
        await this.workflowService.executeWorkflow(
          'appointment_no_show',
          {
            entityType: 'appointment',
            entityId: saved.id,
            patientId: saved.patientId,
            data: {
              appointmentType: saved.appointmentType,
              doctorId: saved.doctorId,
              appointmentDate: saved.appointmentDate,
            },
          },
          connection,
        );
      } catch (error: any) {
        this.logger.warn(`Failed to trigger workflow for appointment_no_show: ${error.message}`);
      }
    }

    if (this.mlFeedbackService && connection) {
      try {
        await this.mlFeedbackService.recordNoShowOutcome(connection, id, 'no_show');
      } catch (e: any) { this.logger.warn(`ML feedback failed: ${e.message}`); }
    }

    return saved;
  }

  /**
   * Overdue ("missed") appointments — scheduled time has passed but the patient never
   * arrived (not checked in, still scheduled/confirmed). Surfaces them so staff can mark
   * no-show and follow up. `graceMinutes` avoids flagging patients who are merely late.
   */
  async getOverdueAppointments(tenantId: string, graceMinutes = 30): Promise<AppointmentSimple[]> {
    const repo = await this.getAppointmentRepository(tenantId);
    const cutoff = new Date(Date.now() - graceMinutes * 60_000);
    return repo
      .createQueryBuilder('a')
      .where('a.appointmentDate < :cutoff', { cutoff })
      .andWhere('a.status IN (:...active)', { active: ['scheduled', 'confirmed'] })
      .andWhere('a.checkInTime IS NULL')
      .orderBy('a.appointmentDate', 'ASC')
      .getMany();
  }

  async searchAppointments(query: string, tenantId: string): Promise<any[]> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    const appointments = await appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('patient.firstName ILIKE :query', { query: `%${query}%` })
      .orWhere('patient.lastName ILIKE :query', { query: `%${query}%` })
      .orWhere('patient.patientNumber ILIKE :query', { query: `%${query}%` })
      .orWhere('appointment.reason ILIKE :query', { query: `%${query}%` })
      .orderBy('appointment.appointmentDate', 'DESC')
      .limit(50)
      .getMany();

    return appointments.map(apt => ({
      id: apt.id,
      patient: {
        id: apt.patient?.id,
        name: `${apt.patient?.firstName} ${apt.patient?.lastName}`,
        patientNumber: apt.patient?.patientNumber,
      },
      doctor: {
        id: apt.doctor?.id,
        name: `${apt.doctor?.firstName} ${apt.doctor?.lastName}`,
      },
      appointmentDate: apt.appointmentDate,
      status: apt.status,
      reason: apt.reason,
      type: apt.appointmentType,
    }));
  }

  async getAppointmentTemplates(tenantId: string): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    try {
      const { AppointmentTemplate } = await import('../entities/appointment-template.entity');
      const templateRepository = connection.getRepository(AppointmentTemplate);
      const templates = await templateRepository.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      });

      // If no templates exist, return default templates
      if (templates.length === 0) {
        return [
          {
            id: 'consultation',
            name: 'General Consultation',
            type: 'consultation',
            duration: 30,
            instructions: 'Please arrive 10 minutes early',
            color: '#3B82F6'
          },
          {
            id: 'follow-up',
            name: 'Follow-up Visit',
            type: 'follow_up',
            duration: 20,
            instructions: 'Bring previous test results',
            color: '#10B981'
          },
          {
            id: 'procedure',
            name: 'Minor Procedure',
            type: 'procedure',
            duration: 60,
            instructions: 'Fasting may be required',
            color: '#F59E0B'
          },
          {
            id: 'telehealth',
            name: 'Telehealth Consultation',
            type: 'consultation',
            duration: 30,
            instructions: 'Ensure stable internet connection',
            color: '#8B5CF6'
          }
        ];
      }

      return templates.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        duration: t.durationMinutes,
        instructions: t.instructions,
        color: t.color,
        createdAt: t.createdAt,
      }));
    } catch (error) {
      this.logger.error('Error fetching appointment templates:', error);
      // Return default templates on error
      return [
        {
          id: 'consultation',
          name: 'General Consultation',
          type: 'consultation',
          duration: 30,
          instructions: 'Please arrive 10 minutes early',
          color: '#3B82F6'
        }
      ];
    }
  }

  async createAppointmentTemplate(template: any, tenantId: string, userId?: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const { AppointmentTemplate } = await import('../entities/appointment-template.entity');
    const templateRepository = connection.getRepository(AppointmentTemplate);

    const newTemplate = templateRepository.create({
      name: template.name,
      type: template.type,
      durationMinutes: template.duration || template.durationMinutes || 30,
      instructions: template.instructions,
      color: template.color || '#3B82F6',
      isActive: true,
      createdBy: userId,
    });

    const saved = await templateRepository.save(newTemplate);
    return {
      id: saved.id,
      name: saved.name,
      type: saved.type,
      duration: saved.durationMinutes,
      instructions: saved.instructions,
      color: saved.color,
      createdAt: saved.createdAt,
    };
  }

  async deleteAppointmentTemplate(templateId: string, tenantId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const { AppointmentTemplate } = await import('../entities/appointment-template.entity');
    const templateRepository = connection.getRepository(AppointmentTemplate);

    const template = await templateRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    // Soft delete by setting isActive to false
    template.isActive = false;
    await templateRepository.save(template);
  }

  async getAppointmentTrends(period: string, tenantId: string): Promise<any> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const appointments = await appointmentRepository.find({
      where: {
        appointmentDate: Between(startDate, now),
      },
      relations: ['patient', 'doctor']
    });

    // Group by date and status
    const trends = appointments.reduce<Record<string, { total: number; completed: number; cancelled: number; noShow: number }>>(
      (acc, apt) => {
      const date = apt.appointmentDate.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, completed: 0, cancelled: 0, noShow: 0 };
      }
      acc[date].total++;
      if (apt.status === 'completed') acc[date].completed++;
      if (apt.status === 'cancelled') acc[date].cancelled++;
      if (apt.status === 'no_show') acc[date].noShow++;
      return acc;
      },
      {},
    );

    return {
      period,
      trends: Object.entries(trends).map(([date, stats]) => ({
        date,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      }))
    };
  }

  async getDoctorPerformance(doctorId: string, tenantId: string): Promise<any> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const whereClause: any = {
      appointmentDate: Between(thirtyDaysAgo, new Date()),
    };

    if (doctorId) {
      whereClause.doctorId = doctorId;
    }

    const appointments = await appointmentRepository.find({
      where: whereClause,
      relations: ['doctor']
    });

    const doctorStats = appointments.reduce<
      Record<
        string,
        {
          doctorId: string;
          doctorName: string;
          total: number;
          completed: number;
          cancelled: number;
          noShow: number;
          completionRate?: number;
          cancellationRate?: number;
          noShowRate?: number;
        }
      >
    >((acc, apt) => {
      const doctorName = `${apt.doctor?.firstName} ${apt.doctor?.lastName}`;
      if (!acc[apt.doctorId]) {
        acc[apt.doctorId] = {
          doctorId: apt.doctorId,
          doctorName,
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
        };
      }
      
      acc[apt.doctorId].total++;
      if (apt.status === 'completed') acc[apt.doctorId].completed++;
      if (apt.status === 'cancelled') acc[apt.doctorId].cancelled++;
      if (apt.status === 'no_show') acc[apt.doctorId].noShow++;
      
      return acc;
    }, {});

    Object.values(doctorStats).forEach((stats) => {
      stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      stats.cancellationRate = stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0;
      stats.noShowRate = stats.total > 0 ? Math.round((stats.noShow / stats.total) * 100) : 0;
    });

    return Object.values(doctorStats);
  }

  async sendReminder(appointmentId: string, tenantId: string, options?: { sendSms?: boolean; sendEmail?: boolean }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    
    const appointment = await this.findOne(appointmentId, tenantId);
    const appointmentRepository = connection.getRepository(AppointmentSimple);

    if (!appointment.patient) {
      throw new NotFoundException('Patient not found for appointment');
    }

    const sendSms = options?.sendSms !== false; // Default to true
    const sendEmail = options?.sendEmail || false;

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const results: any = {
      success: true,
      smsSent: false,
      emailSent: false,
      errors: [],
    };

    // Send SMS reminder
    if (sendSms && appointment.patient.phone) {
      try {
        const smsResult = await this.notificationsService.sendAppointmentReminder(appointmentId, connection);
        results.smsSent = true;
        results.smsMessageId = smsResult.messageId;
      } catch (error: any) {
        results.errors.push(`SMS failed: ${error.message}`);
        this.logger.error(`Failed to send SMS reminder for appointment ${appointmentId}:`, error);
      }
    }

    // Send Email reminder
    if (sendEmail && appointment.patient.email) {
      try {
        const emailSubject = `Appointment Reminder - ${formattedDate}`;
        const emailBody = `
Dear ${appointment.patient.firstName} ${appointment.patient.lastName},

This is a reminder for your upcoming appointment:

Date: ${formattedDate}
Time: ${formattedTime}
Doctor: Dr. ${appointment.doctor?.firstName || ''} ${appointment.doctor?.lastName || ''}
Duration: ${appointment.durationMinutes} minutes
${appointment.reason ? `Reason: ${appointment.reason}` : ''}

Please arrive 15 minutes early for your appointment.

If you need to reschedule or cancel, please contact us as soon as possible.

Thank you,
Umoya Clinic
        `.trim();

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Appointment Reminder</h2>
            <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
            <p>This is a reminder for your upcoming appointment:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Doctor:</strong> Dr. ${appointment.doctor?.firstName || ''} ${appointment.doctor?.lastName || ''}</p>
              <p><strong>Duration:</strong> ${appointment.durationMinutes} minutes</p>
              ${appointment.reason ? `<p><strong>Reason:</strong> ${appointment.reason}</p>` : ''}
            </div>
            <p>Please arrive 15 minutes early for your appointment.</p>
            <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 12px;">Thank you,<br>Umoya Clinic</p>
          </div>
        `;

        const emailResult = await this.emailService.sendEmail({
          to: appointment.patient.email,
          subject: emailSubject,
          text: emailBody,
          html: htmlBody,
        });

        if (emailResult.success) {
          results.emailSent = true;
          results.emailMessageId = emailResult.messageId;
        } else {
          results.errors.push(`Email failed: ${emailResult.error}`);
        }
      } catch (error: any) {
        results.errors.push(`Email failed: ${error.message}`);
        this.logger.error(`Failed to send email reminder for appointment ${appointmentId}:`, error);
      }
    }

    // Update reminder count and timestamp
    appointment.reminderSentCount = (appointment.reminderSentCount || 0) + 1;
    appointment.lastReminderSent = new Date();
    await appointmentRepository.save(appointment);

    results.reminderCount = appointment.reminderSentCount;
    results.message = `Reminder sent successfully${results.errors.length > 0 ? ' (with some errors)' : ''}`;

    return results;
  }

  async checkConflicts(doctorId: string, date: string, time: string, duration: number, tenantId: string): Promise<any> {
    const appointmentDate = new Date(`${date}T${time}:00`);
    
    try {
      await this.checkForConflicts(doctorId, appointmentDate.toISOString(), duration, tenantId);
      return { hasConflict: false, message: 'No conflicts found' };
    } catch (error) {
      return { hasConflict: true, message: error.message };
    }
  }

  async checkAvailability(doctorId: string, appointmentDate: string, durationMinutes: number, tenantId: string): Promise<any> {
    try {
      await this.checkForConflicts(doctorId, appointmentDate, durationMinutes, tenantId);
      return { hasConflict: false, message: 'No conflicts found' };
    } catch (error: any) {
      return { hasConflict: true, message: error.message || 'Doctor is not available at this time' };
    }
  }
}
