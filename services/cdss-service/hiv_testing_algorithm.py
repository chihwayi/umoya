"""
Zimbabwe National HIV Testing Algorithm Implementation

Based on WHO/Zimbabwe guidelines:
- Step 1: Determine HIV-1/2 (First test)
- If reactive: Step 2: Unigold or First Response (Second test)
- If both reactive: HIV Positive
- If Step 1 reactive, Step 2 non-reactive: Retest or refer to lab (Indeterminate)
- If Step 1 non-reactive: HIV Negative
"""

from typing import Dict, List, Any, Optional
from enum import Enum


class TestKit(str, Enum):
    """Supported HIV rapid test kits in Zimbabwe"""
    DETERMINE = "Determine HIV-1/2"
    UNIGOLD = "Unigold HIV"
    FIRST_RESPONSE = "First Response HIV 1-2"
    ABBOTT = "Abbott Determine"


class TestResult(str, Enum):
    REACTIVE = "reactive"
    NON_REACTIVE = "non_reactive"
    INVALID = "invalid"
    INDETERMINATE = "indeterminate"


class AlgorithmResult(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    INDETERMINATE = "indeterminate"
    INCOMPLETE = "incomplete"


class ZimbabweHIVTestingAlgorithm:
    """
    Implements the Zimbabwe National HIV Testing Algorithm
    
    Algorithm:
    1. Test 1 (Determine): If non-reactive → HIV Negative
    2. If Test 1 reactive → Test 2 (Unigold or First Response)
    3. If both reactive → HIV Positive
    4. If Test 1 reactive, Test 2 non-reactive → Indeterminate (retest or refer)
    """
    
    # Test kits configuration
    FIRST_LINE_TEST = TestKit.DETERMINE
    SECOND_LINE_TESTS = [TestKit.UNIGOLD, TestKit.FIRST_RESPONSE, TestKit.ABBOTT]
    
    def __init__(self):
        self.algorithm_steps = []
    
    def process_test_sequence(self, tests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process a sequence of HIV tests according to Zimbabwe algorithm
        
        Args:
            tests: List of test results with keys:
                - test_kit_name: Name of the test kit
                - test_result: 'reactive', 'non_reactive', 'invalid'
                - test_date: Date of test
                - tested_by: User who performed test
        
        Returns:
            Dictionary with:
                - algorithm_result: 'positive', 'negative', 'indeterminate', 'incomplete'
                - confidence: 'high', 'moderate', 'low'
                - next_step: Recommended next action
                - algorithm_steps: List of steps processed
        """
        if not tests:
            return {
                'algorithm_result': AlgorithmResult.INCOMPLETE,
                'confidence': 'none',
                'next_step': 'Perform first test (Determine)',
                'algorithm_steps': []
            }
        
        # Sort tests by date
        sorted_tests = sorted(tests, key=lambda x: x.get('test_date', ''))
        self.algorithm_steps = []
        
        # Step 1: First test (should be Determine)
        step1_test = sorted_tests[0]
        step1_result = step1_test.get('test_result', '').lower()
        step1_kit = step1_test.get('test_kit_name', '').upper()
        
        step1_info = {
            'step': 1,
            'test_kit': step1_test.get('test_kit_name', ''),
            'test_result': step1_result,
            'test_date': step1_test.get('test_date', ''),
            'tested_by': step1_test.get('tested_by', '')
        }
        
        # Check if first test is Determine (preferred)
        if 'DETERMINE' not in step1_kit:
            step1_info['warning'] = f'First test should be Determine, but {step1_kit} was used'
        
        self.algorithm_steps.append(step1_info)
        
        # If Step 1 is non-reactive → Negative
        if step1_result == TestResult.NON_REACTIVE:
            return {
                'algorithm_result': AlgorithmResult.NEGATIVE,
                'confidence': 'high',
                'next_step': 'No further testing needed. Provide post-test counseling.',
                'algorithm_steps': self.algorithm_steps,
                'interpretation': 'HIV Negative - Single non-reactive test sufficient per algorithm'
            }
        
        # If Step 1 is invalid → Incomplete
        if step1_result == TestResult.INVALID:
            return {
                'algorithm_result': AlgorithmResult.INCOMPLETE,
                'confidence': 'none',
                'next_step': 'Retest with new Determine kit',
                'algorithm_steps': self.algorithm_steps,
                'interpretation': 'Test 1 invalid - must retest'
            }
        
        # If Step 1 is reactive → Need Step 2
        if step1_result == TestResult.REACTIVE:
            if len(sorted_tests) < 2:
                return {
                    'algorithm_result': AlgorithmResult.INCOMPLETE,
                    'confidence': 'none',
                    'next_step': f'Perform second confirmatory test (Unigold or First Response)',
                    'algorithm_steps': self.algorithm_steps,
                    'interpretation': 'Test 1 reactive - awaiting confirmatory test'
                }
            
            # Step 2: Second test (should be Unigold or First Response)
            step2_test = sorted_tests[1]
            step2_result = step2_test.get('test_result', '').lower()
            step2_kit = step2_test.get('test_kit_name', '').upper()
            
            step2_info = {
                'step': 2,
                'test_kit': step2_test.get('test_kit_name', ''),
                'test_result': step2_result,
                'test_date': step2_test.get('test_date', ''),
                'tested_by': step2_test.get('tested_by', '')
            }
            
            # Check if second test is appropriate confirmatory test
            is_valid_confirmatory = any(confirmatory in step2_kit for confirmatory in ['UNIGOLD', 'FIRST RESPONSE', 'ABBOTT'])
            if not is_valid_confirmatory:
                step2_info['warning'] = f'Second test should be Unigold or First Response, but {step2_kit} was used'
            
            self.algorithm_steps.append(step2_info)
            
            # If Step 2 is invalid → Incomplete
            if step2_result == TestResult.INVALID:
                return {
                    'algorithm_result': AlgorithmResult.INCOMPLETE,
                    'confidence': 'none',
                    'next_step': 'Retest Step 2 with new test kit',
                    'algorithm_steps': self.algorithm_steps,
                    'interpretation': 'Test 2 invalid - must retest'
                }
            
            # If both reactive → Positive
            if step2_result == TestResult.REACTIVE:
                return {
                    'algorithm_result': AlgorithmResult.POSITIVE,
                    'confidence': 'high',
                    'next_step': 'Provide post-test counseling. Offer enrollment in HIV care.',
                    'algorithm_steps': self.algorithm_steps,
                    'interpretation': 'HIV Positive - Both tests reactive (confirmed)'
                }
            
            # If Step 1 reactive, Step 2 non-reactive → Indeterminate
            if step2_result == TestResult.NON_REACTIVE:
                # Check for third test (tiebreaker)
                if len(sorted_tests) >= 3:
                    step3_test = sorted_tests[2]
                    step3_result = step3_test.get('test_result', '').lower()
                    
                    step3_info = {
                        'step': 3,
                        'test_kit': step3_test.get('test_kit_name', ''),
                        'test_result': step3_result,
                        'test_date': step3_test.get('test_date', ''),
                        'tested_by': step3_test.get('tested_by', '')
                    }
                    self.algorithm_steps.append(step3_info)
                    
                    if step3_result == TestResult.REACTIVE:
                        return {
                            'algorithm_result': AlgorithmResult.POSITIVE,
                            'confidence': 'high',
                            'next_step': 'Provide post-test counseling. Offer enrollment in HIV care.',
                            'algorithm_steps': self.algorithm_steps,
                            'interpretation': 'HIV Positive - Two of three tests reactive'
                        }
                    else:
                        return {
                            'algorithm_result': AlgorithmResult.NEGATIVE,
                            'confidence': 'moderate',
                            'next_step': 'Provide post-test counseling. Consider retest in 3 months if recent exposure.',
                            'algorithm_steps': self.algorithm_steps,
                            'interpretation': 'HIV Negative - Tiebreaker test non-reactive'
                        }
                
                return {
                    'algorithm_result': AlgorithmResult.INDETERMINATE,
                    'confidence': 'low',
                    'next_step': 'Discordant results. Retest with third test kit or refer for laboratory testing (ELISA/PCR).',
                    'algorithm_steps': self.algorithm_steps,
                    'interpretation': 'Indeterminate - Test 1 reactive, Test 2 non-reactive (discordant)'
                }
        
        # Fallback
        return {
            'algorithm_result': AlgorithmResult.INCOMPLETE,
            'confidence': 'none',
            'next_step': 'Review test sequence and retest if needed',
            'algorithm_steps': self.algorithm_steps,
            'interpretation': 'Algorithm incomplete - unable to determine result'
        }
    
    def validate_test_kit(self, kit_name: str, step: int) -> Dict[str, Any]:
        """
        Validate if the test kit is appropriate for the algorithm step
        
        Args:
            kit_name: Name of the test kit
            step: Algorithm step (1 or 2)
        
        Returns:
            Validation result with recommendations
        """
        kit_upper = kit_name.upper()
        
        if step == 1:
            if 'DETERMINE' in kit_upper:
                return {
                    'valid': True,
                    'recommended': True,
                    'message': 'Determine is the recommended first-line test'
                }
            else:
                return {
                    'valid': True,  # Still valid, just not optimal
                    'recommended': False,
                    'message': f'Determine is recommended for Step 1, but {kit_name} was used'
                }
        
        elif step == 2:
            valid_kits = ['UNIGOLD', 'FIRST RESPONSE', 'ABBOTT']
            is_valid = any(vk in kit_upper for vk in valid_kits)
            
            if is_valid:
                return {
                    'valid': True,
                    'recommended': True,
                    'message': f'{kit_name} is appropriate for confirmatory testing'
                }
            else:
                return {
                    'valid': False,
                    'recommended': False,
                    'message': f'{kit_name} is not recommended for Step 2. Use Unigold or First Response.'
                }
        
        return {
            'valid': True,
            'recommended': False,
            'message': 'No specific validation for this step'
        }
    
    def get_recommended_next_test(self, current_tests: List[Dict[str, Any]]) -> Optional[str]:
        """
        Get recommendation for next test based on current test results
        
        Args:
            current_tests: List of tests already performed
        
        Returns:
            Recommended next test kit name, or None if algorithm is complete
        """
        if not current_tests:
            return self.FIRST_LINE_TEST.value
        
        step1 = current_tests[0]
        step1_result = step1.get('test_result', '').lower()
        
        if step1_result == TestResult.NON_REACTIVE:
            return None  # Algorithm complete
        
        if step1_result == TestResult.INVALID:
            return self.FIRST_LINE_TEST.value  # Retest Step 1
        
        if step1_result == TestResult.REACTIVE:
            if len(current_tests) < 2:
                return 'Unigold HIV'  # Recommend Unigold for Step 2
            else:
                step2 = current_tests[1]
                step2_result = step2.get('test_result', '').lower()
                
                if step2_result == TestResult.INVALID:
                    return 'Unigold HIV'  # Retest Step 2
                
                if step2_result == TestResult.NON_REACTIVE:
                    # Discordant - recommend third test or lab referral
                    return 'First Response HIV 1-2'  # Tiebreaker
        
        return None


# Singleton instance
hiv_testing_algorithm = ZimbabweHIVTestingAlgorithm()

