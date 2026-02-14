"""
MediCore Clinical Decision Support System (CDSS) Service
Python FastAPI microservice for advanced clinical reasoning
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Form, Request, Response
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
import hashlib
import json
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
from settings_provider import SettingsProvider
import jwt
import threading
import pathlib
import redis as redis_pkg
from uuid import uuid4
from threading import Lock

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

# Settings Provider (Master DB)
settings_provider = None
try:
    settings_provider = SettingsProvider()
except Exception as e:
    print(f"SettingsProvider initialization failed (will use env defaults only): {e}")

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
_INGEST_JOBS = {}
_INGEST_LOCK = Lock()

def require_owner(request: Request, response: Response, x_owner_email: str = Header(None), authorization: str = Header(None)) -> str:
    """
    Owner gating with JWT verification:
    - Prefer Authorization: Bearer <token>, extract email from JWT, check against OWNER_EMAILS
    - Fallback to X-Owner-Email only if JWT not present
    """
    allow = os.getenv("OWNER_EMAILS", "")
    allowed = [e.strip().lower() for e in allow.split(",") if e.strip()]
    # Try JWT first
    email_from_jwt = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        secret = os.getenv("JWT_SECRET", "medicore-super-secret-key")
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            email_from_jwt = str(payload.get("email") or payload.get("sub") or "").lower()
        except Exception:
            email_from_jwt = None
    # Rate limiting helper using Redis (if available)
    def _rate_limit(email: str):
        try:
            limit_per_min = int(os.getenv("ADMIN_RATE_LIMIT_PER_MIN", "60"))
            if limit_per_min <= 0:
                return
            # Use RAG engine's Redis if available, else try new client
            r = None
            try:
                if diagnostic_assistant and diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
                    r = diagnostic_assistant.rag_engine.redis_client
                else:
                    redis_url = os.getenv("REDIS_URL")
                    if redis_url:
                        r = redis_pkg.from_url(redis_url, decode_responses=True)
                    else:
                        host = os.getenv("REDIS_HOST", "localhost")
                        port = int(os.getenv("REDIS_PORT", 6379))
                        r = redis_pkg.Redis(host=host, port=port, db=0, decode_responses=True)
            except Exception:
                r = None
            if not r:
                return
            path = request.url.path
            minute = datetime.utcnow().strftime("%Y%m%d%H%M")
            key = f"ratelimit:admin:{email}:{path}:{minute}"
            count = r.incr(key)
            if count == 1:
                r.expire(key, 60)
            try:
                ttl = r.ttl(key)
            except Exception:
                ttl = 60
            remaining = max(0, limit_per_min - count)
            try:
                response.headers["X-RateLimit-Limit"] = str(limit_per_min)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                response.headers["X-RateLimit-Reset"] = str(ttl if isinstance(ttl, int) and ttl >= 0 else 60)
            except Exception:
                pass
            if count > limit_per_min:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
        except HTTPException:
            raise
        except Exception:
            # Fail-open on rate limit errors
            return
    if email_from_jwt:
        if email_from_jwt in allowed:
            _rate_limit(email_from_jwt)
            return email_from_jwt
        else:
            raise HTTPException(status_code=403, detail="Owner access required (JWT)")
    # Fallback header
    if not x_owner_email or x_owner_email.lower() not in allowed:
        raise HTTPException(status_code=403, detail="Owner access required")
    _rate_limit(x_owner_email.lower())
    return x_owner_email.lower()

@app.get("/admin/status")
async def admin_status(owner: str = Depends(require_owner)):
    llm = {
        "enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
        "model": os.getenv("LLM_MODEL_NAME"),
        "api_url": os.getenv("LLM_API_URL")
    }
    if diagnostic_assistant and diagnostic_assistant.llm_provider:
        try:
            llm["model"] = diagnostic_assistant.llm_provider.model_name
            llm["enabled"] = diagnostic_assistant.llm_provider.enabled
            llm["api_url"] = diagnostic_assistant.llm_provider.base_url
        except Exception:
            pass

    rag = {
        "enabled": diagnostic_assistant.rag_engine is not None,
        "documents": None,
        "cache_enabled": False
    }
    try:
        if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.collection:
            rag["documents"] = diagnostic_assistant.rag_engine.collection.count()
        if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
            rag["cache_enabled"] = True
    except Exception:
        pass

    return {"llm": llm, "rag": rag}

class SettingsPayload(BaseModel):
    llm_enabled: Optional[bool] = None
    llm_api_url: Optional[str] = None
    llm_model_name: Optional[str] = None
    rag_enabled: Optional[bool] = None
    cache_ttl_seconds: Optional[int] = None
    cache_namespace: Optional[str] = None
    allow_pdf_uploads: Optional[bool] = None

@app.get("/admin/settings")
async def get_admin_settings(owner: str = Depends(require_owner)):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    return settings_provider.get_settings()

@app.put("/admin/settings")
async def update_admin_settings(payload: SettingsPayload, owner: str = Depends(require_owner)):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    # Basic data validation
    data = {k: v for k, v in payload.dict().items() if v is not None}
    if "cache_ttl_seconds" in data and (not isinstance(data["cache_ttl_seconds"], int) or data["cache_ttl_seconds"] < 0):
        raise HTTPException(status_code=400, detail="cache_ttl_seconds must be a non-negative integer")
    updated = settings_provider.set_settings(data, actor=owner, action="update_settings")
    return {"settings": updated}

def _run_ingest(job_id: str = None):
    ok = False
    err = None
    try:
        from ingest_guidelines import ingest_guidelines
        ingest_guidelines()
        ok = True
    except Exception as e:
        err = str(e)
    finally:
        if job_id:
            try:
                with _INGEST_LOCK:
                    job = _INGEST_JOBS.get(job_id)
                    if job:
                        job["status"] = "completed" if ok else "failed"
                        job["finished_at"] = datetime.utcnow().isoformat()
                        job["message"] = None if ok else err
                        _INGEST_JOBS[job_id] = job
            except Exception:
                pass

@app.post("/admin/ingest")
async def admin_ingest(file: UploadFile | None = File(None), owner: str = Depends(require_owner)):
    if settings_provider:
        s = settings_provider.get_settings()
        if not s.get("allow_pdf_uploads", True) and file is not None:
            raise HTTPException(status_code=403, detail="PDF uploads disabled")
    if file is not None:
        target_dir = pathlib.Path(__file__).resolve().parent / "who-smart-guidelines" / "dak"
        target_dir.mkdir(parents=True, exist_ok=True)
        dest = target_dir / file.filename
        content = await file.read()
        with open(dest, "wb") as f:
            f.write(content)
    job_id = str(uuid4())
    with _INGEST_LOCK:
        _INGEST_JOBS[job_id] = {
            "jobId": job_id,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "message": None
        }
    t = threading.Thread(target=_run_ingest, args=(job_id,), daemon=True)
    t.start()
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="ingest_start", payload={"filename": getattr(file, 'filename', None), "jobId": job_id})
        except Exception:
            pass
    return {"started": True, "jobId": job_id}

@app.post("/admin/reindex")
async def admin_reindex(owner: str = Depends(require_owner)):
    if not diagnostic_assistant or not diagnostic_assistant.rag_engine:
        raise HTTPException(status_code=503, detail="RAG engine unavailable")
    try:
        ce = diagnostic_assistant.rag_engine
        if ce.chroma_client:
            ce.chroma_client.delete_collection("medical_guidelines")
            ce.collection = ce.chroma_client.get_or_create_collection("medical_guidelines")
            ce._build_bm25_index()
        count = ce.collection.count() if ce.collection else 0
        if settings_provider:
            try:
                settings_provider.log_action(actor=owner, action="reindex", payload={"documents": count})
            except Exception:
                pass
        return {"reindexed": True, "documents": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/ingest/jobs")
async def admin_ingest_jobs(limit: int = 20, owner: str = Depends(require_owner)):
    with _INGEST_LOCK:
        arr = list(_INGEST_JOBS.values())
    arr.sort(key=lambda x: x.get("started_at") or "", reverse=True)
    return {"jobs": arr[:limit], "limit": limit}

@app.get("/admin/ingest/status/{job_id}")
async def admin_ingest_status(job_id: str, owner: str = Depends(require_owner)):
    with _INGEST_LOCK:
        job = _INGEST_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/admin/ingest/retry/{job_id}")
async def admin_ingest_retry(job_id: str, owner: str = Depends(require_owner)):
    with _INGEST_LOCK:
        existing = _INGEST_JOBS.get(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")
    if existing.get("status") == "running":
        raise HTTPException(status_code=409, detail="Job is still running")
    new_id = str(uuid4())
    with _INGEST_LOCK:
        _INGEST_JOBS[new_id] = {
            "jobId": new_id,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "message": None,
            "retry_of": job_id
        }
    t = threading.Thread(target=_run_ingest, args=(new_id,), daemon=True)
    t.start()
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="ingest_retry", payload={"retry_of": job_id, "jobId": new_id})
        except Exception:
            pass
    return {"started": True, "jobId": new_id, "retry_of": job_id}
@app.post("/admin/cache/flush")
async def admin_cache_flush(owner: str = Depends(require_owner)):
    if not diagnostic_assistant or not diagnostic_assistant.rag_engine:
        return {"flushed": 0}
    ce = diagnostic_assistant.rag_engine
    if not ce.redis_client:
        return {"flushed": 0}
    namespace = "cdss"
    if settings_provider:
        try:
            namespace = settings_provider.get_settings().get("cache_namespace", "cdss")
        except Exception:
            pass
    pattern_list = [f"{namespace}:*", "rag:*", "llm:*"]
    deleted = 0
    for pattern in pattern_list:
        try:
            for key in ce.redis_client.scan_iter(match=pattern):
                ce.redis_client.delete(key)
                deleted += 1
        except Exception:
            continue
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="cache_flush", payload={"deleted": deleted})
        except Exception:
            pass
    return {"flushed": deleted}

@app.post("/admin/metrics/reset")
async def admin_metrics_reset(owner: str = Depends(require_owner)):
    ce = diagnostic_assistant.rag_engine if diagnostic_assistant else None
    if not ce or not ce.redis_client:
        return {"reset": 0}
    keys = [
        "metrics:rag:cache_hit",
        "metrics:rag:cache_miss",
        "metrics:llm:cache_hit",
        "metrics:llm:cache_miss",
    ]
    reset = 0
    try:
        for k in keys:
            ce.redis_client.delete(k)
            reset += 1
    except Exception:
        pass
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="metrics_reset", payload={"reset": reset})
        except Exception:
            pass
    return {"reset": reset}

@app.get("/admin/metrics")
async def admin_metrics(owner: str = Depends(require_owner)):
    docs = None
    cache_keys = 0
    rag_cache_hit = 0
    rag_cache_miss = 0
    llm_cache_hit = 0
    llm_cache_miss = 0
    ce = diagnostic_assistant.rag_engine if diagnostic_assistant else None
    if ce and ce.collection:
        try:
            docs = ce.collection.count()
        except Exception:
            docs = None
    if ce and ce.redis_client:
        try:
            cache_keys = len(list(ce.redis_client.scan_iter(match="*")))
            try:
                val = ce.redis_client.get("metrics:rag:cache_hit")
                rag_cache_hit = int(val or 0)
            except Exception:
                rag_cache_hit = 0
            try:
                val = ce.redis_client.get("metrics:rag:cache_miss")
                rag_cache_miss = int(val or 0)
            except Exception:
                rag_cache_miss = 0
            try:
                val = ce.redis_client.get("metrics:llm:cache_hit")
                llm_cache_hit = int(val or 0)
            except Exception:
                llm_cache_hit = 0
            try:
                val = ce.redis_client.get("metrics:llm:cache_miss")
                llm_cache_miss = int(val or 0)
            except Exception:
                llm_cache_miss = 0
        except Exception:
            cache_keys = 0
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="metrics_view", payload={"documents": docs, "cache_keys": cache_keys})
        except Exception:
            pass
    def _rate(h, m):
        total = h + m
        return round((h / total) * 100, 2) if total > 0 else 0.0
    return {
        "documents": docs,
        "cache_keys": cache_keys,
        "rag_cache": {"hit": rag_cache_hit, "miss": rag_cache_miss, "hit_rate_percent": _rate(rag_cache_hit, rag_cache_miss)},
        "llm_cache": {"hit": llm_cache_hit, "miss": llm_cache_miss, "hit_rate_percent": _rate(llm_cache_hit, llm_cache_miss)}
    }

class AuditQuery(BaseModel):
    limit: Optional[int] = 50
    offset: Optional[int] = 0

@app.get("/admin/audit")
async def admin_audit(limit: int = 50, offset: int = 0, owner: str = Depends(require_owner)):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    logs = settings_provider.get_audit_logs(limit=limit, offset=offset)
    return {"logs": logs, "limit": limit, "offset": offset}

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
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Patient specific data (vitals, age, gender, conditions)")


@app.post("/guidelines/search")
async def search_guidelines(request: GuidelineSearchRequest):
    """
    Search for clinical guidelines using RAG and optionally generate patient-specific analysis.
    """
    citations = []
    analysis = None
    
    # 1. Retrieve relevant guidelines (RAG)
    if diagnostic_assistant.rag_engine:
        try:
            print(f"[CDSS] Searching guidelines for: {request.query}")
            
            # Construct Metadata Filters (Sprint 2: Context-Aware Retrieval)
            filters = {}
            # NOTE: Metadata filtering disabled to ensure results are returned (metadata tagging might be incomplete)
            # if request.patient_context:
            #     pc = request.patient_context
            #     
            #     # Age-based filtering
            #     age = pc.get('age')
            #     if age is not None:
            #         if isinstance(age, str) and age.isdigit():
            #             age = int(age)
            #             
            #         if isinstance(age, int):
            #             if age < 18:
            #                 filters["target_population"] = "children"
            #             elif age > 65:
            #                 filters["target_population"] = "elderly"
            #     
            #     # Gender/Pregnancy (Overrides age if pregnant)
            #     gender = pc.get('gender', '').lower()
            #     is_pregnant = pc.get('is_pregnant', False) or 'pregnant' in str(pc).lower()
            #     
            #     if is_pregnant and gender in ['female', 'f']:
            #         filters["target_population"] = "pregnant_women"
            
            # Log active filters
            if filters:
                print(f"[CDSS] Applying RAG Filters: {filters}")

            citations = diagnostic_assistant.rag_engine.query(
                request.query, 
                n_results=request.limit,
                filters=filters if filters else None
            )
        except Exception as e:
            print(f"[CDSS] Guideline search failed: {e}")
            
    # 2. Generate Patient-Specific Analysis (LLM) with caching
    if diagnostic_assistant.llm_provider:
        try:
            # Construct context-aware prompt
            context_str = ""
            if request.patient_context:
                context_str = "\n".join([f"{k}: {v}" for k, v in request.patient_context.items()])
            else:
                context_str = "No specific patient context provided. Answer generally."

            guidelines_str = "\n\n".join([f"Source: {c['source']}\n{c['text']}" for c in citations])
            
            prompt = f"""
            You are a clinical decision support assistant. 
            Analyze the following patient case against the provided clinical guidelines.
            
            PATIENT CONTEXT:
            {context_str}
            
            RELEVANT GUIDELINES:
            {guidelines_str[:12000]}
            
            USER QUERY: {request.query}
            
            INSTRUCTIONS:
            1. FIRST, think step-by-step: Analyze the patient's vitals/demographics against the guidelines.
            2. THEN, provide specific recommendations for THIS patient.
            3. Cite the guidelines where appropriate.
            4. Highlight any red flags or immediate actions needed.
            5. Keep it concise and clinically actionable.
            6. If the guidelines provided are not relevant, state that clearly.
            
            FORMAT YOUR RESPONSE AS:
            **Clinical Reasoning:**
            [Step-by-step analysis]
            
            **Recommendation:**
            [Actionable advice]
            """
            analysis = None
            # Cache layer
            cache_client = None
            cache_ttl = 600
            try:
                if settings_provider:
                    cache_ttl = int(settings_provider.get_settings().get("cache_ttl_seconds", 600))
            except Exception:
                cache_ttl = 600
            if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
                cache_client = diagnostic_assistant.rag_engine.redis_client
            cache_key = f"llm:analysis:{hashlib.md5(prompt.encode()).hexdigest()}"
            if cache_client:
                try:
                    cached = cache_client.get(cache_key)
                    if cached:
                        try:
                            cache_client.incr("metrics:llm:cache_hit")
                        except Exception:
                            pass
                        analysis = json.loads(cached)
                except Exception:
                    analysis = None
            if analysis is None:
                print(f"[CDSS] Generating analysis for patient context...")
                analysis = await diagnostic_assistant.llm_provider.generate_response(prompt)
                try:
                    if cache_client:
                        cache_client.incr("metrics:llm:cache_miss")
                except Exception:
                    pass
                # Persist to cache
                if cache_client and analysis:
                    try:
                        cache_client.setex(cache_key, cache_ttl, json.dumps(analysis))
                    except Exception:
                        pass
            
        except Exception as e:
            print(f"[CDSS] LLM analysis failed: {e}")
            analysis = f"Analysis generation failed due to a temporary error: {str(e)}. Please try again."

    return {
        "query": request.query,
        "citations": citations,
        "analysis": analysis,
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
