import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientNotificationsService } from './patient-notifications.service';

export interface CreateGoalDto {
  goalType: string;
  goalName: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate: string;
  targetDate: string;
  isAutoTracked?: boolean;
  trackingSource?: string;
  notes?: string;
}

export interface UpdateGoalDto {
  goalName?: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  targetDate?: string;
  status?: string;
  notes?: string;
}

export interface LogProgressDto {
  loggedValue: number;
  loggedDate: string;
  source?: string;
  sourceId?: string;
  notes?: string;
}

@Injectable()
export class HealthGoalsService {
  private readonly logger = new Logger(HealthGoalsService.name);

  constructor(private readonly patientNotificationsService?: PatientNotificationsService) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Create a new health goal for a patient
   */
  async createGoal(tenantDb: DataSource, patientId: string, dto: CreateGoalDto, createdBy?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO patient_health_goals (
        patient_id, goal_type, goal_name, description, target_value, current_value,
        unit, start_date, target_date, is_auto_tracked, tracking_source, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        patientId,
        dto.goalType,
        dto.goalName,
        dto.description || null,
        dto.targetValue || null,
        dto.currentValue || null,
        dto.unit || null,
        dto.startDate,
        dto.targetDate,
        dto.isAutoTracked || false,
        dto.trackingSource || null,
        dto.notes || null,
        createdBy || null,
      ],
    );

    const goal = result[0];
    
    // If current value is provided, calculate initial progress
    if (dto.currentValue !== undefined && dto.targetValue !== undefined) {
      await this.updateProgress(tenantDb, goal.id, patientId);
    }

