# 🏥 Sprint 26: Operating Room (OR) Management

**Duration:** 4 weeks (160 hours)  
**Priority:** CRITICAL 🔴  
**Dependencies:** Bed Management, Consent, Scheduling  
**Target:** Enable surgical procedures in hospital setting

---

## 📋 Sprint Goals

Enable complete operating room workflow from scheduling to post-operative care:
1. Schedule surgeries in ORs
2. Manage surgical staff & resources
3. Document surgical procedures
4. Track implants & supplies
5. Monitor OR utilization
6. Post-operative orders

---

## 🗄️ STAGE 1: Database Schema (Week 1, Day 1-2)

### **Migration: 010-operating-room-management.sql**

```sql
-- Operating Rooms Table
CREATE TABLE IF NOT EXISTS operating_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(20) UNIQUE NOT NULL,
  room_name VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  room_type VARCHAR(50) CHECK (room_type IN ('general', 'cardiac', 'ortho', 'neuro', 'vascular', 'minor_procedure')),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance', 'offline')),
  has_laminar_flow BOOLEAN DEFAULT false,
  has_c_arm BOOLEAN DEFAULT false,
  has_microscope BOOLEAN DEFAULT false,
  has_robot BOOLEAN DEFAULT false,
  equipment_list JSONB DEFAULT '[]'::jsonb,
  capacity INTEGER DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surgical Cases Table
CREATE TABLE IF NOT EXISTS surgical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  admission_id UUID REFERENCES admissions(id),
  operating_room_id UUID REFERENCES operating_rooms(id),
  
  -- Scheduling Info
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  patient_in_room_time TIMESTAMP WITH TIME ZONE,
  patient_out_room_time TIMESTAMP WITH TIME ZONE,
  
  -- Procedure Info
  procedure_name TEXT NOT NULL,
  procedure_code_cpt VARCHAR(10),
  procedure_code_snomed VARCHAR(20),
  procedure_type VARCHAR(50) CHECK (procedure_type IN ('elective', 'urgent', 'emergent', 'trauma')),
  surgical_approach VARCHAR(50) CHECK (surgical_approach IN ('open', 'laparoscopic', 'robotic', 'endoscopic', 'minimally_invasive')),
  laterality VARCHAR(20) CHECK (laterality IN ('left', 'right', 'bilateral', 'not_applicable')),
  
  -- Diagnosis
  primary_diagnosis TEXT NOT NULL,
  primary_diagnosis_icd10 VARCHAR(10),
  primary_diagnosis_snomed VARCHAR(20),
  secondary_diagnoses JSONB DEFAULT '[]'::jsonb,
  
  -- Staff
  primary_surgeon_id UUID REFERENCES users(id),
  assistant_surgeon_id UUID REFERENCES users(id),
  anesthesiologist_id UUID REFERENCES users(id),
  scrub_nurse_id UUID REFERENCES users(id),
  circulating_nurse_id UUID REFERENCES users(id),
  additional_staff JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'patient_arrived', 'in_progress', 
    'completed', 'cancelled', 'postponed', 'no_show'
  )),
  case_priority INTEGER DEFAULT 3 CHECK (case_priority BETWEEN 1 AND 5),
  
  -- Documentation
  pre_op_diagnosis TEXT,
  post_op_diagnosis TEXT,
  findings TEXT,
  procedure_performed TEXT,
  complications TEXT,
  estimated_blood_loss INTEGER, -- in mL
  specimens_sent JSONB DEFAULT '[]'::jsonb,
  drains_placed JSONB DEFAULT '[]'::jsonb,
  implants_used JSONB DEFAULT '[]'::jsonb,
  
  -- Anesthesia
  anesthesia_type VARCHAR(50) CHECK (anesthesia_type IN ('general', 'regional', 'local', 'MAC', 'spinal', 'epidural')),
  anesthesia_start_time TIMESTAMP WITH TIME ZONE,
  anesthesia_end_time TIMESTAMP WITH TIME ZONE,
  
  -- Disposition
  disposition VARCHAR(50) CHECK (disposition IN ('pacu', 'icu', 'floor', 'home', 'observation')),
  
  -- Administrative
  consent_id UUID REFERENCES patient_consents(id),
  case_cancelled_reason TEXT,
  case_postponed_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surgical Preference Cards
CREATE TABLE IF NOT EXISTS surgical_preference_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id UUID NOT NULL REFERENCES users(id),
  procedure_name VARCHAR(255) NOT NULL,
  procedure_code_cpt VARCHAR(10),
  
  -- Preferences
  preferred_or_type VARCHAR(50),
  preferred_position VARCHAR(50) CHECK (preferred_position IN ('supine', 'prone', 'lateral', 'lithotomy', 'trendelenburg', 'reverse_trendelenburg')),
  preferred_anesthesia VARCHAR(50),
  
  -- Equipment
  required_equipment JSONB DEFAULT '[]'::jsonb,
  preferred_instruments JSONB DEFAULT '[]'::jsonb,
  suture_preferences JSONB DEFAULT '[]'::jsonb,
  
  -- Supplies
  supply_list JSONB DEFAULT '[]'::jsonb,
  implant_options JSONB DEFAULT '[]'::jsonb,
  
  -- Staff
  preferred_scrub_tech VARCHAR(255),
  special_instructions TEXT,
  
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(surgeon_id, procedure_name, version)
);

-- OR Schedule / Block Time
CREATE TABLE IF NOT EXISTS or_block_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
  surgeon_id UUID REFERENCES users(id),
  service_name VARCHAR(100),
  
  -- Schedule
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  
  -- Block Type
  block_type VARCHAR(50) CHECK (block_type IN ('dedicated', 'shared', 'open', 'emergency_only')),
  is_recurring BOOLEAN DEFAULT true,
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Implant Tracking
CREATE TABLE IF NOT EXISTS surgical_implants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  
  -- Implant Info
  implant_name VARCHAR(255) NOT NULL,
  implant_type VARCHAR(100),
  manufacturer VARCHAR(255),
  catalog_number VARCHAR(100),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiration_date DATE,
  
  -- FDA
  udi VARCHAR(255), -- Unique Device Identifier
  udi_di VARCHAR(100), -- Device Identifier
  udi_pi VARCHAR(100), -- Production Identifier
  
  -- Billing
  charge_code VARCHAR(50),
  unit_cost DECIMAL(10, 2),
  billable BOOLEAN DEFAULT true,
  
  -- Documentation
  implanted_by UUID REFERENCES users(id),
  implanted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  body_site VARCHAR(100),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OR Supply Usage
CREATE TABLE IF NOT EXISTS or_supply_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgical_case_id UUID NOT NULL REFERENCES surgical_cases(id),
  
  supply_name VARCHAR(255) NOT NULL,
  supply_code VARCHAR(50),
  quantity_used INTEGER NOT NULL,
  unit_of_measure VARCHAR(20),
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  
  charged_to_patient BOOLEAN DEFAULT true,
  charge_code VARCHAR(50),
  
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OR Turnover Tracking
CREATE TABLE IF NOT EXISTS or_turnover_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_room_id UUID NOT NULL REFERENCES operating_rooms(id),
  surgical_case_id UUID REFERENCES surgical_cases(id),
  
  -- Times
  patient_out_time TIMESTAMP WITH TIME ZONE,
  cleaning_start_time TIMESTAMP WITH TIME ZONE,
  cleaning_end_time TIMESTAMP WITH TIME ZONE,
  next_patient_in_time TIMESTAMP WITH TIME ZONE,
  
  -- Turnover Time (minutes)
  turnover_time INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (next_patient_in_time - patient_out_time))/60
  ) STORED,
  
  -- Delays
  delay_reason TEXT,
  delay_minutes INTEGER,
  
  -- Staff
  cleaned_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_surgical_cases_patient ON surgical_cases(patient_id);
CREATE INDEX idx_surgical_cases_date ON surgical_cases(scheduled_date);
CREATE INDEX idx_surgical_cases_status ON surgical_cases(status);
CREATE INDEX idx_surgical_cases_surgeon ON surgical_cases(primary_surgeon_id);
CREATE INDEX idx_surgical_cases_or ON surgical_cases(operating_room_id);
CREATE INDEX idx_surgical_cases_procedure_cpt ON surgical_cases(procedure_code_cpt);
CREATE INDEX idx_surgical_cases_diagnosis_icd10 ON surgical_cases(primary_diagnosis_icd10);

CREATE INDEX idx_implants_case ON surgical_implants(surgical_case_id);
CREATE INDEX idx_implants_udi ON surgical_implants(udi);
CREATE INDEX idx_implants_lot ON surgical_implants(lot_number);
CREATE INDEX idx_implants_serial ON surgical_implants(serial_number);

CREATE INDEX idx_or_block_room ON or_block_schedule(operating_room_id);
CREATE INDEX idx_or_block_surgeon ON or_block_schedule(surgeon_id);
CREATE INDEX idx_or_block_dow ON or_block_schedule(day_of_week);

CREATE INDEX idx_preference_cards_surgeon ON surgical_preference_cards(surgeon_id);

-- Comments
COMMENT ON TABLE surgical_cases IS 'Complete surgical case tracking from scheduling to completion';
COMMENT ON TABLE surgical_preference_cards IS 'Surgeon preferences for specific procedures';
COMMENT ON TABLE surgical_implants IS 'FDA-compliant implant tracking with UDI';
COMMENT ON TABLE or_turnover_log IS 'OR efficiency tracking and turnover times';
```

