# Quality Measures (HEDIS/eCQM) Implementation

## Overview

This document outlines the implementation of clinical quality measures for value-based care reporting, including HEDIS (Healthcare Effectiveness Data and Information Set) and eCQM (electronic Clinical Quality Measures) standards.

## Implementation Status

### ✅ Completed

1. **Quality Measures Service**
   - Framework for calculating quality measures
   - HEDIS measure implementations
   - eCQM measure implementations
   - Measure result storage and retrieval

2. **Database Schema**
   - `quality_measure_results` table for storing calculated measures
   - Indexes for efficient querying

3. **Implemented Measures**

   **HEDIS Measures**:
   - ✅ Comprehensive Diabetes Care - HbA1c Control (<8%)
   - ✅ Comprehensive Diabetes Care - Eye Exam
   - ✅ Comprehensive Diabetes Care - Nephropathy Screening
   - ✅ Controlling High Blood Pressure
   - ✅ Breast Cancer Screening
   - ✅ Colorectal Cancer Screening
   - ✅ Cervical Cancer Screening
   - ✅ Immunizations for Adolescents

   **eCQM Measures**:
   - ✅ Diabetes: Hemoglobin A1c Poor Control (>9%)
   - ✅ Controlling High Blood Pressure
   - ✅ Breast Cancer Screening

4. **API Endpoints**
   - `GET /quality-measures/measures` - Get all available measures
   - `GET /quality-measures/measures/:measureId` - Get specific measure
   - `POST /quality-measures/calculate/:measureId` - Calculate a measure
   - `POST /quality-measures/calculate` - Calculate multiple measures
   - `GET /quality-measures/results` - Get measure results history
   - `GET /quality-measures/dashboard` - Get quality dashboard summary

5. **Frontend Integration**
   - API methods for all quality measure operations
   - Dashboard summary methods

## Quality Measure Structure

### Measure Definition

Each quality measure includes:
- **ID**: Unique identifier
- **Name**: Human-readable name
- **Description**: Detailed description
- **Type**: HEDIS, eCQM, or Custom
- **Category**: Preventive care, chronic disease, etc.
- **Numerator**: Criteria for numerator
- **Denominator**: Criteria for denominator
- **Exclusions**: Criteria for exclusions
- **NQF Number**: National Quality Forum number (if applicable)
- **CMS ID**: CMS measure ID (if applicable)
- **Version**: Measure version

### Measure Result

Each calculated result includes:
- **Measure ID & Name**: Identifies the measure
- **Period**: Start and end dates
- **Denominator**: Number of eligible patients
- **Numerator**: Number of patients meeting criteria
- **Exclusions**: Number of excluded patients
- **Rate**: Percentage (0-100)
- **Benchmark**: Target rate
- **Status**: met, not_met, or partial
- **Patient Lists**: Lists of patient IDs in each category

## Implemented Measures

### 1. Comprehensive Diabetes Care - HbA1c Control (<8%)

**HEDIS ID**: `hedis-dm-001`
**NQF Number**: 0059

**Description**: Percentage of patients 18-75 years with diabetes who had HbA1c <8.0% during the measurement year.

**Calculation**:
- **Denominator**: Patients 18-75 years with active diabetes diagnosis
- **Numerator**: Patients with most recent HbA1c <8.0%
- **Exclusions**: Patients with hospice, advanced illness, or pregnancy
- **Benchmark**: 75%

### 2. Comprehensive Diabetes Care - Eye Exam

**HEDIS ID**: `hedis-dm-002`
**NQF Number**: 0055

**Description**: Percentage of patients 18-75 years with diabetes who received an eye exam.

**Calculation**:
- **Denominator**: Patients 18-75 years with active diabetes diagnosis
- **Numerator**: Patients who received retinal or dilated eye exam
- **Exclusions**: Patients with hospice, advanced illness, or pregnancy
- **Benchmark**: 60%

### 3. Controlling High Blood Pressure

**HEDIS ID**: `hedis-bp-001`
**NQF Number**: 0018

**Description**: Percentage of patients 18-85 years with hypertension who had BP <140/90 mmHg.

**Calculation**:
- **Denominator**: Patients 18-85 years with active hypertension diagnosis
- **Numerator**: Patients with most recent BP <140/90 mmHg
- **Exclusions**: Patients with hospice, advanced illness, or pregnancy
- **Benchmark**: 70%

