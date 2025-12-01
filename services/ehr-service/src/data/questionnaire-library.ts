/**
 * Comprehensive Questionnaire Library
 * 
 * This file contains digitized versions of free, publicly available questionnaires
 * from sources like PHQ Screeners, NIH PROMIS, and other public domain tools.
 * 
 * All questionnaires here are verified to be free for clinical use.
 * See docs/questionnaire-sources.md for licensing details.
 */

import { QuestionnaireTemplate } from '../services/patient-pro.service';

export const QUESTIONNAIRE_LIBRARY: QuestionnaireTemplate[] = [
  // ============================================
  // MENTAL HEALTH QUESTIONNAIRES (PHQ Series)
  // ============================================
  
  // PHQ-2: Ultra-brief depression screening (2 items)
  {
    code: 'PHQ2',
    name: 'Patient Health Questionnaire-2 (PHQ-2)',
    description: 'Ultra-brief 2-item depression screening tool',
    category: 'mental_health',
    version: '1.0',
    questions: [
      {
        number: 1,
        text: 'Over the past 2 weeks, how often have you been bothered by little interest or pleasure in doing things?',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 2,
        text: 'Over the past 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 6,
      thresholds: [
        { label: 'Negative screen', min: 0, max: 2, severity: 'low' },
        { label: 'Positive screen (follow-up with PHQ-9 recommended)', min: 3, max: 6, severity: 'medium' },
      ],
    },
  },

  // PHQ-9: Already implemented, but included for completeness
  {
    code: 'PHQ9',
    name: 'Patient Health Questionnaire-9 (PHQ-9)',
    description: '9-item depression screening questionnaire',
    category: 'mental_health',
    version: '1.0',
    questions: [
      {
        number: 1,
        text: 'Little interest or pleasure in doing things',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 2,
        text: 'Feeling down, depressed, or hopeless',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 3,
        text: 'Trouble falling or staying asleep, or sleeping too much',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 4,
        text: 'Feeling tired or having little energy',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 5,
        text: 'Poor appetite or overeating',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 6,
        text: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 7,
        text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 8,
        text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 9,
        text: 'Thoughts that you would be better off dead, or of hurting yourself',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 27,
      thresholds: [
        { label: 'Minimal', min: 0, max: 4, severity: 'low' },
        { label: 'Mild', min: 5, max: 9, severity: 'medium' },
        { label: 'Moderate', min: 10, max: 14, severity: 'high' },
        { label: 'Moderately Severe', min: 15, max: 19, severity: 'high' },
        { label: 'Severe', min: 20, max: 27, severity: 'critical' },
      ],
    },
  },

  // PHQ-15: Somatic symptom severity
  {
    code: 'PHQ15',
    name: 'Patient Health Questionnaire-15 (PHQ-15)',
    description: '15-item somatic symptom severity scale',
    category: 'symptom_tracking',
    version: '1.0',
    questions: [
      { number: 1, text: 'Stomach pain', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'Back pain', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'Pain in your arms, legs, or joints', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'Menstrual cramps or other problems with your periods (women only)', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'Headaches', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'Chest pain', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'Dizziness', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 8, text: 'Fainting spells', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 9, text: 'Feeling your heart pound or race', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 10, text: 'Shortness of breath', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 11, text: 'Pain or problems during sexual intercourse', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 12, text: 'Constipation, loose bowels, or diarrhea', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 13, text: 'Nausea, gas, or indigestion', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 14, text: 'Feeling tired or having low energy', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
      { number: 15, text: 'Trouble sleeping', type: 'scale', required: true, options: [
        { value: 0, label: 'Not bothered at all' },
        { value: 1, label: 'Bothered a little' },
        { value: 2, label: 'Bothered a lot' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 30,
      thresholds: [
        { label: 'Minimal', min: 0, max: 4, severity: 'low' },
        { label: 'Low', min: 5, max: 9, severity: 'low' },
        { label: 'Medium', min: 10, max: 14, severity: 'medium' },
        { label: 'High', min: 15, max: 30, severity: 'high' },
      ],
    },
  },

  // GAD-2: Ultra-brief anxiety screening (2 items)
  {
    code: 'GAD2',
    name: 'Generalized Anxiety Disorder-2 (GAD-2)',
    description: 'Ultra-brief 2-item anxiety screening tool',
    category: 'mental_health',
    version: '1.0',
    questions: [
      {
        number: 1,
        text: 'Over the last 2 weeks, how often have you been bothered by feeling nervous, anxious, or on edge?',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
      {
        number: 2,
        text: 'Over the last 2 weeks, how often have you been bothered by not being able to stop or control worrying?',
        type: 'scale',
        required: true,
        options: [
          { value: 0, label: 'Not at all' },
          { value: 1, label: 'Several days' },
          { value: 2, label: 'More than half the days' },
          { value: 3, label: 'Nearly every day' },
        ],
        scoring: { method: 'direct' },
      },
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 6,
      thresholds: [
        { label: 'Negative screen', min: 0, max: 2, severity: 'low' },
        { label: 'Positive screen (follow-up with GAD-7 recommended)', min: 3, max: 6, severity: 'medium' },
      ],
    },
  },

  // GAD-7: Already implemented, but included for completeness
  {
    code: 'GAD7',
    name: 'Generalized Anxiety Disorder-7 (GAD-7)',
    description: '7-item anxiety screening questionnaire',
    category: 'mental_health',
    version: '1.0',
    questions: [
      { number: 1, text: 'Feeling nervous, anxious, or on edge', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'Not being able to stop or control worrying', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'Worrying too much about different things', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'Trouble relaxing', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'Being so restless that it is hard to sit still', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'Becoming easily annoyed or irritable', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'Feeling afraid, as if something awful might happen', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 21,
      thresholds: [
        { label: 'Minimal', min: 0, max: 4, severity: 'low' },
        { label: 'Mild', min: 5, max: 9, severity: 'medium' },
        { label: 'Moderate', min: 10, max: 14, severity: 'high' },
        { label: 'Severe', min: 15, max: 21, severity: 'critical' },
      ],
    },
  },

  // ============================================
  // PAIN ASSESSMENT
  // ============================================
  
  {
    code: 'PAIN_SCALE',
    name: 'Pain Scale (NRS 0-10)',
    description: 'Numeric Rating Scale for pain assessment',
    category: 'symptom_tracking',
    version: '1.0',
    questions: [
      {
        number: 1,
        text: 'On a scale of 0 to 10, with 0 being no pain and 10 being the worst pain imaginable, how would you rate your pain right now?',
        type: 'number',
        required: true,
        min: 0,
        max: 10,
        scoring: { method: 'direct' },
      },
    ],
    scoring: {
      algorithm: 'direct',
      minScore: 0,
      maxScore: 10,
      thresholds: [
        { label: 'No pain', min: 0, max: 0, severity: 'low' },
        { label: 'Mild pain', min: 1, max: 3, severity: 'low' },
        { label: 'Moderate pain', min: 4, max: 6, severity: 'medium' },
        { label: 'Severe pain', min: 7, max: 8, severity: 'high' },
        { label: 'Very severe pain', min: 9, max: 10, severity: 'critical' },
      ],
    },
  },

  // ============================================
  // PROMIS QUESTIONNAIRES (NIH - Public Domain)
  // ============================================
  
  // PROMIS-29 Profile v2.1 (simplified version)
  {
    code: 'PROMIS29',
    name: 'PROMIS-29 Profile v2.1',
    description: '29-item health-related quality of life assessment (NIH PROMIS)',
    category: 'quality_of_life',
    version: '2.1',
    questions: [
      // Physical Function (4 items)
      { number: 1, text: 'Does your health now limit you in doing moderate activities, such as moving a table, pushing a vacuum cleaner, bowling, or playing golf?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 2, text: 'Does your health now limit you in climbing several flights of stairs?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 3, text: 'Are you able to do chores such as vacuuming or yard work?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 4, text: 'Are you able to go up and down stairs at a normal pace?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse', weight: 1 }},
      
      // Anxiety (4 items)
      { number: 5, text: 'In the past 7 days, I felt fearful', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 6, text: 'In the past 7 days, I found it hard to focus on anything other than my anxiety', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 7, text: 'In the past 7 days, my worries overwhelmed me', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 8, text: 'In the past 7 days, I felt uneasy', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      
      // Depression (4 items)
      { number: 9, text: 'In the past 7 days, I felt worthless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 10, text: 'In the past 7 days, I felt helpless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 11, text: 'In the past 7 days, I felt depressed', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 12, text: 'In the past 7 days, I felt hopeless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      
      // Fatigue (4 items)
      { number: 13, text: 'In the past 7 days, I felt fatigued', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 14, text: 'In the past 7 days, I had trouble starting things because I was tired', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 15, text: 'In the past 7 days, I had trouble finishing things because I was tired', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 16, text: 'In the past 7 days, I had to push myself to get things done because of my fatigue', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      
      // Sleep Disturbance (4 items)
      { number: 17, text: 'In the past 7 days, my sleep was restless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 18, text: 'In the past 7 days, I had trouble falling asleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 19, text: 'In the past 7 days, I had trouble staying asleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 20, text: 'In the past 7 days, I had problems with my sleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct', weight: 1 }},
      
      // Ability to Participate in Social Roles (4 items)
      { number: 21, text: 'In the past 7 days, I have trouble doing all of my regular leisure activities with family or friends', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 22, text: 'In the past 7 days, I have trouble doing all of the family activities that I want to do', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 23, text: 'In the past 7 days, I have trouble doing all of my usual work (include work at home)', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'reverse', weight: 1 }},
      { number: 24, text: 'In the past 7 days, I have trouble doing all of the activities with friends that I want to do', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'reverse', weight: 1 }},
      
      // Pain Interference (4 items)
      { number: 25, text: 'In the past 7 days, how much did pain interfere with your day-to-day activities?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Very much' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 26, text: 'In the past 7 days, how much did pain interfere with your work around the home?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Very much' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 27, text: 'In the past 7 days, how much did pain interfere with your ability to participate in social activities?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Very much' },
      ], scoring: { method: 'direct', weight: 1 }},
      { number: 28, text: 'In the past 7 days, how much did pain interfere with your household chores?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Very much' },
      ], scoring: { method: 'direct', weight: 1 }},
      
      // Pain Intensity (1 item)
      { number: 29, text: 'What is your level of pain right now?', type: 'scale', required: true, options: [
        { value: 0, label: 'No pain' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' },
        { value: 4, label: 'Very severe' },
      ], scoring: { method: 'direct', weight: 1 }},
    ],
    scoring: {
      algorithm: 'weighted',
      minScore: 0,
      maxScore: 100,
      thresholds: [
        { label: 'Excellent', min: 80, max: 100, severity: 'low' },
        { label: 'Good', min: 60, max: 79, severity: 'low' },
        { label: 'Fair', min: 40, max: 59, severity: 'medium' },
        { label: 'Poor', min: 20, max: 39, severity: 'high' },
        { label: 'Very Poor', min: 0, max: 19, severity: 'critical' },
      ],
    },
  },

  // PROMIS Physical Function Short Form 4a
  {
    code: 'PROMIS_PF_4A',
    name: 'PROMIS Physical Function Short Form 4a',
    description: '4-item physical function assessment (NIH PROMIS)',
    category: 'quality_of_life',
    version: '2.0',
    questions: [
      { number: 1, text: 'Are you able to do chores such as vacuuming or yard work?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse' }},
      { number: 2, text: 'Are you able to go up and down stairs at a normal pace?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse' }},
      { number: 3, text: 'Are you able to go for a walk of at least 15 minutes?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse' }},
      { number: 4, text: 'Are you able to run errands and shop?', type: 'scale', required: true, options: [
        { value: 1, label: 'Not at all' },
        { value: 2, label: 'Very little' },
        { value: 3, label: 'Somewhat' },
        { value: 4, label: 'Quite a bit' },
        { value: 5, label: 'Cannot do' },
      ], scoring: { method: 'reverse' }},
    ],
    scoring: {
      algorithm: 'average',
      minScore: 1,
      maxScore: 5,
      thresholds: [
        { label: 'No limitations', min: 4, max: 5, severity: 'low' },
        { label: 'Mild limitations', min: 3, max: 3.9, severity: 'low' },
        { label: 'Moderate limitations', min: 2, max: 2.9, severity: 'medium' },
        { label: 'Severe limitations', min: 1, max: 1.9, severity: 'high' },
      ],
    },
  },

  // PROMIS Anxiety Short Form 4a
  {
    code: 'PROMIS_ANX_4A',
    name: 'PROMIS Anxiety Short Form 4a',
    description: '4-item anxiety assessment (NIH PROMIS)',
    category: 'mental_health',
    version: '2.0',
    questions: [
      { number: 1, text: 'In the past 7 days, I felt fearful', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'In the past 7 days, I found it hard to focus on anything other than my anxiety', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'In the past 7 days, my worries overwhelmed me', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'In the past 7 days, I felt uneasy', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'average',
      minScore: 1,
      maxScore: 5,
      thresholds: [
        { label: 'Minimal anxiety', min: 1, max: 1.5, severity: 'low' },
        { label: 'Mild anxiety', min: 1.6, max: 2.5, severity: 'low' },
        { label: 'Moderate anxiety', min: 2.6, max: 3.5, severity: 'medium' },
        { label: 'Severe anxiety', min: 3.6, max: 5, severity: 'high' },
      ],
    },
  },

  // PROMIS Depression Short Form 4a
  {
    code: 'PROMIS_DEP_4A',
    name: 'PROMIS Depression Short Form 4a',
    description: '4-item depression assessment (NIH PROMIS)',
    category: 'mental_health',
    version: '2.0',
    questions: [
      { number: 1, text: 'In the past 7 days, I felt worthless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'In the past 7 days, I felt helpless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'In the past 7 days, I felt depressed', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'In the past 7 days, I felt hopeless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'average',
      minScore: 1,
      maxScore: 5,
      thresholds: [
        { label: 'Minimal depression', min: 1, max: 1.5, severity: 'low' },
        { label: 'Mild depression', min: 1.6, max: 2.5, severity: 'low' },
        { label: 'Moderate depression', min: 2.6, max: 3.5, severity: 'medium' },
        { label: 'Severe depression', min: 3.6, max: 5, severity: 'high' },
      ],
    },
  },

  // PROMIS Fatigue Short Form 4a
  {
    code: 'PROMIS_FAT_4A',
    name: 'PROMIS Fatigue Short Form 4a',
    description: '4-item fatigue assessment (NIH PROMIS)',
    category: 'symptom_tracking',
    version: '2.0',
    questions: [
      { number: 1, text: 'In the past 7 days, I felt fatigued', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'In the past 7 days, I had trouble starting things because I was tired', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'In the past 7 days, I had trouble finishing things because I was tired', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'In the past 7 days, I had to push myself to get things done because of my fatigue', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'average',
      minScore: 1,
      maxScore: 5,
      thresholds: [
        { label: 'No fatigue', min: 1, max: 1.5, severity: 'low' },
        { label: 'Mild fatigue', min: 1.6, max: 2.5, severity: 'low' },
        { label: 'Moderate fatigue', min: 2.6, max: 3.5, severity: 'medium' },
        { label: 'Severe fatigue', min: 3.6, max: 5, severity: 'high' },
      ],
    },
  },

  // PROMIS Sleep Disturbance Short Form 4a
  {
    code: 'PROMIS_SLEEP_4A',
    name: 'PROMIS Sleep Disturbance Short Form 4a',
    description: '4-item sleep disturbance assessment (NIH PROMIS)',
    category: 'symptom_tracking',
    version: '2.0',
    questions: [
      { number: 1, text: 'In the past 7 days, my sleep was restless', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'In the past 7 days, I had trouble falling asleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'In the past 7 days, I had trouble staying asleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'In the past 7 days, I had problems with my sleep', type: 'scale', required: true, options: [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'average',
      minScore: 1,
      maxScore: 5,
      thresholds: [
        { label: 'No sleep problems', min: 1, max: 1.5, severity: 'low' },
        { label: 'Mild sleep problems', min: 1.6, max: 2.5, severity: 'low' },
        { label: 'Moderate sleep problems', min: 2.6, max: 3.5, severity: 'medium' },
        { label: 'Severe sleep problems', min: 3.6, max: 5, severity: 'high' },
      ],
    },
  },

  // ============================================
  // ADDITIONAL FREE QUESTIONNAIRES
  // ============================================

  // PCL-5: PTSD Checklist for DSM-5 (20 items) - FREE
  {
    code: 'PCL5',
    name: 'PTSD Checklist for DSM-5 (PCL-5)',
    description: '20-item self-report measure assessing PTSD symptoms',
    category: 'mental_health',
    version: '1.0',
    questions: [
      { number: 1, text: 'Repeated, disturbing, and unwanted memories of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'Repeated, disturbing dreams of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'Suddenly feeling or acting as if the stressful experience were actually happening again?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'Feeling very upset when something reminded you of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'Having strong physical reactions when something reminded you of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'Avoiding memories, thoughts, or feelings related to the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'Avoiding external reminders of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 8, text: 'Trouble remembering important parts of the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 9, text: 'Having strong negative beliefs about yourself, other people, or the world?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 10, text: 'Blaming yourself or someone else for the stressful experience?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 11, text: 'Having strong negative feelings such as fear, horror, anger, guilt, or shame?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 12, text: 'Loss of interest in activities that you used to enjoy?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 13, text: 'Feeling distant or cut off from other people?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 14, text: 'Trouble experiencing positive feelings?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 15, text: 'Irritable behavior, angry outbursts, or acting aggressively?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 16, text: 'Taking too many risks or doing things that could cause you harm?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 17, text: 'Being "superalert" or watchful or on guard?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 18, text: 'Feeling jumpy or easily startled?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 19, text: 'Having difficulty concentrating?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
      { number: 20, text: 'Trouble falling or staying asleep?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'A little bit' },
        { value: 2, label: 'Moderately' },
        { value: 3, label: 'Quite a bit' },
        { value: 4, label: 'Extremely' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 80,
      thresholds: [
        { label: 'Minimal/None', min: 0, max: 10, severity: 'low' },
        { label: 'Mild', min: 11, max: 20, severity: 'low' },
        { label: 'Moderate', min: 21, max: 32, severity: 'medium' },
        { label: 'Moderately Severe', min: 33, max: 49, severity: 'high' },
        { label: 'Severe', min: 50, max: 80, severity: 'critical' },
      ],
    },
    alertRules: [
      {
        name: 'Severe PTSD Alert',
        conditionType: 'score_greater_than',
        conditionValue: { threshold: 49 },
        severity: 'critical',
        message: 'PCL-5 score indicates severe PTSD - immediate clinical attention recommended',
        notifyRoles: ['doctor', 'nurse'],
      },
    ],
  },

  // AUDIT: Alcohol Use Disorders Identification Test (10 items) - FREE (WHO)
  {
    code: 'AUDIT',
    name: 'Alcohol Use Disorders Identification Test (AUDIT)',
    description: '10-item screening tool for hazardous and harmful alcohol use (WHO)',
    category: 'mental_health',
    version: '1.0',
    questions: [
      { number: 1, text: 'How often do you have a drink containing alcohol?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Monthly or less' },
        { value: 2, label: '2-4 times a month' },
        { value: 3, label: '2-3 times a week' },
        { value: 4, label: '4 or more times a week' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'How many drinks containing alcohol do you have on a typical day when you are drinking?', type: 'scale', required: true, options: [
        { value: 0, label: '1 or 2' },
        { value: 1, label: '3 or 4' },
        { value: 2, label: '5 or 6' },
        { value: 3, label: '7 to 9' },
        { value: 4, label: '10 or more' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'How often do you have 6 or more drinks on one occasion?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'How often during the last year have you found that you were not able to stop drinking once you had started?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'How often during the last year have you failed to do what was normally expected of you because of drinking?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'How often during the last year have you had a feeling of guilt or remorse after drinking?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 8, text: 'How often during the last year have you been unable to remember what happened the night before because you had been drinking?', type: 'scale', required: true, options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Less than monthly' },
        { value: 2, label: 'Monthly' },
        { value: 3, label: 'Weekly' },
        { value: 4, label: 'Daily or almost daily' },
      ], scoring: { method: 'direct' }},
      { number: 9, text: 'Have you or someone else been injured as a result of your drinking?', type: 'scale', required: true, options: [
        { value: 0, label: 'No' },
        { value: 2, label: 'Yes, but not in the last year' },
        { value: 4, label: 'Yes, during the last year' },
      ], scoring: { method: 'direct' }},
      { number: 10, text: 'Has a relative or friend, doctor, or other health worker been concerned about your drinking or suggested you cut down?', type: 'scale', required: true, options: [
        { value: 0, label: 'No' },
        { value: 2, label: 'Yes, but not in the last year' },
        { value: 4, label: 'Yes, during the last year' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 40,
      thresholds: [
        { label: 'Low risk', min: 0, max: 7, severity: 'low' },
        { label: 'Hazardous use', min: 8, max: 15, severity: 'medium' },
        { label: 'Harmful use', min: 16, max: 19, severity: 'high' },
        { label: 'Likely dependence', min: 20, max: 40, severity: 'critical' },
      ],
    },
    alertRules: [
      {
        name: 'Alcohol Dependence Alert',
        conditionType: 'score_greater_than',
        conditionValue: { threshold: 19 },
        severity: 'critical',
        message: 'AUDIT score indicates likely alcohol dependence - immediate clinical attention recommended',
        notifyRoles: ['doctor', 'nurse'],
      },
    ],
  },

  // CAGE: Substance Abuse Screening (4 items) - FREE
  {
    code: 'CAGE',
    name: 'CAGE Questionnaire',
    description: '4-item screening tool for alcohol and substance abuse',
    category: 'mental_health',
    version: '1.0',
    questions: [
      { number: 1, text: 'Have you ever felt you should Cut down on your drinking or drug use?', type: 'boolean', required: true, scoring: { method: 'direct' }},
      { number: 2, text: 'Have people Annoyed you by criticizing your drinking or drug use?', type: 'boolean', required: true, scoring: { method: 'direct' }},
      { number: 3, text: 'Have you ever felt bad or Guilty about your drinking or drug use?', type: 'boolean', required: true, scoring: { method: 'direct' }},
      { number: 4, text: 'Have you ever had a drink or used drugs first thing in the morning (Eye-opener) to steady your nerves or get rid of a hangover?', type: 'boolean', required: true, scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 4,
      thresholds: [
        { label: 'Negative screen', min: 0, max: 0, severity: 'low' },
        { label: 'Positive screen (1-2)', min: 1, max: 2, severity: 'medium' },
        { label: 'Strong positive (3-4)', min: 3, max: 4, severity: 'high' },
      ],
    },
    alertRules: [
      {
        name: 'CAGE Positive Alert',
        conditionType: 'score_greater_than',
        conditionValue: { threshold: 2 },
        severity: 'high',
        message: 'CAGE score indicates possible substance abuse - further assessment recommended',
        notifyRoles: ['doctor'],
      },
    ],
  },

  // Insomnia Severity Index (ISI) - 7 items - FREE
  {
    code: 'ISI',
    name: 'Insomnia Severity Index',
    description: '7-item self-report measure assessing insomnia severity',
    category: 'symptom_tracking',
    version: '1.0',
    questions: [
      { number: 1, text: 'Difficulty falling asleep', type: 'scale', required: true, options: [
        { value: 0, label: 'None' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' },
        { value: 4, label: 'Very severe' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'Difficulty staying asleep', type: 'scale', required: true, options: [
        { value: 0, label: 'None' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' },
        { value: 4, label: 'Very severe' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'Problems waking up too early', type: 'scale', required: true, options: [
        { value: 0, label: 'None' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' },
        { value: 4, label: 'Very severe' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'How satisfied/dissatisfied are you with your current sleep pattern?', type: 'scale', required: true, options: [
        { value: 0, label: 'Very satisfied' },
        { value: 1, label: 'Satisfied' },
        { value: 2, label: 'Moderately satisfied' },
        { value: 3, label: 'Dissatisfied' },
        { value: 4, label: 'Very dissatisfied' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'How noticeable to others do you think your sleep problem is in terms of impairing the quality of your life?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all noticeable' },
        { value: 1, label: 'A little' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Much' },
        { value: 4, label: 'Very much noticeable' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'How worried/distressed are you about your current sleep problem?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all worried' },
        { value: 1, label: 'A little' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Much' },
        { value: 4, label: 'Very much worried' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'To what extent do you consider your sleep problem to interfere with your daily functioning?', type: 'scale', required: true, options: [
        { value: 0, label: 'Not at all interfering' },
        { value: 1, label: 'A little' },
        { value: 2, label: 'Somewhat' },
        { value: 3, label: 'Much' },
        { value: 4, label: 'Very much interfering' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 28,
      thresholds: [
        { label: 'No clinically significant insomnia', min: 0, max: 7, severity: 'low' },
        { label: 'Subthreshold insomnia', min: 8, max: 14, severity: 'low' },
        { label: 'Moderate clinical insomnia', min: 15, max: 21, severity: 'medium' },
        { label: 'Severe clinical insomnia', min: 22, max: 28, severity: 'high' },
      ],
    },
    alertRules: [
      {
        name: 'Severe Insomnia Alert',
        conditionType: 'score_greater_than',
        conditionValue: { threshold: 21 },
        severity: 'high',
        message: 'ISI score indicates severe clinical insomnia - treatment recommended',
        notifyRoles: ['doctor'],
      },
    ],
  },

  // Epworth Sleepiness Scale (ESS) - 8 items - FREE
  {
    code: 'ESS',
    name: 'Epworth Sleepiness Scale',
    description: '8-item measure of daytime sleepiness',
    category: 'symptom_tracking',
    version: '1.0',
    questions: [
      { number: 1, text: 'Sitting and reading', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 2, text: 'Watching TV', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 3, text: 'Sitting inactive in a public place (e.g., theater, meeting)', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 4, text: 'As a passenger in a car for an hour without a break', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 5, text: 'Lying down to rest in the afternoon when circumstances permit', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 6, text: 'Sitting and talking to someone', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 7, text: 'Sitting quietly after a lunch without alcohol', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
      { number: 8, text: 'In a car, while stopped for a few minutes in traffic', type: 'scale', required: true, options: [
        { value: 0, label: 'Would never doze' },
        { value: 1, label: 'Slight chance of dozing' },
        { value: 2, label: 'Moderate chance of dozing' },
        { value: 3, label: 'High chance of dozing' },
      ], scoring: { method: 'direct' }},
    ],
    scoring: {
      algorithm: 'sum',
      minScore: 0,
      maxScore: 24,
      thresholds: [
        { label: 'Normal daytime sleepiness', min: 0, max: 10, severity: 'low' },
        { label: 'Mild to moderate excessive daytime sleepiness', min: 11, max: 15, severity: 'medium' },
        { label: 'Severe excessive daytime sleepiness', min: 16, max: 24, severity: 'high' },
      ],
    },
    alertRules: [
      {
        name: 'Severe Sleepiness Alert',
        conditionType: 'score_greater_than',
        conditionValue: { threshold: 15 },
        severity: 'high',
        message: 'ESS score indicates severe excessive daytime sleepiness - further evaluation recommended',
        notifyRoles: ['doctor'],
      },
    ],
  },
];

/**
 * Get all questionnaires from the library
 */
export function getAllQuestionnaires(): QuestionnaireTemplate[] {
  return QUESTIONNAIRE_LIBRARY;
}

/**
 * Get questionnaires by category
 */
export function getQuestionnairesByCategory(category: string): QuestionnaireTemplate[] {
  return QUESTIONNAIRE_LIBRARY.filter(q => q.category === category);
}

/**
 * Search questionnaires by name or code
 */
export function searchQuestionnaires(searchTerm: string): QuestionnaireTemplate[] {
  const term = searchTerm.toLowerCase();
  return QUESTIONNAIRE_LIBRARY.filter(q => 
    q.name.toLowerCase().includes(term) ||
    q.code.toLowerCase().includes(term) ||
    q.description.toLowerCase().includes(term)
  );
}

/**
 * Get questionnaire by code
 */
export function getQuestionnaireByCode(code: string): QuestionnaireTemplate | undefined {
  return QUESTIONNAIRE_LIBRARY.find(q => q.code === code);
}

