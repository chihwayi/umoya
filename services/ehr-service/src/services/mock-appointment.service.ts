import { Injectable } from '@nestjs/common';

@Injectable()
export class MockAppointmentService {
  async findAll(query: any) {
    console.log('🔍 MockAppointmentService.findAll called with query:', query);
    console.log('🔍 Query type:', typeof query);
    console.log('🔍 Query keys:', Object.keys(query || {}));
    // Mock appointment data
    const appointments = [
      {
        id: '1',
        patient: {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          patientNumber: 'P001'
        },
        doctor: {
          id: '1',
          firstName: 'Dr. Sarah',
          lastName: 'Johnson'
        },
        appointmentDate: '2025-10-28T09:00:00Z',
        durationMinutes: 30,
        appointmentType: 'consultation',
        status: 'scheduled',
        reason: 'Regular checkup',
        notes: 'Patient feeling well',
        priorityLevel: 'normal',
        isTelehealth: false,
        virtualMeetingUrl: null,
        patientInstructions: 'Please arrive 15 minutes early',
        estimatedCost: 50.00,
        createdBy: '1',
        createdAt: '2025-10-27T10:00:00Z',
        updatedAt: '2025-10-27T10:00:00Z'
      },
      {
        id: '2',
        patient: {
          id: '2',
          firstName: 'Mary',
          lastName: 'Smith',
          patientNumber: 'P002'
        },
        doctor: {
          id: '1',
          firstName: 'Dr. Sarah',
          lastName: 'Johnson'
        },
        appointmentDate: '2025-10-28T10:30:00Z',
        durationMinutes: 45,
        appointmentType: 'follow_up',
        status: 'confirmed',
        reason: 'Follow-up for blood pressure',
        notes: 'Patient needs to monitor blood pressure',
        priorityLevel: 'high',
        isTelehealth: true,
        virtualMeetingUrl: 'https://meet.example.com/room123',
        patientInstructions: 'Take blood pressure reading before appointment',
        estimatedCost: 75.00,
        createdBy: '1',
        createdAt: '2025-10-27T11:00:00Z',
        updatedAt: '2025-10-27T11:00:00Z'
      },
      {
        id: '3',
        patient: {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          patientNumber: 'P001'
        },
        doctor: {
          id: '2',
          firstName: 'Dr. Michael',
          lastName: 'Brown'
        },
        appointmentDate: '2025-10-29T14:00:00Z',
        durationMinutes: 60,
        appointmentType: 'procedure',
        status: 'in_progress',
        reason: 'Minor surgery consultation',
        notes: 'Patient scheduled for minor procedure',
        priorityLevel: 'urgent',
        isTelehealth: false,
        virtualMeetingUrl: null,
        patientInstructions: 'Fast for 8 hours before appointment',
        estimatedCost: 200.00,
        createdBy: '1',
        createdAt: '2025-10-27T12:00:00Z',
        updatedAt: '2025-10-27T12:00:00Z'
      },
      {
        id: '4',
        patient: {
          id: '2',
          firstName: 'Mary',
          lastName: 'Smith',
          patientNumber: 'P002'
        },
        doctor: {
          id: '1',
          firstName: 'Dr. Sarah',
          lastName: 'Johnson'
        },
        appointmentDate: '2025-10-30T11:00:00Z',
        durationMinutes: 30,
        appointmentType: 'consultation',
        status: 'completed',
        reason: 'Annual checkup',
        notes: 'All tests normal, patient in good health',
        priorityLevel: 'normal',
        isTelehealth: false,
        virtualMeetingUrl: null,
        patientInstructions: 'Continue current medication',
        estimatedCost: 50.00,
        createdBy: '1',
        createdAt: '2025-10-26T09:00:00Z',
        updatedAt: '2025-10-26T15:30:00Z'
      },
      {
        id: '5',
        patient: {
          id: '3',
          firstName: 'David',
          lastName: 'Wilson',
          patientNumber: 'P003'
        },
        doctor: {
          id: '2',
          firstName: 'Dr. Michael',
          lastName: 'Brown'
        },
        appointmentDate: '2025-10-31T16:00:00Z',
        durationMinutes: 30,
        appointmentType: 'emergency',
        status: 'cancelled',
        reason: 'Emergency consultation',
        notes: 'Patient cancelled due to family emergency',
        priorityLevel: 'urgent',
        isTelehealth: false,
        virtualMeetingUrl: null,
        patientInstructions: 'Reschedule when available',
        estimatedCost: 100.00,
        createdBy: '1',
        createdAt: '2025-10-27T13:00:00Z',
        updatedAt: '2025-10-27T14:00:00Z'
      },
      {
        id: '6',
        patient: {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          patientNumber: 'P001'
        },
        doctor: {
          id: '1',
          firstName: 'Dr. Sarah',
          lastName: 'Johnson'
        },
        appointmentDate: '2025-10-27T14:00:00Z',
        durationMinutes: 30,
        appointmentType: 'consultation',
        status: 'scheduled',
        reason: 'Follow-up appointment',
        notes: 'Patient needs follow-up care',
        priorityLevel: 'normal',
        isTelehealth: false,
        virtualMeetingUrl: null,
        patientInstructions: 'Please bring previous test results',
        estimatedCost: 50.00,
        createdBy: '1',
        createdAt: '2025-10-27T14:00:00Z',
        updatedAt: '2025-10-27T14:00:00Z'
      }
    ];

    // Apply filters if provided
    let filteredAppointments = appointments;

    if (query.date) {
      const filterDate = new Date(query.date).toISOString().split('T')[0];
      filteredAppointments = filteredAppointments.filter(apt => 
        apt.appointmentDate.startsWith(filterDate)
      );
    }

    if (query.status && query.status !== 'all') {
      filteredAppointments = filteredAppointments.filter(apt => 
        apt.status === query.status
      );
    }

    if (query.doctorId) {
      filteredAppointments = filteredAppointments.filter(apt => 
        apt.doctor.id === query.doctorId
      );
    }

    return {
      appointments: filteredAppointments,
      total: filteredAppointments.length
    };
  }

  async findOne(id: string) {
    const result = await this.findAll({});
    return result.appointments.find(apt => apt.id === id);
  }

  async create(createAppointmentDto: any, userId: string) {
    // Mock creation - just return the created appointment
    const newAppointment = {
      id: Date.now().toString(),
      ...createAppointmentDto,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return newAppointment;
  }

  async update(id: string, updateAppointmentDto: any) {
    // Mock update - just return the updated appointment
    const existing = await this.findOne(id);
    if (!existing) {
      throw new Error('Appointment not found');
    }
    
    return {
      ...existing,
      ...updateAppointmentDto,
      updatedAt: new Date().toISOString()
    };
  }

  async remove(id: string) {
    // Mock removal
    return { message: 'Appointment deleted successfully' };
  }

  async getAvailableSlots(doctorId: string, date: string) {
    // Mock available time slots
    const slots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
    ];
    return slots;
  }
}
