"""
SADC-First Multilingual Clinical NLP
Primary market: SADC (Southern African Development Community)
Secondary market: Broader Africa
Tertiary: Global

Supports multilingual clinical text including Shona, Ndebele, Zulu, Xhosa,
Swahili, Afrikaans, Portuguese, French, Setswana, Chichewa/Nyanja, Lingala,
Siswati, Xitsonga, Tshivenda, and English, with:
- text normalization and local phrase mapping
- fuzzy matching for spelling variants
- symptom-cluster inference
- negation / history / suspicion context detection
- structured scored output
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, asdict
from difflib import SequenceMatcher
from typing import Dict, List, Set, Tuple, Optional, Any


# =============================================================================
# KNOWLEDGE BASES
# =============================================================================

SADC_TERMINOLOGY: Dict[str, Dict[str, Any]] = {
    "hiv": {
        "canonical_name": "HIV/AIDS",
        "english": ["hiv", "aids", "human immunodeficiency virus", "acquired immunodeficiency syndrome"],
        "shona": ["hiv", "mukondombera", "chirwere chehiv", "mukondobera"],
        "ndebele": ["hiv", "isifo sehiv"],
        "zulu": ["hiv", "isifo se-hiv", "igciwane le-hiv"],
        "xhosa": ["hiv", "isifo se-hiv"],
        "swahili": ["hiv", "ukimwi", "virusi vya ukimwi"],
        "afrikaans": ["hiv", "miv", "menslike immunogebrekvirus"],
        "portuguese": ["hiv", "sida", "vírus da imunodeficiência humana"],
        "setswana": ["hiv", "bolwetse jwa hiv"],
        "chichewa": ["hiv", "matenda a hiv", "edzi"],
        "lingala": ["hiv", "maladi ya hiv", "sida"],
        "siswati": ["hiv", "isifo se-hiv"],
        "xitsonga": ["hiv", "vuvabyi bya hiv"],
        "tshivenda": ["hiv", "vhulwadze ha hiv"],
        "local_terms": ["arv", "antiretroviral", "art", "arvs", "known positive", "hiv positive"],
    },
    "tuberculosis": {
        "canonical_name": "Tuberculosis",
        "english": ["tb", "tuberculosis", "pulmonary tb", "extra-pulmonary tb"],
        "shona": ["tb", "chirwere chepfupa", "pfupa", "tb remapapu"],
        "ndebele": ["tb", "isifo samathambo"],
        "zulu": ["tb", "isifo sezifuba", "uqobo"],
        "xhosa": ["tb", "isifo sephepho"],
        "swahili": ["tb", "kifua kikuu", "ugonjwa wa mapafu"],
        "afrikaans": ["tb", "tuberkulose"],
        "portuguese": ["tb", "tuberculose"],
        "setswana": ["tb", "bolwetse jwa masogo"],
        "chichewa": ["tb", "matenda a ntchestolo", "nfuba"],
        "lingala": ["tb", "maladi ya masɛki"],
        "siswati": ["tb", "isifo sebele"],
        "xitsonga": ["tb", "vuvabyi bya sifuba"],
        "tshivenda": ["tb", "vhulwadze ha sifuba"],
        "local_terms": ["tb treatment", "dot therapy", "isoniazid", "rifampicin"],
    },
    "malaria": {
        "canonical_name": "Malaria",
        "english": ["malaria"],
        "shona": ["malaria", "marariya", "maralia", "chirwere chemalaria"],
        "ndebele": ["malaria", "imalariya"],
        "zulu": ["malaria", "imaleriya"],
        "swahili": ["malaria", "homa ya malaria", "homa kali"],
        "afrikaans": ["malaria"],
        "portuguese": ["malária", "paludismo"],
        "setswana": ["malaria", "maleria"],
        "chichewa": ["malaria", "malungo a malaria"],
        "lingala": ["malaria", "fiévre ya malaria"],
        "siswati": ["malaria", "imaleriya"],
        "xitsonga": ["malaria", "vuvabyi bya malaria"],
        "tshivenda": ["malaria", "vhulwadze ha malaria"],
        "local_terms": ["high fever malaria", "act treatment"],
    },
    "diabetes": {
        "canonical_name": "Diabetes",
        "english": ["diabetes", "diabetic", "diabetes mellitus"],
        "shona": ["diabetes", "chirwere cheshuga", "shuga", "ane sugar"],
        "ndebele": ["diabetes", "isifo sikashukela"],
        "zulu": ["diabetes", "isifo sikashukela", "isifo samathambo obushukela"],
        "swahili": ["kisukari", "ugonjwa wa sukari", "diabetes"],
        "afrikaans": ["diabetes", "suikersiekte"],
        "portuguese": ["diabetes", "diabete", "açúcar no sangue"],
        "setswana": ["diabetes", "bolwetse jwa tshigaro"],
        "chichewa": ["diabetes", "matenda a shuga", "shuga"],
        "lingala": ["diabetes", "maladi ya sukali"],
        "siswati": ["diabetes", "isifo seswekile"],
        "xitsonga": ["diabetes", "vuvabyi bya shukela"],
        "tshivenda": ["diabetes", "vhulwadze ha shukela"],
        "local_terms": ["blood sugar", "high sugar", "sugga", "glucose", "insulin"],
    },
    "hypertension": {
        "canonical_name": "Hypertension",
        "english": ["hypertension", "high blood pressure"],
        "shona": [
            "hypertension", "bp yepamusoro", "blood pressure yepamusoro",
            "bp yakwira", "pressure yepamusoro",
        ],
        "ndebele": ["hypertension", "bp ephezulu"],
        "zulu": ["hypertension", "ingcindezi yegazi ephezulu"],
        "swahili": ["shinikizo la damu", "pressure ya damu", "hypertension"],
        "afrikaans": ["hipertensie", "hoë bloeddruk"],
        "portuguese": ["hipertensão", "pressão alta", "pressão arterial elevada"],
        "setswana": ["kgatelelo e e kwa godimo ya madi", "hypertension"],
        "chichewa": ["kumazetsa kwa magazi", "hypertension"],
        "lingala": ["pression ya makila etomboki", "hypertension"],
        "siswati": ["ingcindezi yegazi lecephele", "hypertension"],
        "xitsonga": ["mpfumelo wa ngati wu tlhandlami", "hypertension"],
        "tshivenda": ["pfushi ya madi yo wedzwa", "hypertension"],
        "local_terms": ["high bp", "bp high", "hbp"],
    },
    "pneumonia": {
        "canonical_name": "Pneumonia",
        "english": ["pneumonia", "chest infection", "lung infection"],
        "shona": ["pneumonia", "chirwere chepfuva"],
        "ndebele": ["pneumonia", "isifo sezifuba"],
        "zulu": ["pneumonia", "isifo sezifuba", "ukugula kwezifuba"],
        "swahili": ["nimonia", "ugonjwa wa mapafu", "kifua"],
        "afrikaans": ["longontsteking", "pneumonie"],
        "portuguese": ["pneumonia", "infecção pulmonar"],
        "setswana": ["pneumonia", "bolwetse jwa maphaphu"],
        "chichewa": ["pneumonia", "matenda a mapumo"],
        "lingala": ["pneumonie", "maladi ya mapɛpɛ"],
        "siswati": ["pneumonia", "isifo semaphaphu"],
        "xitsonga": ["pneumonia", "vuvabyi bya mahelo"],
        "tshivenda": ["pneumonia", "vhulwadze ha mavunde"],
        "local_terms": ["lung infection", "lower respiratory tract infection", "lrti"],
    },
}

# Backward-compatible alias
ZIMBABWE_TERMINOLOGY = SADC_TERMINOLOGY

SHONA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["fivha", "kupisa", "kupisa kwemuviri", "muviri uri kupisa", "temperature"],
    "cough": ["chikosoro", "kukosora", "kukosora zvikuru"],
    "headache": ["musoro", "kurwadza musoro"],
    "chest_pain": ["kurwadza pachipfuva", "chipfuva", "kurwadza pachest"],
    "shortness_of_breath": ["kufemuka", "kushaya mweya", "ari kufemuka"],
    "abdominal_pain": ["kurwadza mudumbu", "dumbu", "kurwadza nhumbu"],
    "nausea": ["kusvotwa", "kuda kurutsa"],
    "vomiting": ["kurutsa"],
    "diarrhea": ["manyoka", "kuita manyoka"],
    "fatigue": ["kuneta", "kushaya simba", "kudhakwa"],
    "dizziness": ["kudzungaira"],
    "joint_pain": ["kurwadza mabvi", "kurwadza majoini"],
    "weight_loss": ["kuonda", "kuderera uremu", "weight loss"],
    "night_sweats": ["kudikitira usiku", "night sweats"],
    "thirst": ["nyota", "nyota yakanyanya"],
    "frequent_urination": ["kuita weti kakawanda", "kukashura kakawanda"],
    "blurred_vision": ["kuona zvisina kujeka"],
    "chills": ["chando", "kukurumidza kupisa"],
    "body_aches": ["kurwadza muviri", "body pains"],
    "hemoptysis": ["kukosora ropa", "anokosora ropa", "coughing blood"],
    "swollen_lymph_nodes": ["gogodzviro", "swollen glands"],
}

NDEBELE_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["umkhuhlane", "ubushushu"],
    "cough": ["ukukhwehlela"],
    "headache": ["ubuhlungu bekhanda"],
    "chest_pain": ["ubuhlungu esifubeni"],
    "shortness_of_breath": ["ukuphefumula nzima", "ukuphefumula"],
    "abdominal_pain": ["ubuhlungu esiswini"],
    "nausea": ["ukugula"],
    "vomiting": ["ukuhlanza"],
    "diarrhea": ["uhudo", "ukuchama"],
    "fatigue": ["ukukhathala"],
    "dizziness": ["ukudangala"],
    "joint_pain": ["ubuhlungu emalungwini"],
    "weight_loss": ["ukwehla komzimba"],
    "night_sweats": ["ukujuluka ebusuku"],
    "thirst": ["ukoma"],
    "frequent_urination": ["ukuchama kanengi"],
    "blurred_vision": ["ukubona kufiphala"],
    "chills": ["ukuqhaqhazela"],
    "body_aches": ["ubuhlungu bomzimba"],
    "hemoptysis": ["ukukhwehlela igazi"],
    "swollen_lymph_nodes": ["amaglandisi akhukhumele"],
}

SWAHILI_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["homa", "joto la mwili", "joto kali"],
    "cough": ["kikohozi", "kukohoa"],
    "headache": ["maumivu ya kichwa", "kichwa kuuma"],
    "chest_pain": ["maumivu ya kifua", "kifua kuuma"],
    "shortness_of_breath": ["kupumua kwa shida", "upungufu wa pumzi"],
    "abdominal_pain": ["maumivu ya tumbo", "tumbo kuuma"],
    "nausea": ["kichefuchefu", "kujisikia kichefuchefu"],
    "vomiting": ["kutapika"],
    "diarrhea": ["kuhara", "tumbo la kuhara"],
    "fatigue": ["uchovu", "udhaifu", "nguvu chache"],
    "dizziness": ["kizunguzungu", "kuchanganyikiwa"],
    "joint_pain": ["maumivu ya viungo"],
    "weight_loss": ["kupoteza uzito", "uzito kupungua"],
    "night_sweats": ["jasho la usiku"],
    "thirst": ["kiu", "kiu kali"],
    "frequent_urination": ["kukojoa mara kwa mara"],
    "blurred_vision": ["kuona kwa ukungu", "macho kuona vibaya"],
    "chills": ["baridi ya ghafla", "kutetemeka"],
    "body_aches": ["maumivu ya mwili", "mwili kuuma"],
    "hemoptysis": ["kutoa damu ukikohoa", "kohozi la damu"],
    "swollen_lymph_nodes": ["tezi kuvimba", "nodi za limfu kuvimba"],
}

ZULU_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["umkhuhlane", "ukushisa komzimba", "umzimba ushisa"],
    "cough": ["ukukhwehlela", "ukhwehlelo"],
    "headache": ["ikhanda elibuhlungu", "ubuhlungu bekhanda"],
    "chest_pain": ["ubuhlungu esifubeni", "isifuba esibuhlungu"],
    "shortness_of_breath": ["ukuphefumula nzima", "ukuntuleka komoya"],
    "abdominal_pain": ["ubuhlungu esiswini", "isisu esibuhlungu"],
    "nausea": ["isicefe", "ukuzwa isicefe"],
    "vomiting": ["ukuhlanza", "ukuphalaza"],
    "diarrhea": ["uhudo", "ukuhuda"],
    "fatigue": ["ukukhathala", "ukudiniwa", "ubudedengu"],
    "dizziness": ["ukuzungeza", "ukudangala"],
    "joint_pain": ["ubuhlungu emalungwini", "amalunga abuhlungu"],
    "weight_loss": ["ukwehlela komzimba", "ukuncipha komzimba"],
    "night_sweats": ["ukujuluka ebusuku"],
    "thirst": ["ukoma", "ukwoma kakhulu"],
    "frequent_urination": ["ukuchama kaningi"],
    "blurred_vision": ["ukubona kufiphele"],
    "chills": ["ukuqhaqhazela", "umzimba uyaqhaqhazela"],
    "body_aches": ["ubuhlungu bomzimba", "umzimba ubuhlungu"],
    "hemoptysis": ["igazi ekhwehlelweni", "ukukhwehlela igazi"],
    "swollen_lymph_nodes": ["amaglandisi avuvukile"],
}

AFRIKAANS_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["koors", "verhoogde liggaamstemperatuur"],
    "cough": ["hoes", "hoestery"],
    "headache": ["hoofpyn"],
    "chest_pain": ["borspyn", "pyn in die bors"],
    "shortness_of_breath": ["asemhaling moeilik", "kortasem"],
    "abdominal_pain": ["maagpyn", "buikpyn"],
    "nausea": ["naarheid", "naar voel"],
    "vomiting": ["braking", "opgooi"],
    "diarrhea": ["diarree", "maagloop"],
    "fatigue": ["moegheid", "uitputting"],
    "dizziness": ["duiseligheid", "duiselig"],
    "joint_pain": ["gewrigspyn"],
    "weight_loss": ["gewigsverlies"],
    "night_sweats": ["nagsweetery"],
    "thirst": ["dors", "baie dors"],
    "frequent_urination": ["gereelde urinering"],
    "blurred_vision": ["waasige sig"],
    "chills": ["koue rillings"],
    "body_aches": ["liggaamspyne", "lyf pyn"],
    "hemoptysis": ["bloed hoes", "bloed in slym"],
    "swollen_lymph_nodes": ["geswolle kliere"],
}

SETSWANA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["feberu", "go baba ga mmele", "bogare jwa mmele jo bo kwa godimo"],
    "cough": ["go gôfa", "gôfa"],
    "headache": ["boêmô jwa tlhogo", "tlhogo e e opang"],
    "chest_pain": ["boêmô jwa sefuba", "sefuba se se opang"],
    "shortness_of_breath": ["go phefola ka thata", "tlhokego ya moya"],
    "abdominal_pain": ["boêmô jwa mpa", "mpa e e opang"],
    "nausea": ["go gakala", "go ikutlwa o gakala"],
    "vomiting": ["go rutha", "go bua ka molomo"],
    "diarrhea": ["meetse a mpa", "go ya gare ga meetse"],
    "fatigue": ["go lapisa", "go nona", "go lesega"],
    "dizziness": ["go sisiwa ke tlhogo", "tlhogo e sisimetsa"],
    "joint_pain": ["maoto a a opang", "ditho di di opang"],
    "weight_loss": ["go hupafala ga boima", "boima jwa mmele bo bo fokolang"],
    "night_sweats": ["go tshologa ditsêlê bosigo"],
    "thirst": ["lenyora", "lenyora le le tona"],
    "frequent_urination": ["go tsamaya gopotsa"],
    "blurred_vision": ["go bona ga go itekanela"],
    "chills": ["go roroma", "mogote o o otseng"],
    "body_aches": ["mmele o o opang", "botshe jwa mmele"],
    "hemoptysis": ["go gôfa madi", "madi mo go gôfeng"],
    "swollen_lymph_nodes": ["mangwana a a rurugang"],
}

CHICHEWA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["malungo", "thupi lofunda", "kutentha kwa thupi"],
    "cough": ["chifuwa", "kukohola"],
    "headache": ["kutsimuka mutu", "mutu kuwawa"],
    "chest_pain": ["mkosi kuwawa", "mkosi kupweteka"],
    "shortness_of_breath": ["kupuma mosavuta", "kupanda mpweya"],
    "abdominal_pain": ["mimba kuwawa", "mimba kupweteka"],
    "nausea": ["kufuna kusanza", "kuyipa kwa mimba"],
    "vomiting": ["kusanza", "kuphwanya"],
    "diarrhea": ["kutsekula", "matumbo"],
    "fatigue": ["kutopa", "kufooka", "kusowa mphamvu"],
    "dizziness": ["kuizungulira", "mutu kuzungulira"],
    "joint_pain": ["mfundo kuwawa", "mapewa kupweteka"],
    "weight_loss": ["kuchepuka", "kufooka thupi"],
    "night_sweats": ["kutuluka thukuta usiku"],
    "thirst": ["ludzu", "ludzu la madzi"],
    "frequent_urination": ["kukodza kawirikawiri"],
    "blurred_vision": ["kuona mosavomerezeka", "maso kuona bwino yayi"],
    "chills": ["kunjenjemera", "kutetemera"],
    "body_aches": ["thupi kuwawa", "kupweteka kwa thupi"],
    "hemoptysis": ["kukohola magazi", "magazi pakohola"],
    "swollen_lymph_nodes": ["nodi zawotcha", "makoswe owotcha"],
}

LINGALA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["fiévre", "nzoto ya moto", "nzoto ekiimá"],
    "cough": ["kɔfɔ", "kolɔlɔ"],
    "headache": ["motó ebunga", "motó ewela"],
    "chest_pain": ["libumu ya ntolo ebeta", "ntolo mawa"],
    "shortness_of_breath": ["kouma mosika", "mpema ekabwi"],
    "abdominal_pain": ["libumu ebeta", "libumu ewela"],
    "nausea": ["koyoka bɔɔngɔ", "koyoka pɔɔle"],
    "vomiting": ["kobɛta", "kolɔtɔ"],
    "diarrhea": ["libumu ya mai", "kotɔ mingi"],
    "fatigue": ["kolɛmba", "komɛlɛmɛlɛ", "nguya ezalaka te"],
    "dizziness": ["motó eyokani", "kozungana"],
    "joint_pain": ["nzoto ya mabɔkɔ mawa", "elongi mawa"],
    "weight_loss": ["kokolama", "nzoto ekóki"],
    "night_sweats": ["kolɔtɔ na butu"],
    "thirst": ["mposa ya mai", "mposa mingi"],
    "frequent_urination": ["kobɛtɛla mai mingi"],
    "blurred_vision": ["miso etaleli te", "komona malamu te"],
    "chills": ["kolenga", "nzoto ya mpɔzɔ"],
    "body_aches": ["nzoto ewela", "nzoto mawa nyonso"],
    "hemoptysis": ["kɔfɔ na makila", "kolɔlɔ na makila"],
    "swollen_lymph_nodes": ["nodi ya makolo etumba"],
}

SISWATI_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["umkhuhlane", "kushisa kwemtimba", "umtimba ushisa"],
    "cough": ["ukukhwehlela", "kukhwehlela"],
    "headache": ["inhloko ibuhlungu", "buhlungu bekhanda"],
    "chest_pain": ["libele libuhlungu", "buhlungu esifubeni"],
    "shortness_of_breath": ["kushaywa umoya", "buhlungu ekuphefumuleni"],
    "abdominal_pain": ["esiswini buhlungu", "isisu sibuhlungu"],
    "nausea": ["ukuzwa kubila", "sifuba sekuphuma"],
    "vomiting": ["kuhlanza", "kuphalaza"],
    "diarrhea": ["uhudo", "huda"],
    "fatigue": ["kukhatsala", "kuntula emandla"],
    "dizziness": ["kuzungeza", "inhloko iyazungeza"],
    "joint_pain": ["emilente ibuhlungu", "buhlungu emilenteni"],
    "weight_loss": ["kukhothama komtimba", "lishono lelehla"],
    "night_sweats": ["kukhipha ematuvi ebusuku"],
    "thirst": ["luchago", "luchago lolukhulu"],
    "frequent_urination": ["kuya esindle kanengi"],
    "blurred_vision": ["kubona kufiphela"],
    "chills": ["kugqogqezela", "umtimba uyagqogqezela"],
    "body_aches": ["umtimba ubuhlungu", "emilente ibuhlungu yonke"],
    "hemoptysis": ["kukhwehlela igazi"],
    "swollen_lymph_nodes": ["tiglandula letikhukhumele"],
}

XITSONGA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["xirho", "miri wu hisa", "vutomi bya hisa"],
    "cough": ["kukohola", "kukoha"],
    "headache": ["nhloko yi lova", "nhloko yi pfurha"],
    "chest_pain": ["sifuba si lova", "sifuba si pfurha"],
    "shortness_of_breath": ["ku hema hi ndlela leyi pfumalekaka", "ku pfumala moya"],
    "abdominal_pain": ["ntsongo wu lova", "ntsongo wu pfurha"],
    "nausea": ["ku twisisa hi ndlela yo biha", "ku lava ku hlantsa"],
    "vomiting": ["ku hlantsa", "ku nyurha"],
    "diarrhea": ["ku ya etindlwini kambe na kambe", "matimba ya ntsongo"],
    "fatigue": ["ku karhala", "ku pfumala maatla"],
    "dizziness": ["ku tshoveka wa nhloko", "nhloko yi tshoveka"],
    "joint_pain": ["milenge yi lova", "timilenge ti pfurha"],
    "weight_loss": ["ku helelwa ka ntolovelo", "ntolovelo wu ehla"],
    "night_sweats": ["ku rharhama ebusuku"],
    "thirst": ["nzara ya mati", "nzara yo tika"],
    "frequent_urination": ["ku ya etindlwini kakalo"],
    "blurred_vision": ["ku vona hi ndlela leyo sava"],
    "chills": ["ku titimela", "miri wu titimela"],
    "body_aches": ["miri wu lova hinkwawo", "milenge yi pfurha hinkwayo"],
    "hemoptysis": ["ku kohola na ngati", "ngati eka kukohola"],
    "swollen_lymph_nodes": ["tiglandi ti khulumiwa"],
}

TSHIVENDA_SYMPTOMS: Dict[str, List[str]] = {
    "fever": ["fivha", "muvhili u tshima", "muvhili u fhisa"],
    "cough": ["u khokhola", "kukhokhola"],
    "headache": ["ndevhelo i rwa", "muawo wa ndevhelo"],
    "chest_pain": ["sifuba i rwa", "muawo wa sifuba"],
    "shortness_of_breath": ["u hema nga thavhelo", "u shandukwa ha moya"],
    "abdominal_pain": ["thumbu i rwa", "muawo wa thumbu"],
    "nausea": ["u swika na u ita masimu", "u khou ita masimu"],
    "vomiting": ["u ita masimu", "u vhomisa"],
    "diarrhea": ["u thulusa", "thumbu ya mvula"],
    "fatigue": ["u neta", "u shandukwa ha maatla"],
    "dizziness": ["ndevhelo i tshimbila", "u tshimbila-tshimbila"],
    "joint_pain": ["migodo i rwa", "muawo wa migodo"],
    "weight_loss": ["u lenga", "u fhungudza murole"],
    "night_sweats": ["u tukula vhusiku"],
    "thirst": ["nzara ya mvula", "nzara khulwane"],
    "frequent_urination": ["u ya thoidzi zwinzhi"],
    "blurred_vision": ["u vhona zwi sa tsha leluwa"],
    "chills": ["u titimela", "muvhili u titimela"],
    "body_aches": ["muvhili u rwa hothe", "muawo wa muvhili"],
    "hemoptysis": ["u khokhola na madi", "madi kha u khokhola"],
    "swollen_lymph_nodes": ["maglande a khomedzwa"],
}

SADC_DISEASE_PATTERNS: Dict[str, Dict[str, Any]] = {
    "HIV/AIDS": {
        "common_symptoms": ["fever", "fatigue", "weight_loss", "cough", "diarrhea", "swollen_lymph_nodes"],
        "prevalence": "high",
        "base_probability_multiplier": 1.20,
    },
    "Tuberculosis": {
        "common_symptoms": [
            "cough", "fever", "weight_loss", "night_sweats", "chest_pain", "hemoptysis", "fatigue",
        ],
        "prevalence": "high",
        "base_probability_multiplier": 1.15,
    },
    "Malaria": {
        "common_symptoms": ["fever", "chills", "headache", "body_aches", "fatigue", "vomiting"],
        "prevalence": "high",
        "base_probability_multiplier": 1.20,
    },
    "Diabetes": {
        "common_symptoms": ["frequent_urination", "thirst", "fatigue", "blurred_vision", "weight_loss"],
        "prevalence": "moderate",
        "base_probability_multiplier": 1.00,
    },
    "Hypertension": {
        "common_symptoms": ["headache", "dizziness", "chest_pain"],
        "prevalence": "moderate",
        "base_probability_multiplier": 1.00,
    },
    "Pneumonia": {
        "common_symptoms": ["cough", "fever", "chest_pain", "shortness_of_breath"],
        "prevalence": "moderate",
        "base_probability_multiplier": 1.00,
    },
}

# Backward-compatible alias
ZIMBABWE_DISEASE_PATTERNS = SADC_DISEASE_PATTERNS


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class MatchResult:
    name: str
    canonical_name: str
    score: float
    source_term: str
    source_language: str
    match_type: str
    negated: bool = False
    historical: bool = False
    suspected: bool = False


@dataclass
class ConditionResult:
    name: str
    score: float
    reason: str
    matched_terms: List[str]
    matched_symptoms: List[str]
    negated: bool = False
    historical: bool = False
    suspected: bool = False


# =============================================================================
# MAIN ENGINE
# =============================================================================

class SadcClinicalNLP:
    """
    SADC-first multilingual clinical NLP for mixed-language clinical text.

    Primary market: SADC (English, Afrikaans, Swahili, Portuguese, French,
                           Zulu, Xhosa, Shona, Ndebele, Malagasy,
                           Setswana, Chichewa/Nyanja, Lingala,
                           Siswati, Xitsonga, Tshivenda)
    Secondary: Broader Africa (Amharic, Hausa, Yoruba, Somali, …)
    Tertiary: Global

    Supports:
    - text normalization and local-phrase mapping
    - fuzzy matching for spelling variants and typing mistakes
    - symptom extraction with per-symptom scoring
    - direct condition name extraction
    - symptom-cluster inference (e.g. cough + night_sweats + weight_loss → TB)
    - negation / history / suspicion context detection
    - HIV/TB co-infection flag (clinically important across SADC)
    - structured scored output via analyze()
    """

    NEGATIONS: Set[str] = {
        "no", "not", "without", "denies", "deny", "negative",
        "hapana", "kwete", "pasina", "haana", "hatina",
        "kasi", "akula", "akasina",
    }

    HISTORY_MARKERS: Set[str] = {
        "history of", "past", "previous", "known", "background of",
        "akambo", "akambova", "ane nhoroondo ye",
        "wake waba", "used to have",
    }

    SUSPICION_MARKERS: Set[str] = {
        "possible", "suspected", "query", "?", "r/o",
        "rule out", "probable", "cannot exclude",
        "fungidzira", "suspect", "maybe",
    }

    # Local phrase → canonical term (applied during normalization)
    _PHRASE_MAP: Dict[str, str] = {
        "bp yakwira": "hypertension",
        "bp yepamusoro": "hypertension",
        "blood pressure yepamusoro": "hypertension",
        "pressure yepamusoro": "hypertension",
        "high bp": "hypertension",
        "bp high": "hypertension",
        "ane sugar": "diabetes",
        "high sugar": "diabetes",
        "sugga": "diabetes",
        "blood sugar": "diabetes",
        "muviri uri kupisa": "fever",
        "kupisa kwemuviri": "fever",
        "tb remapapu": "pulmonary tb",
        "anokosora ropa": "hemoptysis",
        "kukosora ropa": "hemoptysis",
        "coughing blood": "hemoptysis",
        "kurutsa nemanyoka": "vomiting diarrhea",
        "ari kufemuka": "shortness of breath",
    }

    def __init__(
        self,
        terminology: Optional[Dict[str, Dict[str, Any]]] = None,
        shona_symptoms: Optional[Dict[str, List[str]]] = None,
        ndebele_symptoms: Optional[Dict[str, List[str]]] = None,
        zulu_symptoms: Optional[Dict[str, List[str]]] = None,
        swahili_symptoms: Optional[Dict[str, List[str]]] = None,
        afrikaans_symptoms: Optional[Dict[str, List[str]]] = None,
        setswana_symptoms: Optional[Dict[str, List[str]]] = None,
        chichewa_symptoms: Optional[Dict[str, List[str]]] = None,
        lingala_symptoms: Optional[Dict[str, List[str]]] = None,
        siswati_symptoms: Optional[Dict[str, List[str]]] = None,
        xitsonga_symptoms: Optional[Dict[str, List[str]]] = None,
        tshivenda_symptoms: Optional[Dict[str, List[str]]] = None,
        disease_patterns: Optional[Dict[str, Dict[str, Any]]] = None,
        fuzzy_threshold: float = 0.88,
    ) -> None:
        self.terminology = terminology or SADC_TERMINOLOGY
        self.shona_symptoms = shona_symptoms or SHONA_SYMPTOMS
        self.ndebele_symptoms = ndebele_symptoms or NDEBELE_SYMPTOMS
        self.zulu_symptoms = zulu_symptoms or ZULU_SYMPTOMS
        self.swahili_symptoms = swahili_symptoms or SWAHILI_SYMPTOMS
        self.afrikaans_symptoms = afrikaans_symptoms or AFRIKAANS_SYMPTOMS
        self.setswana_symptoms = setswana_symptoms or SETSWANA_SYMPTOMS
        self.chichewa_symptoms = chichewa_symptoms or CHICHEWA_SYMPTOMS
        self.lingala_symptoms = lingala_symptoms or LINGALA_SYMPTOMS
        self.siswati_symptoms = siswati_symptoms or SISWATI_SYMPTOMS
        self.xitsonga_symptoms = xitsonga_symptoms or XITSONGA_SYMPTOMS
        self.tshivenda_symptoms = tshivenda_symptoms or TSHIVENDA_SYMPTOMS
        self.disease_patterns = disease_patterns or SADC_DISEASE_PATTERNS
        self.fuzzy_threshold = fuzzy_threshold

        self.english_symptoms = self._build_english_symptom_aliases()
        self.condition_alias_index = self._build_condition_alias_index()
        self.symptom_alias_index = self._build_symptom_alias_index()

    # -------------------------------------------------------------------------
    # PUBLIC API
    # -------------------------------------------------------------------------

    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Full pipeline. Returns a structured dict suitable for API responses.
        """
        normalized = self.normalize_text(text)
        languages = self.detect_language_mix(normalized)

        symptom_matches = self.extract_symptoms(normalized)
        direct_conditions = self.extract_conditions(normalized)
        inferred_conditions = self.infer_conditions_from_symptoms(symptom_matches)
        combined = self.combine_condition_evidence(direct_conditions, inferred_conditions)

        hiv_tb_flag = self._check_hiv_tb_coinfection(combined)

        return {
            "input_text": text,
            "normalized_text": normalized,
            "languages_detected": languages,
            "symptoms_found": [asdict(m) for m in symptom_matches],
            "conditions_direct": [asdict(c) for c in direct_conditions],
            "conditions_inferred": [asdict(c) for c in inferred_conditions],
            "final_conditions": [asdict(c) for c in combined],
            "primary_suspicions": [
                c.name for c in combined if c.score >= 0.60 and not c.negated
            ],
            "hiv_tb_coinfection_flag": hiv_tb_flag,
            "disclaimer": "Rule-based support only. Not a confirmed diagnosis.",
        }

    def extract_symptoms(self, text: str) -> List[MatchResult]:
        text = self.normalize_text(text)
        matches: List[MatchResult] = []

        for symptom_key, alias_entries in self.symptom_alias_index.items():
            best: Optional[MatchResult] = None

            for alias, language in alias_entries:
                score, match_type, source_term = self._match_alias(text, alias)
                if score <= 0:
                    continue

                negated, historical, suspected = self._detect_context(text, alias)
                adjusted = score
                if negated:
                    adjusted *= 0.15
                if historical:
                    adjusted *= 0.60
                if suspected:
                    adjusted *= 0.80

                candidate = MatchResult(
                    name=symptom_key,
                    canonical_name=symptom_key,
                    score=round(adjusted, 3),
                    source_term=source_term,
                    source_language=language,
                    match_type=match_type,
                    negated=negated,
                    historical=historical,
                    suspected=suspected,
                )
                if best is None or candidate.score > best.score:
                    best = candidate

            if best and best.score > 0:
                matches.append(best)

        matches.sort(key=lambda x: x.score, reverse=True)
        return matches

    def extract_conditions(self, text: str) -> List[ConditionResult]:
        text = self.normalize_text(text)
        results: List[ConditionResult] = []

        for condition_key, aliases in self.condition_alias_index.items():
            best_score = 0.0
            matched_terms: List[str] = []
            negated = historical = suspected = False
            canonical = self.terminology[condition_key]["canonical_name"]

            for alias, _lang in aliases:
                score, _, source_term = self._match_alias(text, alias)
                if score <= 0:
                    continue

                a_neg, a_hist, a_susp = self._detect_context(text, alias)
                adjusted = score
                if a_neg:
                    adjusted *= 0.15
                if a_hist:
                    adjusted *= 0.60
                if a_susp:
                    adjusted *= 0.80

                if adjusted > best_score:
                    best_score = adjusted
                    matched_terms = [source_term]
                    negated, historical, suspected = a_neg, a_hist, a_susp
                elif adjusted > 0.80:
                    matched_terms.append(source_term)

            if best_score > 0:
                mult = self.get_zimbabwe_disease_multiplier(canonical)
                final = min(best_score * mult, 1.0)
                results.append(ConditionResult(
                    name=canonical,
                    score=round(final, 3),
                    reason="direct_term_match",
                    matched_terms=list(set(matched_terms)),
                    matched_symptoms=[],
                    negated=negated,
                    historical=historical,
                    suspected=suspected,
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results

    def infer_conditions_from_symptoms(
        self, symptom_matches: List[MatchResult]
    ) -> List[ConditionResult]:
        found = {m.name for m in symptom_matches if m.score >= 0.45 and not m.negated}
        results: List[ConditionResult] = []

        for disease_name, meta in self.disease_patterns.items():
            expected = set(meta.get("common_symptoms", []))
            if not expected:
                continue

            overlap = found.intersection(expected)
            if not overlap:
                continue

            raw = len(overlap) / len(expected)

            # Evidence-based cluster bonuses (clinically validated patterns for Zimbabwe)
            bonus = 0.0
            if disease_name == "Tuberculosis":
                if "hemoptysis" in overlap:
                    bonus += 0.20  # hemoptysis is a strong TB red flag
                if {"cough", "night_sweats", "weight_loss"}.issubset(overlap):
                    bonus += 0.15  # classic TB triad
            if disease_name == "Malaria":
                if {"fever", "chills", "headache"}.issubset(overlap):
                    bonus += 0.15  # classic malaria triad
            if disease_name == "Diabetes":
                if {"thirst", "frequent_urination"}.issubset(overlap):
                    bonus += 0.15  # strong DM cluster
            if disease_name == "HIV/AIDS":
                if {"weight_loss", "fatigue", "diarrhea"}.issubset(overlap):
                    bonus += 0.10  # wasting syndrome

            mult = meta.get("base_probability_multiplier", 1.0)
            final = min((raw + bonus) * mult, 1.0)

            results.append(ConditionResult(
                name=disease_name,
                score=round(final, 3),
                reason="symptom_cluster",
                matched_terms=[],
                matched_symptoms=sorted(list(overlap)),
            ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results

    def combine_condition_evidence(
        self,
        direct: List[ConditionResult],
        inferred: List[ConditionResult],
    ) -> List[ConditionResult]:
        combined: Dict[str, ConditionResult] = {}

        for item in direct:
            combined[item.name] = ConditionResult(
                name=item.name,
                score=item.score,
                reason=item.reason,
                matched_terms=item.matched_terms[:],
                matched_symptoms=item.matched_symptoms[:],
                negated=item.negated,
                historical=item.historical,
                suspected=item.suspected,
            )

        for item in inferred:
            if item.name in combined:
                existing = combined[item.name]
                merged = min(existing.score + item.score * 0.45, 1.0)
                combined[item.name] = ConditionResult(
                    name=item.name,
                    score=round(merged, 3),
                    reason="direct_term_match+symptom_cluster",
                    matched_terms=sorted(set(existing.matched_terms + item.matched_terms)),
                    matched_symptoms=sorted(set(existing.matched_symptoms + item.matched_symptoms)),
                    negated=existing.negated,
                    historical=existing.historical,
                    suspected=existing.suspected,
                )
            else:
                combined[item.name] = item

        results = list(combined.values())
        results.sort(key=lambda x: x.score, reverse=True)
        return results

    # -------------------------------------------------------------------------
    # BACKWARD-COMPATIBLE METHOD WRAPPERS
    # -------------------------------------------------------------------------

    def translate_symptom_to_english(self, text: str) -> str:
        matches = self.extract_symptoms(text)
        if matches:
            return matches[0].name
        return text

    def get_zimbabwe_disease_multiplier(self, diagnosis: str) -> float:
        d = diagnosis.lower()
        for disease, meta in self.disease_patterns.items():
            if disease.lower() in d or d in disease.lower():
                return meta.get("base_probability_multiplier", 1.0)
        return 1.0

    # -------------------------------------------------------------------------
    # NORMALIZATION
    # -------------------------------------------------------------------------

    def normalize_text(self, text: str) -> str:
        text = str(text).lower().strip()
        # Unicode normalization (handles accented chars and compatibility forms)
        text = unicodedata.normalize("NFKD", text)
        # Allow word chars, spaces, hyphens, slashes, question marks
        text = re.sub(r"[^\w\s\/\-\?]", " ", text)
        text = re.sub(r"\s+", " ", text)

        # Apply longest local-phrase replacements first
        for phrase in sorted(self._PHRASE_MAP.keys(), key=len, reverse=True):
            if phrase in text:
                text = text.replace(phrase, self._PHRASE_MAP[phrase])

        return re.sub(r"\s+", " ", text).strip()

    def detect_language_mix(self, text: str) -> List[str]:
        detected: Set[str] = set()
        _checks = [
            ("english", self.english_symptoms),
            ("shona", self.shona_symptoms),
            ("ndebele", self.ndebele_symptoms),
            ("zulu", self.zulu_symptoms),
            ("swahili", self.swahili_symptoms),
            ("afrikaans", self.afrikaans_symptoms),
            ("setswana", self.setswana_symptoms),
            ("chichewa", self.chichewa_symptoms),
            ("lingala", self.lingala_symptoms),
            ("siswati", self.siswati_symptoms),
            ("xitsonga", self.xitsonga_symptoms),
            ("tshivenda", self.tshivenda_symptoms),
        ]
        for lang, symptom_map in _checks:
            if sum(1 for aliases in symptom_map.values() for a in aliases if a in text) > 0:
                detected.add(lang)
        if not detected:
            detected.add("unknown")

        return sorted(detected)

    # -------------------------------------------------------------------------
    # HIV / TB CO-INFECTION CHECK
    # -------------------------------------------------------------------------

    def _check_hiv_tb_coinfection(self, combined: List[ConditionResult]) -> bool:
        """
        Return True when both HIV/AIDS and TB are suspected above threshold.
        SADC has among the world's highest HIV/TB co-infection rates.
        """
        names = {c.name for c in combined if c.score >= 0.50 and not c.negated}
        return "HIV/AIDS" in names and "Tuberculosis" in names

    # -------------------------------------------------------------------------
    # INDEX BUILDERS
    # -------------------------------------------------------------------------

    def _build_english_symptom_aliases(self) -> Dict[str, List[str]]:
        return {
            "fever": ["fever", "high fever", "temperature", "pyrexia"],
            "cough": ["cough", "coughing"],
            "headache": ["headache", "head pain"],
            "chest_pain": ["chest pain", "chest tightness"],
            "shortness_of_breath": ["shortness of breath", "breathless", "difficulty breathing", "dyspnoea"],
            "abdominal_pain": ["abdominal pain", "stomach pain", "belly pain"],
            "nausea": ["nausea", "feeling sick"],
            "vomiting": ["vomiting", "vomit"],
            "diarrhea": ["diarrhea", "diarrhoea", "loose stool", "loose stools"],
            "fatigue": ["fatigue", "tired", "weakness", "weak"],
            "dizziness": ["dizziness", "dizzy", "lightheaded"],
            "joint_pain": ["joint pain", "joint pains"],
            "weight_loss": ["weight loss", "losing weight", "unintentional weight loss"],
            "night_sweats": ["night sweats", "sweating at night"],
            "thirst": ["thirst", "excessive thirst", "polydipsia"],
            "frequent_urination": ["frequent urination", "polyuria", "passing urine often"],
            "blurred_vision": ["blurred vision", "visual disturbance"],
            "chills": ["chills", "shivering", "rigors"],
            "body_aches": ["body aches", "body pains", "myalgia", "muscle pains"],
            "hemoptysis": ["hemoptysis", "haemoptysis", "coughing blood", "blood in sputum"],
            "swollen_lymph_nodes": ["swollen glands", "lymphadenopathy", "swollen lymph nodes"],
        }

    def _build_symptom_alias_index(self) -> Dict[str, List[Tuple[str, str]]]:
        all_symptoms = (
            set(self.shona_symptoms.keys())
            | set(self.ndebele_symptoms.keys())
            | set(self.zulu_symptoms.keys())
            | set(self.swahili_symptoms.keys())
            | set(self.afrikaans_symptoms.keys())
            | set(self.setswana_symptoms.keys())
            | set(self.chichewa_symptoms.keys())
            | set(self.lingala_symptoms.keys())
            | set(self.siswati_symptoms.keys())
            | set(self.xitsonga_symptoms.keys())
            | set(self.tshivenda_symptoms.keys())
            | set(self.english_symptoms.keys())
        )
        index: Dict[str, List[Tuple[str, str]]] = {}
        for sym in all_symptoms:
            entries: List[Tuple[str, str]] = []
            for a in self.english_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "english"))
            for a in self.shona_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "shona"))
            for a in self.ndebele_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "ndebele"))
            for a in self.zulu_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "zulu"))
            for a in self.swahili_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "swahili"))
            for a in self.afrikaans_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "afrikaans"))
            for a in self.setswana_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "setswana"))
            for a in self.chichewa_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "chichewa"))
            for a in self.lingala_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "lingala"))
            for a in self.siswati_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "siswati"))
            for a in self.xitsonga_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "xitsonga"))
            for a in self.tshivenda_symptoms.get(sym, []):
                entries.append((self.normalize_text(a), "tshivenda"))
            index[sym] = entries
        return index

    def _build_condition_alias_index(self) -> Dict[str, List[Tuple[str, str]]]:
        index: Dict[str, List[Tuple[str, str]]] = {}
        _lang_fields = [
            "english", "shona", "ndebele", "zulu", "xhosa", "swahili",
            "afrikaans", "portuguese", "french",
            "setswana", "chichewa", "lingala", "siswati", "xitsonga", "tshivenda",
        ]
        for key, meta in self.terminology.items():
            entries: List[Tuple[str, str]] = []
            for lang in _lang_fields:
                for a in meta.get(lang, []):
                    entries.append((self.normalize_text(a), lang))
            for a in meta.get("local_terms", []):
                entries.append((self.normalize_text(a), "local"))
            index[key] = entries
        return index

    # -------------------------------------------------------------------------
    # MATCHING
    # -------------------------------------------------------------------------

    def _match_alias(self, text: str, alias: str) -> Tuple[float, str, str]:
        if not alias:
            return 0.0, "", ""

        # Exact phrase / term match
        if alias in text:
            if len(alias.split()) > 1:
                return 0.98, "exact_phrase", alias
            return 0.95, "exact_term", alias

        # Fuzzy single-token match
        if len(alias.split()) == 1:
            best_score, best_word = 0.0, ""
            for word in text.split():
                s = SequenceMatcher(None, word, alias).ratio()
                if s > best_score:
                    best_score, best_word = s, word
            if best_score >= self.fuzzy_threshold:
                return round(best_score, 3), "fuzzy_term", best_word

        # Fuzzy n-gram match for multi-word aliases
        alias_tokens = alias.split()
        if len(alias_tokens) > 1:
            text_tokens = text.split()
            w = len(alias_tokens)
            best_score, best_ngram = 0.0, ""
            for i in range(max(1, len(text_tokens) - w + 1)):
                ngram = " ".join(text_tokens[i : i + w])
                s = SequenceMatcher(None, ngram, alias).ratio()
                if s > best_score:
                    best_score, best_ngram = s, ngram
            if best_score >= max(self.fuzzy_threshold, 0.90):
                return round(best_score, 3), "fuzzy_phrase", best_ngram

        return 0.0, "", ""

    # -------------------------------------------------------------------------
    # CONTEXT DETECTION
    # -------------------------------------------------------------------------

    def _detect_context(
        self, text: str, alias: str, window_size: int = 4
    ) -> Tuple[bool, bool, bool]:
        tokens = text.split()
        alias_tokens = alias.split()
        negated = historical = suspected = False

        for i in range(len(tokens) - len(alias_tokens) + 1):
            if tokens[i : i + len(alias_tokens)] == alias_tokens:
                left = tokens[max(0, i - window_size) : i]
                left_str = " ".join(left)

                if any(m in left or m in left_str for m in self.NEGATIONS):
                    negated = True
                if any(m in left_str for m in self.HISTORY_MARKERS):
                    historical = True
                if any(m in left_str for m in self.SUSPICION_MARKERS):
                    suspected = True

        # Whole-text pattern fallback for multi-word context phrases
        compact = " ".join(tokens)
        for marker in ("no ", "not ", "without ", "hapana ", "haana "):
            if f"{marker}{alias}" in compact:
                negated = True
        for marker in ("history of ", "past ", "known "):
            if f"{marker}{alias}" in compact:
                historical = True
        for marker in ("rule out ", "possible ", "suspected ", "? "):
            if f"{marker}{alias}" in compact:
                suspected = True

        return negated, historical, suspected


