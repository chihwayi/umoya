import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';

@Injectable()
export class Dhis2Service {
  private readonly logger = new Logger(Dhis2Service.name);
  private dhis2BaseUrl = process.env.DHIS2_URL || 'https://dhis2.mohcc.gov.zw';
  private dhis2Username = process.env.DHIS2_USERNAME;
  private dhis2Password = process.env.DHIS2_PASSWORD;
  private dhis2ApiVersion = process.env.DHIS2_API_VERSION || '38';
  private useMockMode = process.env.DHIS2_USE_MOCK === 'true' || !this.dhis2Username || !this.dhis2Password;
  
  private dhis2Client: AxiosInstance | null = null;

  constructor() {
    // Initialize DHIS2 client only if credentials are provided
    if (!this.useMockMode) {
      this.dhis2Client = axios.create({
        baseURL: `${this.dhis2BaseUrl}/api/${this.dhis2ApiVersion}`,
        auth: {
          username: this.dhis2Username || '',
          password: this.dhis2Password || '',
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds
      });

      // Add response interceptor for error handling
      this.dhis2Client.interceptors.response.use(
        (response) => response,
        (error) => {
          this.logger.error(`DHIS2 API Error: ${error.message}`, error.response?.data);
          throw error;
        }
      );

      this.logger.log('DHIS2 service initialized with real API integration');
    } else {
      this.logger.warn('DHIS2 service running in MOCK mode (set DHIS2_USERNAME and DHIS2_PASSWORD to enable real API)');
    }
  }

  async syncPatients(tenantDb: DataSource) {
    try {
      const patientRepository = tenantDb.getRepository(Patient);
      const patients = await patientRepository.find({ where: { isActive: true } });

      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 sync running in MOCK mode');
        return {
          status: 'SUCCESS',
          imported: patients.length,
          updated: 0,
          ignored: 0,
          deleted: 0,
          message: `[MOCK] Successfully synced ${patients.length} patients to DHIS2`
        };
      }

      const trackedEntityType = process.env.DHIS2_TRACKED_ENTITY_TYPE || 'MCPQUTHX1Ze';
      const orgUnit = process.env.DHIS2_ORG_UNIT || 'YOUR_ORG_UNIT_ID';

      const importPayload = {
        trackedEntityInstances: patients.map(patient => ({
          trackedEntityType,
          orgUnit,
          attributes: [
            {
              attribute: 'w75KJ2mc4zz', // First name
              value: patient.firstName
            },
            {
              attribute: 'zDhUuAYrxNC', // Last name
              value: patient.lastName
            },
            {
              attribute: 'FO4GPuUTfQU', // Date of birth
              value: patient.dateOfBirth.toISOString().split('T')[0]
            },
            {
              attribute: 'cejWyOfXge6', // Gender
              value: patient.gender.toUpperCase()
            },
            {
              attribute: 'AuPLng5hLbE', // National ID
              value: patient.nationalId || ''
            }
          ]
        }))
      };

      // Real DHIS2 API call
      const response = await this.dhis2Client.post('/trackedEntityInstances', importPayload);

      return {
        status: response.data.status || 'SUCCESS',
        imported: response.data.imported || 0,
        updated: response.data.updated || 0,
        ignored: response.data.ignored || 0,
        deleted: response.data.deleted || 0,
        message: `Successfully synced ${response.data.imported || 0} patients to DHIS2`
      };
    } catch (error: any) {
      this.logger.error('Error syncing patients to DHIS2:', error);
      // Return mock response on error to prevent breaking the application
      return {
        status: 'ERROR',
        imported: 0,
        updated: 0,
        ignored: 0,
        deleted: 0,
        message: `DHIS2 sync failed: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  async sendEvent(eventData: any) {
    try {
      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 sendEvent running in MOCK mode');
        return {
          status: 'SUCCESS',
          reference: `EVENT_${Date.now()}`,
          message: '[MOCK] Event sent to DHIS2 successfully'
        };
      }

      const dhis2Event = {
        program: eventData.program,
        orgUnit: eventData.orgUnit,
        eventDate: eventData.eventDate,
        status: 'COMPLETED',
        trackedEntityInstance: eventData.patientId,
        dataValues: eventData.dataValues
      };

      // Real DHIS2 API call
      const response = await this.dhis2Client.post('/events', dhis2Event);

      return {
        status: 'SUCCESS',
        reference: response.data.response?.importSummaries?.[0]?.reference || `EVENT_${Date.now()}`,
        message: 'Event sent to DHIS2 successfully'
      };
    } catch (error: any) {
      this.logger.error('Error sending event to DHIS2:', error);
      return {
        status: 'ERROR',
        reference: `EVENT_${Date.now()}`,
        message: `DHIS2 event send failed: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  async sendDataValues(dataValues: any) {
    try {
      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 sendDataValues running in MOCK mode');
        return {
          status: 'SUCCESS',
          imported: dataValues.values?.length || 0,
          message: '[MOCK] Data values sent to DHIS2 successfully'
        };
      }

      const dhis2DataValues = {
        dataSet: dataValues.dataSet,
        completeDate: new Date().toISOString(),
        period: dataValues.period,
        orgUnit: dataValues.orgUnit,
        dataValues: dataValues.values
      };

      // Real DHIS2 API call
      const response = await this.dhis2Client.post('/dataValueSets', dhis2DataValues);

      return {
        status: response.data.status || 'SUCCESS',
        imported: response.data.imported || 0,
        updated: response.data.updated || 0,
        ignored: response.data.ignored || 0,
        deleted: response.data.deleted || 0,
        message: 'Data values sent to DHIS2 successfully'
      };
    } catch (error: any) {
      this.logger.error('Error sending data values to DHIS2:', error);
      return {
        status: 'ERROR',
        imported: 0,
        message: `DHIS2 data values send failed: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  async getPrograms() {
    try {
      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 getPrograms running in MOCK mode');
        return {
          programs: [
            {
              id: 'IpHINAT79UW',
              name: 'Child Programme',
              description: 'Child health and immunization program'
            },
            {
              id: 'WSGAb5XwJ3Y',
              name: 'Malaria case management',
              description: 'Malaria diagnosis and treatment program'
            },
            {
              id: 'M3xtLkYBlKI',
              name: 'TB care and treatment',
              description: 'Tuberculosis care and treatment program'
            },
            {
              id: 'uy2gU8kT1jF',
              name: 'HIV Care and Treatment',
              description: 'HIV/AIDS care and treatment program'
            }
          ]
        };
      }

      // Real DHIS2 API call
      const response = await this.dhis2Client.get('/programs', {
        params: {
          fields: 'id,name,description',
          paging: false
        }
      });

      return {
        programs: response.data.programs || []
      };
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 programs:', error);
      // Return cached/default programs on error
      return {
        programs: [
          {
            id: 'uy2gU8kT1jF',
            name: 'HIV Care and Treatment',
            description: 'HIV/AIDS care and treatment program'
          },
          {
            id: 'M3xtLkYBlKI',
            name: 'TB care and treatment',
            description: 'Tuberculosis care and treatment program'
          },
        ],
        error: 'Failed to fetch from DHIS2, using default programs'
      };
    }
  }

  async getDataElements(program?: string) {
    try {
      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 getDataElements running in MOCK mode');
        const mockDataElements = {
          'IpHINAT79UW': [ // Child Programme
            { id: 'UXz7xuGCEhU', name: 'Weight (kg)', valueType: 'NUMBER' },
            { id: 'lZGmxYbs97q', name: 'Height (cm)', valueType: 'NUMBER' },
            { id: 'X8zyunlgUfM', name: 'Vaccination given', valueType: 'BOOLEAN' }
          ],
          'WSGAb5XwJ3Y': [ // Malaria
            { id: 'qrur9Dvnyt5', name: 'Fever', valueType: 'BOOLEAN' },
            { id: 'oZg33kd9taw', name: 'RDT Result', valueType: 'TEXT' },
            { id: 'GieVkTxp4HH', name: 'Treatment given', valueType: 'TEXT' }
          ]
        };
        return {
          dataElements: program ? mockDataElements[program] || [] : Object.values(mockDataElements).flat()
        };
      }

      // Real DHIS2 API call
      if (program) {
        // Get data elements for specific program
        const response = await this.dhis2Client.get(`/programs/${program}`, {
          params: {
            fields: 'programStages[programStageDataElements[dataElement[id,name,valueType]]]'
          }
        });
        
        const dataElements: any[] = [];
        if (response.data.programStages) {
          response.data.programStages.forEach((stage: any) => {
            if (stage.programStageDataElements) {
              stage.programStageDataElements.forEach((psde: any) => {
                if (psde.dataElement) {
                  dataElements.push({
                    id: psde.dataElement.id,
                    name: psde.dataElement.name,
                    valueType: psde.dataElement.valueType
                  });
                }
              });
            }
          });
        }
        
        return { dataElements };
      } else {
        // Get all data elements
        const response = await this.dhis2Client.get('/dataElements', {
          params: {
            fields: 'id,name,valueType',
            paging: false
          }
        });
        
        return {
          dataElements: response.data.dataElements || []
        };
      }
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 data elements:', error);
      return {
        dataElements: [],
        error: error.response?.data || error.message
      };
    }
  }

  async sendAggregateReport(reportData: any, tenantDb: DataSource) {
    try {
      // Generate aggregate data from EHR
      const appointmentRepository = tenantDb.getRepository(AppointmentSimple);
      
      const totalAppointments = await appointmentRepository.count();
      const completedAppointments = await appointmentRepository.count({
        where: { status: 'completed' }
      });

      const aggregateData = {
        dataSet: reportData.dataSet || process.env.DHIS2_DATASET_ID || 'BfMAe6Itzgt',
        period: reportData.period || new Date().toISOString().slice(0, 7).replace('-', ''),
        orgUnit: reportData.orgUnit || process.env.DHIS2_ORG_UNIT || 'YOUR_ORG_UNIT_ID',
        dataValues: [
          {
            dataElement: reportData.dataElements?.totalConsultations || 'FTRrcoaog83',
            value: totalAppointments.toString()
          },
          {
            dataElement: reportData.dataElements?.completedConsultations || 'eY5ehpbEsB7',
            value: completedAppointments.toString()
          }
        ]
      };

      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        this.logger.warn('DHIS2 sendAggregateReport running in MOCK mode');
        return {
          status: 'SUCCESS',
          period: aggregateData.period,
          dataValues: aggregateData.dataValues.length,
          message: '[MOCK] Aggregate report sent to DHIS2 successfully'
        };
      }

      // Real DHIS2 API call
      const response = await this.dhis2Client.post('/dataValueSets', aggregateData);

      return {
        status: response.data.status || 'SUCCESS',
        period: aggregateData.period,
        imported: response.data.imported || 0,
        updated: response.data.updated || 0,
        ignored: response.data.ignored || 0,
        dataValues: aggregateData.dataValues.length,
        message: 'Aggregate report sent to DHIS2 successfully'
      };
    } catch (error: any) {
      this.logger.error('Error sending aggregate report to DHIS2:', error);
      return {
        status: 'ERROR',
        period: reportData.period || 'unknown',
        dataValues: 0,
        message: `DHIS2 aggregate report send failed: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  async getSyncStatus(tenantDb: DataSource) {
    try {
      // Mock mode fallback
      if (this.useMockMode || !this.dhis2Client) {
        return {
          lastSync: null,
          status: 'MOCK_MODE',
          patientsSynced: 0,
          eventsSynced: 0,
          dataValuesSynced: 0,
          errors: 0,
          nextSync: null,
          message: 'DHIS2 running in MOCK mode. Set DHIS2_USERNAME and DHIS2_PASSWORD to enable real API.'
        };
      }

      // Test connection by fetching system info
      const systemInfo = await this.dhis2Client.get('/system/info');
      
      // Get actual sync statistics from database (if tracking table exists)
      // For now, return connection status
      return {
        lastSync: null, // TODO: Track last sync in database
        status: 'CONNECTED',
        dhis2Version: systemInfo.data?.version || 'unknown',
        patientsSynced: 0, // TODO: Track in sync_log table
        eventsSynced: 0,
        dataValuesSynced: 0,
        errors: 0,
        nextSync: null,
        message: 'Connected to DHIS2 successfully'
      };
    } catch (error: any) {
      this.logger.error('Error checking DHIS2 sync status:', error);
      return {
        lastSync: null,
        status: 'ERROR',
        patientsSynced: 0,
        eventsSynced: 0,
        dataValuesSynced: 0,
        errors: 1,
        nextSync: null,
        message: `DHIS2 connection failed: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }
}