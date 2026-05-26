// @lai/core/src/context/builder.ts

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { AIContext, FileContext, FileChange, ProjectStructure } from '../types';

export class ContextBuilder {
  private context: AIContext = {};

  addFiles(filePaths: string[]): this {
    this.context.files = filePaths.map(filePath => ({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
      language: this.detectLanguage(filePath),
    }));
    return this;
  }

  addGitContext(repoPath: string): this {
    try {
      // Get recent diff
      this.context.gitDiff = execSync('git diff HEAD', {
        cwd: repoPath,
        encoding: 'utf-8',
      });

      // Get recent log
      this.context.gitLog = execSync('git log --oneline -10', {
        cwd: repoPath,
        encoding: 'utf-8',
      });

      // Get current branch
      const branch = execSync('git branch --show-current', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();

      this.context.gitBranch = branch;
    } catch (error) {
      // Not a git repo or git not available
    }
    return this;
  }

  addWorkspace(workspacePath: string): this {
    this.context.workspace = {
      path: workspacePath,
      structure: this.analyzeProjectStructure(workspacePath),
    };
    return this;
  }

  addRecentChanges(changes: FileChange[]): this {
    this.context.recentChanges = changes;
    return this;
  }

  async build(): Promise<AIContext> {
    return this.context;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.dart': 'dart',
    };
    return languageMap[ext] || 'text';
  }

  private analyzeProjectStructure(workspacePath: string): ProjectStructure {
    // Detect project type by looking for key files
    const hasPackageJson = fs.existsSync(path.join(workspacePath, 'package.json'));
    const hasCargoToml = fs.existsSync(path.join(workspacePath, 'Cargo.toml'));
    const hasRequirementsTxt = fs.existsSync(path.join(workspacePath, 'requirements.txt'));
    const hasPubspecYaml = fs.existsSync(path.join(workspacePath, 'pubspec.yaml'));

    let projectType = 'unknown';
    if (hasPackageJson) projectType = 'javascript';
    else if (hasCargoToml) projectType = 'rust';
    else if (hasRequirementsTxt) projectType = 'python';
    else if (hasPubspecYaml) projectType = 'dart';

    return {
      type: projectType,
      rootPath: workspacePath,
      // Add more analysis as needed
    };
  }
}