    return goal;
  }

  /**
   * Get all goals for a patient
   */
  async getPatientGoals(tenantDb: DataSource, patientId: string, status?: string) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM patient_health_goals WHERE patient_id = $1`;
    const params: any[] = [patientId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    return await tenantDb.query(query, params);
  }

  /**
   * Get a single goal by ID
   */
  async getGoalById(tenantDb: DataSource, goalId: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT * FROM patient_health_goals WHERE id = $1`,
      [goalId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Goal not found');
    }

    return result[0];
  }

  /**
   * Update a goal
   */
  async updateGoal(tenantDb: DataSource, goalId: string, dto: UpdateGoalDto) {
    this.ensureTenantDb(tenantDb);

    const goal = await this.getGoalById(tenantDb, goalId);

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.goalName !== undefined) {
      updates.push(`goal_name = $${paramIndex++}`);
      params.push(dto.goalName);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description);
    }
    if (dto.targetValue !== undefined) {
      updates.push(`target_value = $${paramIndex++}`);
      params.push(dto.targetValue);
    }
    if (dto.currentValue !== undefined) {
      updates.push(`current_value = $${paramIndex++}`);
      params.push(dto.currentValue);
    }
    if (dto.targetDate !== undefined) {
      updates.push(`target_date = $${paramIndex++}`);
      params.push(dto.targetDate);
    }
    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(dto.status);
    }
    if (dto.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(dto.notes);
    }

    if (updates.length === 0) {
      return goal;
    }

    updates.push(`updated_at = NOW()`);
    params.push(goalId);

    await tenantDb.query(
      `UPDATE patient_health_goals SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );

    // Recalculate progress if values changed
    if (dto.currentValue !== undefined || dto.targetValue !== undefined) {
      await this.updateProgress(tenantDb, goalId, goal.patient_id);
    }

    return await this.getGoalById(tenantDb, goalId);
  }

  /**
   * Delete a goal
   */
  async deleteGoal(tenantDb: DataSource, goalId: string) {
    this.ensureTenantDb(tenantDb);

    const goal = await this.getGoalById(tenantDb, goalId);
    
    await tenantDb.query(
      `DELETE FROM patient_health_goals WHERE id = $1`,
      [goalId],
    );

    return { message: 'Goal deleted successfully' };
  }

  /**
   * Log progress for a goal
   */
  async logProgress(tenantDb: DataSource, goalId: string, patientId: string, dto: LogProgressDto) {
    this.ensureTenantDb(tenantDb);

    const goal = await this.getGoalById(tenantDb, goalId);

    // Insert or update progress log
    await tenantDb.query(
      `INSERT INTO goal_progress_logs (
        goal_id, patient_id, logged_value, logged_date, source, source_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (goal_id, logged_date) 
      DO UPDATE SET logged_value = EXCLUDED.logged_value, notes = EXCLUDED.notes, updated_at = NOW()`,
      [
        goalId,
        patientId,
        dto.loggedValue,
        dto.loggedDate,
        dto.source || 'manual',
        dto.sourceId || null,
        dto.notes || null,
      ],
    );

    // Update goal's current value
    await tenantDb.query(
      `UPDATE patient_health_goals SET current_value = $1, updated_at = NOW() WHERE id = $2`,
      [dto.loggedValue, goalId],
    );

    // Recalculate progress
    await this.updateProgress(tenantDb, goalId, patientId);

    return await this.getProgressLogs(tenantDb, goalId);
  }

  /**
   * Get progress logs for a goal
   */
  async getProgressLogs(tenantDb: DataSource, goalId: string, limit?: number) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM goal_progress_logs WHERE goal_id = $1 ORDER BY logged_date DESC`;
    const params: any[] = [goalId];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    return await tenantDb.query(query, params);
  }

  /**
   * Update progress percentage for a goal
   */
  private async updateProgress(tenantDb: DataSource, goalId: string, patientId: string) {
    const goal = await this.getGoalById(tenantDb, goalId);

    if (!goal.target_value || !goal.current_value) {
      return;
    }

    let progressPercentage = 0;

    // Calculate progress based on goal type
    if (goal.goal_type === 'weight_loss') {
      // For weight loss: progress = (start - current) / (start - target) * 100
      const startValue = goal.current_value; // This should be the starting weight
      const targetValue = goal.target_value;
      const currentValue = goal.current_value;
      
      if (startValue > targetValue) {
        progressPercentage = ((startValue - currentValue) / (startValue - targetValue)) * 100;
      }
    } else if (goal.goal_type === 'weight_gain') {
      // For weight gain: progress = (current - start) / (target - start) * 100
      const startValue = goal.current_value;
      const targetValue = goal.target_value;
      const currentValue = goal.current_value;
      
      if (targetValue > startValue) {
        progressPercentage = ((currentValue - startValue) / (targetValue - startValue)) * 100;
      }
    } else {
      // For other goals: progress = (current / target) * 100
      progressPercentage = (goal.current_value / goal.target_value) * 100;
    }

    progressPercentage = Math.max(0, Math.min(100, progressPercentage));

    // Check for milestone achievement
    let milestoneAchieved = goal.milestone_achieved;
    let milestoneAchievedAt = goal.milestone_achieved_at;

    if (!milestoneAchieved && progressPercentage >= goal.milestone_percentage) {
      milestoneAchieved = true;
      milestoneAchievedAt = new Date();
      
      // Create achievement
      await this.createAchievement(
        tenantDb,
        patientId,
        'milestone_reached',
        `Reached ${goal.milestone_percentage}% milestone`,
        `You've reached ${goal.milestone_percentage}% progress towards "${goal.goal_name}"!`,
        goalId,
        goal.milestone_percentage,
      );
    }

    // Check if goal is completed
    let status = goal.status;
    if (progressPercentage >= 100 && status === 'active') {
      status = 'completed';
      
      // Create achievement
      await this.createAchievement(
        tenantDb,
        patientId,
        'goal_completed',
        `Goal Completed: ${goal.goal_name}`,
        `Congratulations! You've completed your goal: "${goal.goal_name}"!`,
        goalId,
      );
    }

    await tenantDb.query(
      `UPDATE patient_health_goals 
       SET progress_percentage = $1, milestone_achieved = $2, milestone_achieved_at = $3, status = $4, updated_at = NOW()
       WHERE id = $5`,
      [progressPercentage, milestoneAchieved, milestoneAchievedAt, status, goalId],
    );
  }

  /**
   * Get achievements for a patient
   */
  async getPatientAchievements(tenantDb: DataSource, patientId: string, limit?: number) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM patient_achievements WHERE patient_id = $1 ORDER BY earned_at DESC`;
    const params: any[] = [patientId];

    if (limit) {
      query += ` LIMIT $2`;
      params.push(limit);
    }

    return await tenantDb.query(query, params);
  }

  /**
   * Create an achievement
   */
  private async createAchievement(
    tenantDb: DataSource,
    patientId: string,
    achievementType: string,
    achievementName: string,
    achievementDescription: string,
    goalId?: string,
    milestonePercentage?: number,
    streakDays?: number,
    tenantId?: string,
  ) {
    const badgeConfig = this.getBadgeConfig(achievementType);

    await tenantDb.query(
      `INSERT INTO patient_achievements (
        patient_id, achievement_type, achievement_name, achievement_description,
        badge_icon, badge_color, points, goal_id, milestone_percentage, streak_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        patientId,
        achievementType,
        achievementName,
        achievementDescription,
        badgeConfig.icon,
        badgeConfig.color,
        badgeConfig.points,
        goalId || null,
        milestonePercentage || null,
        streakDays || null,
      ],
    );

    // Send notification if service and tenantId available
    if (this.patientNotificationsService && tenantId) {
      try {
        await this.patientNotificationsService.createNotification(
          patientId,
          'achievement' as any,
          achievementName,
          achievementDescription,
          tenantId,
          {
            actionUrl: `/health-goals/${goalId || ''}`,
            actionLabel: 'View Goal',
            priority: 'normal',
            metadata: { achievementType, goalId },
          },
        );
      } catch (error) {
        this.logger.warn(`Failed to send achievement notification: ${error.message}`);
      }
    }
  }

  /**
   * Get badge configuration for achievement type
   */
  private getBadgeConfig(achievementType: string) {
    const configs: Record<string, { icon: string; color: string; points: number }> = {
      goal_completed: { icon: 'trophy', color: '#FFD700', points: 100 },
      milestone_reached: { icon: 'star', color: '#FF6B6B', points: 50 },
      streak: { icon: 'flame', color: '#FF8C00', points: 25 },
      consistency: { icon: 'check-circle', color: '#4ECDC4', points: 30 },
      improvement: { icon: 'trending-up', color: '#95E1D3', points: 40 },
      engagement: { icon: 'heart', color: '#F38181', points: 20 },
      special: { icon: 'award', color: '#AA96DA', points: 75 },
    };

    return configs[achievementType] || { icon: 'star', color: '#6C757D', points: 10 };
  }

  /**
   * Update or create streak for a patient
   */
  async updateStreak(tenantDb: DataSource, patientId: string, streakType: string) {
    this.ensureTenantDb(tenantDb);

    const today = new Date().toISOString().split('T')[0];
    
    const existing = await tenantDb.query(
      `SELECT * FROM patient_streaks WHERE patient_id = $1 AND streak_type = $2`,
      [patientId, streakType],
    );

    if (existing.length === 0) {
      // Create new streak
      await tenantDb.query(
        `INSERT INTO patient_streaks (
          patient_id, streak_type, current_streak_days, longest_streak_days,
          last_activity_date, streak_start_date, is_active
        ) VALUES ($1, $2, 1, 1, $3, $3, true)`,
        [patientId, streakType, today],
      );
    } else {
      const streak = existing[0];
      const lastDate = streak.last_activity_date ? new Date(streak.last_activity_date).toISOString().split('T')[0] : null;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      let currentStreak = streak.current_streak_days;
      let streakStartDate = streak.streak_start_date || today;

      if (lastDate === today) {
        // Already logged today, no change
        return streak;
      } else if (lastDate === yesterday) {
        // Continue streak
        currentStreak += 1;
      } else {
        // Streak broken, restart
        currentStreak = 1;
        streakStartDate = today;
      }

      const longestStreak = Math.max(currentStreak, streak.longest_streak_days);

      await tenantDb.query(
        `UPDATE patient_streaks 
         SET current_streak_days = $1, longest_streak_days = $2, 
             last_activity_date = $3, streak_start_date = $4, updated_at = NOW()
         WHERE patient_id = $5 AND streak_type = $6`,
        [currentStreak, longestStreak, today, streakStartDate, patientId, streakType],
      );

      // Check for streak achievements
      if (currentStreak === 7) {
        await this.createAchievement(
          tenantDb,
          patientId,
          'streak',
          '7-Day Streak!',
          `You've maintained a ${currentStreak}-day streak!`,
          undefined,
          undefined,
          currentStreak,
        );
      } else if (currentStreak === 30) {
        await this.createAchievement(
          tenantDb,
          patientId,
          'streak',
          '30-Day Streak!',
          `Amazing! You've maintained a ${currentStreak}-day streak!`,
          undefined,
          undefined,
          currentStreak,
        );
      }
    }

    return await tenantDb.query(
      `SELECT * FROM patient_streaks WHERE patient_id = $1 AND streak_type = $2`,
      [patientId, streakType],
    );
  }

  /**
   * Get streaks for a patient
   */
  async getPatientStreaks(tenantDb: DataSource, patientId: string) {
    this.ensureTenantDb(tenantDb);

    return await tenantDb.query(
      `SELECT * FROM patient_streaks WHERE patient_id = $1 AND is_active = true ORDER BY current_streak_days DESC`,
      [patientId],
    );
  }

  /**
   * Auto-update goals from vitals data
   */
  async autoUpdateFromVitals(tenantDb: DataSource, patientId: string, vitalsData: any) {
    this.ensureTenantDb(tenantDb);

    const autoTrackedGoals = await tenantDb.query(
      `SELECT * FROM patient_health_goals 
       WHERE patient_id = $1 AND is_auto_tracked = true AND status = 'active'`,
      [patientId],
    );

    for (const goal of autoTrackedGoals) {
      let value: number | null = null;

      switch (goal.goal_type) {
        case 'weight_loss':
        case 'weight_gain':
          value = vitalsData.weight ? parseFloat(vitalsData.weight) : null;
          break;
        case 'blood_pressure':
          // Extract systolic from "120/80" format
          if (vitalsData.blood_pressure) {
            const bp = vitalsData.blood_pressure.split('/')[0];
            value = parseFloat(bp);
          }
          break;
        case 'blood_glucose':
          value = vitalsData.blood_glucose ? parseFloat(vitalsData.blood_glucose) : null;
          break;
      }

      if (value !== null) {
        await this.logProgress(tenantDb, goal.id, patientId, {
          loggedValue: value,
          loggedDate: new Date().toISOString().split('T')[0],
          source: 'vitals',
          sourceId: vitalsData.id,
        });
      }
    }
  }
}

