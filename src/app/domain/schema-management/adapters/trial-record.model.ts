export interface TrialRecord {
  id: string;
  groupingFactor: string;
  stratum: Record<string, string>;
  category: string;
  categoryId?: string;
  [key: string]: any;
}
