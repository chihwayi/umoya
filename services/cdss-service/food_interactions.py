"""
Drug–Food Interaction Checking
- Grapefruit juice (CYP3A4 inhibition)
- Warfarin–vitamin K rich foods
- MAOIs–tyramine rich foods
- Alcohol interactions (sedatives, metronidazole, insulin/hypoglycemics)
"""
from typing import List, Dict, Any, Optional


class FoodInteractionChecker:
    """Rule-based drug–food interaction checker"""

    GRAPEFRUIT_RISK = {
        'statins': ['simvastatin', 'atorvastatin', 'lovastatin'],
        'ccb': ['felodipine', 'nifedipine', 'verapamil'],
        'others': ['amiodarone', 'carbamazepine', 'buspirone', 'diazepam']
    }

    WARFARIN_VITK = ['spinach', 'kale', 'broccoli', 'brussels sprouts', 'cabbage', 'collard greens']

    MAOI_TYRAMINE = ['aged cheese', 'cured meats', 'fermented foods', 'soy sauce', 'draft beer', 'kimchi']

    ALCOHOL_CAUTION = {
        'hypoglycemics': ['insulin', 'glyburide', 'glipizide', 'glimepiride'],
        'metronidazole': ['metronidazole'],
        'cns_depressants': ['benzodiazepine', 'diazepam', 'lorazepam', 'opiates', 'morphine', 'oxycodone']
    }

    def check(self, medications: List[Dict[str, Any]]) -> Dict[str, Any]:
        interactions: List[Dict[str, Any]] = []

        def has_med(names: List[str]) -> Optional[str]:
            for med in medications:
                name = (med.get('genericName') or med.get('name') or '').lower()
                for target in names:
                    if target.lower() in name:
                        return med.get('name') or med.get('genericName') or name
            return None

        # Grapefruit
        for bucket in self.GRAPEFRUIT_RISK.values():
            hit = has_med(bucket)
            if hit:
                interactions.append({
                    'food': 'grapefruit juice',
                    'medication': hit,
                    'severity': 'moderate',
                    'mechanism': 'CYP3A4 inhibition increases serum drug levels',
                    'recommendation': 'Avoid grapefruit/grapefruit juice; monitor for adverse effects'
                })
                break

        # Warfarin – vitamin K
        if has_med(['warfarin']):
            interactions.append({
                'food': 'vitamin K–rich foods',
                'examples': self.WARFARIN_VITK[:5],
                'medication': 'Warfarin',
                'severity': 'major',
                'mechanism': 'Vitamin K intake reduces anticoagulant effect (lowers INR)',
                'recommendation': 'Keep vitamin K intake consistent; monitor INR closely'
            })

        # MAOIs – tyramine (simplified by keywords)
        if has_med(['phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline']):
            interactions.append({
                'food': 'tyramine-rich foods',
                'examples': self.MAOI_TYRAMINE[:5],
                'medication': 'MAOI',
                'severity': 'major',
                'mechanism': 'Hypertensive crisis due to tyramine potentiation',
                'recommendation': 'Strict tyramine-restricted diet while on MAOI'
            })

        # Alcohol cautions
        if has_med(self.ALCOHOL_CAUTION['metronidazole']):
            interactions.append({
                'food': 'alcohol',
                'medication': 'Metronidazole',
                'severity': 'major',
                'mechanism': 'Disulfiram-like reaction (flushing, tachycardia, nausea)',
                'recommendation': 'Avoid alcohol during therapy and for 72 hours after last dose'
            })
        if has_med(self.ALCOHOL_CAUTION['hypoglycemics']):
            interactions.append({
                'food': 'alcohol',
                'medication': 'Insulin/sulfonylurea',
                'severity': 'moderate',
                'mechanism': 'Alcohol can cause hypoglycemia',
                'recommendation': 'Limit alcohol; ensure food intake and glucose monitoring'
            })
        if has_med(self.ALCOHOL_CAUTION['cns_depressants']):
            interactions.append({
                'food': 'alcohol',
                'medication': 'CNS depressant',
                'severity': 'major',
                'mechanism': 'Additive CNS depression and respiratory suppression',
                'recommendation': 'Avoid alcohol use while on CNS depressants'
            })

        summary = {
            'major': len([i for i in interactions if i['severity'] == 'major']),
            'moderate': len([i for i in interactions if i['severity'] == 'moderate'])
        }

        return {
            'interactions': interactions,
            'summary': summary,
            'recommendations': self._recommendations(interactions)
        }

    def _recommendations(self, interactions: List[Dict[str, Any]]) -> List[str]:
        if not interactions:
            return ['No significant drug–food interactions detected']
        recs = []
        for i in interactions:
            if i.get('recommendation') and i['recommendation'] not in recs:
                recs.append(i['recommendation'])
        return recs
