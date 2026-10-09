import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  setRawCapture,
  type AgentTask,
  type SkillAgentHandle,
  type ThinkResult,
} from '@wireassist/core';
import { emailTriageSkill } from '../skills/email-triage';

const task: AgentTask = {
  id: 'task-triage',
  agentRole: 'admin',
  description: 'Triage my inbox',
  status: 'queued',
  createdAt: new Date(),
  updatedAt: new Date(),
  input: { type: 'email_triage' },
  approvalRequired: false,
};

const VALID_REPLY = JSON.stringify({
  categories: { urgent: [], replyNeeded: [], fyi: [], ignore: [] },
  summary: 'Nothing needs attention.',
});

const ok = (content: string): ThinkResult => ({
  content,
  finishReason: 'end_turn',
  truncated: false,
});
const cutOff = (content: string): ThinkResult => ({
  content,
  finishReason: 'max_tokens',
  truncated: true,
});

function makeHandle(replies: ThinkResult[], withDetailed = true) {
  const queue = [...replies];
  const next = () => {
    const reply = queue.shift();
    if (!reply) throw new Error('test ran out of scripted replies');
    return reply;
  };
  const thinkDetailed = jest.fn(async () => next());
  const think = jest.fn(async () => next().content);
  const handle = {
    think,
    ...(withDetailed ? { thinkDetailed } : {}),
    useTool: jest.fn(async (name: string) =>
      name === 'gmail_list_threads'
        ? [{ id: 't1' }]
        : { id: 't1', from: 'a@example.com', subject: 'hi', snippet: '...', date: 'today' }
    ),
    loadContext: jest.fn().mockResolvedValue(''),
    remember: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(true),
    emit: jest.fn(),
    runToolLoop: jest.fn(),
    listDecisions: jest.fn().mockReturnValue([]),
    listPending: jest.fn().mockReturnValue([]),
    listOrphanedApprovals: jest.fn().mockReturnValue([]),
    listMemories: jest.fn().mockReturnValue([]),
  } as unknown as SkillAgentHandle;
  return { handle, think, thinkDetailed };
}

describe('emailTriageSkill — model reply handling', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const run = (handle: SkillAgentHandle) =>
    emailTriageSkill.execute({ agent: handle, task, input: {} });

  it('uses a single model call when the first reply parses', async () => {
    const { handle, thinkDetailed } = makeHandle([ok(VALID_REPLY)]);
    const result = await run(handle);
    expect(thinkDetailed).toHaveBeenCalledTimes(1);
    expect(thinkDetailed).toHaveBeenCalledWith(expect.any(String), '', 8192);
    expect(result.summary).toBe('Nothing needs attention.');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('retries once when the first reply is cut off, and succeeds on the second', async () => {
    const { handle, thinkDetailed } = makeHandle([
      cutOff('{"categories": {"urgent": [{"threadId": "t1", "reason": "sto'),
      ok(VALID_REPLY),
    ]);
    const result = await run(handle);
    expect(thinkDetailed).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe('Nothing needs attention.');
    // The failed first attempt is still logged with its finish reason.
    expect(errorSpy.mock.calls.flat().join(' ')).toContain('finishReason=max_tokens');
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('retrying once');
  });

  it('retries once on malformed (not truncated) JSON too', async () => {
    const { handle, thinkDetailed } = makeHandle([
      ok('Sure! Here you go: not json'),
      ok(VALID_REPLY),
    ]);
    await run(handle);
    expect(thinkDetailed).toHaveBeenCalledTimes(2);
  });

  it('gives up after exactly one retry and says the reply was cut off', async () => {
    const { handle, thinkDetailed } = makeHandle([cutOff('{"categories": {'), cutOff('{"cat')]);
    const error = await run(handle).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/cut off at the output-token limit/);
    expect((error as Error).message).toMatch(/finish reason: max_tokens/);
    expect(thinkDetailed).toHaveBeenCalledTimes(2);
  });

  it('reports invalid JSON (not "cut off") when the failing reply ended normally', async () => {
    const { handle, thinkDetailed } = makeHandle([ok('not json at all'), ok('still not json')]);
    const error = await run(handle).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/returned invalid JSON during triage/);
    expect((error as Error).message).toMatch(/14 chars, finish reason: end_turn/);
    expect(thinkDetailed).toHaveBeenCalledTimes(2);
  });

  it('never puts the model reply in the thrown error or the error-level log', async () => {
    const secret = 'Subject: confidential salary offer';
    const { handle } = makeHandle([ok(`oops ${secret}`), ok(`oops again ${secret}`)]);
    const error = await run(handle).catch((e: Error) => e);
    expect((error as Error).message).not.toContain('confidential');
    // console.error carries the error-level log lines; the reply text must not be there.
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('confidential');
  });

  it('writes the raw reply to the log only while Diagnostic logging is switched on', async () => {
    const previousHome = process.env.WIREASSIST_HOME;
    const home = mkdtempSync(join(tmpdir(), 'wa-triage-'));
    process.env.WIREASSIST_HOME = home;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const logged = () => logSpy.mock.calls.flat().join(' ');
    try {
      // Off (the default): the failure is reported, the reply text is not.
      await expect(
        run(makeHandle([ok('oops OFF-TEXT'), ok('oops OFF-TEXT')]).handle)
      ).rejects.toThrow();
      expect(logged()).not.toContain('OFF-TEXT');

      // On: same failure, now the reply text is written for diagnosis.
      setRawCapture(true);
      await expect(
        run(makeHandle([ok('oops ON-TEXT'), ok('oops ON-TEXT')]).handle)
      ).rejects.toThrow();
      expect(logged()).toContain('ON-TEXT');
    } finally {
      if (previousHome === undefined) delete process.env.WIREASSIST_HOME;
      else process.env.WIREASSIST_HOME = previousHome;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('carries the urgent reason on the proposed action, outside the tool payload', async () => {
    const reply = JSON.stringify({
      categories: {
        urgent: [
          { threadId: 't1', from: 'a@example.com', subject: 'hi', reason: 'Invoice due Friday' },
        ],
        replyNeeded: [],
        fyi: [],
        ignore: [],
      },
      summary: 'One urgent.',
    });
    const { handle } = makeHandle([ok(reply)]);
    const result = await run(handle);
    const action = result.proposedActions[0];
    expect(action.reason).toBe('Invoice due Friday');
    expect(action.payload).not.toHaveProperty('reason');
    // What the user is shown for approval includes the reason...
    expect(handle.proposeAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        actions: [expect.objectContaining({ reason: 'Invoice due Friday' })],
      })
    );
    // ...but the Gmail tool still receives only its own payload.
    expect(handle.useTool).toHaveBeenCalledWith('gmail_label_thread', action.payload);
  });

  it('falls back to think() on a handle without thinkDetailed', async () => {
    const { handle, think } = makeHandle([ok(VALID_REPLY)], false);
    const result = await run(handle);
    expect(think).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('Nothing needs attention.');
  });
});
