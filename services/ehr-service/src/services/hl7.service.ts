import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { MedicalRecord } from '../entities/medical-record.entity';

@Injectable()
export class Hl7Service {

  async processAdtMessage(hl7Message: string, tenantDb: DataSource) {
    try {
      const segments = this.parseHl7Message(hl7Message);
      const msh = this.parseSegment(segments.find(s => s.startsWith('MSH')));
      const pid = this.parseSegment(segments.find(s => s.startsWith('PID')));
      const evn = this.parseSegment(segments.find(s => s.startsWith('EVN')));

      const patientRepository = tenantDb.getRepository(Patient);

      // Extract patient information
      const patientData = {
        patientNumber: pid[3]?.[0]?.split('^')[0],
        firstName: pid[5]?.[0]?.split('^')[1],
        lastName: pid[5]?.[0]?.split('^')[0],
        middleName: pid[5]?.[0]?.split('^')[2],
        dateOfBirth: this.parseHl7Date(pid[7]?.[0]),
        gender: pid[8]?.[0]?.toLowerCase(),
        phone: pid[13]?.[0],
        address: pid[11]?.[0]?.split('^')[0],
        city: pid[11]?.[0]?.split('^')[2],
        province: pid[11]?.[0]?.split('^')[3],
        postalCode: pid[11]?.[0]?.split('^')[4]
      };

      // Check if patient exists
      let patient = await patientRepository.findOne({
        where: { patientNumber: patientData.patientNumber }
      });

      if (!patient) {
        // Create new patient
        patient = patientRepository.create(patientData as any) as any;
        await patientRepository.save(patient);
      } else {
        // Update existing patient
        Object.assign(patient, patientData);
        await patientRepository.save(patient);
      }

      return {
        messageType: 'ADT',
        eventType: evn[1]?.[0],
        patientId: patient.id,
        status: 'processed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to process ADT message: ${error.message}`);
    }
  }

  async processOrmMessage(hl7Message: string, tenantDb: DataSource) {
    try {
      const segments = this.parseHl7Message(hl7Message);
      const msh = this.parseSegment(segments.find(s => s.startsWith('MSH')));
      const pid = this.parseSegment(segments.find(s => s.startsWith('PID')));
      const orc = this.parseSegment(segments.find(s => s.startsWith('ORC')));
      const obr = this.parseSegment(segments.find(s => s.startsWith('OBR')));

      const labOrderRepository = tenantDb.getRepository(LabOrder);
      const patientRepository = tenantDb.getRepository(Patient);

      // Find patient
      const patient = await patientRepository.findOne({
        where: { patientNumber: pid[3]?.[0]?.split('^')[0] }
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      // Create lab order
      const labOrder = labOrderRepository.create({
        orderNumber: orc[2]?.[0],
        patientId: patient.id,
        orderingProviderId: orc[12]?.[0], // This would need to be mapped to actual provider
        tests: [{
          testCode: obr[4]?.[0]?.split('^')[0],
          testName: obr[4]?.[0]?.split('^')[1],
          category: 'hematology' as any, // Default, should be mapped from test code
          specimenType: obr[15]?.[0]
        }],
        clinicalInfo: obr[13]?.[0],
        scheduledDateTime: this.parseHl7DateTime(obr[6]?.[0])
      });

      await labOrderRepository.save(labOrder);

      return {
        messageType: 'ORM',
        orderId: labOrder.id,
        orderNumber: labOrder.orderNumber,
        status: 'processed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to process ORM message: ${error.message}`);
    }
  }

  async processOruMessage(hl7Message: string, tenantDb: DataSource) {
    try {
      const segments = this.parseHl7Message(hl7Message);
      const msh = this.parseSegment(segments.find(s => s.startsWith('MSH')));
      const pid = this.parseSegment(segments.find(s => s.startsWith('PID')));
      const obr = this.parseSegment(segments.find(s => s.startsWith('OBR')));
      const obxSegments = segments.filter(s => s.startsWith('OBX')).map(s => this.parseSegment(s));

      const labOrderRepository = tenantDb.getRepository(LabOrder);

      // Find lab order by order number
      const labOrder = await labOrderRepository.findOne({
        where: { orderNumber: obr[2]?.[0] }
      });

      if (!labOrder) {
        throw new Error('Lab order not found');
      }

      // Process results
      const results = obxSegments.map(obx => ({
        testCode: obx[3]?.[0]?.split('^')[0],
        testName: obx[3]?.[0]?.split('^')[1],
        value: obx[5]?.[0],
        unit: obx[6]?.[0],
        referenceRange: obx[7]?.[0],
        flag: this.mapAbnormalFlag(obx[8]?.[0]),
        resultDate: new Date(),
        performedBy: obx[16]?.[0]
      }));

      // Update lab order with results
      labOrder.results = results;
      labOrder.status = 'completed' as any;
      await labOrderRepository.save(labOrder);

      return {
        messageType: 'ORU',
        orderId: labOrder.id,
        resultsCount: results.length,
        status: 'processed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to process ORU message: ${error.message}`);
    }
  }

  async processMdmMessage(hl7Message: string, tenantDb: DataSource) {
    try {
      const segments = this.parseHl7Message(hl7Message);
      const msh = this.parseSegment(segments.find(s => s.startsWith('MSH')));
      const evn = this.parseSegment(segments.find(s => s.startsWith('EVN')));
      const pid = this.parseSegment(segments.find(s => s.startsWith('PID')));
      const txa = this.parseSegment(segments.find(s => s.startsWith('TXA')));

      // Process medical document
      return {
        messageType: 'MDM',
        documentType: txa[2]?.[0],
        documentId: txa[12]?.[0],
        status: 'processed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to process MDM message: ${error.message}`);
    }
  }

  async generateAdtMessage(patientId: string, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ where: { id: patientId } });

    if (!patient) {
      throw new Error('Patient not found');
    }

    const timestamp = this.formatHl7DateTime(new Date());
    const messageControlId = `ADT${Date.now()}`;

    const extendedPatient = patient as Patient & {
      middleName?: string;
      province?: string;
      postalCode?: string;
    };

    const hl7Message = [
      `MSH|^~\\&|MEDICORE|CLINIC|HIS|HOSPITAL|${timestamp}||ADT^A04^ADT_A01|${messageControlId}|P|2.5`,
      `EVN||${timestamp}|||^SYSTEM^MEDICORE`,
      `PID|1||${patient.patientNumber}^^^MEDICORE^MR||${patient.lastName}^${patient.firstName}^${extendedPatient.middleName || ''}||${this.formatHl7Date(patient.dateOfBirth)}|${patient.gender?.toUpperCase()}|||${patient.address}^^${patient.city}^${extendedPatient.province || ''}^${extendedPatient.postalCode || ''}||${patient.phone}|||||||||||||||||||`,
      `PV1|1|O|||||||||||||||||||||||||||||||||||||||||||||||||`
    ].join('\r');

    return {
      message: hl7Message,
      messageType: 'ADT^A04',
      messageControlId,
      timestamp
    };
  }

  async generateOrmMessage(orderId: string, tenantDb: DataSource) {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const labOrder = await labOrderRepository.findOne({
      where: { id: orderId },
      relations: ['patient']
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    const timestamp = this.formatHl7DateTime(new Date());
    const messageControlId = `ORM${Date.now()}`;

    const hl7Message = [
      `MSH|^~\\&|MEDICORE|CLINIC|LIS|LAB|${timestamp}||ORM^O01^ORM_O01|${messageControlId}|P|2.5`,
      `PID|1||${labOrder.patient.patientNumber}^^^MEDICORE^MR||${labOrder.patient.lastName}^${labOrder.patient.firstName}||${this.formatHl7Date(labOrder.patient.dateOfBirth)}|${labOrder.patient.gender?.toUpperCase()}`,
      `ORC|NW|${labOrder.orderNumber}||||||${this.formatHl7DateTime(labOrder.createdAt)}`,
      ...labOrder.tests.map(test => 
        `OBR|1|${labOrder.orderNumber}||${test.testCode}^${test.testName}|||${this.formatHl7DateTime(labOrder.scheduledDateTime || labOrder.createdAt)}||||||||${labOrder.clinicalInfo}||||||||||F`
      )
    ].join('\r');

    return {
      message: hl7Message,
      messageType: 'ORM^O01',
      messageControlId,
      timestamp
    };
  }

  private parseHl7Message(message: string): string[] {
    return message.split(/\r?\n/).filter(line => line.trim());
  }

  private parseSegment(segment: string): string[][] {
    if (!segment) return [];
    
    const fields = segment.split('|');
    return fields.map(field => field.split('^'));
  }

  private parseHl7Date(hl7Date: string): Date {
    if (!hl7Date) return null;
    
    // HL7 date format: YYYYMMDD
    const year = parseInt(hl7Date.substring(0, 4));
    const month = parseInt(hl7Date.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(hl7Date.substring(6, 8));
    
    return new Date(year, month, day);
  }

  private parseHl7DateTime(hl7DateTime: string): Date {
    if (!hl7DateTime) return null;
    
    // HL7 datetime format: YYYYMMDDHHMMSS
    const year = parseInt(hl7DateTime.substring(0, 4));
    const month = parseInt(hl7DateTime.substring(4, 6)) - 1;
    const day = parseInt(hl7DateTime.substring(6, 8));
    const hour = parseInt(hl7DateTime.substring(8, 10)) || 0;
    const minute = parseInt(hl7DateTime.substring(10, 12)) || 0;
    const second = parseInt(hl7DateTime.substring(12, 14)) || 0;
    
    return new Date(year, month, day, hour, minute, second);
  }

  private formatHl7Date(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  private formatHl7DateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  private mapAbnormalFlag(flag: string): 'normal' | 'high' | 'low' | 'critical' {
    switch (flag?.toUpperCase()) {
      case 'H': return 'high';
      case 'L': return 'low';
      case 'HH':
      case 'LL':
      case 'AA': return 'critical';
      default: return 'normal';
    }
  }
}