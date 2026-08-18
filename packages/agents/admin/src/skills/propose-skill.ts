import type { Skill } from '@wireassist/core';
import { buildDelegatedFreeformTask } from '../delegate';

export interface ProposeSkillInput {
  request: string;
}

const PROPOSED_SKILL_PATH_PREFIX = 'packages/agents/admin/src/skills/proposed/';

// One real existing skill, shown as a few-shot example of the exact shape
// the drafted code must follow — small and self-contained, no chain
// complexity. Kept as a literal string (not an import) so the example in
// the prompt can never silently drift from what's actually being requested
// here, and so this file has zero runtime dependency on that skill's
// internals.
const FEW_SHOT_EXAMPLE = `import type { Skill } from '@wireassist/core';

export interface FollowUpNudgesInput {
  daysStale?: number;
}

export const followUpNudgesSkill: Skill<FollowUpNudgesInput, void> = {
  name: 'follow_up_nudges',
  role: 'admin',
  description: 'Find sent threads where nobody has replied in N days, and propose a follow-up nudge for each.',

  async execute({ agent, task, input }) {
    const daysStale = input.daysStale ?? 3;
    // ... read data via agent.useTool(...), reason about it via agent.think(...) ...
    const approved = await agent.proposeAction(task, 'Follow-up nudge: ...', { threadId: 'x', body: 'drafted text' });
    if (approved) {
      await agent.useTool('gmail_create_draft', { threadId: 'x', body: 'drafted text' });
    }
  },
};`;

function buildDraftingPrompt(request: string): string {
  return `A user has asked for a new capability. Decide whether you can draft a concrete new Admin
skill for it, or whether the request is too vague to draft anything real.

THE EXACT INTERFACE EVERY SKILL MUST IMPLEMENT:

interface Skill<TInput, TOutput> {
  name: string;
  role: 'admin';
  description: string;
  execute(ctx: { agent: SkillAgentHandle; task: AgentTask; input: TInput }): Promise<TOutput>;
}

SkillAgentHandle's ENTIRE available surface — do not invent methods that don't exist here:
  think(userMessage, extraContext?, maxTokensOverride?): Promise<string>
  useTool(toolName, params): Promise<unknown>
  loadContext(query): Promise<string>
  remember(content, tags?): void
  proposeAction(task, action, payload): Promise<boolean>   // the ONLY way to gate a mutating action — never skip this
  emit(event, payload): void
  runToolLoop(task, userMessage, opts?): Promise<string>
  listDecisions(params?): ApprovalRequest[]
  listPending(): ApprovalRequest[]

A real existing skill, as a shape reference:

\`\`\`ts
${FEW_SHOT_EXAMPLE}
\`\`\`

Rules:
- Any action that changes something outside this process (sends an email, posts content, calls
  a mutating tool) MUST go through agent.proposeAction() first — never execute it directly.
- Only use tools/methods that already exist on SkillAgentHandle above. Do not assume a new
  useTool() tool name exists unless the request is clearly about combining existing capabilities.
- If the request is too vague to draft something concrete and correct, do NOT guess — ask one
  specific clarifying question instead.

The user's request: "${request}"

Respond in EXACTLY one of these two formats, nothing else before or after:

If you need clarification:
CLARIFICATION_NEEDED: <one specific question>

If you can draft it:
SKILL_NAME: <short human-readable name>
FILENAME: <kebab-case-filename.ts>
SUMMARY: <one sentence describing what this skill does and why>
\`\`\`ts
<the complete file content, ready to save as-is>
\`\`\``;
}

type DraftResult =
  | { kind: 'needs_clarification'; question: string }
  | { kind: 'drafted'; skillName: string; filename: string; summary: string; code: string };

function parseDraftResponse(response: string): DraftResult {
  const clarificationMatch = response.match(/CLARIFICATION_NEEDED:\s*(.+)/);
  if (clarificationMatch) {
    return { kind: 'needs_clarification', question: clarificationMatch[1].trim() };
  }

  const skillName = response.match(/SKILL_NAME:\s*(.+)/)?.[1]?.trim();
  const filename = response.match(/FILENAME:\s*(.+)/)?.[1]?.trim();
  const summary = response.match(/SUMMARY:\s*(.+)/)?.[1]?.trim();
  const code = response.match(/```(?:ts|typescript)?\n([\s\S]*?)```/)?.[1]?.trim();

  if (!skillName || !filename || !summary || !code) {
    return {
      kind: 'needs_clarification',
      question:
        "I couldn't parse a clean draft from my own response — could you rephrase the request with more specifics?",
    };
  }
  return { kind: 'drafted', skillName, filename, summary, code };
}

export const proposeSkillSkill: Skill<ProposeSkillInput, void> = {
  name: 'propose_skill',
  role: 'admin',
  description:
    "Drafts a new Admin skill as real TypeScript for a capability you describe, and — once you approve the code — asks the GitHub Dev Agent to open it as a draft PR for review. Never wires the drafted code into the running system itself; that stays a separate, manual step after you've reviewed and merged it.",

  async execute({ agent, task, input }) {
    const drafted = await agent.think(buildDraftingPrompt(input.request));
    const parsed = parseDraftResponse(drafted);

    if (parsed.kind === 'needs_clarification') {
      agent.emit('agent:propose_skill_response', { taskId: task.id, response: parsed.question });
      return;
    }

    const approved = await agent.proposeAction(
      task,
      `Draft new skill "${parsed.skillName}": ${parsed.summary}`,
      { code: parsed.code, filename: parsed.filename, description: parsed.summary }
    );

    if (!approved) {
      agent.emit('agent:propose_skill_response', {
        taskId: task.id,
        response: 'Declined — not proposing this skill.',
      });
      return;
    }

    const slug = parsed.filename.replace(/\.ts$/, '');
    const prPrompt = `Open a draft pull request proposing a new Admin skill. Do this in order:
1. Create a new branch named "skill-proposal/${slug}" from the default branch.
2. Add a new file at "${PROPOSED_SKILL_PATH_PREFIX}${parsed.filename}" on that branch with exactly this content:

\`\`\`ts
${parsed.code}
\`\`\`

3. Open a DRAFT pull request titled "Proposed skill: ${parsed.skillName}" from that branch, with this body:

${parsed.summary}

This is a proposed new Admin skill, drafted by the Admin agent and approved for review by Jason. It is staged under ${PROPOSED_SKILL_PATH_PREFIX} and is inert — not registered or reachable anywhere — until a human reviews it and, separately, wires it into the real skill registry.`;

    // Mirrors BaseAgent.executeDelegateToAgent()'s handoff shape exactly —
    // route-handoff.ts/server.ts's consumer is already generic across all
    // six agent roles, so no new plumbing is needed for this handoff.
    agent.emit('agent:handoff_requested', {
      task: buildDelegatedFreeformTask(task, 'github', prPrompt),
    });
    agent.emit('agent:propose_skill_response', {
      taskId: task.id,
      response: `Sent to the GitHub Dev Agent to open a draft PR for "${parsed.skillName}". Check /github or Approvals for the next steps — each write it makes (branch, file, PR) still needs your separate approval.`,
    });
  },
};
