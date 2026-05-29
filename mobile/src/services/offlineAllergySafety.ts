import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedAllergy {
  allergen: string;
  severity: string;
  status: string;
}

const cacheKey = (patientId: string) => `allergies_v1_${patientId}`;

export async function cacheAllergies(
  patientId: string,
  allergies: CachedAllergy[],
): Promise<void> {
  await AsyncStorage.setItem(
    cacheKey(patientId),
    JSON.stringify({ allergies, at: Date.now() }),
  );
}

export async function checkAllergyBlock(
  patientId: string,
  drugName: string,
): Promise<{ blocked: boolean; reason: string }> {
  const raw = await AsyncStorage.getItem(cacheKey(patientId));

  if (!raw) {
    return {
      blocked: true,
      reason:
        'Allergy cache missing — connect to network and open the patient record first',
    };
  }

  const { allergies }: { allergies: CachedAllergy[] } = JSON.parse(raw);
  const drug = drugName.toLowerCase();

  const match = allergies
    .filter((a) => a.status === 'active')
    .find(
      (a) =>
        drug.includes(a.allergen.toLowerCase()) ||
        a.allergen.toLowerCase().includes(drug),
    );

  if (match) {
    return {
      blocked: true,
      reason: `Patient has a ${match.severity.toUpperCase()} allergy to ${match.allergen}`,
    };
  }

  return { blocked: false, reason: '' };
}