### **Seed Data: or-seed-data.sql**

```sql
-- Sample Operating Rooms for Bulawayo General
INSERT INTO operating_rooms (room_number, room_name, location, room_type, has_laminar_flow, has_c_arm, equipment_list) VALUES
('OR-1', 'Main Operating Theatre 1', 'Surgical Suite - 2nd Floor', 'general', true, true, 
 '["Surgical Table", "Anesthesia Machine", "Electrocautery", "Suction System", "Surgical Lights"]'::jsonb),
('OR-2', 'Main Operating Theatre 2', 'Surgical Suite - 2nd Floor', 'general', true, false,
 '["Surgical Table", "Anesthesia Machine", "Electrocautery", "Suction System", "Surgical Lights"]'::jsonb),
('OR-3', 'Cardiac Surgery Suite', 'Surgical Suite - 2nd Floor', 'cardiac', true, true,
 '["Cardiac Table", "Anesthesia Machine", "Heart-Lung Machine", "TEE", "Surgical Lights", "C-Arm"]'::jsonb),
('OR-4', 'Orthopedic Suite', 'Surgical Suite - 2nd Floor', 'ortho', true, true,
 '["Orthopedic Table", "Anesthesia Machine", "C-Arm", "Arthroscopy Tower", "Surgical Lights"]'::jsonb),
('OR-5', 'Minor Procedures Room', 'Day Surgery Unit', 'minor_procedure', false, false,
 '["Procedure Table", "Surgical Lights", "Anesthesia Cart"]'::jsonb)
ON CONFLICT (room_number) DO NOTHING;
```

