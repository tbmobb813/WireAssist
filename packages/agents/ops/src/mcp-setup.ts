import type { MCPClient } from '@wireassist/core';
import { listWorkflows } from './context-loader';

// Registers NixOps's own local MCP tools — currently just a way for the
// chat tool loop to discover valid workflow names before calling
// run_workflow_skill, instead of guessing one and burning a full DATA-loop
// run on an invalid name. Synchronous and local (reads context/workflows/
// off disk), unlike Admin's/Research's MCP setup which talk to real
// external APIs — still registered the same way so useTool() sees it as
// any other authorized tool.
export function setupOpsMCP(mcp: MCPClient): void {
  mcp.register('list_workflows', async () => ({ workflows: listWorkflows() }));
}