# =============================================================================
# MODULE-LEVEL SINGLETON  (created once, reused)
# =============================================================================

_nlp = SadcClinicalNLP()

# Backward-compatible alias so any `from zimbabwe_terminology import _nlp as _zim_nlp` keeps working
ZimbabweClinicalNLP = SadcClinicalNLP


# =============================================================================
# MODULE-LEVEL FUNCTIONS
# =============================================================================

def translate_symptom_to_english(text: str, language: str = "auto") -> str:
    """Translate a multilingual symptom expression to English. SADC-first."""
    return _nlp.translate_symptom_to_english(text)


def get_regional_disease_multiplier(diagnosis: str) -> float:
    """Prevalence multiplier for SADC-priority diseases."""
    return _nlp.get_zimbabwe_disease_multiplier(diagnosis)


# Backward-compatible alias
def get_zimbabwe_disease_multiplier(diagnosis: str) -> float:
    """Backward-compatible alias for get_regional_disease_multiplier."""
    return get_regional_disease_multiplier(diagnosis)


def extract_sadc_conditions(text: str) -> list:
    """
    Extract SADC-priority conditions from multilingual clinical text.
    Returns lowercase condition keys compatible with the SADC_TERMINOLOGY dict.
    """
    norm = _nlp.normalize_text(text)
    direct = _nlp.extract_conditions(norm)
    inferred = _nlp.infer_conditions_from_symptoms(_nlp.extract_symptoms(norm))
    combined = _nlp.combine_condition_evidence(direct, inferred)

    # Reverse-map canonical_name → dict key for backward compat
    rev = {meta["canonical_name"]: key for key, meta in _nlp.terminology.items()}
    return [
        rev.get(c.name, c.name.lower().replace(" ", "_"))
        for c in combined
        if c.score >= 0.35 and not c.negated
    ]


# Backward-compatible alias
def extract_zimbabwe_conditions(text: str) -> list:
    """Backward-compatible alias for extract_sadc_conditions."""
    return extract_sadc_conditions(text)
