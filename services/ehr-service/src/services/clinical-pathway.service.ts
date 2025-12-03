import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClinicalPathway } from '../entities/clinical-pathway.entity';

@Injectable()
export class ClinicalPathwayService {
  private readonly logger = new Logger(ClinicalPathwayService.name);

  async getPathways(
    filters: {
      condition?: string;
      specialty?: string;
      isActive?: boolean;
    },
    tenantDb: DataSource,
  ): Promise<ClinicalPathway[]> {
    const repository = tenantDb.getRepository(ClinicalPathway);
    const queryBuilder = repository.createQueryBuilder('pathway');

    if (filters.condition) {
      queryBuilder.andWhere('pathway.condition ILIKE :condition', {
        condition: `%${filters.condition}%`,
      });
    }

    if (filters.specialty) {
      queryBuilder.andWhere('pathway.specialty = :specialty', {
        specialty: filters.specialty,
      });
    }

    if (filters.isActive !== undefined) {
      queryBuilder.andWhere('pathway.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    queryBuilder.orderBy('pathway.pathwayName', 'ASC');

    return await queryBuilder.getMany();
  }

  async getPathwayById(id: string, tenantDb: DataSource): Promise<ClinicalPathway> {
    const repository = tenantDb.getRepository(ClinicalPathway);
    const pathway = await repository.findOne({ where: { id } });

    if (!pathway) {
      throw new NotFoundException(`Clinical pathway not found: ${id}`);
    }

    return pathway;
  }

  async enrollPatient(
    pathwayId: string,
    patientId: string,
    admissionId: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const pathway = await this.getPathwayById(pathwayId, tenantDb);

    // Generate enrollment number
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM pathway_enrollments WHERE enrollment_number LIKE 'PATH-%'`,
    );
    const count = parseInt(result.count) + 1;
    const enrollmentNumber = `PATH-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;

    // Create enrollment
    const [enrollment] = await tenantDb.query(
      `
      INSERT INTO pathway_enrollments (
        enrollment_number, patient_id, pathway_id, admission_id,
        enrolled_date, enrolled_by, start_date, enrollment_status,
        primary_provider, current_step
      ) VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), 'active', $5, 1)
      RETURNING *
    `,
      [enrollmentNumber, patientId, pathwayId, admissionId, userId],
    );

    this.logger.log(`Patient enrolled in pathway: ${pathway.pathwayName}`);

    return enrollment;
  }

  async getPatientEnrollments(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<any[]> {
    const enrollments = await tenantDb.query(
      `
      SELECT e.*, p.pathway_name, p.condition, p.specialty
      FROM pathway_enrollments e
      JOIN clinical_pathways p ON p.id = e.pathway_id
      WHERE e.patient_id = $1
      ORDER BY e.enrolled_date DESC
    `,
      [patientId],
    );

    return enrollments;
  }

  async trackAdherence(
    enrollmentId: string,
    stepId: string,
    completed: boolean,
    userId: string,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      UPDATE pathway_adherence
      SET status = $1, completed_date = NOW(), completed_by = $2, on_time = true
      WHERE enrollment_id = $3 AND step_id = $4
    `,
      [completed ? 'completed' : 'skipped', userId, enrollmentId, stepId],
    );

    this.logger.log(`Pathway adherence tracked for enrollment: ${enrollmentId}`);
  }
}

