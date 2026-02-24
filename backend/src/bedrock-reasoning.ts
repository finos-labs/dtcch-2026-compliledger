import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ProofStepResult, SettlementIntent } from "./types";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-haiku-20240307-v1:0";

const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

export interface StepExplanation {
  step_name: string;
  pass: boolean;
  explanation: string;
}

export interface ComplianceReasoning {
  summary: string;
  step_explanations: StepExplanation[];
  risk_assessment: string;
  recommendation: string;
}

export async function generateComplianceReasoning(
  intent: SettlementIntent,
  steps: ProofStepResult[],
  decision: "ALLOW" | "DENY"
): Promise<ComplianceReasoning> {
  const prompt = buildPrompt(intent, steps, decision);

  try {
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text
      || responseBody.output?.message?.content?.[0]?.text
      || "";

    return parseResponse(text, steps);
  } catch (err) {
    console.error("Bedrock reasoning error:", err);
    return buildFallbackReasoning(intent, steps, decision);
  }
}

function buildPrompt(
  intent: SettlementIntent,
  steps: ProofStepResult[],
  decision: "ALLOW" | "DENY"
): string {
  const stepsDescription = steps
    .map(
      (s) =>
        `Step ${s.step_index + 1} — ${s.step_name}: ${s.pass ? "PASS" : "FAIL"}${
          s.reason_codes.length > 0 ? ` (${s.reason_codes.join(", ")})` : ""
        }`
    )
    .join("\n");

  return `You are a compliance analyst for SettlementGuard, a settlement enforcement system for tokenized assets on the Canton Network.

A settlement intent was evaluated through the Canonical Proof Chain with the following results:

Asset Type: ${intent.asset_type}
Issuer: ${intent.issuer_name} (Status: ${intent.issuer_status})
Asset ID: ${intent.asset_id}
Classification: ${intent.classification}
Custody Provider: ${intent.custody_provider}
Custody Valid: ${intent.custody_valid}
Reserve Ratio: ${intent.reserve_ratio}

Proof Chain Results:
${stepsDescription}

Final Decision: ${decision}

Provide a JSON response with exactly this structure (no markdown, just raw JSON):
{
  "summary": "One sentence summary of the enforcement result",
  "step_explanations": [
    {"step_name": "<step_name>", "pass": <true/false>, "explanation": "Brief human-readable explanation of why this step passed or failed"}
  ],
  "risk_assessment": "Brief risk assessment based on all findings",
  "recommendation": "What should happen next based on the decision"
}`;
}

function parseResponse(
  text: string,
  steps: ProofStepResult[]
): ComplianceReasoning {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || "",
      step_explanations: parsed.step_explanations || [],
      risk_assessment: parsed.risk_assessment || "",
      recommendation: parsed.recommendation || "",
    };
  } catch {
    return {
      summary: text.slice(0, 200),
      step_explanations: steps.map((s) => ({
        step_name: s.step_name,
        pass: s.pass,
        explanation: s.pass ? "Check passed successfully." : `Failed: ${s.reason_codes.join(", ")}`,
      })),
      risk_assessment: "Unable to parse AI assessment.",
      recommendation: "Review results manually.",
    };
  }
}

function buildFallbackReasoning(
  intent: SettlementIntent,
  steps: ProofStepResult[],
  decision: "ALLOW" | "DENY"
): ComplianceReasoning {
  const failedSteps = steps.filter((s) => !s.pass);

  const stepExplanations: StepExplanation[] = steps.map((s) => {
    const explanations: Record<string, Record<string, string>> = {
      issuer_legitimacy: {
        pass: `${intent.issuer_name} has active issuer status and is authorized to issue ${intent.asset_type} assets.`,
        fail: `${intent.issuer_name} has a suspended issuer status and cannot issue new settlement requests.`,
      },
      asset_classification: {
        pass: `Asset ${intent.asset_id} is correctly classified as ${intent.classification} and matches the ${intent.asset_type} category.`,
        fail: `Asset ${intent.asset_id} has classification "${intent.classification}" which does not match the expected category for ${intent.asset_type}.`,
      },
      custody_conditions: {
        pass: `${intent.custody_provider} confirms valid custody of the underlying asset with proper segregation.`,
        fail: `Custody validation failed for ${intent.custody_provider}. The custodian cannot confirm proper asset segregation or control.`,
      },
      backing_reserve: {
        pass: `Reserve ratio of ${intent.reserve_ratio} meets the minimum 1.0 threshold, confirming adequate backing.`,
        fail: `Reserve ratio of ${intent.reserve_ratio} is below the required 1.0 minimum. The asset is under-collateralized.`,
      },
    };

    return {
      step_name: s.step_name,
      pass: s.pass,
      explanation: explanations[s.step_name]?.[s.pass ? "pass" : "fail"] || (s.pass ? "Check passed." : "Check failed."),
    };
  });

  return {
    summary:
      decision === "ALLOW"
        ? `Settlement for ${intent.asset_type} asset ${intent.asset_id} passed all four compliance checks and is approved for finality.`
        : `Settlement for ${intent.asset_type} asset ${intent.asset_id} was denied due to ${failedSteps.length} failed compliance check(s).`,
    step_explanations: stepExplanations,
    risk_assessment:
      decision === "ALLOW"
        ? "Low risk. All four proof chain steps verified successfully. No regulatory or operational concerns identified."
        : `Elevated risk. ${failedSteps.map((s) => s.step_name).join(", ")} failed verification. Settlement cannot proceed until remediated.`,
    recommendation:
      decision === "ALLOW"
        ? "Proceed with on-chain anchoring and settlement finality."
        : `Block settlement. Issuer must remediate: ${failedSteps.map((s) => s.reason_codes.join(", ")).join("; ")}.`,
  };
}
