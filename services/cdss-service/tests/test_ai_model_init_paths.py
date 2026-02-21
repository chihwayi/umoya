from ai_models import clinicalbert_diagnostic as clinicalbert_module
from ai_models import medbert_predictor as medbert_module
from ai_models.clinicalbert_diagnostic import ClinicalBERTDiagnostic
from ai_models.medbert_predictor import MedBERTPredictor


def test_medbert_loads_from_cache_when_ai_enabled(monkeypatch):
    monkeypatch.setattr(medbert_module, "TRANSFORMERS_AVAILABLE", True)
    monkeypatch.setattr(medbert_module, "TERMINOLOGY_AVAILABLE", False)
    monkeypatch.setattr(medbert_module, "is_ai_enabled", lambda: True)

    cached_model = object()
    cached_tokenizer = object()
    cache = {
        "medbert_cached-model": {
            "model": cached_model,
            "tokenizer": cached_tokenizer,
        }
    }
    monkeypatch.setattr(medbert_module, "get_model_cache", lambda: cache)

    predictor = MedBERTPredictor(model_name="cached-model")
    assert predictor.model is cached_model
    assert predictor.tokenizer is cached_tokenizer


def test_clinicalbert_loads_from_cache_when_ai_enabled(monkeypatch):
    monkeypatch.setattr(clinicalbert_module, "TRANSFORMERS_AVAILABLE", True)
    monkeypatch.setattr(clinicalbert_module, "TERMINOLOGY_AVAILABLE", False)
    monkeypatch.setattr(clinicalbert_module, "is_ai_enabled", lambda: True)
    monkeypatch.setattr(clinicalbert_module, "LLMProvider", lambda: None)

    cached_model = object()
    cached_tokenizer = object()
    cached_classifier = object()
    cache = {
        "clinicalbert_cached-model": {
            "model": cached_model,
            "tokenizer": cached_tokenizer,
            "classifier": cached_classifier,
        }
    }
    monkeypatch.setattr(clinicalbert_module, "get_model_cache", lambda: cache)

    diagnostic = ClinicalBERTDiagnostic(model_name="cached-model")
    assert diagnostic.model is cached_model
    assert diagnostic.tokenizer is cached_tokenizer
    assert diagnostic.classifier is cached_classifier


class _DummyToken:
    def __init__(self, lemma: str):
        self.lemma_ = lemma


class _DummyChunk:
    def __init__(self, text: str):
        self.text = text


class _DummyDoc:
    def __init__(self, lemmas, chunks):
        self._tokens = [_DummyToken(lemma) for lemma in lemmas]
        self.noun_chunks = [_DummyChunk(chunk) for chunk in chunks]

    def __iter__(self):
        return iter(self._tokens)


def test_clinicalbert_lemma_extraction_populates_symptoms(monkeypatch):
    monkeypatch.setattr(clinicalbert_module, "TRANSFORMERS_AVAILABLE", False)
    monkeypatch.setattr(clinicalbert_module, "TERMINOLOGY_AVAILABLE", False)
    monkeypatch.setattr(clinicalbert_module, "is_ai_enabled", lambda: False)

    diagnostic = ClinicalBERTDiagnostic()
    diagnostic.nlp = lambda _: _DummyDoc(["dyspnea"], [])

    entities = diagnostic._extract_entities_lightweight("Patient reports dyspnea.")
    assert "shortness_of_breath" in entities["symptoms"]
    assert any(item.get("name") == "shortness_of_breath" for item in entities["symptom_details"])


def test_clinicalbert_phrase_extraction_populates_symptoms(monkeypatch):
    monkeypatch.setattr(clinicalbert_module, "TRANSFORMERS_AVAILABLE", False)
    monkeypatch.setattr(clinicalbert_module, "TERMINOLOGY_AVAILABLE", False)
    monkeypatch.setattr(clinicalbert_module, "is_ai_enabled", lambda: False)

    diagnostic = ClinicalBERTDiagnostic()
    diagnostic.nlp = lambda _: _DummyDoc([], ["chest pain", "shortness of breath"])

    entities = diagnostic._extract_entities_lightweight("Chest pain with shortness of breath.")
    assert "chest_pain" in entities["symptoms"]
    assert "shortness_of_breath" in entities["symptoms"]
