import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HivMonthlyReturnService {
  private readonly logger = new Logger(HivMonthlyReturnService.name);

  /**
   * Calculate age category from date of birth
   */
  private getAgeCategory(dateOfBirth: Date | string, asOfDate: Date = new Date()): string {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    const ageInMonths = (asOfDate.getFullYear() - dob.getFullYear()) * 12 + 
                       (asOfDate.getMonth() - dob.getMonth());
    const ageInYears = ageInMonths / 12;

    if (ageInMonths <= 2) return '≤2 months';
    if (ageInMonths <= 12) return '3-12 months';
    if (ageInMonths <= 24) return '13-24 months';
    if (ageInMonths <= 59) return '25-59 months';
    if (ageInYears < 5) return '5-9 years';
    if (ageInYears < 10) return '10-14 years';
    if (ageInYears < 15) return '15-19 years';
    if (ageInYears < 20) return '20-24 years';
    if (ageInYears < 25) return '25-29 years';
    if (ageInYears < 30) return '30-34 years';
    if (ageInYears < 35) return '35-39 years';
    if (ageInYears < 40) return '40-44 years';
    if (ageInYears < 45) return '45-49 years';
    if (ageInYears < 50) return '50-54 years';
    if (ageInYears < 55) return '55-59 years';
    if (ageInYears < 60) return '60-64 years';
    return '65+ years';
  }

  /**
   * Get ART line from regimen code
   */
  private getArtLine(regimenCode: string | null): 'first' | 'second' | 'third' | 'unknown' {
    if (!regimenCode) return 'unknown';
    if (regimenCode.startsWith('1')) return 'first';
    if (regimenCode.startsWith('2')) return 'second';
    if (regimenCode.startsWith('3') || regimenCode.startsWith('4') || regimenCode.startsWith('5') || regimenCode.startsWith('6')) return 'third';
    return 'unknown';
  }

  /**
   * Generate monthly return form data
   */
  async generateMonthlyReturn(year: number, month: number, tenantDb: DataSource) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const ageCategories = [
      '≤2 months', '3-12 months', '13-24 months', '25-59 months',
      '5-9 years', '10-14 years', '15-19 years', '20-24 years',
      '25-29 years', '30-34 years', '35-39 years', '40-44 years',
      '45-49 years', '50-54 years', '55-59 years', '60-64 years', '65+ years'
    ];

    // Initialize result structure
    const result: any = {
      period: { year, month, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] },
      sectionC: {},
      sectionD: {}
    };

    // Get all enrollments with patient data
    const enrollments = await tenantDb.query(`
      SELECT e.*, p.date_of_birth, p.gender, p.first_name, p.last_name
      FROM hiv_care_enrollments e
      JOIN patients p ON e.patient_id = p.id
    `);

    // Get all visits in the month
    const visits = await tenantDb.query(`
      SELECT v.*, e.patient_id, p.date_of_birth, p.gender
      FROM hiv_clinical_visits v
      JOIN hiv_care_enrollments e ON v.enrollment_id = e.id
      JOIN patients p ON e.patient_id = p.id
      WHERE v.visit_date >= $1::date AND v.visit_date <= $2::date
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    // Helper function to initialize age/sex structure
    const initAgeSexStructure = () => {
      const structure: any = {};
      ageCategories.forEach(age => {
        structure[age] = { M: 0, F: 0 };
      });
      structure['Total'] = { M: 0, F: 0 };
      return structure;
    };

    // Helper function to add count
    const addCount = (structure: any, ageCategory: string, gender: string, count: number = 1) => {
      const genderCode = gender?.toLowerCase() === 'male' ? 'M' : 'F';
      if (structure[ageCategory]) {
        structure[ageCategory][genderCode] = (structure[ageCategory][genderCode] || 0) + count;
        structure['Total'][genderCode] = (structure['Total'][genderCode] || 0) + count;
      }
    };

    // SECTION C: HIV/TB Collaboration
    result.sectionC = {
      C1: {
        description: 'Number of PLHIV in care screened for TB during their last visit this month',
        newlyEnrolled: initAgeSexStructure(),
        alreadyInCare: initAgeSexStructure()
      },
      C2: initAgeSexStructure(),
      C3: initAgeSexStructure(),
      C4: initAgeSexStructure(),
      C5: initAgeSexStructure(),
      C6: {
        description: 'Number of PLHIV eligible for TB Preventive Therapy this month',
        newlyEnrolled: initAgeSexStructure(),
        alreadyInCare: initAgeSexStructure()
      },
      C7: {
        description: 'Number of PLHIV initiated on 3HP this month',
        newlyEnrolled: initAgeSexStructure(),
        alreadyInCare: initAgeSexStructure()
      },
      C8: {
        description: 'Number of PLHIV initiated on 6H this month',
        newlyEnrolled: initAgeSexStructure(),
        alreadyInCare: initAgeSexStructure()
      },
      C9: initAgeSexStructure(),
      C10: initAgeSexStructure(),
      C11: {
        description: 'Number of PLHIV who completed TB Preventive Therapy course this month',
        '3HP': initAgeSexStructure(),
        '6H': initAgeSexStructure()
      }
    };

    // Process Section C indicators
    for (const visit of visits) {
      const ageCategory = this.getAgeCategory(visit.date_of_birth, new Date(visit.visit_date));
      const isNewlyEnrolled = visit.visit_number === 1 || visit.visit_number === null;

      // C1: TB Screening
      if (visit.tb_screening && ['Y', 'S', 'ON'].includes(visit.tb_screening)) {
        if (isNewlyEnrolled) {
          addCount(result.sectionC.C1.newlyEnrolled, ageCategory, visit.gender);
        } else {
          addCount(result.sectionC.C1.alreadyInCare, ageCategory, visit.gender);
        }
      }

      // C2: Presumptive TB cases
      if (visit.tb_screening === 'Y' || visit.tb_investigation_result) {
        addCount(result.sectionC.C2, ageCategory, visit.gender);
      }

      // C3: TB investigations
      if (visit.tb_investigation_result && ['1', '2', '3', '4', '5'].includes(visit.tb_investigation_result)) {
        addCount(result.sectionC.C3, ageCategory, visit.gender);
      }

      // C4: TB positive
      if (visit.tb_diagnosed) {
        addCount(result.sectionC.C4, ageCategory, visit.gender);
      }

      // C5: TB treatment started
      if (visit.tb_treatment_started) {
        addCount(result.sectionC.C5, ageCategory, visit.gender);
      }

      // C6: TPT eligibility
      if (visit.ipt_eligibility === 'Y') {
        if (isNewlyEnrolled) {
          addCount(result.sectionC.C6.newlyEnrolled, ageCategory, visit.gender);
        } else {
          addCount(result.sectionC.C6.alreadyInCare, ageCategory, visit.gender);
        }
      }

      // C7: Initiated on 3HP
      if (visit.tpt_status === 'II' || visit.tpt_status === 'CI') {
        // Check if it's 3HP (usually indicated by regimen code or status)
        const is3HP = visit.tpt_status === 'II' || visit.tpt_status === 'CI';
        if (is3HP) {
          if (isNewlyEnrolled) {
            addCount(result.sectionC.C7.newlyEnrolled, ageCategory, visit.gender);
          } else {
            addCount(result.sectionC.C7.alreadyInCare, ageCategory, visit.gender);
          }
        }
      }

      // C8: Initiated on 6H
      if (visit.tpt_status === 'II' || visit.tpt_status === 'CI') {
        // Differentiate 3HP vs 6H - for now assume based on status
        // C7 and C8 might need additional field to differentiate
        // This is a simplification - you may need to add a field to distinguish 3HP vs 6H
      }

      // C9: TPT adverse events
      if (visit.adverse_events_status && visit.adverse_events_status.length > 0 && 
          (visit.tpt_status === 'II' || visit.tpt_status === 'CI' || visit.tpt_status === 'RI')) {
        addCount(result.sectionC.C9, ageCategory, visit.gender);
      }

      // C10: Stopped TPT due to adverse events
      if (visit.tpt_status === 'IS' && visit.tpt_not_started_stopped_reason && 
          visit.adverse_events_status && visit.adverse_events_status.length > 0) {
        addCount(result.sectionC.C10, ageCategory, visit.gender);
      }

      // C11: Completed TPT (will be calculated from regimen history or completion status)
    }

    // SECTION D: ART Summary
    // Initialize all D indicators
    const initDIndicator = () => initAgeSexStructure();
    
    result.sectionD = {
      // D1-D12: Enrollment and Pre-ART
      D1: initDIndicator(), // Newly diagnosed registered
      D2: initDIndicator(), // WHO Stage 1
      D3: initDIndicator(), // WHO Stage 2
      D4: initDIndicator(), // WHO Stage 3
      D5: initDIndicator(), // WHO Stage 4
      D6: initDIndicator(), // Currently on CTX
      D7: initDIndicator(), // Started CTX
      D8: initDIndicator(), // CTX adverse events
      D9: initDIndicator(), // Transferred out before ART
      D10: initDIndicator(), // Transferred in before ART
      D11: initDIndicator(), // Currently on Pre-ART
      D12: {
        description: 'PLHIV in Newly ART initiations',
        testedForCD4: initDIndicator(),
        treatmentFailure: initDIndicator(),
        returningAfter3Months: initDIndicator()
      },
      // D13-D20: CD4 categories and Cryptococcal
      D13: {
        description: 'PLHIV with CD4 <200',
        newlyARTInitiations: initDIndicator(),
        treatmentFailure: initDIndicator(),
        returningAfter3Months: initDIndicator()
      },
      D14: {
        description: 'PLHIV with CD4 200-350',
        newlyARTInitiations: initDIndicator(),
        treatmentFailure: initDIndicator(),
        returningAfter3Months: initDIndicator()
      },
      D15: {
        description: 'PLHIV with CD4 >350',
        newlyARTInitiations: initDIndicator(),
        treatmentFailure: initDIndicator(),
        returningAfter3Months: initDIndicator()
      },
      D16: initDIndicator(), // Screened for Cryptococcal
      D17: {
        description: 'PLHIV presumptive for CM investigated',
        positive: initDIndicator(),
        negative: initDIndicator()
      },
      D18: initDIndicator(), // Pre-emptive fluconazole
      D19: initDIndicator(), // Treatment for CM
      D20: initDIndicator(), // CM adverse events
      // D21-D26: Laboratory Services
      D21: {
        description: 'VL sample collected',
        new: initDIndicator(),
        repeats: initDIndicator()
      },
      D22: {
        description: 'VL results received',
        '>1000': initDIndicator(),
        'undetectable': initDIndicator(),
        '≤1000': initDIndicator()
      },
      D23: {
        description: 'Started EAC',
        '>1000': initDIndicator(),
        '≤1000': initDIndicator()
      },
      D24: initDIndicator(), // Completed EAC
      D25: initDIndicator(), // Second VL test done
      D26: {
        description: 'Second VL results',
        '>1000_first': initDIndicator(),
        '>1000_second': initDIndicator(),
        '>1000_third': initDIndicator(),
        'undetectable': initDIndicator(),
        '≤1000': initDIndicator()
      },
      // D27-D31: Drug Resistance
      D27: initDIndicator(), // First to Second line switch
      D28: initDIndicator(), // Sample collected for DR
      D29: initDIndicator(), // DR results received
      D30: initDIndicator(), // Resistant to Second line
      D31: initDIndicator(), // Second to Third line switch
      // D32-D35: First Line ART
      D32: initDIndicator(), // Newly initiated on First line
      D33: {
        description: 'Reinitiated on First line after LTFU',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D34: {
        description: 'Reinitiated on First line after stopping',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D35: initDIndicator(), // Transferred in from private/diaspora
      // D36-D40: First Line Outcomes
      D36: initDIndicator(), // Died on First line
      D37: initDIndicator(), // LTFU on First line
      D38: initDIndicator(), // Transferred out on First line
      D39: initDIndicator(), // Transferred in on First line
      D40: initDIndicator(), // Adverse events on First line
      // D41-D43: First Line Status
      D41: initDIndicator(), // Stopped First line
      D42: initDIndicator(), // Substituted First line due to toxicity
      D43: initDIndicator(), // Currently on First line
      // D44-D48: Second Line Reinitiation and Outcomes
      D44: {
        description: 'Reinitiated on Second line after stopping',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D45: {
        description: 'Reinitiated on Second line after LTFU',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D46: initDIndicator(), // Died on Second line
      D47: initDIndicator(), // LTFU on Second line
      D48: initDIndicator(), // Transferred out on Second line
      // D49-D53: Second Line Status
      D49: initDIndicator(), // Transferred in on Second line
      D50: initDIndicator(), // Adverse events on Second line
      D51: initDIndicator(), // Stopped Second line
      D52: initDIndicator(), // Substituted Second line due to toxicity
      D53: initDIndicator(), // Currently on Second line
      // D54-D57: Third Line Reinitiation and Outcomes
      D54: {
        description: 'Reinitiated on Third line after stopping',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D55: {
        description: 'Reinitiated on Third line after LTFU',
        '<3months': initDIndicator(),
        '3-5months': initDIndicator(),
        '≥6months': initDIndicator()
      },
      D56: initDIndicator(), // Died on Third line
      D57: initDIndicator(), // LTFU on Third line
      // D58-D63: Third Line Status
      D58: initDIndicator(), // Transferred out on Third line
      D59: initDIndicator(), // Transferred in on Third line
      D60: initDIndicator(), // Adverse events on Third line
      D61: initDIndicator(), // Stopped Third line
      D62: initDIndicator(), // Substituted Third line due to toxicity
      D63: initDIndicator(), // Currently on Third line
      D64: initDIndicator() // Total on ART (D43 + D53 + D63)
    };

    // Process Section D indicators
    // Get all enrollments and their current status
    const allEnrollments = await tenantDb.query(`
      SELECT 
        e.*, 
        p.date_of_birth, 
        p.gender,
        (SELECT visit_date FROM hiv_clinical_visits WHERE enrollment_id = e.id ORDER BY visit_date DESC LIMIT 1) as last_visit_date,
        (SELECT arv_status FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_status IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_arv_status,
        (SELECT arv_regimen_code FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_regimen_code IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_regimen_code,
        (SELECT who_clinical_stage FROM hiv_clinical_visits WHERE enrollment_id = e.id AND who_clinical_stage IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_who_stage,
        (SELECT cd4_count FROM hiv_clinical_visits WHERE enrollment_id = e.id AND cd4_count IS NOT NULL ORDER BY cd4_test_date DESC LIMIT 1) as latest_cd4,
        (SELECT viral_load FROM hiv_clinical_visits WHERE enrollment_id = e.id AND viral_load IS NOT NULL ORDER BY viral_load_test_date DESC LIMIT 1) as latest_vl
      FROM hiv_care_enrollments e
      JOIN patients p ON e.patient_id = p.id
    `);

    // Process enrollments for D indicators
    for (const enrollment of allEnrollments) {
      const ageCategory = this.getAgeCategory(enrollment.date_of_birth, endDate);
      const artLine = this.getArtLine(enrollment.current_regimen_code);

      // D1: Newly diagnosed registered this month
      if (enrollment.enrollment_date >= startDate && enrollment.enrollment_date <= endDate) {
        addCount(result.sectionD.D1, ageCategory, enrollment.gender);
        
        // D2-D5: WHO Stage at registration
        if (enrollment.baseline_who_stage === '1' || enrollment.baseline_clinical_stage === 'stage1') {
          addCount(result.sectionD.D2, ageCategory, enrollment.gender);
        } else if (enrollment.baseline_who_stage === '2' || enrollment.baseline_clinical_stage === 'stage2') {
          addCount(result.sectionD.D3, ageCategory, enrollment.gender);
        } else if (enrollment.baseline_who_stage === '3' || enrollment.baseline_clinical_stage === 'stage3') {
          addCount(result.sectionD.D4, ageCategory, enrollment.gender);
        } else if (enrollment.baseline_who_stage === '4' || enrollment.baseline_clinical_stage === 'stage4') {
          addCount(result.sectionD.D5, ageCategory, enrollment.gender);
        }
      }

      // D43, D53, D63: Currently on First/Second/Third line ART
      if (enrollment.current_arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.current_arv_status)) {
        if (artLine === 'first') {
          addCount(result.sectionD.D43, ageCategory, enrollment.gender);
        } else if (artLine === 'second') {
          addCount(result.sectionD.D53, ageCategory, enrollment.gender);
        } else if (artLine === 'third') {
          addCount(result.sectionD.D63, ageCategory, enrollment.gender);
        }
      }

      // D64: Total on ART (sum of D43, D53, D63)
      if (enrollment.current_arv_status && ['2a', '2b', '3', '4', '6'].includes(enrollment.current_arv_status)) {
        addCount(result.sectionD.D64, ageCategory, enrollment.gender);
      }
    }

    // Process visits for D indicators
    for (const visit of visits) {
      const ageCategory = this.getAgeCategory(visit.date_of_birth, new Date(visit.visit_date));
      const artLine = this.getArtLine(visit.arv_regimen_code);

      // D6: Currently on CTX
      if (visit.cotrimoxazole_quantity_dispensed && visit.cotrimoxazole_quantity_dispensed > 0) {
        addCount(result.sectionD.D6, ageCategory, visit.gender);
      }

      // D7: Started CTX this month
      if (visit.cotrimoxazole_quantity_dispensed && visit.cotrimoxazole_quantity_dispensed > 0) {
        // Check if this is first time on CTX (simplified - would need to check previous visits)
        addCount(result.sectionD.D7, ageCategory, visit.gender);
      }

      // D21: VL sample collected
      if (visit.viral_load_sample_collected_date) {
        const isNewVL = !visit.viral_load || visit.viral_load_sample_collected_date >= startDate;
        if (isNewVL) {
          addCount(result.sectionD.D21.new, ageCategory, visit.gender);
        } else {
          addCount(result.sectionD.D21.repeats, ageCategory, visit.gender);
        }
      }

      // D22: VL results received
      if (visit.viral_load && visit.viral_load_test_date) {
        if (visit.viral_load > 1000) {
          addCount(result.sectionD.D22['>1000'], ageCategory, visit.gender);
        } else if (visit.viral_load < 50 || visit.viral_load === 0) {
          addCount(result.sectionD.D22.undetectable, ageCategory, visit.gender);
        } else {
          addCount(result.sectionD.D22['≤1000'], ageCategory, visit.gender);
        }
      }

      // D23: Started EAC
      if (visit.viral_load && visit.viral_load > 1000) {
        // Check if EAC was started (would need EAC session tracking)
        addCount(result.sectionD.D23['>1000'], ageCategory, visit.gender);
      }

      // D32: Newly initiated on First line
      if (visit.arv_status === '2a' && artLine === 'first') {
        addCount(result.sectionD.D32, ageCategory, visit.gender);
      }

      // D36-D40: First line outcomes
      if (artLine === 'first') {
        if (visit.follow_up_status === 'D') {
          addCount(result.sectionD.D36, ageCategory, visit.gender);
        }
        if (visit.follow_up_status === 'LTFU') {
          addCount(result.sectionD.D37, ageCategory, visit.gender);
        }
        if (visit.follow_up_status === 'TO') {
          addCount(result.sectionD.D38, ageCategory, visit.gender);
        }
        if (visit.adverse_events_status && visit.adverse_events_status.length > 0) {
          addCount(result.sectionD.D40, ageCategory, visit.gender);
        }
      }

      // D41: Stopped First line
      if (artLine === 'first' && visit.arv_status === '5') {
        addCount(result.sectionD.D41, ageCategory, visit.gender);
      }

      // D42: Substituted First line due to toxicity
      if (artLine === 'first' && visit.arv_status === '4' && 
          visit.arv_change_stop_reason_code && visit.adverse_events_status && visit.adverse_events_status.length > 0) {
        addCount(result.sectionD.D42, ageCategory, visit.gender);
      }
    }

    // Calculate D64 totals
    const calculateTotals = (indicator: any) => {
      if (indicator && typeof indicator === 'object' && !indicator.Total) {
        // For nested structures, calculate recursively
        Object.keys(indicator).forEach(key => {
          if (key !== 'description' && typeof indicator[key] === 'object') {
            calculateTotals(indicator[key]);
          }
        });
      } else if (indicator && indicator.Total) {
        // Calculate totals for flat structure
        ageCategories.forEach(age => {
          if (indicator[age]) {
            indicator['Total'].M = (indicator['Total'].M || 0) + (indicator[age].M || 0);
            indicator['Total'].F = (indicator['Total'].F || 0) + (indicator[age].F || 0);
          }
        });
      }
    };

    // Calculate all totals
    Object.keys(result.sectionD).forEach(key => {
      calculateTotals(result.sectionD[key]);
    });

    Object.keys(result.sectionC).forEach(key => {
      calculateTotals(result.sectionC[key]);
    });

    return result;
  }
}

