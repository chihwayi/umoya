import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DietaryService {
  private readonly logger = new Logger(DietaryService.name);

  constructor() {}

  async orderDiet(
    dietData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO diet_orders (patient_id, admission_id, diet_type, food_allergies, 
        tube_feeding, ordered_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [dietData.patientId, dietData.admissionId, dietData.dietType, 
       JSON.stringify(dietData.foodAllergies || []), dietData.tubeFeeding || false, 
       userId, 'active']
    );
    return result[0];
  }

  async getActiveDietOrders(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<any[]> {
    return await tenantDb.query(
      `SELECT * FROM diet_orders WHERE patient_id = $1 AND status = 'active' ORDER BY order_date DESC`,
      [patientId]
    );
  }

  async createNutritionalAssessment(
    assessmentData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const result = await tenantDb.query(
      `INSERT INTO nutritional_assessments (patient_id, admission_id, height_cm, weight_kg, 
        nutritional_risk, dietary_recommendations, assessed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [assessmentData.patientId, assessmentData.admissionId, assessmentData.heightCm,
       assessmentData.weightKg, assessmentData.nutritionalRisk, 
       assessmentData.dietaryRecommendations, userId]
    );
    return result[0];
  }
}