---

## 🔧 STAGE 2: Backend Development (Week 1-2)

### **Files to Create:**

#### **1. entities/operating-room.entity.ts**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('operating_rooms')
export class OperatingRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_number', length: 20, unique: true })
  roomNumber: string;

  @Column({ name: 'room_name', length: 100 })
  roomName: string;

  @Column({ length: 100, nullable: true })
  location: string;

  @Column({ name: 'room_type', length: 50 })
  roomType: string;

  @Column({ length: 20, default: 'available' })
  status: string;

  @Column({ name: 'has_laminar_flow', default: false })
  hasLaminarFlow: boolean;

  @Column({ name: 'has_c_arm', default: false })
  hasCArm: boolean;

  @Column({ name: 'has_microscope', default: false })
  hasMicroscope: boolean;

  @Column({ name: 'has_robot', default: false })
  hasRobot: boolean;

  @Column({ name: 'equipment_list', type: 'jsonb', default: '[]' })
  equipmentList: any[];

  @Column({ default: 1 })
  capacity: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

#### **2. entities/surgical-case.entity.ts**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { OperatingRoom } from './operating-room.entity';
import { Admission } from './admission.entity';

@Entity('surgical_cases')
export class SurgicalCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_number', length: 50, unique: true })
  caseNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'operating_room_id', type: 'uuid', nullable: true })
  operatingRoomId: string;

  @ManyToOne(() => OperatingRoom)
  @JoinColumn({ name: 'operating_room_id' })
  operatingRoom: OperatingRoom;

  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId: string;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission: Admission;

  // Scheduling
  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'scheduled_start_time', type: 'time' })
  scheduledStartTime: string;

  @Column({ name: 'scheduled_end_time', type: 'time' })
  scheduledEndTime: string;

  @Column({ name: 'actual_start_time', type: 'timestamptz', nullable: true })
  actualStartTime: Date;

  @Column({ name: 'actual_end_time', type: 'timestamptz', nullable: true })
  actualEndTime: Date;

  // Procedure
  @Column({ name: 'procedure_name', type: 'text' })
  procedureName: string;

  @Column({ name: 'procedure_code_cpt', length: 10, nullable: true })
  procedureCodeCpt: string;

  @Column({ name: 'procedure_code_snomed', length: 20, nullable: true })
  procedureCodeSnomed: string;

  @Column({ name: 'procedure_type', length: 50 })
  procedureType: string;

  @Column({ name: 'surgical_approach', length: 50, nullable: true })
  surgicalApproach: string;

  @Column({ length: 20, nullable: true })
  laterality: string;

  // Diagnosis
  @Column({ name: 'primary_diagnosis', type: 'text' })
  primaryDiagnosis: string;

  @Column({ name: 'primary_diagnosis_icd10', length: 10, nullable: true })
  primaryDiagnosisIcd10: string;

  @Column({ name: 'primary_diagnosis_snomed', length: 20, nullable: true })
  primaryDiagnosisSnomed: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: '[]' })
  secondaryDiagnoses: any[];

  // Staff
  @Column({ name: 'primary_surgeon_id', type: 'uuid' })
  primarySurgeonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'primary_surgeon_id' })
  primarySurgeon: User;

  @Column({ name: 'anesthesiologist_id', type: 'uuid', nullable: true })
  anesthesiologistId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'anesthesiologist_id' })
  anesthesiologist: User;

  @Column({ name: 'scrub_nurse_id', type: 'uuid', nullable: true })
  scrubNurseId: string;

  @Column({ name: 'circulating_nurse_id', type: 'uuid', nullable: true })
  circulatingNurseId: string;

  @Column({ name: 'additional_staff', type: 'jsonb', default: '[]' })
  additionalStaff: any[];

  // Status
  @Column({ length: 50, default: 'scheduled' })
  status: string;

  @Column({ name: 'case_priority', type: 'integer', default: 3 })
  casePriority: number;

  // Documentation
  @Column({ name: 'pre_op_diagnosis', type: 'text', nullable: true })
  preOpDiagnosis: string;

  @Column({ name: 'post_op_diagnosis', type: 'text', nullable: true })
  postOpDiagnosis: string;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ name: 'procedure_performed', type: 'text', nullable: true })
  procedurePerformed: string;

  @Column({ type: 'text', nullable: true })
  complications: string;

  @Column({ name: 'estimated_blood_loss', type: 'integer', nullable: true })
  estimatedBloodLoss: number;

  @Column({ name: 'specimens_sent', type: 'jsonb', default: '[]' })
  specimensSent: any[];

  @Column({ name: 'drains_placed', type: 'jsonb', default: '[]' })
  drainsPlaced: any[];

  @Column({ name: 'implants_used', type: 'jsonb', default: '[]' })
  implantsUsed: any[];

  // Anesthesia
  @Column({ name: 'anesthesia_type', length: 50, nullable: true })
  anesthesiaType: string;

  @Column({ name: 'disposition', length: 50, nullable: true })
  disposition: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

