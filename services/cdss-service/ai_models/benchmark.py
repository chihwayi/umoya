"""
Benchmarking utilities for CDSS performance evaluation
Compares AI models vs rule-based CDSS accuracy
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class CDSSBenchmark:
    """Benchmark CDSS performance"""
    
    def __init__(self):
        self.results = []
        self.metrics = {
            'total_tests': 0,
            'rule_based_correct': 0,
            'ai_correct': 0,
            'fusion_correct': 0,
            'rule_based_accuracy': 0.0,
            'ai_accuracy': 0.0,
            'fusion_accuracy': 0.0
        }
    
    def evaluate_prediction(
        self,
        rule_based_result: Dict[str, Any],
        ai_result: Optional[Dict[str, Any]],
        fusion_result: Optional[Dict[str, Any]],
        ground_truth: str
    ) -> Dict[str, Any]:
        """
        Evaluate a single prediction against ground truth
        
        Args:
            rule_based_result: Rule-based CDSS prediction
            ai_result: AI model prediction (optional)
            fusion_result: Fusion engine prediction (optional)
            ground_truth: Correct diagnosis
        
        Returns:
            Evaluation metrics
        """
        self.metrics['total_tests'] += 1
        
        # Check rule-based
        rule_based_top = rule_based_result.get('suggested_diagnoses', [{}])[0].get('diagnosis', '')
        rule_based_correct = ground_truth.lower() in rule_based_top.lower() or rule_based_top.lower() in ground_truth.lower()
        
        # Check AI
        ai_correct = False
        if ai_result:
            ai_top = ai_result.get('suggested_diagnoses', [{}])[0].get('diagnosis', '')
            ai_correct = ground_truth.lower() in ai_top.lower() or ai_top.lower() in ground_truth.lower()
        
        # Check fusion
        fusion_correct = False
        if fusion_result:
            fusion_top = fusion_result.get('suggested_diagnoses', [{}])[0].get('diagnosis', '')
            fusion_correct = ground_truth.lower() in fusion_top.lower() or fusion_top.lower() in ground_truth.lower()
        
        # Update metrics
        if rule_based_correct:
            self.metrics['rule_based_correct'] += 1
        if ai_correct:
            self.metrics['ai_correct'] += 1
        if fusion_correct:
            self.metrics['fusion_correct'] += 1
        
        # Calculate accuracies
        total = self.metrics['total_tests']
        self.metrics['rule_based_accuracy'] = self.metrics['rule_based_correct'] / total if total > 0 else 0.0
        self.metrics['ai_accuracy'] = self.metrics['ai_correct'] / total if total > 0 else 0.0
        self.metrics['fusion_accuracy'] = self.metrics['fusion_correct'] / total if total > 0 else 0.0
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'ground_truth': ground_truth,
            'rule_based': {
                'prediction': rule_based_top,
                'correct': rule_based_correct
            },
            'ai': {
                'prediction': ai_result.get('suggested_diagnoses', [{}])[0].get('diagnosis', '') if ai_result else None,
                'correct': ai_correct
            } if ai_result else None,
            'fusion': {
                'prediction': fusion_result.get('suggested_diagnoses', [{}])[0].get('diagnosis', '') if fusion_result else None,
                'correct': fusion_correct
            } if fusion_result else None,
            'metrics': self.metrics.copy()
        }
        
        self.results.append(result)
        return result
    
    def get_summary(self) -> Dict[str, Any]:
        """Get benchmark summary"""
        return {
            'total_tests': self.metrics['total_tests'],
            'accuracies': {
                'rule_based': round(self.metrics['rule_based_accuracy'], 3),
                'ai': round(self.metrics['ai_accuracy'], 3),
                'fusion': round(self.metrics['fusion_accuracy'], 3)
            },
            'improvement': {
                'ai_vs_rule': round(self.metrics['ai_accuracy'] - self.metrics['rule_based_accuracy'], 3),
                'fusion_vs_rule': round(self.metrics['fusion_accuracy'] - self.metrics['rule_based_accuracy'], 3),
                'fusion_vs_ai': round(self.metrics['fusion_accuracy'] - self.metrics['ai_accuracy'], 3)
            },
            'timestamp': datetime.now().isoformat()
        }
    
    def export_results(self, filepath: str):
        """Export benchmark results to JSON file"""
        export_data = {
            'summary': self.get_summary(),
            'results': self.results,
            'metrics': self.metrics
        }
        
        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        logger.info(f"Benchmark results exported to {filepath}")


