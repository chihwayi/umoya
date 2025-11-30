import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { AppointmentService } from './appointment.service';
import { PaymentsService } from './payments.service';
import { FinanceService } from './finance.service';
import { BillingService } from './billing.service';
import { PatientNotificationsService } from './patient-notifications.service';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { User } from '../entities/user.entity';
import { Bill } from '../entities/billing.entity';

@Injectable()
export class PatientPortalAppointmentService {
  private readonly logger = new Logger(PatientPortalAppointmentService.name);

  constructor(
    private tenantService: TenantService,
    private appointmentService: AppointmentService,
    private paymentsService: PaymentsService,
    private financeService: FinanceService,
    private billingService: BillingService,
    private patientNotificationsService: PatientNotificationsService,
  ) {}

  async requestAppointmentWithPayment(
    patientId: string,
    appointmentData: {
      doctorId: string;
      appointmentDate: string;
      reason: string;
      durationMinutes?: number;
      appointmentType?: string;
      notes?: string;
      isTelehealth?: boolean;
    },
    paymentData: {
      method: 'ecocash' | 'onemoney' | 'cash' | 'card';
      phoneNumber?: string;
      amount: number;
      currency?: string;
    },
    tenantId: string,
  ): Promise<{ appointment: AppointmentSimple; payment: any; message: string }> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get default consultation fee if not provided
    const defaultConsultationFee =
      process.env.DEFAULT_CONSULTATION_FEE !== undefined
        ? Number(process.env.DEFAULT_CONSULTATION_FEE)
        : 20;

    const feeAmount = paymentData.amount || defaultConsultationFee;

    // Validate payment method
    if (paymentData.method === 'ecocash' || paymentData.method === 'onemoney') {
      if (!paymentData.phoneNumber) {
        throw new BadRequestException('Phone number is required for mobile money payments');
      }
    }

    // Create appointment first
    const appointmentDto = {
      patientId,
      doctorId: appointmentData.doctorId,
      appointmentDate: new Date(appointmentData.appointmentDate),
      reason: appointmentData.reason,
      durationMinutes: appointmentData.durationMinutes || 30,
      appointmentType: appointmentData.appointmentType || 'consultation',
      notes: appointmentData.notes,
      isTelehealth: appointmentData.isTelehealth || false,
      feeAmount,
    };

    let appointment: AppointmentSimple;
    try {
      // Use the appointment service to create the appointment
      // This will handle availability checks and conflict detection
      appointment = await this.appointmentService.create(
        appointmentDto,
        patientId, // Use patientId as userId for patient-created appointments
        tenantId,
      );
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Failed to create appointment:', error);
      throw new BadRequestException(`Failed to create appointment: ${error.message}`);
    }

    // Process payment
    let paymentResult: any;
    let billId: string | null = null;

    try {
      if (paymentData.method === 'ecocash' || paymentData.method === 'onemoney') {
        // Create a bill for the appointment using BillingService
        const bill = await this.billingService.createBill(
          {
            patientId,
            appointmentId: appointment.id,
            items: [
              {
                description: appointmentData.appointmentType || 'Consultation',
                totalPrice: feeAmount,
              },
            ],
            subtotal: feeAmount,
            totalAmount: feeAmount,
            status: 'pending',
          },
          connection,
          patientId,
        );

        billId = bill.id;

        // Process mobile money payment
        paymentResult = await this.paymentsService.processMobileMoneyPayment(
          {
            billId,
            amount: feeAmount,
            phoneNumber: paymentData.phoneNumber,
            provider: paymentData.method,
            currency: paymentData.currency || 'USD',
          },
          connection,
        );

        // Update appointment payment status
        await connection.query(
          `UPDATE appointments 
           SET payment_status = $1 
           WHERE id = $2`,
          ['pending', appointment.id],
        );
      } else if (paymentData.method === 'cash' || paymentData.method === 'card') {
        // For cash/card, mark as paid immediately (in real scenario, card would go through payment gateway)
        paymentResult = {
          status: 'COMPLETED',
          method: paymentData.method,
          amount: feeAmount,
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: paymentData.method === 'cash' 
            ? 'Payment will be collected at the clinic' 
            : 'Payment processed successfully',
        };

        // Create financial transaction
        await this.financeService.createTransaction(
          connection,
          {
            sourceModule: 'appointments',
            patientId,
            amount: feeAmount,
            currency: paymentData.currency || 'USD',
            notes: `Appointment payment - ${appointmentData.reason}`,
            payerType: 'self',
            lineItems: [
              {
                description: appointmentData.appointmentType || 'Consultation',
                billingCode: 'CONSULT',
                unitPrice: feeAmount,
                quantity: 1,
              },
            ],
          },
          patientId,
        );

        // Update appointment payment status
        await connection.query(
          `UPDATE appointments 
           SET payment_status = $1, status = $2
           WHERE id = $3`,
          ['paid', 'scheduled', appointment.id],
        );
      }
    } catch (error: any) {
      this.logger.error('Payment processing failed:', error);
      // Don't delete appointment, but mark payment as failed
      await connection.query(
        `UPDATE appointments 
         SET payment_status = $1 
         WHERE id = $2`,
        ['failed', appointment.id],
      );
      throw new BadRequestException(`Payment processing failed: ${error.message}`);
    }

