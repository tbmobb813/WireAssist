import type { AIContext, FileChange } from '../types';
export declare class ContextBuilder {
  private context;
  addFiles(filePaths: string[]): this;
  addGitContext(repoPath: string): this;
  addWorkspace(workspacePath: string): this;
  addRecentChanges(changes: FileChange[]): this;
  build(): Promise<AIContext>;
  private detectLanguage;
  private analyzeProjectStructure;
}
//# sourceMappingURL=builder.d.ts.map
