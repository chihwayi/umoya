/**
 * WHO Smart Guidelines Service
 * 
 * Integrates WHO Smart Guidelines (FHIR-based) into the EHR system.
 * Parses FHIR PlanDefinition, Questionnaire, and Library resources.
 * 
 * Contact WHO: SMART_DAKS@who.int to get FHIR resources
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// FHIRPath evaluator (optional - falls back to simple matching if not available)
let fhirpath: any = null;
try {
  fhirpath = require('fhirpath');
} catch (e) {
  // FHIRPath not available - will use simple matching
}

// FHIR R4 Types (simplified - in production, use @types/fhir or fhir/r4)
interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
}

interface PlanDefinition extends FHIRResource {
  resourceType: 'PlanDefinition';
  title?: string;
  description?: string;
  status: 'draft' | 'active' | 'retired' | 'unknown';
  action?: PlanDefinitionAction[];
  relatedArtifact?: RelatedArtifact[];
}

interface PlanDefinitionAction {
  id?: string;
  title?: string;
  description?: string;
  textEquivalent?: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: CodeableConcept[];
  condition?: PlanDefinitionCondition[];
  relatedAction?: {
    actionId: string;
    relationship: 'before-start' | 'before' | 'before-end' | 'concurrent-with-start' | 'concurrent' | 'concurrent-with-end' | 'after-start' | 'after' | 'after-end';
  }[];
}

interface PlanDefinitionCondition {
  kind: 'applicability' | 'start' | 'stop';
  expression?: {
    language: string;
    expression: string;
  };
}

interface Questionnaire extends FHIRResource {
  resourceType: 'Questionnaire';
  title?: string;
  description?: string;
  status: 'draft' | 'active' | 'retired' | 'unknown';
  item?: QuestionnaireItem[];
}

interface QuestionnaireItem {
  linkId: string;
  text?: string;
  type: 'group' | 'display' | 'question' | 'boolean' | 'decimal' | 'integer' | 'date' | 'dateTime' | 'time' | 'string' | 'text' | 'url' | 'choice' | 'open-choice' | 'attachment' | 'reference' | 'quantity';
  required?: boolean;
  repeats?: boolean;
  answerOption?: {
    valueCoding?: CodeableConcept;
    valueString?: string;
    valueInteger?: number;
  }[];
  item?: QuestionnaireItem[]; // Nested items
  enableWhen?: {
    question: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'exists';
    answerBoolean?: boolean;
    answerCoding?: CodeableConcept;
    answerString?: string;
  }[];
}

interface CodeableConcept {
  coding?: {
    system?: string;
    code?: string;
    display?: string;
  }[];
  text?: string;
}

interface RelatedArtifact {
  type: 'documentation' | 'justification' | 'citation' | 'predecessor' | 'successor' | 'derived-from' | 'depends-on' | 'composed-of';
  display?: string;
  url?: string;
}

interface GuidelineRecommendation {
  id: string;
  title: string;
  description: string;
  priority: string;
  conditions?: string[];
  actions?: string[];
  source: 'who_smart_guidelines';
  fhirResourceId?: string;
}

interface SmartForm {
  id: string;
  title: string;
  description?: string;
  items: FormItem[];
  source: 'who_smart_guidelines';
  fhirResourceId?: string;
}

interface FormItem {
  linkId: string;
  text: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  items?: FormItem[];
  enableWhen?: {
    question: string;
    operator: string;
    value: any;
  }[];
}

@Injectable()
export class WhoSmartGuidelinesService {
  private readonly logger = new Logger(WhoSmartGuidelinesService.name);
  
  // In-memory cache for loaded guidelines
  private planDefinitions: Map<string, PlanDefinition> = new Map();
  private questionnaires: Map<string, Questionnaire> = new Map();
  
  // Guidelines directory (where WHO FHIR resources are stored)
  private readonly guidelinesDir = path.join(process.cwd(), 'who-smart-guidelines');
  
  constructor() {
    // Ensure guidelines directory exists
    if (!fs.existsSync(this.guidelinesDir)) {
      fs.mkdirSync(this.guidelinesDir, { recursive: true });
      this.logger.log(`Created WHO Smart Guidelines directory: ${this.guidelinesDir}`);
      this.logger.warn('WHO Smart Guidelines directory is empty. Contact SMART_DAKS@who.int to get FHIR resources.');
    }
    
    // Load guidelines on startup (if available) - fire and forget
    this.loadGuidelines().catch(err => {
      this.logger.error(`Failed to load WHO Smart Guidelines: ${err.message}`);
    });
  }
  
  /**
   * Load WHO Smart Guidelines FHIR resources from filesystem
   */
  async loadGuidelines(): Promise<void> {
    try {
      if (!fs.existsSync(this.guidelinesDir)) {
        this.logger.warn(`WHO Smart Guidelines directory not found: ${this.guidelinesDir}`);
        return;
      }
      
      const files = fs.readdirSync(this.guidelinesDir);
      let loadedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.guidelinesDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const resource = JSON.parse(content) as FHIRResource;
          
          if (resource.resourceType === 'PlanDefinition') {
            const planDef = resource as PlanDefinition;
            const id = planDef.id || file.replace('.json', '');
            this.planDefinitions.set(id, planDef);
            this.logger.log(`Loaded PlanDefinition: ${id} - ${planDef.title || 'Untitled'}`);
            loadedCount++;
          } else if (resource.resourceType === 'Questionnaire') {
            const questionnaire = resource as Questionnaire;
            const id = questionnaire.id || file.replace('.json', '');
            this.questionnaires.set(id, questionnaire);
            this.logger.log(`Loaded Questionnaire: ${id} - ${questionnaire.title || 'Untitled'}`);
            loadedCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to load ${file}: ${error.message}`);
        }
      }
      
      if (loadedCount > 0) {
        this.logger.log(`✅ Loaded ${loadedCount} WHO Smart Guidelines resources`);
      } else {
        this.logger.warn('No WHO Smart Guidelines found. Place FHIR resources in: ' + this.guidelinesDir);
        this.logger.warn('Contact SMART_DAKS@who.int to get FHIR resources');
      }
    } catch (error) {
      this.logger.error(`Error loading WHO Smart Guidelines: ${error.message}`);
    }
  }
  
  /**
   * Get recommendations from WHO Smart Guidelines for a condition
   */
  async getRecommendations(
    condition: string,
    patientData?: {
      age?: number;
      gender?: string;
      vitals?: Record<string, any>;
      labs?: Record<string, any>;
      conditions?: string[];
      medications?: string[];
    }
  ): Promise<GuidelineRecommendation[] | null> {
    // Normalize condition name
    const normalizedCondition = this.normalizeCondition(condition);
    
    // Find matching PlanDefinition
    let planDef: PlanDefinition | undefined;
    
    // Try exact match first
    planDef = this.planDefinitions.get(normalizedCondition);
    
    // Try partial match
    if (!planDef) {
      for (const [id, pd] of this.planDefinitions.entries()) {
        if (id.toLowerCase().includes(normalizedCondition) || 
            normalizedCondition.includes(id.toLowerCase()) ||
            pd.title?.toLowerCase().includes(normalizedCondition)) {
          planDef = pd;
          break;
        }
      }
    }
    
    if (!planDef) {
      this.logger.debug(`No WHO Smart Guidelines found for condition: ${condition}`);
      return null;
    }
    
    // Extract recommendations from PlanDefinition
    const recommendations: GuidelineRecommendation[] = [];
    
    if (planDef.action) {
      for (const action of planDef.action) {
        // Check if action is applicable based on conditions
        if (this.isActionApplicable(action, patientData)) {
          recommendations.push({
            id: action.id || `action-${recommendations.length}`,
            title: action.title || 'Recommendation',
            description: action.description || action.textEquivalent || '',
            priority: action.priority || 'routine',
            conditions: action.condition?.map(c => c.expression?.expression || '').filter(Boolean),
            actions: action.code?.map(c => c.text || c.coding?.[0]?.display || '').filter(Boolean),
            source: 'who_smart_guidelines',
            fhirResourceId: planDef.id
          });
        }
      }
    }
    
    return recommendations.length > 0 ? recommendations : null;
  }
  
  /**
   * Get Smart Form (Questionnaire) by ID
   */
  async getSmartForm(formId: string): Promise<SmartForm | null> {
    const questionnaire = this.questionnaires.get(formId);
    
    if (!questionnaire) {
      this.logger.debug(`No WHO Smart Form found for ID: ${formId}`);
      return null;
    }
    
    return this.convertQuestionnaireToForm(questionnaire);
  }
  
  /**
   * List available Smart Forms
   */
  async listSmartForms(): Promise<Array<{ id: string; title: string; description?: string }>> {
    const forms: Array<{ id: string; title: string; description?: string }> = [];
    
    for (const [id, questionnaire] of this.questionnaires.entries()) {
      forms.push({
        id,
        title: questionnaire.title || 'Untitled Form',
        description: questionnaire.description
      });
    }
    
    return forms;
  }
  
  /**
   * List available guidelines
   */
  async listGuidelines(): Promise<Array<{ id: string; title: string; description?: string }>> {
    const guidelines: Array<{ id: string; title: string; description?: string }> = [];
    
    for (const [id, planDef] of this.planDefinitions.entries()) {
      guidelines.push({
        id,
        title: planDef.title || 'Untitled Guideline',
        description: planDef.description
      });
    }
    
    return guidelines;
  }
  
  /**
   * Convert FHIR Questionnaire to Smart Form structure
   */
  private convertQuestionnaireToForm(questionnaire: Questionnaire): SmartForm {
    return {
      id: questionnaire.id || 'unknown',
      title: questionnaire.title || 'Untitled Form',
      description: questionnaire.description,
      items: questionnaire.item?.map(item => this.convertQuestionnaireItem(item)) || [],
      source: 'who_smart_guidelines',
      fhirResourceId: questionnaire.id
    };
  }
  
  /**
   * Convert FHIR QuestionnaireItem to FormItem
   */
  private convertQuestionnaireItem(item: QuestionnaireItem): FormItem {
    const formItem: FormItem = {
      linkId: item.linkId,
      text: item.text || '',
      type: item.type,
      required: item.required,
      items: item.item?.map(subItem => this.convertQuestionnaireItem(subItem))
    };
    
    // Convert answer options
    if (item.answerOption) {
      formItem.options = item.answerOption.map(option => ({
        value: option.valueCoding?.code || option.valueString || String(option.valueInteger || ''),
        label: option.valueCoding?.display || option.valueString || String(option.valueInteger || '')
      }));
    }
    
    // Convert enableWhen conditions
    if (item.enableWhen) {
      formItem.enableWhen = item.enableWhen.map(condition => ({
        question: condition.question,
        operator: condition.operator,
        value: condition.answerBoolean ?? condition.answerCoding ?? condition.answerString
      }));
    }
    
    return formItem;
  }
  
  /**
   * Check if a PlanDefinition action is applicable to patient
   * Uses FHIRPath evaluator if available, falls back to simple matching
   */
  private isActionApplicable(
    action: PlanDefinitionAction,
    patientData?: {
      age?: number;
      gender?: string;
      vitals?: Record<string, any>;
      labs?: Record<string, any>;
      conditions?: string[];
      medications?: string[];
    }
  ): boolean {
    // If no conditions, action is always applicable
    if (!action.condition || action.condition.length === 0) {
      return true;
    }
    
    // Check applicability conditions
    for (const condition of action.condition) {
      if (condition.kind === 'applicability') {
        if (condition.expression?.expression) {
          // Try FHIRPath evaluation if available
          if (fhirpath && condition.expression.language === 'text/fhirpath') {
            try {
              // Create a FHIR Patient resource-like object for evaluation
              const patientResource = {
                resourceType: 'Patient',
                gender: patientData?.gender,
                birthDate: patientData?.age
                  ? new Date(new Date().getFullYear() - (patientData.age || 0), 0, 1)
                      .toISOString()
                      .split('T')[0]
                  : undefined,
                extension: [
                  ...(patientData?.vitals
                    ? Object.entries(patientData.vitals).map(([key, value]) => ({
                        url: `http://example.org/vitals/${key}`,
                        valueString: String(value),
                      }))
                    : []),
                  ...(patientData?.labs
                    ? Object.entries(patientData.labs).map(([key, value]) => ({
                        url: `http://example.org/labs/${key}`,
                        valueString: String(value),
                      }))
                    : []),
                ],
              };

              // Evaluate FHIRPath expression
              const result = fhirpath.evaluate(
                patientResource,
                condition.expression.expression
              );
              
              // If result is falsy, condition not met
              if (!result || (Array.isArray(result) && result.length === 0)) {
                return false;
              }
              
              // If result is boolean, return it
              if (typeof result === 'boolean') {
                return result;
              }
              
              // If result is array with boolean, return first boolean
              if (Array.isArray(result) && result.length > 0) {
                const firstResult = result[0];
                if (typeof firstResult === 'boolean') {
                  return firstResult;
                }
              }
              
              // Default: if we got a result, assume applicable
              return true;
            } catch (error) {
              this.logger.warn(
                `FHIRPath evaluation failed: ${error.message}. Using fallback.`
              );
              // Fall through to simple matching
            }
          }
          
          // Simple pattern matching fallback
          // Check for common patterns in expressions
          const expression = condition.expression.expression.toLowerCase();
          
          // Age-based conditions
          if (patientData?.age !== undefined) {
            if (expression.includes('age') || expression.includes('birthdate')) {
              // Simple age checks
              if (expression.includes('>') && expression.includes('65')) {
                if (patientData.age <= 65) return false;
              }
              if (expression.includes('<') && expression.includes('18')) {
                if (patientData.age >= 18) return false;
              }
            }
          }
          
          // Gender-based conditions
          if (patientData?.gender && expression.includes('gender')) {
            const genderLower = patientData.gender.toLowerCase();
            if (expression.includes('female') && !['female', 'f'].includes(genderLower)) {
              return false;
            }
            if (expression.includes('male') && !['male', 'm'].includes(genderLower)) {
              return false;
            }
          }
          
          // Default: if expression exists, assume applicable (conservative approach)
          return true;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Normalize condition name for matching
   */
  private normalizeCondition(condition: string): string {
    return condition
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
  }
  
  /**
   * Reload guidelines from filesystem
   */
  async reloadGuidelines(): Promise<void> {
    this.planDefinitions.clear();
    this.questionnaires.clear();
    await this.loadGuidelines();
  }
}
