// S286 — Structured composer DTO (the first, stronger PHI-safety layer).
//
// No field for exact age, DOB, or name anywhere in this DTO — that is deliberate,
// not an oversight. Age is an enum-validated band; sex is a closed union. All
// free-text fields pass through the PHI redaction guard server-side.

export const AGE_BANDS = [
  '0-17',
  '18-29',
  '30-39',
  '40-49',
  '50-59',
  '60-69',
  '70-79',
  '80+',
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export type ClinicianNetworkSex = 'male' | 'female' | 'other';

export class CreateTopicDto {
  panelId!: string;
  title!: string;
  ageBand!: string;
  sex!: ClinicianNetworkSex;
  presentingComplaint!: string;
  relevantHistory!: string;
  question!: string;
  tags!: string[];
}

export class CreateReplyDto {
  topicId!: string;
  parentReplyId?: string | null;
  body!: string;
}