#### **3. services/operating-room.service.ts**
```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OperatingRoom } from '../entities/operating-room.entity';
import { SurgicalCase } from '../entities/surgical-case.entity';

@Injectable()
export class OperatingRoomService {
  private readonly logger = new Logger(OperatingRoomService.name);

  async getOperatingRooms(filters: any, tenantDb: DataSource): Promise<OperatingRoom[]> {
    const repository = tenantDb.getRepository(OperatingRoom);
    const queryBuilder = repository.createQueryBuilder('or');

    if (filters.roomType) {
      queryBuilder.andWhere('or.roomType = :roomType', { roomType: filters.roomType });
    }

    if (filters.status) {
      queryBuilder.andWhere('or.status = :status', { status: filters.status });
    }

    if (typeof filters.isActive !== 'undefined') {
      queryBuilder.andWhere('or.isActive = :isActive', { isActive: filters.isActive });
    }

    queryBuilder.orderBy('or.roomNumber', 'ASC');

    return await queryBuilder.getMany();
  }

  async getORAvailability(date: Date, tenantDb: DataSource): Promise<any> {
    // Get all ORs and their scheduled cases for the date
    const query = `
      SELECT 
        or_rooms.id,
        or_rooms.room_number,
        or_rooms.room_name,
        or_rooms.room_type,
        or_rooms.status,
        json_agg(
          json_build_object(
            'caseId', sc.id,
            'caseNumber', sc.case_number,
            'patientName', p.first_name || ' ' || p.last_name,
            'procedureName', sc.procedure_name,
            'scheduledStartTime', sc.scheduled_start_time,
            'scheduledEndTime', sc.scheduled_end_time,
            'surgeon', u.first_name || ' ' || u.last_name,
            'status', sc.status
          ) ORDER BY sc.scheduled_start_time
        ) FILTER (WHERE sc.id IS NOT NULL) as scheduled_cases
      FROM operating_rooms or_rooms
      LEFT JOIN surgical_cases sc ON sc.operating_room_id = or_rooms.id 
        AND sc.scheduled_date = $1
        AND sc.status NOT IN ('cancelled', 'completed')
      LEFT JOIN patients p ON sc.patient_id = p.id
      LEFT JOIN users u ON sc.primary_surgeon_id = u.id
      WHERE or_rooms.is_active = true
      GROUP BY or_rooms.id, or_rooms.room_number, or_rooms.room_name, or_rooms.room_type, or_rooms.status
      ORDER BY or_rooms.room_number
    `;

    return await tenantDb.query(query, [date]);
  }

  async scheduleSurgicalCase(caseData: any, userId: string, tenantDb: DataSource): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);

    // Generate case number
    const caseNumber = await this.generateCaseNumber(tenantDb);

    // Verify OR availability
    const isAvailable = await this.checkORAvailability(
      caseData.operatingRoomId,
      caseData.scheduledDate,
      caseData.scheduledStartTime,
      caseData.scheduledEndTime,
      tenantDb
    );

    if (!isAvailable) {
      throw new BadRequestException('Operating room is not available at the requested time');
    }

    const surgicalCase = repository.create({
      caseNumber,
      ...caseData,
      status: 'scheduled',
      createdBy: userId,
    });

    const saved = await repository.save(surgicalCase);
    this.logger.log(`Surgical case scheduled: ${saved.caseNumber}`);

    return saved;
  }

  async updateCaseStatus(caseId: string, status: string, userId: string, tenantDb: DataSource): Promise<SurgicalCase> {
    const repository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = await repository.findOne({ where: { id: caseId } });

    if (!surgicalCase) {
      throw new NotFoundException('Surgical case not found');
    }

    surgicalCase.status = status;

    // Set actual times based on status
    if (status === 'in_progress' && !surgicalCase.actualStartTime) {
      surgicalCase.actualStartTime = new Date();
    }

    if (status === 'completed' && !surgicalCase.actualEndTime) {
      surgicalCase.actualEndTime = new Date();
    }

    return await repository.save(surgicalCase);
  }

  async trackImplant(implantData: any, userId: string, tenantDb: DataSource): Promise<any> {
    const query = `
      INSERT INTO surgical_implants (
        surgical_case_id, implant_name, implant_type, manufacturer,
        catalog_number, lot_number, serial_number, udi,
        unit_cost, billable, implanted_by, body_site, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await tenantDb.query(query, [
      implantData.surgicalCaseId,
      implantData.implantName,
      implantData.implantType,
      implantData.manufacturer,
      implantData.catalogNumber,
      implantData.lotNumber,
      implantData.serialNumber,
      implantData.udi,
      implantData.unitCost,
      implantData.billable !== false,
      userId,
      implantData.bodySite,
      implantData.notes,
    ]);

    return result[0];
  }

  async getORMetrics(startDate: Date, endDate: Date, tenantDb: DataSource): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_cases,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_cases,
        AVG(EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))/60) FILTER (WHERE actual_end_time IS NOT NULL) as avg_case_duration_minutes,
        AVG(estimated_blood_loss) FILTER (WHERE estimated_blood_loss IS NOT NULL) as avg_blood_loss,
        COUNT(DISTINCT operating_room_id) as rooms_utilized
      FROM surgical_cases
      WHERE scheduled_date BETWEEN $1 AND $2
    `;

    const result = await tenantDb.query(query, [startDate, endDate]);
    return result[0];
  }

  private async generateCaseNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM surgical_cases WHERE case_number LIKE 'SUR-%'`
    );
    const count = parseInt(result.count) + 1;
    return `SUR-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  private async checkORAvailability(
    orId: string,
    date: Date,
    startTime: string,
    endTime: string,
    tenantDb: DataSource
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as conflicts
      FROM surgical_cases
      WHERE operating_room_id = $1
        AND scheduled_date = $2
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (scheduled_start_time, scheduled_end_time) OVERLAPS ($3::time, $4::time)
        )
    `;

    const [result] = await tenantDb.query(query, [orId, date, startTime, endTime]);
    return result.conflicts === '0';
  }
}
```

#### **4. controllers/operating-room.controller.ts**
```typescript
import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OperatingRoomService } from '../services/operating-room.service';
import { TenantService } from '../services/tenant.service';