## Usage Examples

### Calculate a Single Measure

```typescript
// Backend
const result = await qualityMeasuresService.calculateMeasure(
  tenantDb,
  'hedis-dm-001',
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

// Save result
await qualityMeasuresService.saveMeasureResult(
  tenantDb,
  result,
  userId
);
```

### Calculate Multiple Measures

```typescript
const results = await qualityMeasuresService.calculateMeasures(
  tenantDb,
  ['hedis-dm-001', 'hedis-dm-002', 'hedis-bp-001'],
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

### Get Quality Dashboard

```typescript
const dashboard = await qualityMeasuresService.getQualityDashboard(
  tenantDb,
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

// Returns:
// {
//   period: { startDate, endDate },
//   totalMeasures: 11,
//   calculatedMeasures: 10,
//   averageRate: 68.5,
//   measuresMet: 6,
//   measuresPartial: 2,
//   measuresNotMet: 2,
//   byCategory: { ... },
//   results: [ ... ]
// }
```

### API Endpoints

```bash
# Get all measures
GET /quality-measures/measures?type=hedis&category=chronic_disease

# Get specific measure
GET /quality-measures/measures/hedis-dm-001

# Calculate measure
POST /quality-measures/calculate/hedis-dm-001?startDate=2024-01-01&endDate=2024-12-31&save=true

# Calculate multiple measures
POST /quality-measures/calculate
Body: { "measureIds": ["hedis-dm-001", "hedis-dm-002"] }
Query: startDate=2024-01-01&endDate=2024-12-31&save=true

# Get results history
GET /quality-measures/results?measureId=hedis-dm-001&startDate=2024-01-01&endDate=2024-12-31

# Get dashboard
GET /quality-measures/dashboard?startDate=2024-01-01&endDate=2024-12-31
```

## Measure Categories

### Preventive Care
- Breast Cancer Screening
- Colorectal Cancer Screening
- Cervical Cancer Screening
- Immunizations for Adolescents

### Chronic Disease
- Diabetes Care (HbA1c, Eye Exam, Nephropathy)
- Hypertension Control

### Mental Health
- (To be implemented)

### Maternal Child
- (To be implemented)

### Patient Safety
- (To be implemented)

### Care Coordination
- (To be implemented)

## Measure Status

Each measure result has a status:
- **met**: Rate meets or exceeds benchmark
- **partial**: Rate is between 50% and benchmark
- **not_met**: Rate is below 50% or significantly below benchmark

## Benchmark Standards

Benchmarks are based on HEDIS national averages and CMS targets:
- **Diabetes HbA1c Control**: 75%
- **Diabetes Eye Exam**: 60%
- **Hypertension Control**: 70%
- **Cancer Screenings**: Varies by measure

## Data Sources

Quality measures pull data from:
- **Problems**: Active diagnoses (diabetes, hypertension)
- **Lab Orders**: Lab results (HbA1c, urine microalbumin)
- **Vitals**: Blood pressure readings
- **Medical Records**: Clinical assessments
- **Diabetes Module**: Diabetes-specific screenings
- **Appointments**: Patient visits

## Future Enhancements

1. **Additional HEDIS Measures**:
   - Medication Adherence
   - Care for Older Adults
   - Behavioral Health Measures
   - Maternal/Child Health Measures

2. **Additional eCQM Measures**:
   - CMS Meaningful Use measures
   - MIPS (Merit-based Incentive Payment System) measures
   - ACO (Accountable Care Organization) measures

3. **Reporting**:
   - HEDIS reporting format export
   - CMS QRDA (Quality Reporting Document Architecture) export
   - PDF quality reports
   - Excel exports

4. **Analytics**:
   - Trend analysis over time
   - Comparison with national benchmarks
   - Provider-level performance
   - Patient-level gap analysis

5. **Automation**:
   - Scheduled measure calculations
   - Automated alerts for low-performing measures
   - Integration with care management workflows

## Summary

✅ **11 Quality Measures** implemented (8 HEDIS, 3 eCQM)
✅ **Framework** for adding new measures
✅ **Database schema** for storing results
✅ **API endpoints** for calculation and reporting
✅ **Dashboard** for quality overview
✅ **Frontend integration** ready

The EHR now supports comprehensive quality measure calculation and reporting for value-based care initiatives.


