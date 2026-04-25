export type Agent2ProcessResponse = {
  ok: boolean;
  message: string;
  state?: {
    stage?: string;
    facts?: Record<string, unknown>;
  };
  actions?: Array<{ type?: string; question?: string; reason?: string }>;
  checklist?: Array<{ task?: string; status?: string }>;
};

const API_BASE = import.meta.env.VITE_AGENT2_API_BASE_URL || "http://127.0.0.1:8000";

export async function processAgent2Input(rawInput: string, policyTopic?: string): Promise<Agent2ProcessResponse> {
  const response = await fetch(`${API_BASE}/api/agent2/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw_input: rawInput,
      source_type: "message",
      source_meta: policyTopic ? { policy_topic: policyTopic } : {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent2 request failed with status ${response.status}`);
  }

  return response.json();
}