@Controller('operating-room')
@UseGuards(JwtAuthGuard)
export class OperatingRoomController {
  constructor(
    private readonly orService: OperatingRoomService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('rooms')
  async getOperatingRooms(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getOperatingRooms(filters, tenantDb);
  }

  @Get('availability')
  async getORAvailability(@Query('date') date: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getORAvailability(new Date(date), tenantDb);
  }

  @Post('cases')
  async scheduleSurgicalCase(@Body() caseData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.scheduleSurgicalCase(caseData, req.user.userId, tenantDb);
  }

  @Put('cases/:id/status')
  async updateCaseStatus(
    @Param('id') caseId: string,
    @Body('status') status: string,
    @Req() req: RequestWithTenant
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateCaseStatus(caseId, status, req.user.userId, tenantDb);
  }

  @Get('cases/:id')
  async getSurgicalCase(@Param('id') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getSurgicalCase(caseId, tenantDb);
  }

  @Post('implants')
  async trackImplant(@Body() implantData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.trackImplant(implantData, req.user.userId, tenantDb);
  }

  @Get('metrics')
  async getORMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getORMetrics(new Date(startDate), new Date(endDate), tenantDb);
  }
}
```

**✅ COMMIT:** `feat(sprint26): Add OR backend - entities, service, controller`

---

## 🎨 STAGE 3: Frontend Development (Week 2-3)

### **Files to Create:**

#### **1. pages/ORDashboard.tsx**

**Features:**
- OR Board - Visual OR availability (like bed board)
- Daily schedule view (timeline)
- Case list (scheduled, in progress, completed)
- Quick stats (utilization, avg case time, etc.)

**UI Design:**
```
┌──────────────────────────────────────────────┐
│ 🏥 Operating Room Dashboard                 │
├──────────────────────────────────────────────┤
│ Date: [Dec 4, 2025 ▼]  View: [Timeline ▼]  │
├──────────────────────────────────────────────┤
│ Stats (Today):                               │
│ [5 Cases] [4 Completed] [1 In Progress]    │
│ [85% Utilization] [2.5h Avg Duration]       │
├──────────────────────────────────────────────┤
│                                              │
│ OR-1: General Surgery                        │
│ ├─ 08:00-10:30 [Completed] Appendectomy    │
│ ├─ 11:00-13:00 [In Progress] Cholecystectomy│
│ └─ 14:00-16:00 [Scheduled] Hernia Repair   │
│                                              │
│ OR-2: Orthopedics                           │
│ ├─ 09:00-12:00 [Completed] Total Knee      │
│ └─ 13:00-15:00 [Scheduled] Hip Replacement │
│                                              │
│ OR-3: Cardiac (Available)                   │
│ └─ [No cases scheduled]                     │
└──────────────────────────────────────────────┘
```

**API Calls:**
```typescript
// ✅ CORRECT - Use axios directly
const response = await axios.get('/operating-room/availability', {
  params: { date: selectedDate },
  headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }
});

