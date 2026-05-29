import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { config as envConfig } from '@umoya/config';
import { Patient } from '../entities/patient.entity';
import { TenantService } from './tenant.service';
import { EmailService } from './email.service';
import { RegistrationIntelligenceService } from './registration-intelligence.service';

export interface PatientRegisterDto {
  patientNumber: string;
  email: string;
  password: string;
  dateOfBirth: string; // For verification
  phone?: string;
}

export interface PatientLoginDto {
  email: string;
  password: string;
}

export interface PatientRegistrationAssessment {
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  portalAccessEnabled: boolean;
  emailConflict: boolean;
  intakeAssessment: any;
}

export interface PatientPasswordResetDto {
  email: string;
}

export interface PatientPasswordResetConfirmDto {
  token: string;
  newPassword: string;
}

@Injectable()
export class PatientAuthService {
  private readonly logger = new Logger(PatientAuthService.name);
  private readonly portalBaseUrl = String(process.env.PORTAL_BASE_URL || envConfig.publicUrls.patientPortal || '').replace(/\/+$/, '');

  constructor(
    private jwtService: JwtService,
    private tenantService: TenantService,
    private emailService: EmailService,
    private registrationIntelligenceService: RegistrationIntelligenceService,
  ) {}

  private getPortalLink(path: string): string {
    if (!this.portalBaseUrl) {
      throw new Error('PORTAL_BASE_URL is not configured. Set PORTAL_BASE_URL or PUBLIC_APP_BASE_URL.');
    }

    return `${this.portalBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async getPatientRepository(tenantId: string): Promise<Repository<Patient>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(Patient);
  }

  private parseDateOfBirth(input: string): Date {
    if (input.includes('/')) {
      const [day, month, year] = input.split('/');
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }

    return new Date(input);
  }

  private normalizeDateOnly(input: Date): Date {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }

  private async resolvePortalRegistrationContext(registerDto: PatientRegisterDto, tenantId: string) {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const patientRepository = connection.getRepository(Patient);
    const patient = await patientRepository.findOne({
      where: { patientNumber: registerDto.patientNumber },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found. Please contact the clinic to register.');
    }

    const patientDob = patient.dateOfBirth instanceof Date
      ? patient.dateOfBirth
      : new Date(patient.dateOfBirth);
    const inputDob = this.parseDateOfBirth(registerDto.dateOfBirth);
    const patientDobDate = this.normalizeDateOnly(patientDob);
    const inputDobDate = this.normalizeDateOnly(inputDob);

    if (patientDobDate.getTime() !== inputDobDate.getTime()) {
      throw new BadRequestException('Date of birth does not match our records.');
    }

    const existingPatient = await patientRepository.findOne({
      where: { email: registerDto.email, portalAccessEnabled: true },
    });

    return {
      connection,
      patientRepository,
      patient,
      existingPatient,
    };
  }

  private buildRegistrationAssessmentPayload(patient: Patient, registerDto: PatientRegisterDto) {
    return {
      patientId: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      nationalId: patient.nationalId,
      phone: registerDto.phone || patient.phone,
      email: registerDto.email,
      address: patient.address,
      city: patient.city,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      nextOfKinName: patient.nextOfKinName,
      nextOfKinPhone: patient.nextOfKinPhone,
      insuranceProvider: patient.insuranceProvider || patient.medicalAidProvider,
      insuranceNumber: patient.insuranceNumber || patient.medicalAidNumber,
      medicalAidPlan: patient.medicalAidPlan,
    };
  }

  async assessRegistration(registerDto: PatientRegisterDto, tenantId: string): Promise<PatientRegistrationAssessment> {
    const { connection, patient, existingPatient } = await this.resolvePortalRegistrationContext(registerDto, tenantId);

    const intakeAssessment = await this.registrationIntelligenceService.assessRegistrationIntake(
      connection,
      this.buildRegistrationAssessmentPayload(patient, registerDto),
      { persist: false },
    );

    return {
      patient: {
        id: patient.id,
        patientNumber: patient.patientNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email || null,
        phone: patient.phone || null,
      },
      portalAccessEnabled: Boolean(patient.portalAccessEnabled),
      emailConflict: Boolean(existingPatient && existingPatient.id !== patient.id),
      intakeAssessment,
    };
  }

  async register(registerDto: PatientRegisterDto, tenantId: string): Promise<any> {
    const { connection, patientRepository, patient, existingPatient } =
      await this.resolvePortalRegistrationContext(registerDto, tenantId);

    // Check if email matches or update it
    // Allow email update if patient doesn't have one, or if it matches
    // If patient has email but it's different, allow update but log it
    if (patient.email && patient.email.toLowerCase() !== registerDto.email.toLowerCase()) {
      // Email mismatch - allow update but could log for security
      this.logger.warn(`Email mismatch for patient ${registerDto.patientNumber}: existing=${patient.email}, new=${registerDto.email}`);
    }

    // Check if already registered
    if (patient.portalAccessEnabled) {
      throw new BadRequestException('Portal access is already enabled for this patient.');
    }

    if (existingPatient && existingPatient.id !== patient.id) {
      throw new BadRequestException('This email is already registered to another patient.');
    }

    const intakeAssessment = await this.registrationIntelligenceService.assessRegistrationIntake(
      connection,
      this.buildRegistrationAssessmentPayload(patient, registerDto),
      { persist: true, actorUserId: null },
    );

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Update patient
    patient.portalPasswordHash = passwordHash;
    patient.portalAccessEnabled = true;
    patient.portalRegisteredAt = new Date();
    patient.email = registerDto.email;
    if (registerDto.phone) {
      patient.phone = registerDto.phone;
    }
    patient.portalEmailVerified = false;
    patient.portalEmailVerificationToken = verificationToken;

    await patientRepository.save(patient);

    // Send verification email
    try {
      await this.emailService.sendEmail({
        to: registerDto.email,
        subject: 'Verify Your Umoya Patient Portal Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to Umoya Patient Portal</h2>
            <p>Dear ${patient.firstName} ${patient.lastName},</p>
            <p>Thank you for registering for the Umoya Patient Portal. Please verify your email address by clicking the link below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${this.getPortalLink(`/patient/verify-email?token=${verificationToken}`)}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </p>
            <p>If you did not register for this account, please contact the clinic immediately.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 12px;">This link will expire in 24 hours.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    return {
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      patient: {
        id: patient.id,
        patientNumber: patient.patientNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
      },
      intakeAssessment,
    };
  }

  async login(loginDto: PatientLoginDto, tenantId: string): Promise<any> {
    const patientRepository = await this.getPatientRepository(tenantId);

    // Find patient by email (case-insensitive search)
    // Use raw SQL query for better performance and case-insensitive matching
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const patients = await connection.query(
      `SELECT id, email, patient_number, portal_access_enabled, portal_email_verified, portal_password_hash, first_name, last_name, phone, date_of_birth 
       FROM patients 
       WHERE LOWER(email) = LOWER($1) AND portal_access_enabled = TRUE`,
      [loginDto.email]
    );

    if (!patients || patients.length === 0) {
      this.logger.warn(`Login attempt with email: ${loginDto.email} - Patient not found or portal not enabled`);
      throw new UnauthorizedException('Invalid credentials or portal access not enabled');
    }

    const patient = patients[0];

    if (!patient.portal_password_hash) {
      this.logger.warn(`Login attempt for patient ${patient.patient_number} - No password hash`);
      throw new UnauthorizedException('Portal access not set up. Please register first.');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, patient.portal_password_hash);

    if (!isPasswordValid) {
      this.logger.warn(`Login attempt for patient ${patient.patient_number} - Invalid password`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified (optional - can be made required)
    if (!patient.portal_email_verified) {
      return {
        success: false,
        requiresVerification: true,
        message: 'Please verify your email address before logging in.',
      };
    }

    // Update last login
    await connection.query(
      `UPDATE patients SET portal_last_login = NOW() WHERE id = $1`,
      [patient.id]
    );

    // Generate JWT token
    const payload = {
      sub: patient.id,
      email: patient.email,
      role: 'patient',
      patientNumber: patient.patient_number,
      firstName: patient.first_name,
      lastName: patient.last_name,
    };

    return {
      success: true,
      token: this.jwtService.sign(payload, { expiresIn: '7d' }), // Longer expiry for patients
      patient: {
        id: patient.id,
        patientNumber: patient.patient_number,
        firstName: patient.first_name,
        lastName: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.date_of_birth,
      },
    };
  }

  async verifyEmail(token: string, tenantId: string): Promise<any> {
    const patientRepository = await this.getPatientRepository(tenantId);

    const patient = await patientRepository.findOne({
      where: { portalEmailVerificationToken: token },
    });

    if (!patient) {
      throw new NotFoundException('Invalid verification token');
    }

    patient.portalEmailVerified = true;
    patient.portalEmailVerificationToken = null;
    await patientRepository.save(patient);

    return {
      success: true,
      message: 'Email verified successfully. You can now log in to the portal.',
    };
  }

  async requestPasswordReset(resetDto: PatientPasswordResetDto, tenantId: string): Promise<any> {
    const patientRepository = await this.getPatientRepository(tenantId);

    const patient = await patientRepository.findOne({
      where: { email: resetDto.email, portalAccessEnabled: true },
    });

    if (!patient) {
      // Don't reveal if email exists for security
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    patient.portalPasswordResetToken = resetToken;
    patient.portalPasswordResetExpires = resetExpires;
    await patientRepository.save(patient);

    // Send reset email
    try {
      await this.emailService.sendEmail({
        to: resetDto.email,
        subject: 'Reset Your Umoya Patient Portal Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>Dear ${patient.firstName} ${patient.lastName},</p>
            <p>You requested to reset your password. Click the link below to reset it:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${this.getPortalLink(`/patient/reset-password?token=${resetToken}`)}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 12px;">This link will expire in 1 hour.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email:', error);
    }

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }

  async confirmPasswordReset(resetDto: PatientPasswordResetConfirmDto, tenantId: string): Promise<any> {
    const patientRepository = await this.getPatientRepository(tenantId);

    const patient = await patientRepository.findOne({
      where: { portalPasswordResetToken: resetDto.token },
    });

    if (!patient) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    if (!patient.portalPasswordResetExpires || patient.portalPasswordResetExpires < new Date()) {
      throw new BadRequestException('Reset token has expired. Please request a new one.');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(resetDto.newPassword, 10);

    // Update patient
    patient.portalPasswordHash = passwordHash;
    patient.portalPasswordResetToken = null;
    patient.portalPasswordResetExpires = null;
    await patientRepository.save(patient);

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  async getPatientProfile(patientId: string, tenantId: string): Promise<Patient> {
    const patientRepository = await this.getPatientRepository(tenantId);
    const patient = await patientRepository.findOne({ where: { id: patientId } });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async updatePatientProfile(patientId: string, updateData: Partial<Patient>, tenantId: string): Promise<Patient> {
    const patient = await this.getPatientProfile(patientId, tenantId);
    const patientRepository = await this.getPatientRepository(tenantId);

    // Only allow updating certain fields
    const allowedFields = ['phone', 'email', 'address', 'city', 'emergencyContactName', 'emergencyContactPhone'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        patient[field] = updateData[field];
      }
    }

    return patientRepository.save(patient);
  }

  async linkAccount(
    patientId: string,
    linkData: { patientNumber: string; dateOfBirth: string; nationalId?: string; phone?: string },
    tenantId: string,
  ): Promise<any> {
    const patientRepository = await this.getPatientRepository(tenantId);

    // Get the logged-in patient (portal account)
    const portalPatient = await patientRepository.findOne({ where: { id: patientId } });

    if (!portalPatient) {
      throw new NotFoundException('Patient account not found');
    }

    // Check if already linked
    if (portalPatient.portalAccessEnabled && portalPatient.email) {
      // Try to find matching patient record
      const matchingPatient = await patientRepository.findOne({
        where: { patientNumber: linkData.patientNumber },
      });

      if (matchingPatient && matchingPatient.id === portalPatient.id) {
        return {
          success: true,
          message: 'Account is already linked',
          patient: {
            id: portalPatient.id,
            patientNumber: portalPatient.patientNumber,
            firstName: portalPatient.firstName,
            lastName: portalPatient.lastName,
          },
        };
      }
    }

    // Find patient record by patient number
    const patientRecord = await patientRepository.findOne({
      where: { patientNumber: linkData.patientNumber },
    });

    if (!patientRecord) {
      throw new NotFoundException('Patient record not found. Please verify your patient number.');
    }

    // Verify date of birth
    const dob = new Date(linkData.dateOfBirth);
    if (patientRecord.dateOfBirth.getTime() !== dob.getTime()) {
      throw new BadRequestException('Date of birth does not match our records.');
    }

    // Optional: Verify national ID if provided
    if (linkData.nationalId && patientRecord.nationalId) {
      if (patientRecord.nationalId !== linkData.nationalId) {
        throw new BadRequestException('National ID does not match our records.');
      }
    }

    // Optional: Verify phone if provided
    if (linkData.phone && patientRecord.phone) {
      // Normalize phone numbers for comparison
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      if (normalizePhone(patientRecord.phone) !== normalizePhone(linkData.phone)) {
        throw new BadRequestException('Phone number does not match our records.');
      }
    }

    // Link the accounts: Update patient record with portal credentials
    patientRecord.portalPasswordHash = portalPatient.portalPasswordHash;
    patientRecord.portalAccessEnabled = true;
    patientRecord.portalRegisteredAt = portalPatient.portalRegisteredAt || new Date();
    patientRecord.email = portalPatient.email;
    patientRecord.portalEmailVerified = portalPatient.portalEmailVerified || false;

    // If portal patient has different ID, we need to merge or update
    if (portalPatient.id !== patientRecord.id) {
      // Update the portal patient to point to the actual patient record
      // For now, we'll update the actual patient record with portal access
      await patientRepository.save(patientRecord);

      // Optionally delete the temporary portal patient record
      // await patientRepository.delete(portalPatient.id);
    } else {
      await patientRepository.save(patientRecord);
    }

    return {
      success: true,
      message: 'Account linked successfully! You now have full access to your patient portal.',
      patient: {
        id: patientRecord.id,
        patientNumber: patientRecord.patientNumber,
        firstName: patientRecord.firstName,
        lastName: patientRecord.lastName,
        email: patientRecord.email,
      },
    };
  }
}
