"""
Intelligent Fusion Engine
Combines rule-based CDSS + AI model results
Resolves conflicts, ranks recommendations, calculates confidence
Includes SNOMED CT and ICD-10 code mapping
"""

import logging
from typing import Dict, List, Optional, Any
from collections import Counter

logger = logging.getLogger(__name__)

# Import terminology mappers
try:
    from terminology.icd10_mapper import Icd10Mapper
    from terminology.snomed_mapper import SnomedMapper
    TERMINOLOGY_AVAILABLE = True
except ImportError:
    TERMINOLOGY_AVAILABLE = False
    logger.warning("Terminology mappers not available. Codes will not be included.")


class IntelligentFusionEngine:
    """
    Fuses recommendations from multiple sources:
    - Rule-based CDSS
    - MedBERT (structured data)
    - ClinicalBERT (clinical notes)
    """
    
    def __init__(self):
        # Base weights for different sources (optimized based on testing)
        # Rule-based: Reliable baseline, good for common patterns
        # MedBERT: Strong for structured data (vitals, labs, demographics)
        # ClinicalBERT: Strong for unstructured clinical notes
        self.base_weights = {
            'rule_based': 0.35,  # Reduced from 0.4 - rule-based is reliable but less adaptive
            'medbert': 0.35,     # Increased from 0.3 - strong for structured data
            'clinicalbert': 0.30  # Kept at 0.3 - good for notes but depends on note quality
        }
        
        # Confidence multipliers (adjust weights based on source confidence)
        self.confidence_multipliers = {
            'high': 1.2,      # Boost high-confidence sources
            'moderate': 1.0,   # Standard weight
            'low': 0.7        # Reduce low-confidence sources
        }
        
        # Initialize terminology mappers
        self.icd10_mapper = None
        self.snomed_mapper = None
        
        if TERMINOLOGY_AVAILABLE:
            try:
                self.icd10_mapper = Icd10Mapper()
                self.snomed_mapper = SnomedMapper()
                logger.info("Terminology mappers initialized in fusion engine")
            except Exception as e:
                logger.warning(f"Failed to initialize terminology mappers: {e}")
    
    def fuse_recommendations(
        self,
        rule_based_results: Dict[str, Any],
        medbert_results: Optional[Dict[str, Any]] = None,
        clinicalbert_results: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Combine and rank recommendations from all sources
        
        Args:
            rule_based_results: Results from rule-based CDSS
            medbert_results: Results from MedBERT (optional)
            clinicalbert_results: Results from ClinicalBERT (optional)
        
        Returns:
            Fused recommendations with confidence scores and explanations
        """
        # Collect all diagnoses from all sources
        all_diagnoses = {}
        
        # Process rule-based results
        rule_diagnoses = rule_based_results.get('suggested_diagnoses', [])
        for diag in rule_diagnoses:
            diag_name = diag.get('diagnosis', '')
            if not diag_name:
                continue
            
            if diag_name not in all_diagnoses:
                all_diagnoses[diag_name] = {
                    'diagnosis': diag_name,
                    'probabilities': [],
                    'sources': [],
                    'confidence_scores': [],
                    'supporting_data': {}
                }
            
            prob = diag.get('probability', 0.0)
            all_diagnoses[diag_name]['probabilities'].append(('rule_based', prob))
            all_diagnoses[diag_name]['sources'].append('rule_based')
            all_diagnoses[diag_name]['confidence_scores'].append(
                diag.get('confidence', 'low')
            )
            all_diagnoses[diag_name]['supporting_data']['rule_based'] = {
                'matching_symptoms': diag.get('matching_symptoms', []),
                'probability': prob
            }
        
        # Process MedBERT results
        if medbert_results:
            medbert_predictions = medbert_results.get('predictions', [])
            for pred in medbert_predictions:
                diag_name = pred.get('diagnosis', '')
                if not diag_name:
                    continue
                
                if diag_name not in all_diagnoses:
                    all_diagnoses[diag_name] = {
                        'diagnosis': diag_name,
                        'probabilities': [],
                        'sources': [],
                        'confidence_scores': [],
                        'supporting_data': {}
                    }
                
                prob = pred.get('probability', 0.0)
                all_diagnoses[diag_name]['probabilities'].append(('medbert', prob))
                all_diagnoses[diag_name]['sources'].append('medbert')
                all_diagnoses[diag_name]['confidence_scores'].append(
                    pred.get('confidence', 'low')
                )
                all_diagnoses[diag_name]['supporting_data']['medbert'] = {
                    'similarity_score': pred.get('similarity_score', 0.0),
                    'probability': prob
                }
        
        # Process ClinicalBERT results
        if clinicalbert_results:
            clinicalbert_suggestions = clinicalbert_results.get('suggestions', [])
            for sugg in clinicalbert_suggestions:
                diag_name = sugg.get('diagnosis', '')
                if not diag_name:
                    continue
                
                if diag_name not in all_diagnoses:
                    all_diagnoses[diag_name] = {
                        'diagnosis': diag_name,
                        'probabilities': [],
                        'sources': [],
                        'confidence_scores': [],
                        'supporting_data': {}
                    }
                
                prob = sugg.get('probability', 0.0)
                all_diagnoses[diag_name]['probabilities'].append(('clinicalbert', prob))
                all_diagnoses[diag_name]['sources'].append('clinicalbert')
                all_diagnoses[diag_name]['confidence_scores'].append(
                    sugg.get('confidence', 'low')
                )
                all_diagnoses[diag_name]['supporting_data']['clinicalbert'] = {
                    'supporting_symptoms': sugg.get('supporting_symptoms', []),
                    'probability': prob
                }
        
        # Calculate fused probabilities and confidence
        fused_diagnoses = []
        
        for diag_name, diag_data in all_diagnoses.items():
            # Weighted average of probabilities
            weighted_prob = 0.0
            total_weight = 0.0
            
            for source, prob in diag_data['probabilities']:
                weight = self.base_weights.get(source, 0.33)  # Default equal weight
                weighted_prob += prob * weight
                total_weight += weight
            
            if total_weight > 0:
                fused_probability = weighted_prob / total_weight
            else:
                fused_probability = sum([p[1] for p in diag_data['probabilities']]) / max(len(diag_data['probabilities']), 1)
            
            # Determine confidence based on:
            # 1. Number of sources agreeing
            # 2. Agreement level
            # 3. Individual confidence scores
            
            source_count = len(set(diag_data['sources']))
            agreement_bonus = 0.1 * (source_count - 1)  # Bonus for multiple sources
            
            # Check if sources agree (similar probabilities)
            if len(diag_data['probabilities']) > 1:
                probs = [p[1] for p in diag_data['probabilities']]
                prob_variance = max(probs) - min(probs)
                if prob_variance < 0.2:  # Low variance = good agreement
                    agreement_bonus += 0.1
            
            final_probability = min(fused_probability + agreement_bonus, 0.95)
            
            # Enhanced confidence determination
            # Consider: probability, source count, agreement, and data quality
            high_conf_sources = sum(1 for conf in diag_data['confidence_scores'] if conf == 'high')
            
            if final_probability >= 0.75 and source_count >= 2 and high_conf_sources >= 1:
                confidence = 'high'
            elif final_probability >= 0.65 and source_count >= 2:
                confidence = 'high'
            elif final_probability >= 0.55 and source_count >= 2:
                confidence = 'moderate'
            elif final_probability >= 0.45:
                confidence = 'moderate'
            else:
                confidence = 'low'
            
            # Build explanation
            sources_list = list(set(diag_data['sources']))
            explanation = f"Suggested by {', '.join(sources_list)}"
            if source_count > 1:
                explanation += f" ({source_count} sources agree)"
            
            # Calculate average AI probability (MedBERT + ClinicalBERT)
            ai_probs = [
                p[1] for p in diag_data['probabilities']
                if p[0] in ['medbert', 'clinicalbert']
            ]
            avg_ai_probability = sum(ai_probs) / len(ai_probs) if ai_probs else None
            
            diag_dict = {
                'diagnosis': diag_name,
                'probability': round(final_probability, 3),
                'confidence': confidence,
                'sources': sources_list,
                'source_count': source_count,
                'explanation': explanation,
                'supporting_data': diag_data['supporting_data'],
                'rule_based_probability': next(
                    (p[1] for p in diag_data['probabilities'] if p[0] == 'rule_based'),
                    None
                ),
                'ai_probability': avg_ai_probability,
                'agreement_score': round(agreement_score, 3) if 'agreement_score' in locals() else None,
                'weight_adjustments': {
                    source: round(weight, 3)
                    for source, weight in normalized_weights.items()
                } if 'normalized_weights' in locals() else None
            }
            
            # Add ICD-10 and SNOMED CT codes
            if self.icd10_mapper:
                icd10_code = self.icd10_mapper.get_icd10_code(diag_name)
                if icd10_code:
                    diag_dict['icd10'] = icd10_code
            
            if self.snomed_mapper:
                snomed_code = self.snomed_mapper.get_snomed_code(diag_name)
                if snomed_code:
                    diag_dict['snomed'] = snomed_code
            
            fused_diagnoses.append(diag_dict)
        
        # Sort by probability
        fused_diagnoses.sort(key=lambda x: x['probability'], reverse=True)
        
        # Calculate overall confidence
        if fused_diagnoses and fused_diagnoses[0]['probability'] > 0.7:
            overall_confidence = 'high'
        elif fused_diagnoses and fused_diagnoses[0]['probability'] > 0.5:
            overall_confidence = 'moderate'
        else:
            overall_confidence = 'low'
        
        return {
            'suggested_diagnoses': fused_diagnoses[:10],  # Top 10
            'confidence': overall_confidence,
            'source': 'hybrid_cdss_ai',
            'rule_based_contributions': len([d for d in fused_diagnoses if 'rule_based' in d['sources']]),
            'ai_contributions': len([d for d in fused_diagnoses if any(s in d['sources'] for s in ['medbert', 'clinicalbert'])]),
            'total_sources': len(set([s for d in fused_diagnoses for s in d['sources']])),
            'explanation': f"Combined results from rule-based CDSS and AI models. {len(fused_diagnoses)} diagnoses identified."
        }