// ❌ WRONG - Don't use non-existent methods
// const response = await ehrApi.getORAvailability(date);
```

**✅ COMMIT:** `feat(sprint26): Add OR Dashboard with timeline view`

#### **2. components/ScheduleSurgeryModal.tsx**

**Features:**
- Patient selection
- Procedure selection (with CPT/SNOMED)
- Diagnosis selection (**ICD10Picker!**)
- OR selection (available only)
- Date & time selection
- Surgeon & staff assignment
- Duration estimate
- Priority level
- Special requirements

**✅ COMMIT:** `feat(sprint26): Add schedule surgery modal with ICD10Picker`

#### **3. components/SurgicalCaseDetailModal.tsx**

**Features:**
- Case overview (patient, procedure, staff)
- Start/complete case buttons
- Intraoperative documentation:
  - Findings
  - Procedure performed
  - Complications
  - EBL (estimated blood loss)
  - Specimens sent
  - Drains placed
  - Implants used
- Status timeline
- Post-op orders button

**✅ COMMIT:** `feat(sprint26): Add surgical case detail & documentation`

#### **4. components/ImplantTrackingModal.tsx**

**Features:**
- Implant catalog search
- Lot number entry
- Serial number entry
- UDI scanning (barcode future)
- Expiration date
- Body site
- Billable flag
- Automatic charge capture

**✅ COMMIT:** `feat(sprint26): Add FDA-compliant implant tracking`

#### **5. components/ORBoardView.tsx**

**Features:**
- Visual OR board (like bed board)
- Color-coded status
- Drag-and-drop scheduling (future)
- Quick case info
- Click to open details

**Design:**
- Glassy cards for each OR
- Green = available
- Blue = scheduled
- Orange = in progress
- Gray = cleaning
- Red = emergency

**✅ COMMIT:** `feat(sprint26): Add OR board visualization`

---

## 🧪 STAGE 4: Testing & Polish (Week 3-4)

### **Test Scenarios:**

#### **Test 1: Schedule Routine Surgery**
```
1. Open OR Dashboard
2. Click "Schedule Surgery"
3. Select patient
4. Enter procedure: "Laparoscopic Cholecystectomy"
5. Search ICD-10: "cholecystitis" → Select K81.0
6. Enter CPT: 47562
7. Select OR-2, Date: Tomorrow, Time: 09:00-11:00
8. Assign surgeon: Dr. Smith
9. Assign anesthesiologist: Dr. Jones
10. Assign scrub nurse: Nurse Brown
11. Priority: Routine (3)
12. Click "Schedule"
✅ Case appears on OR board
✅ OR shows as "scheduled" for that time
```

#### **Test 2: Start Surgical Case**
```
1. Open surgical case from board
2. Verify patient, procedure, staff
3. Click "Start Case"
4. Status changes to "in_progress"
5. Timer starts
6. Actual start time recorded
✅ Case marked as in progress
✅ OR status updated
```

#### **Test 3: Document Surgery**
```
1. During case, click "Add Documentation"
2. Enter findings: "Acute cholecystitis confirmed"
3. Enter procedure performed: "Laparoscopic cholecystectomy completed"
4. Enter EBL: 50 mL
5. Add specimen: "Gallbladder"
6. Add drain: "JP drain, RUQ"
7. Click "Save"
✅ Documentation saved
✅ Visible in case detail
```

#### **Test 4: Track Implant**
```
1. Click "Add Implant"
2. Enter implant name: "Titanium Mesh"
3. Manufacturer: "Ethicon"
4. Lot number: LOT123456
5. Serial number: SN789012
6. UDI: (01)00843210001234...
7. Unit cost: $500
8. Body site: "Abdominal wall"
9. Click "Track Implant"
✅ Implant recorded
✅ Charge captured
✅ FDA compliance maintained
```

#### **Test 5: Complete Case**
```
1. Click "Complete Case"
2. Enter post-op diagnosis: "Acute cholecystitis"
3. Select disposition: "PACU"
4. Enter post-op orders
5. Click "Complete"
✅ Case marked as completed
✅ Actual end time recorded
✅ OR available for cleaning
✅ Post-op orders sent
```

### **UI/UX Polish Checklist:**
- [ ] Loading states on all buttons
- [ ] Error handling with toast notifications
- [ ] Confirmation dialogs for destructive actions
- [ ] Responsive design (mobile-friendly)
- [ ] Glassmorphism design
- [ ] Color-coded status indicators
- [ ] Icons for all actions
- [ ] Tooltips for complex fields
- [ ] Keyboard shortcuts (Esc to close modals)
- [ ] Auto-refresh OR board (every 30s)

### **Code Quality:**
```bash
# Lint check
cd ehr-frontend && npm run lint

