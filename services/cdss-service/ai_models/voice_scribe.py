import os
import logging
from typing import Dict, Any, Optional
from faster_whisper import WhisperModel
from .llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class VoiceScribe:
    """
    Voice-to-Text engine using Faster-Whisper and Auto-SOAP generation.
    Supports English, Shona, and Ndebele transcription and translation.
    """
    
    def __init__(self):
        self.model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        self.device = os.getenv("WHISPER_DEVICE", "cpu") 
        self.compute_type = "int8" 
        self.model = None
        self.llm_provider = LLMProvider()
        
        try:
            logger.info(f"Loading Whisper model ({self.model_size}) on {self.device}...")
            # download_root can be configured to cache models persistently
            self.model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type)
            logger.info("Whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")

    def transcribe_audio(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio file to text.
        """
        if not self.model:
            return {"error": "Whisper model not initialized"}
        
        try:
            # Transcribe
            # language=None enables auto-detection
            # Map 'auto' to None for Whisper
            whisper_lang = None if language == 'auto' else language
            
            segments, info = self.model.transcribe(audio_path, beam_size=5, language=whisper_lang)
            
            transcript_text = ""
            for segment in segments:
                transcript_text += segment.text + " "
            
            return {
                "text": transcript_text.strip(),
                "language": info.language,
                "language_probability": round(info.language_probability, 2),
                "duration": round(info.duration, 2)
            }
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {"error": str(e)}

    async def generate_soap_note(self, transcript: str) -> Dict[str, Any]:
        """
        Convert transcript to SOAP note using LLM.
        Handles English, Shona, and Ndebele by asking LLM to translate/summarize in English.
        """
        if not transcript:
            return {"error": "No transcript provided"}

        schema = """
        {
            "subjective": "Patient's complaints and history (in English)",
            "objective": "Physical findings and vitals (in English)",
            "assessment": "Diagnosis or differential diagnosis (in English)",
            "plan": "Treatment plan and follow-up (in English)",
            "original_language_detected": "Language detected in transcript (e.g., English, Shona, Ndebele)"
        }
        """

        prompt = f"""
        You are an expert medical scribe.
        The following text is a transcription of a medical consultation. 
        It may be in English, Shona, or Ndebele (or a mix).
        
        TRANSCRIPT:
        "{transcript}"
        
        Task:
        1. Analyze the transcript.
        2. Extract the Subjective, Objective, Assessment, and Plan (SOAP) components.
        3. Translate any non-English content (Shona/Ndebele) into professional medical English.
        4. Format the output as a structured JSON object.
        """
        
        result = await self.llm_provider.generate_json(prompt, schema)
        return result or {"error": "Failed to generate SOAP note"}
