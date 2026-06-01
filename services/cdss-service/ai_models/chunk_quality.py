"""
Chunk quality helpers for guideline RAG.

Clinical PDFs carry a lot of "back matter" — reference lists, bibliographies,
acknowledgments, endorsing-society lists, tables of contents — that repeat clinical
keywords (so BM25/keyword search ranks them highly) but contain NO actionable clinical
guidance. Surfacing those to a nurse is noise. These helpers detect such low-value
chunks (so they can be filtered at ingestion and at query time) and clean raw PDF
extraction artifacts (URLs, "Cited Here | Google Scholar", "91 of 170", timestamps).
"""
import re

# --- low-value (non-clinical back-matter) detection ---------------------------------
_CITATION_TOKENS_RE = re.compile(
    r'\bet al\.|\bdoi:|\bGoogle Scholar\b|\bCited Here\b|\bPubMed\b|\bJ\s+[A-Z][a-z]+\s+\d{4}\b',
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r'\b(?:19|20)\d{2}\b')
_NUMBERED_ENTRY_RE = re.compile(r'(?:^|\n)\s*\d{1,3}[\.\)]\s')
_ACK_RE = re.compile(
    r'\b(?:endorsed by|acknowledg|conflict of interest|sponsoring societ|we (?:thank|wish to thank)|'
    r'the panel (?:thanks|wishes|completed)|special thanks)\b',
    re.IGNORECASE,
)
_ORG_RE = re.compile(r'\b(?:Society|Association|Federation|College of|Institute|Academy)\b')


def is_low_value_text(text: str) -> bool:
    """True for reference lists, bibliographies, acknowledgments, society/TOC pages."""
    if not text:
        return True
    t = text.strip()
    if len(t) < 60:
        return True

    lower = t.lower()
    gscholar = lower.count("google scholar")
    cited_here = lower.count("cited here")
    citation_tokens = len(_CITATION_TOKENS_RE.findall(t))

    # Reference list / bibliography: repeated citation machinery.
    if gscholar >= 2 or cited_here >= 2 or citation_tokens >= 4:
        return True

    # Acknowledgments / endorsements paired with a list of organisations.
    if _ACK_RE.search(t) and len(_ORG_RE.findall(t)) >= 3:
        return True

    # A pure list of societies/organisations (endorsement block).
    if len(_ORG_RE.findall(t)) >= 6:
        return True

    # Dense numbered-citation block (e.g. "29. Author ... 2024 30. Author ... 2015").
    if len(_NUMBERED_ENTRY_RE.findall(t)) >= 4 and len(_YEAR_RE.findall(t)) >= 4:
        return True

    return False


# --- PDF extraction artifact cleaning ----------------------------------------------
_URL_RE = re.compile(r'https?://\S+')
_CITED_HERE_RE = re.compile(r'(?:•\s*)?Cited Here\s*\|?\s*(?:•\s*)?(?:Google Scholar)?', re.IGNORECASE)
_PAGE_OF_RE = re.compile(r'\b\d{1,4}\s+of\s+\d{1,4}\b')
_TIMESTAMP_RE = re.compile(r'\d{1,2}/\d{1,2}/\d{2,4},?\s*\d{1,2}:\d{2}')
_MULTISPACE_RE = re.compile(r'[ \t]{2,}')
_MULTINEWLINE_RE = re.compile(r'\n{3,}')


def clean_chunk_text(text: str) -> str:
    """Strip common PDF-extraction noise so chunk text reads cleanly to a clinician."""
    if not text:
        return text or ""
    t = text
    t = _URL_RE.sub('', t)
    t = _CITED_HERE_RE.sub('', t)
    t = _TIMESTAMP_RE.sub('', t)
    t = _PAGE_OF_RE.sub('', t)
    t = _MULTISPACE_RE.sub(' ', t)
    t = _MULTINEWLINE_RE.sub('\n\n', t)
    return t.strip()
