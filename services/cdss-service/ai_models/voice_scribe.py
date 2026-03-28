import os
import logging
from typing import Dict, Any, Optional
try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
except ImportError:
    WhisperModel = None  # type: ignore
    FASTER_WHISPER_AVAILABLE = False
from .llm_provider import LLMProvider
from privacy_guard import redact_text

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
        self.llm_provider = None
        try:
            self.llm_provider = LLMProvider()
        except Exception as e:
            logger.warning(f"Failed to initialize LLM provider for SOAP generation: {e}")

        if not FASTER_WHISPER_AVAILABLE:
            logger.error("faster_whisper dependency unavailable; voice transcription disabled.")
            return
        
        try:
            logger.info(f"Loading Whisper model ({self.model_size}) on {self.device}...")
            # download_root can be configured to cache models persistently
            self.model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type)
            logger.info("Whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")

    def _normalize_language_code(self, value: Optional[str], fallback: str = "en") -> str:
        token = str(value or "").strip().lower()
        mapping = {
            "en": "en",
            "eng": "en",
            "english": "en",
            "sn": "sn",
            "shona": "sn",
            "nd": "nd",
            "ndebele": "nd",
            "auto": "en",
        }
        normalized = mapping.get(token)
        if normalized:
            return normalized
        fallback_norm = mapping.get(str(fallback or "").strip().lower())
        return fallback_norm or "en"

    def _normalize_soap_payload(self, payload: Any, detected_language: str) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            payload = {}

        def _field(name: str) -> str:
            value = payload.get(name)
            if isinstance(value, str) and value.strip():
                return value.strip()
            return "Not provided"

        return {
            "subjective": _field("subjective"),
            "objective": _field("objective"),
            "assessment": _field("assessment"),
            "plan": _field("plan"),
            "original_language_detected": self._normalize_language_code(
                payload.get("original_language_detected"),
                detected_language,
            ),
        }

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

            detected_language = self._normalize_language_code(getattr(info, "language", None), "en")
            
            return {
                "text": transcript_text.strip(),
                "language": detected_language,
                "raw_language_detected": getattr(info, "language", None),
                "language_probability": round(info.language_probability, 2),
                "duration": round(info.duration, 2)
            }
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {"error": str(e)}

    async def generate_soap_note(
        self,
        transcript: str,
        detected_language: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Convert transcript to SOAP note using LLM.
        Handles English, Shona, and Ndebele by asking LLM to translate/summarize in English.
        """
        if not transcript:
            return {"error": "No transcript provided"}
        if not self.llm_provider:
            return {"error": "SOAP generation unavailable"}

        schema = """
        {
            "subjective": "Patient's complaints and history (in English)",
            "objective": "Physical findings and vitals (in English)",
            "assessment": "Diagnosis or differential diagnosis (in English)",
            "plan": "Treatment plan and follow-up (in English)",
            "original_language_detected": "Language detected in transcript (e.g., English, Shona, Ndebele)"
        }
        """

        safe_transcript = redact_text(transcript)

        prompt = f"""
        You are an expert medical scribe.
        The following text is a transcription of a medical consultation. 
        It may be in English, Shona, or Ndebele (or a mix).
        
        TRANSCRIPT:
        "{safe_transcript}"
        
        Task:
        1. Analyze the transcript.
        2. Extract the Subjective, Objective, Assessment, and Plan (SOAP) components.
        3. Translate any non-English content (Shona/Ndebele) into professional medical English.
        4. Format the output as a structured JSON object.
        """
        
        result = await self.llm_provider.generate_json(
            prompt,
            schema,
            use_case="voice_soap_generation",
            tenant_id=tenant_id,
        )
        normalized_lang = self._normalize_language_code(detected_language, "en")
        if not result:
            return self._normalize_soap_payload({}, normalized_lang)
        return self._normalize_soap_payload(result, normalized_lang)
