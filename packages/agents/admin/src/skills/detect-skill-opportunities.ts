import { randomUUID } from 'crypto';
import type { AgentRole, AgentTask, MemoryEntry, Skill } from '@wireassist/core';

// Every freeform.ts skill remembers its own request tagged 'freeform_request'
// (see each agent's freeform.ts) — this is what's being searched here.
const FREEFORM_REQUEST_TAG = 'freeform_request';
const DEFAULT_LIMIT = 200;

const VALID_ROLES = new Set<AgentRole>([
  'admin',
  'content',
  'research',
  'gtm',
  'strategy',
  'github',
]);

export interface DetectSkillOpportunitiesInput {
  limit?: number;
}

type PatternResult =
  | { kind: 'no_pattern' }
  | { kind: 'pattern'; description: string; examples: string[]; suggestedRole: AgentRole };

function buildDetectionPrompt(memories: MemoryEntry[]): string {
  const list = memories.map((m) => `- [${m.agentRole}] "${m.content}"`).join('\n');
  return `These are recent freeform requests Jason has made to WireAssist's agents (each tagged
with which agent handled it). Look for a genuine repeated pattern — the same kind of ask, showing
up more than once, that a purpose-built skill could handle better than a one-off freeform chat
reply. Do NOT force a pattern that isn't really there; most of the time there won't be one yet.

REQUESTS:
${list}

Respond in EXACTLY one of these two formats, nothing else before or after:

If there's no clear repeated pattern:
NO_PATTERN_FOUND

If you find one:
PATTERN: <one-sentence description of the repeated need>
ROLE: <which agent's requests form this pattern — one of: admin, content, research, gtm, strategy, github>
EXAMPLES: <2-4 of the actual requests above that form this pattern, separated by " | ">`;
}

function parsePatternResponse(response: string): PatternResult {
  const description = response.match(/PATTERN:\s*(.+)/)?.[1]?.trim();
  const examplesRaw = response.match(/EXAMPLES:\s*(.+)/)?.[1]?.trim();
  if (!description || !examplesRaw) {
    return { kind: 'no_pattern' };
  }

  const roleRaw = response.match(/ROLE:\s*(\w+)/)?.[1]?.trim() as AgentRole | undefined;
  const suggestedRole = roleRaw && VALID_ROLES.has(roleRaw) ? roleRaw : 'admin';
  const examples = examplesRaw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return { kind: 'pattern', description, examples, suggestedRole };
}

export const detectSkillOpportunitiesSkill: Skill<DetectSkillOpportunitiesInput, void> = {
  name: 'detect_skill_opportunities',
  role: 'admin',
  description:
    "Look for a repeated pattern across recent freeform requests, and — only if Jason approves the pattern itself — hand off a draft request to the relevant agent's own propose_skill. Never opens a PR unilaterally: the drafted code still needs its own separate approval from that agent's propose_skill flow.",

  async execute({ agent, task, input }) {
    const memories = agent.listMemories({
      tags: [FREEFORM_REQUEST_TAG],
      limit: input.limit ?? DEFAULT_LIMIT,
    });

    if (memories.length === 0) {
      agent.emit('agent:detect_skill_opportunities_complete', {
        taskId: task.id,
        summary: 'No freeform requests recorded yet — nothing to look for a pattern in.',
        patternFound: false,
      });
      return;
    }

    const raw = await agent.think(buildDetectionPrompt(memories));
    const parsed = parsePatternResponse(raw);

    if (parsed.kind === 'no_pattern') {
      agent.emit('agent:detect_skill_opportunities_complete', {
        taskId: task.id,
        summary: 'No clear repeated pattern found in recent requests.',
        patternFound: false,
      });
      return;
    }

    // Gate 1 of 2: the pattern itself. Only on approval does anything get
    // drafted — and even then, only a request handed to the relevant
    // agent's own propose_skill, which gates the actual drafted code
    // separately (gate 2), through the exact same Approvals-tab/Telegram
    // path as every other approval in this codebase.
    //
    // Hands the pattern description straight to the suggested agent's own
    // propose_skill task — reuses that agent's real pathPrefix/few-shot
    // config exactly as if Jason had asked it directly, rather than this
    // skill needing to know every other agent's drafting config itself
    // (which would mean agent-admin importing from every other agent
    // package — a circular dependency, since they all depend on
    // agent-admin for BaseAgent). Built now, before the approval wait, and
    // passed as resumeTask so it survives a restart between approval and
    // this continuation resuming — see ApprovalRequest.resumeTask.
    const handoffTask: AgentTask = {
      id: randomUUID(),
      agentRole: parsed.suggestedRole,
      description: `Draft a new ${parsed.suggestedRole} skill for detected pattern: ${parsed.description}`,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: { type: 'propose_skill', request: parsed.description },
      approvalRequired: false,
    };

    const approved = await agent.proposeAction(
      task,
      `Draft a skill for pattern: ${parsed.description}`,
      {
        patternDescription: parsed.description,
        exampleRequests: parsed.examples,
        suggestedRole: parsed.suggestedRole,
      },
      handoffTask
    );

    if (!approved) {
      agent.emit('agent:detect_skill_opportunities_complete', {
        taskId: task.id,
        summary: `Pattern noticed but declined: ${parsed.description}`,
        patternFound: true,
        drafted: false,
      });
      return;
    }

    agent.emit('agent:handoff_requested', { task: handoffTask, taskId: task.id });

    agent.emit('agent:detect_skill_opportunities_complete', {
      taskId: task.id,
      summary: `Pattern approved — sent to the ${parsed.suggestedRole} agent to draft a skill for: ${parsed.description}`,
      patternFound: true,
      drafted: true,
    });
  },
};
