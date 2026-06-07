#!/usr/bin/env python3
"""
Simple Whisper API Server for Local Use
Run with: python whisper-server.py
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
import uvicorn

app = FastAPI(title="Umoya Voice Scribe API")

PORT = int(os.getenv("PORT", 8000))

# Enable CORS
# Load allowed origins from environment variable, default to "*" if not set (for development)
cors_origins_env = os.getenv("CORS_ORIGINS")
allowed_origins = cors_origins_env.split(",") if cors_origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # In production, restrict to your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model (change 'base' to 'tiny', 'small', 'medium', or 'large')
# First run will download the model automatically
print("Loading Whisper model...")
model = whisper.load_model("base")  # Start with 'base' for good balance
print("Model loaded successfully!")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "model": "base"}

@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    temperature: float = Form(0.0),
    prompt: str = Form("")
):
    """
    Transcribe audio file using Whisper
    
    Args:
        audio: Audio file (WAV, MP3, M4A, etc.)
        language: Language code ('en', 'sn', 'nd') or 'auto' for auto-detect
        temperature: Sampling temperature (0.0-1.0)
        prompt: Optional prompt to guide transcription
    
    Returns:
        JSON with transcribed text, language, and segments
    """
    tmp_path = None
    try:
        # Validate file type
        if not audio.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{audio.filename.split('.')[-1]}") as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Prepare transcription options
        transcribe_options = {
            "temperature": temperature,
        }
        
        # Add language if specified
        if language and language != "auto":
            transcribe_options["language"] = language
        
        # Add prompt if provided
        if prompt:
            transcribe_options["initial_prompt"] = prompt
        
        # Transcribe
        print(f"Transcribing audio file: {audio.filename}")
        result = model.transcribe(tmp_path, **transcribe_options)
        
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        return {
            "text": result["text"],
            "rawText": result["text"],
            "language": result.get("language", language if language != "auto" else "en"),
            "segments": [
                {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"]
                }
                for seg in result.get("segments", [])
            ]
        }
        
    except Exception as e:
        # Clean up on error
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        print(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

if __name__ == "__main__":
    HOST = os.getenv("HOST", "0.0.0.0")
    print(f"Starting Whisper API server on port {PORT}")
    print(f"API Documentation: http://{HOST}:{PORT}/docs")
    uvicorn.run(app, host=HOST, port=PORT)
