import {
  GITHUB_TOOL_ALLOWLIST,
  READ_ONLY_GITHUB_TOOLS,
  resolveAuthorizedGithubTools,
} from '../tool-policy';
import type { RemoteToolDefinition } from '../github-client';

function tool(name: string): RemoteToolDefinition {
  return { name, description: `desc for ${name}`, inputSchema: { type: 'object', properties: {} } };
}

describe('resolveAuthorizedGithubTools', () => {
  it('intersects the live server tool list against the allowlist', () => {
    const remoteTools = [tool('issue_read'), tool('add_issue_comment'), tool('merge_pull_request')];
    const authorized = resolveAuthorizedGithubTools(remoteTools);
    const names = authorized.map((t) => t.name);

    expect(names).toContain('issue_read');
    expect(names).toContain('add_issue_comment');
    expect(names).not.toContain('merge_pull_request');
  });

  it('warns (but does not throw) when an allowlisted tool is missing from the live server', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const authorized = resolveAuthorizedGithubTools([tool('issue_read')]);

    expect(authorized.map((t) => t.name)).toEqual(['issue_read']);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('never widens the allowlist based on what the server advertises', () => {
    const remoteTools = [
      ...GITHUB_TOOL_ALLOWLIST,
      'merge_pull_request',
      'delete_branch',
      'push_files',
    ].map(tool);
    const authorized = resolveAuthorizedGithubTools(remoteTools);
    const names = new Set(authorized.map((t) => t.name));

    for (const name of names) {
      expect(GITHUB_TOOL_ALLOWLIST.has(name)).toBe(true);
    }
    expect(names.has('merge_pull_request')).toBe(false);
    expect(names.has('delete_branch')).toBe(false);
    expect(names.has('push_files')).toBe(false);
  });
});

describe('READ_ONLY_GITHUB_TOOLS', () => {
  it('is a strict subset of the full allowlist', () => {
    for (const name of READ_ONLY_GITHUB_TOOLS) {
      expect(GITHUB_TOOL_ALLOWLIST.has(name)).toBe(true);
    }
  });

  it('never includes a write tool', () => {
    expect(READ_ONLY_GITHUB_TOOLS.has('add_issue_comment')).toBe(false);
    expect(READ_ONLY_GITHUB_TOOLS.has('create_pull_request')).toBe(false);
  });
});

describe('GITHUB_TOOL_ALLOWLIST — propose_skill pilot additions', () => {
  it('now includes create_or_update_file and create_branch', () => {
    expect(GITHUB_TOOL_ALLOWLIST.has('create_or_update_file')).toBe(true);
    expect(GITHUB_TOOL_ALLOWLIST.has('create_branch')).toBe(true);
  });

  it('still excludes push_files, delete_file, and merge/admin tools', () => {
    expect(GITHUB_TOOL_ALLOWLIST.has('push_files')).toBe(false);
    expect(GITHUB_TOOL_ALLOWLIST.has('delete_file')).toBe(false);
    expect(GITHUB_TOOL_ALLOWLIST.has('merge_pull_request')).toBe(false);
    expect(GITHUB_TOOL_ALLOWLIST.has('create_repository')).toBe(false);
  });
});
