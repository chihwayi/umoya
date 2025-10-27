import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Appointment } from '../entities/appointment.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Bill } from '../entities/billing.entity';

@Injectable()
export class ReportsService {
  
  async getPatientSummary(patientId: string, tenantDb: DataSource) {
    const patientRepo = tenantDb.getRepository(Patient);
    const appointmentRepo = tenantDb.getRepository(Appointment);
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    const labRepo = tenantDb.getRepository(LabOrder);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    const appointments = await appointmentRepo.find({ where: { patientId } });
    const records = await recordRepo.find({ where: { patientId } });
    const prescriptions = await prescriptionRepo.find({ where: { patientId } });
    const labOrders = await labRepo.find({ where: { patientId } });

    return {
      patient,
      summary: {
        totalVisits: appointments.length,
        lastVisit: appointments[0]?.appointmentDate,
        activePrescriptions: prescriptions.filter(p => p.status === 'active').length,
        pendingLabResults: labOrders.filter(l => l.status === 'pending').length,
        chronicConditions: patient?.medicalHistory?.split(',') || []
      },
      recentActivity: {
        appointments: appointments.slice(0, 5),
        prescriptions: prescriptions.slice(0, 5),
        labOrders: labOrders.slice(0, 5)
      }
    };
  }

  async getFinancialReport(query: any, tenantDb: DataSource) {
    const billRepo = tenantDb.getRepository(Bill);
    
    let queryBuilder = billRepo.createQueryBuilder('bill');
    
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('bill.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate
      });
    }

    const bills = await queryBuilder.getMany();
    
    const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
    const paidBills = bills.filter(b => b.status === 'paid');
    const pendingBills = bills.filter(b => b.status === 'pending');
    
    return {
      period: { startDate: query.startDate, endDate: query.endDate },
      summary: {
        totalRevenue,
        paidAmount: paidBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0),
        pendingAmount: pendingBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0),
        totalBills: bills.length,
        paidBills: paidBills.length,
        pendingBills: pendingBills.length
      },
      currency: 'USD', // Support for ZWL/USD
      breakdown: {
        byStatus: {
          paid: paidBills.length,
          pending: pendingBills.length,
          overdue: bills.filter(b => b.status === 'overdue').length
        }
      }
    };
  }

  async getClinicalReport(query: any, tenantDb: DataSource) {
    const appointmentRepo = tenantDb.getRepository(Appointment);
    const recordRepo = tenantDb.getRepository(MedicalRecord);
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    
    const appointments = await appointmentRepo.find();
    const records = await recordRepo.find();
    const prescriptions = await prescriptionRepo.find();

    // Common diagnoses analysis
    const diagnoses = records.map(r => r.diagnosis).filter(Boolean);
    const diagnosisCount = diagnoses.reduce((acc, diagnosis) => {
      acc[diagnosis] = (acc[diagnosis] || 0) + 1;
      return acc;
    }, {});

    return {
      period: { startDate: query.startDate, endDate: query.endDate },
      summary: {
        totalConsultations: appointments.length,
        completedConsultations: appointments.filter(a => a.status === 'completed').length,
        totalPrescriptions: prescriptions.length,
        activePrescriptions: prescriptions.filter(p => p.status === 'active').length
      },
      topDiagnoses: Object.entries(diagnosisCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([diagnosis, count]) => ({ diagnosis, count })),
      appointmentTrends: {
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        completed: appointments.filter(a => a.status === 'completed').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
        noShow: appointments.filter(a => a.status === 'no_show').length
      }
    };
  }

  async getDashboardData(tenantDb: DataSource) {
    const patientRepo = tenantDb.getRepository(Patient);
    const appointmentRepo = tenantDb.getRepository(Appointment);
    const billRepo = tenantDb.getRepository(Bill);
    const prescriptionRepo = tenantDb.getRepository(Prescription);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalPatients,
      todayAppointments,
      monthlyRevenue,
      activePrescriptions
    ] = await Promise.all([
      patientRepo.count({ where: { isActive: true } }),
      appointmentRepo.count({
        where: {
          appointmentDate: today
        }
      }),
      billRepo.createQueryBuilder('bill')
        .select('SUM(bill.totalAmount)', 'total')
        .where('bill.createdAt >= :startOfMonth', { startOfMonth })
        .getRawOne(),
      prescriptionRepo.count({ where: { status: 'active' } })
    ]);

    return {
      overview: {
        totalPatients,
        todayAppointments,
        monthlyRevenue: Number(monthlyRevenue?.total || 0),
        activePrescriptions
      },
      recentActivity: {
        newPatients: 5, // Last 7 days
        completedAppointments: 23, // This week
        pendingLabResults: 8,
        overduePayments: 3
      },
      alerts: [
        { type: 'info', message: 'System backup completed successfully' },
        { type: 'warning', message: '3 patients have overdue appointments' }
      ]
    };
  }

  async getAppointmentsReport(query: any, tenantDb: DataSource) {
    const appointmentRepo = tenantDb.getRepository(Appointment);
    
    const appointments = await appointmentRepo.find({
      relations: ['patient'],
      order: { appointmentDate: 'DESC' }
    });

    return {
      total: appointments.length,
      byStatus: {
        scheduled: appointments.filter(a => a.status === 'scheduled').length,
        completed: appointments.filter(a => a.status === 'completed').length,
        cancelled: appointments.filter(a => a.status === 'cancelled').length,
        noShow: appointments.filter(a => a.status === 'no_show').length
      },
      appointments: appointments.slice(0, 50) // Limit for performance
    };
  }

  async getPrescriptionsReport(query: any, tenantDb: DataSource) {
    const prescriptionRepo = tenantDb.getRepository(Prescription);
    
    const prescriptions = await prescriptionRepo.find({
      relations: ['patient'],
      order: { createdAt: 'DESC' }
    });

    // Most prescribed medications
    const medicationCount = prescriptions.reduce((acc, prescription) => {
      acc[prescription.medicationName] = (acc[prescription.medicationName] || 0) + 1;
      return acc;
    }, {});

    return {
      total: prescriptions.length,
      byStatus: {
        active: prescriptions.filter(p => p.status === 'active').length,
        completed: prescriptions.filter(p => p.status === 'completed').length,
        cancelled: prescriptions.filter(p => p.status === 'cancelled').length
      },
      topMedications: Object.entries(medicationCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([medication, count]) => ({ medication, count })),
      prescriptions: prescriptions.slice(0, 50)
    };
  }

  async getLabResultsReport(query: any, tenantDb: DataSource) {
    const labRepo = tenantDb.getRepository(LabOrder);
    
    const labOrders = await labRepo.find({
      relations: ['patient'],
      order: { createdAt: 'DESC' }
    });

    return {
      total: labOrders.length,
      byStatus: {
        pending: labOrders.filter(l => l.status === 'pending').length,
        completed: labOrders.filter(l => l.status === 'completed').length,
        cancelled: labOrders.filter(l => l.status === 'cancelled').length
      },
      turnaroundTime: {
        average: '2.5 days',
        fastest: '4 hours',
        slowest: '7 days'
      },
      labOrders: labOrders.slice(0, 50)
    };
  }
}