"""
MediCore Clinical Decision Support System (CDSS) Service
Python FastAPI microservice for advanced clinical reasoning
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uvicorn
import httpx
import os
import shutil
import tempfile
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from fastapi import UploadFile, File, Form
from drug_interactions import DrugInteractionAnalyzer
from clinical_guidelines import ClinicalGuidelinesEngine
from risk_scoring import RiskScoringEngine
from dosing_calculator import DosingCalculator
from diagnostic_assistant import DiagnosticAssistant
from trend_analysis import TrendAnalysisEngine
from lab_interpreter import LabResultInterpreter
from duplicate_therapy import DuplicateTherapyDetector
from high_risk_medications import HighRiskMedicationDetector
from food_interactions import FoodInteractionChecker
from ai_models.voice_scribe import VoiceScribe
from ai_models.medical_vision import MedicalVisionService

app = FastAPI(
    title="MediCore CDSS Service",
    description="Clinical Decision Support System API",
    version="1.0.0"
)

# CORS middleware
# Load allowed origins from environment variable, default to "*" if not set (for development)
cors_origins_env = os.getenv("CORS_ORIGINS")
allowed_origins = cors_origins_env.split(",") if cors_origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class DrugInteractionRequest(BaseModel):
    drug_ids: List[str] = Field(..., description="List of drug UUIDs to check")
    patient_id: Optional[str] = Field(None, description="Patient ID for context")
    drugs_data: Optional[List[Dict[str, Any]]] = Field(None, description="Optional: Pre-fetched drug data from EHR service")


class DrugInteractionResponse(BaseModel):
    interactions: List[Dict[str, Any]]
    severity_summary: Dict[str, int]
    recommendations: List[str]


class ClinicalGuidelineRequest(BaseModel):
    condition: str = Field(..., description="Diagnosis or condition code")
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    comorbidities: Optional[List[str]] = []
    medications: Optional[List[str]] = []


class RiskScoreRequest(BaseModel):
    patient_id: str
    vitals: Dict[str, Any]
    medications: List[str]
    diagnoses: List[str]
    lab_results: Optional[Dict[str, Any]] = None
    historical_vitals: Optional[List[Dict[str, Any]]] = None
    visit_history: Optional[List[Dict[str, Any]]] = None


class RiskScoreResponse(BaseModel):
    overall_score: float
    risk_level: str  # low, moderate, high, critical
    factors: List[Dict[str, Any]]
    recommendations: List[str]
    guideline_citations: List[Dict[str, Any]] = []


# Health Check
@app.get("/")
async def root():
    return {
        "service": "MediCore CDSS",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Initialize analyzers
analyzer = DrugInteractionAnalyzer()
guidelines_engine = ClinicalGuidelinesEngine()
risk_scoring_engine = RiskScoringEngine()
dosing_calculator = DosingCalculator()
diagnostic_assistant = DiagnosticAssistant()  # Now includes AI models if available
trend_analysis_engine = TrendAnalysisEngine()

# Check for AI enablement
enable_ai = os.getenv("CDSS_ENABLE_AI", "false").lower() == "true"

# Initialize Voice Scribe
voice_scribe = None
if enable_ai:
    try:
        voice_scribe = VoiceScribe()
    except Exception as e:
        print(f"Voice scribe initialization failed: {e}")
else:
    print("Voice Scribe disabled via CDSS_ENABLE_AI=false")

# Initialize Medical Vision Service
medical_vision = None
if enable_ai:
    try:
        medical_vision = MedicalVisionService()
    except Exception as e:
        print(f"Medical Vision initialization failed: {e}")
else:
    print("AI features (Medical Vision) disabled via CDSS_ENABLE_AI=false")

# MinIO Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
if not MINIO_ENDPOINT:
    print("Warning: MINIO_ENDPOINT not set, defaulting to internal service name or requiring env var")
    # In docker, it might be 'http://minio:9000', locally 'http://localhost:9000'
    # We'll leave it empty to force configuration or handle it downstream

MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "medicore")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "medicore_password")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "medicore-documents")

# Initialize S3 Client
s3_client = boto3.client(
    's3',
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=boto3.session.Config(signature_version='s3v4')
)

@app.on_event("startup")
async def startup_event():
    """Ensure MinIO bucket exists on startup."""
    try:
        try:
            s3_client.head_bucket(Bucket=MINIO_BUCKET)
            print(f"Bucket '{MINIO_BUCKET}' exists.")
        except ClientError as e:
            # If a client error is thrown, then check that it was a 404 error.
            # If it was a 404 error, then the bucket does not exist.
            error_code = e.response['Error']['Code']
            if error_code == '404':
                s3_client.create_bucket(Bucket=MINIO_BUCKET)
                print(f"Bucket '{MINIO_BUCKET}' created successfully.")
            else:
                print(f"Error checking bucket '{MINIO_BUCKET}': {e}")
    except Exception as e:
        print(f"Error checking MinIO connection: {e}")

lab_interpreter = LabResultInterpreter()

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    generate_soap: bool = True,
    language: Optional[str] = Form(None)
):
    """
    Transcribe audio file (English, Shona, Ndebele) and optionally generate SOAP note.
    Stores audio in MinIO.
    """
    if not voice_scribe:
        raise HTTPException(status_code=503, detail="Voice service unavailable")
    
    # Save uploaded file to temp file
    suffix = f".{file.filename.split('.')[-1]}" if '.' in file.filename else ".tmp"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name
    
    try:
        # 1. Transcribe
        transcription_result = await run_in_threadpool(voice_scribe.transcribe_audio, temp_path, language=language)
        if "error" in transcription_result:
             raise HTTPException(status_code=500, detail=transcription_result["error"])
        
        result = {
            "transcription": transcription_result,
            "soap_note": None,
            "audio_url": None,
            "storage_key": None
        }
        
        # 2. Upload to MinIO
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = os.path.basename(temp_path)
            file_key = f"voice-consultations/{timestamp}_{filename}"
            
            await run_in_threadpool(s3_client.upload_file, temp_path, MINIO_BUCKET, file_key)
            
            # Construct URL (accessible if bucket is public or via signed url)
            # For internal use, we return the key
            result["storage_key"] = file_key
            result["audio_url"] = f"{MINIO_ENDPOINT}/{MINIO_BUCKET}/{file_key}"
        except Exception as e:
            print(f"MinIO upload failed: {e}")
            # Continue even if upload fails, as we have the text
        
        # 3. Generate SOAP Note
        if generate_soap:
            soap_result = await voice_scribe.generate_soap_note(transcription_result["text"])
            result["soap_note"] = soap_result
            
        return result
    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/analyze-image")
async def analyze_medical_image(
    file: UploadFile = File(...)
):
    """
    Analyze medical images (X-Ray, DICOM) using Computer Vision.
    Detects: Pneumonia, Tuberculosis, Pleural Effusion, etc.
    """
    if not medical_vision:
        raise HTTPException(status_code=503, detail="Medical Vision service unavailable")

    try:
        content = await file.read()
        
        # Run inference in threadpool to avoid blocking
        result = await run_in_threadpool(
            medical_vision.analyze_image, 
            content, 
            file.filename
        )
        
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
             
        return result
        
    except Exception as e:
        print(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


duplicate_detector = DuplicateTherapyDetector()
high_risk_detector = HighRiskMedicationDetector()
food_interaction_checker = FoodInteractionChecker()

# Advanced Drug Interaction Checking
@app.post("/drugs/interactions/advanced", response_model=DrugInteractionResponse)
async def check_drug_interactions_advanced(request: DrugInteractionRequest):
    """
    Advanced drug-drug interaction checking with:
    - Pharmacokinetic interactions (CYP450 enzyme interactions)
    - Pharmacodynamic interactions (receptor-based, synergistic effects)
    - Clinical significance scoring
    - Evidence-based management recommendations
    """
    if len(request.drug_ids) < 2:
        return DrugInteractionResponse(
            interactions=[],
            severity_summary={"critical": 0, "major": 0, "moderate": 0, "minor": 0},
            recommendations=["At least 2 drugs required for interaction checking"]
        )
    
    # Fetch drug data if not provided
    drugs_data = request.drugs_data
    if not drugs_data:
        # Optionally fetch from EHR service (if EHR_SERVICE_URL is set)
        ehr_api_url = os.getenv("EHR_SERVICE_URL")
        # For now, we'll use the drug_ids to infer names
        # In production, make HTTP call to EHR service to get drug details
        drugs_data = [{"id": drug_id, "name": drug_id} for drug_id in request.drug_ids]
    
    # Generate all drug pairs
    drug_pairs = []
    for i in range(len(drugs_data)):
        for j in range(i + 1, len(drugs_data)):
            drug_pairs.append({
                'drug1': drugs_data[i],
                'drug2': drugs_data[j]
            })
    
    # Analyze interactions
    interactions = analyzer.analyze_interactions(drug_pairs)
    
    # Calculate severity summary
    severity_counts = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    recommendations = []
    
    for interaction in interactions:
        severity = interaction.get('severity', 'minor')
        if severity in severity_counts:
            severity_counts[severity] += 1
        
        # Generate recommendations
        if 'management' in interaction:
            recommendations.append(f"{interaction.get('drug1', 'Drug 1')} + {interaction.get('drug2', 'Drug 2')}: {interaction['management']}")
        elif 'risk' in interaction:
            recommendations.append(f"Monitor for {interaction['risk']}")
    
    if not interactions:
        recommendations.append("No significant interactions detected with current analysis")
    
    # Format interactions for response
    formatted_interactions = []
    for interaction in interactions:
        formatted_interactions.append({
            "drug1": interaction.get('drug1', 'Unknown'),
            "drug2": interaction.get('drug2', 'Unknown'),
            "severity": interaction.get('severity', 'minor'),
            "mechanism": interaction.get('mechanism', interaction.get('effect', 'Unknown mechanism')),
            "description": interaction.get('effect') or interaction.get('clinical_impact', ''),
            "management": interaction.get('management') or interaction.get('risk', ''),
            "source": interaction.get('source', 'cdss_analysis'),
            "clinical_significance": interaction.get('clinical_significance', 5.0)
        })
    
    return DrugInteractionResponse(
        interactions=formatted_interactions,
        severity_summary=severity_counts,
        recommendations=recommendations if recommendations else ["No interactions detected"]
    )


# Clinical Guidelines Engine
@app.post("/guidelines/check")
async def check_clinical_guidelines(request: ClinicalGuidelineRequest):
    """
    Check clinical guidelines and protocols based on:
    - Diagnosis/condition
    - Patient demographics
    - Comorbidities
    - Current medications
    
    Returns evidence-based recommendations from WHO, ADA, AHA, IDSA, etc.
    """
    result = guidelines_engine.check_guidelines(
        condition=request.condition,
        patient_age=request.patient_age,
        patient_gender=request.patient_gender,
        comorbidities=request.comorbidities,
        medications=request.medications
    )
    
    return {
        "guidelines": result.get('guidelines', []),
        "recommendations": result.get('recommendations', []),
        "contraindications": result.get('contraindications', []),
        "medication_warnings": result.get('medication_warnings', []),
        "evidence_level": result.get('evidence_level', 'moderate'),
        "matched_condition": result.get('matched_condition', request.condition)
    }


class GuidelineSearchRequest(BaseModel):
    query: str = Field(..., description="Search query for clinical guidelines")
    limit: int = Field(5, description="Maximum number of results to return")


@app.post("/guidelines/search")
async def search_guidelines(request: GuidelineSearchRequest):
    """
    Search for clinical guidelines using RAG (Retrieval-Augmented Generation).
    Returns relevant guideline excerpts and citations based on the search query.
    """
    citations = []
    if diagnostic_assistant.rag_engine:
        try:
            print(f"[CDSS] Searching guidelines for: {request.query}")
            citations = diagnostic_assistant.rag_engine.query(request.query, n_results=request.limit)
        except Exception as e:
            print(f"[CDSS] Guideline search failed: {e}")
            # Don't fail the request, just return empty list or error message
    
    return {
        "query": request.query,
        "citations": citations,
        "count": len(citations)
    }


# Risk Scoring Algorithms
@app.post("/risk/calculate")  # Removed response_model to allow additional fields (trends, visit_patterns)
async def calculate_risk_score(request: RiskScoreRequest):
    """
    Calculate patient risk scores:
    - Cardiovascular risk (Framingham)
    - Medication adherence risk
    - Readmission risk
    
    Combines multiple risk factors from vitals, medications, diagnoses, and lab results
    """
    factors = []
    recommendations = []
    risk_scores = []
    
    # Extract data from request
    vitals = request.vitals or {}
    age = vitals.get('age') or vitals.get('patient_age')
    gender = vitals.get('gender') or vitals.get('patient_gender', '').lower()
    systolic_bp = None
    if vitals.get('bloodPressure'):
        bp_parts = str(vitals['bloodPressure']).split('/')
        if len(bp_parts) >= 1:
            try:
                systolic_bp = int(bp_parts[0])
            except (ValueError, TypeError):
                systolic_bp = None
    
    # 1. Cardiovascular Risk (Framingham)
    if age and systolic_bp and vitals.get('totalCholesterol') and vitals.get('hdlCholesterol'):
        cv_risk = risk_scoring_engine.calculate_framingham_risk(
            age=int(age),
            gender=gender or 'unknown',
            total_cholesterol=float(vitals.get('totalCholesterol', 0)),
            hdl_cholesterol=float(vitals.get('hdlCholesterol', 0)),
            systolic_bp=int(systolic_bp),
            smoker=vitals.get('smoker', False),
            diabetes=any('diabetes' in d.lower() for d in request.diagnoses),
            on_bp_medication=any('ace' in m.lower() or 'arb' in m.lower() or 'beta' in m.lower() for m in request.medications)
        )
        risk_scores.append(cv_risk)
        factors.append({
            'category': 'cardiovascular',
            'score': cv_risk['overall_score'],
            'level': cv_risk['risk_level'],
            'model': cv_risk['model']
        })
        recommendations.extend(cv_risk['recommendations'])
    
    # 2. Readmission Risk
    if age:
        readmission_risk = risk_scoring_engine.calculate_readmission_risk(
            age=int(age),
            number_of_medications=len(request.medications),
            number_of_comorbidities=len(request.diagnoses),
            previous_admissions=vitals.get('previousAdmissions', 0),
            emergency_department_visits=vitals.get('edVisits', 0)
        )
        risk_scores.append(readmission_risk)
        factors.append({
            'category': 'readmission',
            'score': readmission_risk['overall_score'],
            'level': readmission_risk['risk_level'],
            'model': readmission_risk['model']
        })
        recommendations.extend(readmission_risk['recommendations'])
    
    # 3. Medication Adherence Risk
    if request.medications:
        medication_frequencies = [vitals.get(f'med_{i}_frequency', 'once daily') for i in range(len(request.medications))]
        adherence_risk = risk_scoring_engine.calculate_adherence_risk(
            number_of_medications=len(request.medications),
            medication_frequency=medication_frequencies,
            patient_age=int(age) if age else None,
            cognitive_impairment=any('dementia' in d.lower() or 'alzheimers' in d.lower() for d in request.diagnoses),
            cost_concerns=vitals.get('costConcerns', False)
        )
        risk_scores.append(adherence_risk)
        factors.append({
            'category': 'adherence',
            'score': adherence_risk['overall_score'],
            'level': adherence_risk['risk_level'],
            'model': adherence_risk['model']
        })
        recommendations.extend(adherence_risk['recommendations'])
    
    # Calculate overall risk (average of all scores, weighted)
    if risk_scores:
        overall_score = sum(r['overall_score'] for r in risk_scores) / len(risk_scores)
        
        # Determine overall risk level
        risk_levels = [r['risk_level'] for r in risk_scores]
        if 'critical' in risk_levels:
            overall_risk_level = 'critical'
        elif 'high' in risk_levels:
            overall_risk_level = 'high'
        elif 'moderate' in risk_levels:
            overall_risk_level = 'moderate'
        else:
            overall_risk_level = 'low'
    else:
        overall_score = 0.0
        overall_risk_level = 'unknown'
        recommendations.append('Insufficient data for risk calculation - provide age, vitals, medications, and diagnoses')
    
    # Perform trend analysis if historical data available
    trends = None
    print(f"[CDSS] Trend analysis check - historical_vitals: {len(request.historical_vitals) if request.historical_vitals else 0}")
    if request.historical_vitals and len(request.historical_vitals) > 0:
        try:
            current_vitals_with_date = {
                **request.vitals,
                'recordedAt': datetime.now().isoformat()
            }
            print(f"[CDSS] Calling analyze_vital_trends with {len(request.historical_vitals)} historical vitals")
            vital_trends = trend_analysis_engine.analyze_vital_trends(
                current_vitals_with_date,
                request.historical_vitals
            )
            print(f"[CDSS] analyze_vital_trends returned: has_trends={vital_trends.get('has_trends')}, trends_count={len(vital_trends.get('trends', {}))}")
            # Always include trends if we have any trend data
            if vital_trends.get('trends') and len(vital_trends.get('trends', {})) > 0:
                trends = vital_trends
                print(f"[CDSS] ✅ Setting trends - {len(vital_trends.get('trends', {}))} trend entries")
                # Add trend-based recommendations
                if vital_trends.get('alerts'):
                    recommendations.extend(vital_trends['alerts'])
            elif vital_trends.get('has_trends'):
                trends = vital_trends
                print(f"[CDSS] ✅ Setting trends (has_trends=True)")
                if vital_trends.get('alerts'):
                    recommendations.extend(vital_trends['alerts'])
            else:
                print(f"[CDSS] ⚠️ No trends detected - has_trends={vital_trends.get('has_trends')}, trends keys: {list(vital_trends.get('trends', {}).keys())}")
        except Exception as e:
            print(f"[CDSS] ❌ Error in trend analysis: {e}")
            import traceback
            traceback.print_exc()
    
    # Analyze visit patterns
    visit_patterns = None
    print(f"[CDSS] Visit pattern check - visit_history: {len(request.visit_history) if request.visit_history else 0}")
    if request.visit_history and len(request.visit_history) > 0:
        try:
            print(f"[CDSS] Calling analyze_visit_patterns with {len(request.visit_history)} visits")
            visit_patterns = trend_analysis_engine.analyze_visit_patterns(request.visit_history)
            print(f"[CDSS] analyze_visit_patterns returned: has_patterns={visit_patterns.get('has_patterns')}")
            if visit_patterns.get('has_patterns'):
                patterns = visit_patterns.get('patterns', {})
                print(f"[CDSS] ✅ Setting visit_patterns")
                if patterns.get('visit_frequency', {}).get('alert'):
                    recommendations.append(patterns['visit_frequency']['alert'])
            else:
                print(f"[CDSS] ⚠️ No visit patterns detected")
        except Exception as e:
            print(f"[CDSS] ❌ Error in visit pattern analysis: {e}")
            import traceback
            traceback.print_exc()
    
    # RAG-enhanced Guideline Citations
    guideline_citations = []
    if diagnostic_assistant.rag_engine:
        # Collect terms to search for based on high risks and diagnoses
        search_terms = []
        # Add high risk diagnoses/conditions
        for d in request.diagnoses:
            search_terms.append(d)
        
        # Add high risk factors
        for f in factors:
            if f.get('level') in ['high', 'critical'] or f.get('impact') in ['major', 'critical']:
                # Extract simplified term from factor text if possible
                factor_text = f.get('factor', '')
                if 'Hypertension' in factor_text:
                    search_terms.append('Hypertension management')
                elif 'Diabetes' in factor_text:
                    search_terms.append('Diabetes management')
                elif 'Cholesterol' in factor_text:
                    search_terms.append('Dyslipidemia management')
                elif 'Adherence' in factor_text:
                    search_terms.append('Medication adherence strategies')
                else:
                    search_terms.append(factor_text)
        
        # Deduplicate terms
        search_terms = list(dict.fromkeys(search_terms))
        
        if search_terms:
            # Query for the top 3 most relevant terms
            query_terms = search_terms[:3]
            query = f"Clinical guidelines for {', '.join(query_terms)}"
            try:
                print(f"[CDSS] Querying RAG for risk guidelines: {query}")
                retrieved_docs = diagnostic_assistant.rag_engine.query(query, n_results=3)
                if retrieved_docs:
                    guideline_citations = retrieved_docs
                    # Also add a general recommendation if we found citations
                    recommendations.append("Review AI-retrieved clinical guidelines for high-risk factors")
            except Exception as e:
                print(f"[CDSS] RAG query for risk guidelines failed: {e}")

    # Remove duplicates from recommendations
    unique_recommendations = list(dict.fromkeys(recommendations))
    
    # Build response with trend data
    response_data = {
        'overall_score': round(overall_score, 2),
        'risk_level': overall_risk_level,
        'factors': factors,
        'recommendations': unique_recommendations,
        'guideline_citations': guideline_citations
    }
    
    # Add trend data if available (as additional fields not in response model)
    print(f"[CDSS] Before adding to response - trends: {trends is not None}, visit_patterns: {visit_patterns is not None}")
    if trends:
        response_data['trends'] = trends
        print(f"[CDSS] ✅ Added trends to response_data")
    if visit_patterns:
        response_data['visit_patterns'] = visit_patterns
        print(f"[CDSS] ✅ Added visit_patterns to response_data")
    
    print(f"[CDSS] Final response_data keys: {list(response_data.keys())}")
    print(f"[CDSS] response_data has trends: {'trends' in response_data}")
    print(f"[CDSS] response_data has visit_patterns: {'visit_patterns' in response_data}")
    
    # Return as dict to include trend data (will be validated separately)
    return response_data


# Dosing Recommendations
class DosingRequest(BaseModel):
    drug_name: str = Field(..., description="Drug name or ID")
    patient_age: int = Field(..., description="Patient age in years")
    patient_weight_kg: Optional[float] = Field(None, description="Patient weight in kg")
    patient_gender: Optional[str] = Field(None, description="Patient gender")
    eGFR: Optional[float] = Field(None, description="Estimated GFR (mL/min/1.73m²)")
    serum_creatinine: Optional[float] = Field(None, description="Serum creatinine (mg/dL)")
    crCl: Optional[float] = Field(None, description="Creatinine clearance (mL/min)")
    hepatic_function: Optional[str] = Field(None, description="Hepatic function status")
    standard_dose: Optional[float] = Field(None, description="Standard dose to adjust from")


@app.post("/dosing/recommend")
async def recommend_dosing(request: DosingRequest):
    """
    Provide dosing recommendations based on:
    - Patient demographics (age, weight, gender)
    - Organ function (renal, hepatic)
    - Drug pharmacokinetics
    
    Calculates optimal dose considering:
    - Weight-based dosing
    - Renal function adjustments (Cockcroft-Gault)
    - Age-based adjustments (pediatric/geriatric)
    - Hepatic function considerations
    """
    result = dosing_calculator.recommend_dosing(
        drug_name=request.drug_name,
        patient_age=request.patient_age,
        patient_weight_kg=request.patient_weight_kg,
        patient_gender=request.patient_gender,
        eGFR=request.eGFR,
        serum_creatinine=request.serum_creatinine,
        crCl=request.crCl,
        hepatic_function=request.hepatic_function,
        standard_dose=request.standard_dose
    )
    
    return {
        "recommended_dose": result['recommended_dose'],
        "frequency": result['frequency'],
        "adjustments": result['adjustments'],
        "warnings": result['warnings'],
        "monitoring": result['monitoring'],
        "drug_name": result['drug_name']
    }


# Diagnostic Assistance
class DiagnosisRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of presenting symptoms")
    vitals: Optional[Dict[str, Any]] = Field(None, description="Vital signs")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")


class IntelligentDiagnosisRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of presenting symptoms")
    vitals: Optional[Dict[str, Any]] = Field(None, description="Vital signs")
    clinical_notes: Optional[str] = Field(None, description="Free-text clinical notes, chief complaint, history")
    patient_data: Optional[Dict[str, Any]] = Field(None, description="Structured patient data (for MedBERT)")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")
    labs: Optional[Dict[str, Any]] = Field(None, description="Lab results")
    conditions: Optional[List[str]] = Field(None, description="Existing conditions")


class PatientSummaryRequest(BaseModel):
    clinical_notes: List[str] = Field(..., description="List of historical clinical notes")
    age: int = Field(..., description="Patient age")
    gender: str = Field(..., description="Patient gender")
    recent_vitals: Optional[Dict[str, Any]] = Field(None, description="Most recent vital signs")


@app.post("/diagnosis/suggest")
async def suggest_diagnosis(request: DiagnosisRequest):
    """
    Diagnostic assistance based on:
    - Presenting symptoms (pattern matching)
    - Vital signs analysis
    - Patient demographics
    
    Returns differential diagnoses with probability scores, recommended tests, and clinical red flags
    
    Note: This endpoint uses rule-based CDSS only. For AI-enhanced diagnostics, use /diagnosis/suggest/intelligent
    """
    result = diagnostic_assistant.suggest_diagnosis(
        symptoms=request.symptoms,
        vitals=request.vitals,
        age=request.age,
        gender=request.gender
    )
    
    return {
        "suggested_diagnoses": result['suggested_diagnoses'],
        "confidence_scores": result['confidence_scores'],
        "recommended_tests": result['recommended_tests'],
        "red_flags": result['red_flags'],
        "vitals_clues": result.get('vitals_clues', []),
        "source": "rule_based_cdss"
    }


@app.post("/diagnosis/suggest/intelligent")
async def intelligent_diagnosis(request: IntelligentDiagnosisRequest):
    """
    Intelligent diagnostic assistance combining:
    - Rule-based CDSS (pattern matching, guidelines)
    - MedBERT (structured EHR data analysis)
    - ClinicalBERT (clinical notes analysis)
    
    Returns fused recommendations with confidence scores, source attribution, and explanations
    
    This is the "thinking" CDSS that combines rule-based logic with AI models for enhanced accuracy.
    """
    # Prepare patient data for MedBERT
    patient_data = request.patient_data or {}
    if request.age:
        patient_data['age'] = request.age
    if request.gender:
        patient_data['gender'] = request.gender
    if request.vitals:
        patient_data['vitals'] = request.vitals
    if request.labs:
        patient_data['labs'] = request.labs
    if request.conditions:
        patient_data['conditions'] = request.conditions
    
    # Get intelligent suggestions
    result = await diagnostic_assistant.intelligent_suggest(
        symptoms=request.symptoms,
        vitals=request.vitals,
        clinical_notes=request.clinical_notes,
        patient_data=patient_data if patient_data else None,
        age=request.age,
        gender=request.gender
    )
    
    return {
        "suggested_diagnoses": result.get('suggested_diagnoses', []),
        "confidence": result.get('confidence', 'moderate'),
        "recommended_tests": result.get('recommended_tests', []),
        "red_flags": result.get('red_flags', []),
        "vitals_clues": result.get('vitals_clues', []),
        "guideline_citations": result.get('guideline_citations', []),
        "source": result.get('source', 'hybrid_cdss_ai'),
        "ai_enabled": result.get('ai_enabled', False),
        "ai_models_used": result.get('ai_models_used', {}),
        "rule_based_contributions": result.get('rule_based_contributions', 0),
        "ai_contributions": result.get('ai_contributions', 0),
        "total_sources": result.get('total_sources', 1),
        "explanation": result.get('explanation', 'Combined results from rule-based CDSS and AI models')
    }


@app.post("/patient/summarize")
async def summarize_patient_history(request: PatientSummaryRequest):
    """
    Generate a concise "One-Liner" summary of the patient's history using LLM.
    Useful for patient headers and quick context.
    """
    demographics = {"age": request.age, "gender": request.gender}
    
    return await diagnostic_assistant.summarize_patient_history(
        clinical_notes=request.clinical_notes,
        demographics=demographics,
        recent_vitals=request.recent_vitals
    )


# Forecast Glucose Endpoint
@app.post("/forecast/glucose")
async def forecast_glucose(request: Dict[str, Any]):
    """
    Forecast future glucose levels using Exponential Smoothing (Holt-Winters).
    Requires at least 5 historical data points.
    """
    try:
        historical_glucose = request.get('historical_glucose', [])
        days = request.get('days', 7)
        
        return trend_analysis_engine.analyze_glucose_forecast(
            historical_glucose=historical_glucose,
            days_to_forecast=days
        )
    except Exception as e:
        print(f"Error in glucose forecasting: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Trend Analysis Endpoint
@app.post("/trends/analyze")
async def analyze_trends(request: Dict[str, Any]):
    """
    Analyze trends in patient data:
    - Vital sign trends
    - Visit patterns
    - Care gaps
    - Treatment response
    - Lab trends (Viral Load, CD4)
    """
    try:
        current_vitals = request.get('current_vitals', {})
        historical_vitals = request.get('historical_vitals', [])
        visit_history = request.get('visit_history', [])
        patient_age = request.get('patient_age')
        patient_gender = request.get('patient_gender')
        diagnoses = request.get('diagnoses', [])
        current_condition = request.get('current_condition')
        lab_history = request.get('lab_history', []) # New field
        
        results = {}
        
        # Vital trends
        if current_vitals and historical_vitals:
            results['vital_trends'] = trend_analysis_engine.analyze_vital_trends(
                current_vitals, historical_vitals
            )
        
        # Lab Trends (specifically for HIV/TB)
        if lab_history:
            results['lab_trends'] = {}
            for lab_type in ['cd4', 'viral_load']:
                trend = trend_analysis_engine.analyze_lab_trends(lab_history, lab_type)
                if trend.get('has_trend'):
                    results['lab_trends'][lab_type] = trend
        
        # Visit patterns
        if visit_history:
            results['visit_patterns'] = trend_analysis_engine.analyze_visit_patterns(visit_history)
        
        # Care gaps
        if visit_history:
            results['care_gaps'] = trend_analysis_engine.detect_care_gaps(
                patient_age, patient_gender, visit_history, diagnoses
            )
        
        # Treatment response
        if current_condition and visit_history:
            results['treatment_response'] = trend_analysis_engine.analyze_treatment_response(
                current_condition, visit_history
            )
        
        return results
    except Exception as e:
        print(f"Error in trend analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Care Gap Detection Endpoint
@app.post("/care-gaps/detect")
async def detect_care_gaps(request: Dict[str, Any]):
    """
    Detect care gaps:
    - Missing screenings
    - Overdue vaccinations
    - Missing follow-ups
    - Preventive care reminders
    """
    try:
        patient_age = request.get('patient_age')
        patient_gender = request.get('patient_gender')
        visit_history = request.get('visit_history', [])
        diagnoses = request.get('diagnoses', [])
        
        gaps = trend_analysis_engine.detect_care_gaps(
            patient_age, patient_gender, visit_history, diagnoses
        )
        
        return gaps
    except Exception as e:
        print(f"Error in care gap detection: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Lab Result Interpreter Endpoint
class LabResultsRequest(BaseModel):
    lab_results: Dict[str, Any] = Field(..., description="Current lab results {test_name: value}")
    historical_labs: Optional[List[Dict[str, Any]]] = Field(None, description="Historical lab results for trend analysis")
    patient_id: Optional[str] = Field(None, description="Patient ID")


@app.post("/labs/interpret")
async def interpret_lab_results(request: LabResultsRequest):
    """
    Interpret lab results:
    - Abnormal value detection
    - Critical alerts
    - Trend analysis
    - Reference range checking
    """
    try:
        result = lab_interpreter.analyze_lab_results(
            lab_results=request.lab_results,
            historical_labs=request.historical_labs
        )
        
        return result
    except Exception as e:
        print(f"Error in lab interpretation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Duplicate Therapy Detection Endpoint
class DuplicateTherapyRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of current medications")
    prescriptions: Optional[List[Dict[str, Any]]] = Field(None, description="Prescription history for overlap checking")


@app.post("/medications/duplicates")
async def detect_duplicate_therapy(request: DuplicateTherapyRequest):
    """
    Detect duplicate therapy:
    - Exact duplicates
    - Same-class duplicates
    - Therapeutic duplications
    - Overlapping prescriptions
    """
    try:
        result = duplicate_detector.detect_duplicates(request.medications)
        
        # Check for overlapping prescriptions if provided
        if request.prescriptions:
            overlap_result = duplicate_detector.check_overlapping_prescriptions(request.prescriptions)
            result['overlapping_prescriptions'] = overlap_result
        
        return result
    except Exception as e:
        print(f"Error in duplicate therapy detection: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# High-Risk Medication Flags Endpoint
class HighRiskMedicationRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of medications to check")
    patient_age: Optional[int] = Field(None, description="Patient age")
    patient_gender: Optional[str] = Field(None, description="Patient gender")
    diagnoses: Optional[List[str]] = Field(None, description="Patient diagnoses")
    renal_function: Optional[float] = Field(None, description="eGFR or CrCl (mL/min)")


@app.post("/medications/high-risk")
async def check_high_risk_medications(request: HighRiskMedicationRequest):
    """
    Check medications against:
    - Beers Criteria (elderly inappropriate medications)
    - STOPP Criteria (potentially inappropriate prescriptions)
    - High-alert medication flags
    """
    try:
        result = high_risk_detector.check_high_risk_medications(
            medications=request.medications,
            patient_age=request.patient_age,
            patient_gender=request.patient_gender,
            diagnoses=request.diagnoses or [],
            renal_function=request.renal_function
        )
        
        return result
    except Exception as e:
        print(f"Error in high-risk medication checking: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class FoodInteractionRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of current medications")


@app.post("/hiv/testing/algorithm")
async def process_hiv_testing_algorithm(request: Dict[str, Any]):
    """
    Process HIV test results through Zimbabwe National HIV Testing Algorithm.
    """
    try:
        from hiv_testing_algorithm import hiv_testing_algorithm
        tests = request.get('tests', [])
        result = hiv_testing_algorithm.process_test_sequence(tests)
        return result
    except Exception as e:
        print(f"Error in HIV testing algorithm: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/medications/food-interactions")
async def check_food_interactions(request: FoodInteractionRequest):
    """
    Check for common drug–food interactions:
    - Grapefruit juice (CYP3A4 inhibition)
    - Warfarin–vitamin K foods
    - MAOI–tyramine foods
    - Alcohol cautions
    """
    try:
        return food_interaction_checker.check(request.medications)
    except Exception as e:
        print(f"Error in food interaction checking: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    generate_soap: bool = True
):
    """
    Transcribe audio (voice consultation) and optionally generate SOAP notes.
    Supports English, Shona, and Ndebele.
    """
    if not voice_scribe:
        raise HTTPException(status_code=503, detail="Voice service unavailable")
    
    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        temp_path = temp_file.name
    
    try:
        # Transcribe
        transcription_result = voice_scribe.transcribe_audio(temp_path)
        
        if "error" in transcription_result:
             raise HTTPException(status_code=500, detail=transcription_result["error"])
        
        result = {
            "transcription": transcription_result,
            "soap_note": None
        }
        
        # Generate SOAP if requested
        if generate_soap:
            soap_result = await voice_scribe.generate_soap_note(transcription_result["text"])
            result["soap_note"] = soap_result
            
        return result
        
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