# Fix any errors
# Check for duplications
# Remove console.logs
# Add proper types
```

**✅ COMMIT:** `fix(sprint26): Polish UI/UX and fix lint errors`

---

## 📊 STAGE 5: Integration Testing (Week 4)

### **End-to-End Workflow:**

```
COMPLETE SURGICAL WORKFLOW TEST:

1. PRE-OP:
   - Patient admitted (ADT module)
   - Surgical consent signed (Consent module)
   - Pre-op assessment done
   - Surgery scheduled in OR

2. DAY OF SURGERY:
   - Patient arrives
   - Case appears on OR board
   - Anesthesia team notified
   - Start case
   - Document surgery
   - Track implants/supplies
   - Complete case

3. POST-OP:
   - Patient to PACU/ICU
   - Post-op orders
   - Medications via BCMA
   - Monitor vitals
   - Discharge when ready

✅ All modules work together
✅ Data flows correctly
✅ No API errors
✅ UI responsive
```

### **Database Verification:**
```sql
-- Check OR rooms
SELECT * FROM operating_rooms;
-- Expected: 5 ORs

-- Check scheduled cases
SELECT case_number, procedure_name, status, scheduled_date 
FROM surgical_cases;

-- Check implants
SELECT implant_name, udi, unit_cost 
FROM surgical_implants;

