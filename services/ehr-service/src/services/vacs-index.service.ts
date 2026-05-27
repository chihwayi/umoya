import { Injectable } from '@nestjs/common';

interface VacsInput {
  age: number;
  cd4Count: number;
  viralLoad: number;
  hemoglobinGdL: number;
  creatinine: number;
  alanineAminotransferase: number;
  hepatitisCPositive: boolean;
  fbsBmi: number;
  drugProblemEverDiagnosed: boolean;
}

@Injectable()
export class VacsIndexService {
  calculateVacsScore(input: VacsInput): { score: number; tenYearMortality: number } {
    let score = 0;

    if (input.age >= 60) score += 20;
    else if (input.age >= 50) score += 10;
    else if (input.age >= 40) score += 5;

    if (input.cd4Count < 50) score += 22;
    else if (input.cd4Count < 200) score += 14;
    else if (input.cd4Count < 350) score += 7;
    else if (input.cd4Count < 500) score += 3;

    if (input.viralLoad >= 500000) score += 10;
    else if (input.viralLoad >= 100000) score += 7;
    else if (input.viralLoad >= 500) score += 3;

    if (input.hemoglobinGdL < 8) score += 14;
    else if (input.hemoglobinGdL < 10) score += 7;
    else if (input.hemoglobinGdL < 12) score += 3;

    if (input.creatinine >= 3.0) score += 22;
    else if (input.creatinine >= 1.5) score += 11;

    if (input.alanineAminotransferase > 40) score += 8;
    if (input.hepatitisCPositive) score += 8;
    if (input.drugProblemEverDiagnosed) score += 5;

    const tenYearMortality = Math.min(100, Math.max(0, score * 0.5));
    return { score, tenYearMortality };
  }

  classifyFrailty(score: number): 'robust' | 'pre_frail' | 'frail' {
    if (score < 30) return 'robust';
    if (score < 55) return 'pre_frail';
    return 'frail';
  }
}
