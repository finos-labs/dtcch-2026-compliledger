import type { Rule } from "../rules/types";

/**
 * Central registry that stores and retrieves Rule instances by their id.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, Rule>();

  register(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  getAll(): Rule[] {
    return Array.from(this.rules.values());
  }
}

export const defaultRegistry = new RuleRegistry();
