import type { Skill } from '@wireassist/core';

export interface ScheduleEventInput {
  summary: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
}

export const scheduleEventSkill: Skill<ScheduleEventInput, void> = {
  name: 'schedule_event',
  role: 'admin',
  description: 'Create a calendar event, gated by approval.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const { summary, start, end, attendees, description } = input;

    const approved = await agent.proposeAction(
      task,
      `Create calendar event: "${summary}" on ${start}`,
      { summary, start, end, attendees, description }
    );

    if (!approved) return;

    await agent.useTool('calendar_create_event', {
      summary,
      start,
      end,
      attendees,
      description,
    });

    agent.remember(`Scheduled: ${summary} on ${start}`, ['calendar', 'scheduled']);
  },
};
