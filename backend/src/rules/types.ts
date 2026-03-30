export interface Rule {
  id: string;
  evaluate(input: any): {
    passed: boolean;
    reason_code?: string;
  };
}