-- Check OR metrics
SELECT * FROM or_turnover_log;
```

**✅ COMMIT:** `test(sprint26): Verify complete OR workflow end-to-end`

---

## 📚 STAGE 6: Documentation (Week 4)

### **Documents to Create:**

1. **OR_USER_GUIDE.md**
   - How to schedule surgery
   - How to start/complete cases
   - How to track implants
   - How to view OR metrics

2. **OR_API_DOCUMENTATION.md**
   - All OR endpoints
   - Request/response examples
   - Error codes

3. **OR_ADMIN_GUIDE.md**
   - How to configure ORs
   - How to set block schedules
   - How to manage preference cards

**✅ COMMIT:** `docs(sprint26): Add OR management documentation`

---

## ✅ Sprint 26 Definition of Done

- [ ] Database schema created & provisioned
- [ ] Applied to tenant_bulawayo_general
- [ ] 5 OR entities created
- [ ] OR service with 10+ methods
- [ ] OR controller with 8+ endpoints
- [ ] Registered in ehr.module.ts
- [ ] OR Dashboard page created
- [ ] Schedule surgery modal
- [ ] Case detail modal
- [ ] Implant tracking modal
- [ ] OR board visualization
- [ ] All components use axios (not ehrApi methods)
- [ ] UI polished with glassmorphism
- [ ] Mobile responsive
- [ ] No lint/syntax errors
- [ ] No code duplications
- [ ] End-to-end workflow tested
- [ ] Documentation complete
- [ ] All stages committed to git
- [ ] Can perform complete surgical workflow

---

## 🎯 Success Metrics

### **Functional:**
- ✅ Can schedule 10+ surgeries
- ✅ Can see OR availability
- ✅ Can start/complete cases
- ✅ Can track implants
- ✅ Can view OR metrics

### **Performance:**
- ✅ OR board loads <2s
- ✅ Schedule modal opens <500ms
- ✅ No API timeouts

### **Quality:**
- ✅ Zero lint errors
- ✅ Zero TypeScript errors
- ✅ 100% responsive
- ✅ All CRUD operations work

---

## 🔄 Git Commit Strategy

**Minimum 15 commits for this sprint:**

1. `feat(sprint26): Add OR database schema and migrations`
2. `feat(sprint26): Provision OR tables to bulawayo-general`
3. `feat(sprint26): Add operating room entity`
4. `feat(sprint26): Add surgical case entity`
5. `feat(sprint26): Add implant entity`
6. `feat(sprint26): Add OR service with scheduling logic`
7. `feat(sprint26): Add OR controller with endpoints`
8. `feat(sprint26): Register OR module in ehr.module.ts`
9. `test(sprint26): Verify OR API endpoints`
10. `feat(sprint26): Add OR Dashboard page`
11. `feat(sprint26): Add schedule surgery modal with ICD10Picker`
12. `feat(sprint26): Add surgical case detail modal`
13. `feat(sprint26): Add implant tracking modal`
14. `feat(sprint26): Add OR board visualization`
15. `fix(sprint26): Polish UI/UX and fix lint errors`
16. `test(sprint26): End-to-end OR workflow verification`
17. `docs(sprint26): Add OR management documentation`

---

## 📦 Deliverables

### **Database:**
- `database/migrations/010-operating-room-management.sql`
- `database/seeds/or-seed-data.sql`

### **Backend:**
- `services/ehr-service/src/entities/operating-room.entity.ts`
- `services/ehr-service/src/entities/surgical-case.entity.ts`
- `services/ehr-service/src/entities/surgical-preference-card.entity.ts`
- `services/ehr-service/src/entities/surgical-implant.entity.ts`
- `services/ehr-service/src/services/operating-room.service.ts`
- `services/ehr-service/src/controllers/operating-room.controller.ts`
- `services/ehr-service/src/dto/operating-room.dto.ts`

### **Frontend:**
- `ehr-frontend/src/pages/ORDashboard.tsx`
- `ehr-frontend/src/components/ScheduleSurgeryModal.tsx`
- `ehr-frontend/src/components/SurgicalCaseDetailModal.tsx`
- `ehr-frontend/src/components/ImplantTrackingModal.tsx`
- `ehr-frontend/src/components/ORBoardView.tsx`
- `ehr-frontend/src/components/ORTimelineView.tsx`

### **Documentation:**
- `docs/user-guides/or-management-guide.md`
- `docs/api/operating-room-api.md`

---

## 🚀 Ready to Start Sprint 26?

**Next Action:** Begin Stage 1 - Database Schema creation

**Estimated Completion:** 4 weeks from start

**Result:** Full operating room management system ready for surgical hospitals! 🏥

