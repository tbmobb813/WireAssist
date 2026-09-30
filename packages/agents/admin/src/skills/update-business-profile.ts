import type { Skill } from '@wireassist/core';
import { saveBusinessProfile } from '@wireassist/core';

export interface UpdateBusinessProfileInput {
  content: string;
}

export const updateBusinessProfileSkill: Skill<UpdateBusinessProfileInput, void> = {
  name: 'update_business_profile',
  role: 'admin',
  description:
    "Save the shared business profile — a single markdown document about Jason's business " +
    'context that every agent (not just Admin) gets in its own system prompt on every call. ' +
    'This call fully REPLACES the file, so always pass the complete profile: the current one ' +
    '(already visible in your own context under "BUSINESS PROFILE") plus whatever changed, ' +
    'never just the new fragment alone. Use this after an onboarding-style conversation where ' +
    'Jason describes his venture(s), audience, offers, or goals, or whenever he corrects/updates ' +
    'something about that context going forward. No approval gate — this only affects what ' +
    'context agents see, not anything external.',

  async execute({ agent, task, input }) {
    const { content } = input;
    saveBusinessProfile(content);
    agent.remember('Business profile updated.', ['business-profile']);
    agent.emit('agent:business_profile_updated', { taskId: task.id });
  },
};
