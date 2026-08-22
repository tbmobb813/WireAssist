import type { Skill } from '@wireassist/core';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export const sendEmailSkill: Skill<SendEmailInput, void> = {
  name: 'send_email',
  role: 'admin',
  description: 'Send an email, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { to, subject, body, threadId } = input;

    // Always require approval before sending
    const approved = await agent.proposeAction(task, `Send email to ${to}: "${subject}"`, {
      to,
      subject,
      body,
      threadId,
    });

    if (!approved) return;

    await agent.useTool('gmail_send', { to, subject, body, threadId });
    agent.remember(`Sent email to ${to}: ${subject}`, ['email', 'sent']);
  },
};