    // Send notification to patient
    try {
      const userRepository = connection.getRepository(User);
      const doctor = await userRepository.findOne({ where: { id: appointmentData.doctorId } });
      const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Your doctor';

      await this.patientNotificationsService.createAppointmentReminder(
        patientId,
        appointment.id,
        new Date(appointmentData.appointmentDate),
        doctorName,
        tenantId,
      );
    } catch (error) {
      this.logger.warn('Failed to send appointment notification:', error);
      // Don't fail the whole request if notification fails
    }

    return {
      appointment,
      payment: paymentResult,
      message: paymentData.method === 'ecocash' || paymentData.method === 'onemoney'
        ? 'Appointment requested successfully! Please complete the mobile money payment to confirm your appointment.'
        : 'Appointment requested and payment processed successfully!',
    };
  }

  async getAvailableDoctors(tenantId: string): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const query = `
      SELECT 
        u.id,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.specialization,
        u.email,
        u.phone
      FROM users u
      WHERE u.role = 'doctor' AND u.is_active = TRUE
      ORDER BY u.first_name, u.last_name
    `;

    const doctors = await connection.query(query);
    return doctors;
  }

  async getAvailableTimeSlots(
    doctorId: string,
    date: string,
    tenantId: string,
  ): Promise<string[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get doctor's working hours (default: 8 AM - 5 PM)
    const startHour = 8;
    const endHour = 17;
    const slotDuration = 30; // minutes

    // Get existing appointments for the day
    const existingAppointments = await connection.query(
      `SELECT appointment_date, duration_minutes 
       FROM appointments 
       WHERE doctor_id = $1 
       AND DATE(appointment_date) = DATE($2)
       AND status NOT IN ('cancelled', 'completed')`,
      [doctorId, date],
    );

    // Get doctor's unavailable periods
    // Handle both date-only and timestamp formats
    const unavailablePeriods = await connection.query(
      `SELECT 
        CASE 
          WHEN start_time IS NOT NULL AND is_all_day = FALSE THEN 
            (DATE($2) + start_time)::TIMESTAMP
          WHEN is_all_day = TRUE THEN 
            start_date::TIMESTAMP
          ELSE 
            start_date::TIMESTAMP
        END as start_time,
        CASE 
          WHEN end_time IS NOT NULL AND is_all_day = FALSE THEN 
            (DATE($2) + end_time)::TIMESTAMP
          WHEN is_all_day = TRUE AND end_date IS NOT NULL THEN 
            (end_date + INTERVAL '1 day')::TIMESTAMP
          WHEN is_all_day = TRUE THEN 
            (start_date + INTERVAL '1 day')::TIMESTAMP
          WHEN end_date IS NOT NULL THEN 
            (end_date + INTERVAL '1 day')::TIMESTAMP
          ELSE 
            (start_date + INTERVAL '1 day')::TIMESTAMP
        END as end_time
       FROM doctor_availability 
       WHERE doctor_id = $1 
       AND is_unavailable = TRUE
       AND (
         -- Date range overlaps with selected date
         (start_date <= DATE($2) AND (end_date IS NULL OR end_date >= DATE($2)))
         OR 
         -- Single day unavailability
         (DATE(start_date) = DATE($2) AND end_date IS NULL)
       )`,
      [doctorId, date],
    );

    // Generate available time slots
    const availableSlots: string[] = [];
    const selectedDate = new Date(date);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);

        // Skip if slot is in the past
        if (slotTime < new Date()) {
          continue;
        }

        // Check if slot conflicts with existing appointments
        const conflicts = existingAppointments.some((apt: any) => {
          const aptStart = new Date(apt.appointment_date);
          const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 30) * 60000);
          return slotTime < aptEnd && slotTime >= aptStart;
        });

        // Check if slot is in unavailable period
        const isUnavailable = unavailablePeriods.some((period: any) => {
          const periodStart = new Date(period.start_time);
          const periodEnd = new Date(period.end_time);
          return slotTime >= periodStart && slotTime < periodEnd;
        });

        if (!conflicts && !isUnavailable) {
          availableSlots.push(slotTime.toISOString());
        }
      }
    }

    return availableSlots;
  }
}

