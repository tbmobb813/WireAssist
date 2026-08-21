import type { Skill } from '@wireassist/core';

export interface DraftDocumentInput {
  brief: string;
  title?: string;
}

export const draftDocumentSkill: Skill<DraftDocumentInput, void> = {
  name: 'draft_document',
  role: 'admin',
  description: 'Draft a Google Doc from a brief and create it in Drive, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { brief } = input;
    const title = input.title ?? brief.slice(0, 60);

    const memoryContext = await agent.loadContext(brief);
    const content = await agent.think(
      `Write the full content of a document for Jason based on this brief. Write only the
document body itself — no preamble like "Here is the document," no meta-commentary about what
you wrote.

BRIEF: ${brief}`,
      memoryContext
    );

    const approved = await agent.proposeAction(task, `Create Google Doc: "${title}"`, {
      title,
      contentPreview: content.slice(0, 500),
    });

    if (!approved) return;

    const { webViewLink } = (await agent.useTool('drive_create_file', {
      title,
      content,
    })) as { id: string; webViewLink: string };

    agent.remember(`Drafted document "${title}"`, ['admin', 'draft-document']);

    agent.emit('agent:draft_document_complete', {
      taskId: task.id,
      title,
      webViewLink,
    });
  },
};
