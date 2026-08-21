import type { AgentRole, AgentTask } from '../agents/types';
import type { Skill, SkillAgentHandle } from './types';

export interface ProposeSkillInput {
  request: string;
}

// Self-referential by default — a drafted skill's file paths are always
// relative to this repo's own source tree, so the target is normally this
// repo. Confirmed live: without this, the GitHub Dev Agent correctly asked
// for owner/repo instead of guessing, rather than proceeding — override via
// env var if this codebase is ever forked/renamed.
function defaultTargetRepo(): string {
  return process.env.WIREASSIST_REPO ?? 'tbmobb813/WireAssist';
}

function buildDraftingPrompt(params: {
  request: string;
  role: AgentRole;
  roleLabel: string;
  fewShotExample: string;
}): string {
  return `A user has asked for a new capability. Decide whether you can draft a concrete new ${params.roleLabel}
skill for it, or whether the request is too vague to draft anything real.

THE EXACT INTERFACE EVERY SKILL MUST IMPLEMENT:

interface Skill<TInput, TOutput> {
  name: string;
  role: '${params.role}';
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
${params.fewShotExample}
\`\`\`

Rules:
- Any action that changes something outside this process (sends an email, posts content, calls
  a mutating tool) MUST go through agent.proposeAction() first — never execute it directly.
- Only use tools/methods that already exist on SkillAgentHandle above. Do not assume a new
  useTool() tool name exists unless the request is clearly about combining existing capabilities.
- If the request is too vague to draft something concrete and correct, do NOT guess — ask one
  specific clarifying question instead.

The user's request: "${params.request}"

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

export interface ProposeSkillConfig {
  role: AgentRole;
  // Human-readable label used in prompt/PR text — e.g. "Admin", "Content",
  // "GitHub Dev", "NixOps", "Research", "GTM".
  roleLabel: string;
  // Real per-agent variance — where a drafted skill for this agent gets
  // staged, e.g. 'packages/agents/admin/src/skills/proposed/'.
  pathPrefix: string;
  // One real existing skill on this agent, shown as a few-shot example —
  // kept as a literal string (not an import) so the example in the prompt
  // can never silently drift from what's actually being requested, and so
  // this has zero runtime dependency on that skill's internals.
  fewShotExample: string;
  // Hands the PR-opening request to the GitHub Dev Agent. Every agent
  // package already depends on @wireassist/agent-admin for BaseAgent, so
  // the real per-agent call site passes
  // `(task, prompt) => buildDelegatedFreeformTask(task, 'github', prompt)`
  // straight from '@wireassist/agent-admin' — this factory in
  // wireassist/core stays decoupled from that agent-specific delegation
  // mechanism rather than importing it directly (agent-admin depends on
  // core, so core can't depend back on agent-admin).
  buildHandoffTask: (task: AgentTask, prompt: string) => AgentTask;
  targetRepo?: string;
}

// The actual drafting/propose/handoff logic, factored out from
// createProposeSkillSkill() so a second caller (a future pattern-detection
// skill that drafts from an inferred pattern rather than a direct user
// request) can reuse it without going through a full Skill's execute()
// dispatch.
export async function draftAndProposeSkill(
  config: ProposeSkillConfig & { agent: SkillAgentHandle; task: AgentTask; request: string }
): Promise<void> {
  const { agent, task, request, role, roleLabel, pathPrefix, fewShotExample, buildHandoffTask } =
    config;
  const targetRepo = config.targetRepo ?? defaultTargetRepo();

  const drafted = await agent.think(
    buildDraftingPrompt({ request, role, roleLabel, fewShotExample })
  );
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
  const prPrompt = `Open a draft pull request proposing a new ${roleLabel} skill, in the ${targetRepo} repository. Do this in order:
1. Create a new branch named "skill-proposal/${slug}" from the default branch.
2. Add a new file at "${pathPrefix}${parsed.filename}" on that branch with exactly this content:

\`\`\`ts
${parsed.code}
\`\`\`

3. Open a DRAFT pull request titled "Proposed skill: ${parsed.skillName}" from that branch, with this body:

${parsed.summary}

This is a proposed new ${roleLabel} skill, drafted by the ${roleLabel} agent and approved for review by Jason. It is staged under ${pathPrefix} and is inert — not registered or reachable anywhere — until a human reviews it and, separately, wires it into the real skill registry.`;

  // Mirrors BaseAgent.executeDelegateToAgent()'s handoff shape exactly —
  // route-handoff.ts/server.ts's consumer is already generic across all six
  // agent roles, so no new plumbing is needed for this handoff.
  agent.emit('agent:handoff_requested', { task: buildHandoffTask(task, prPrompt) });
  agent.emit('agent:propose_skill_response', {
    taskId: task.id,
    response: `Sent to the GitHub Dev Agent to open a draft PR for "${parsed.skillName}". Check /github or Approvals for the next steps — each write it makes (branch, file, PR) still needs your separate approval.`,
  });
}

// Modeled on createFreeformSkill()'s same factory pattern — real per-agent
// variance (role, pathPrefix, fewShotExample) as required parameters,
// shared drafting/parsing/handoff logic staying unparameterized inside.
export function createProposeSkillSkill(
  config: ProposeSkillConfig
): Skill<ProposeSkillInput, void> {
  return {
    name: 'propose_skill',
    role: config.role,
    description: `Drafts a new ${config.roleLabel} skill as real TypeScript for a capability you describe, and — once you approve the code — asks the GitHub Dev Agent to open it as a draft PR for review. Never wires the drafted code into the running system itself; that stays a separate, manual step after you've reviewed and merged it.`,

    async execute({ agent, task, input }) {
      await draftAndProposeSkill({ ...config, agent, task, request: input.request });
    },
  };
}
