'use strict';
// @lai/core/src/context/builder.ts
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.ContextBuilder = void 0;
const fs = __importStar(require('fs'));
const path = __importStar(require('path'));
const child_process_1 = require('child_process');
class ContextBuilder {
  constructor() {
    Object.defineProperty(this, 'context', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: {},
    });
  }
  addFiles(filePaths) {
    this.context.files = filePaths.map((filePath) => ({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
      language: this.detectLanguage(filePath),
    }));
    return this;
  }
  addGitContext(repoPath) {
    try {
      // Get recent diff
      this.context.gitDiff = (0, child_process_1.execSync)('git diff HEAD', {
        cwd: repoPath,
        encoding: 'utf-8',
      });
      // Get recent log
      this.context.gitLog = (0, child_process_1.execSync)('git log --oneline -10', {
        cwd: repoPath,
        encoding: 'utf-8',
      });
      // Get current branch
      const branch = (0, child_process_1.execSync)('git branch --show-current', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
      this.context.gitBranch = branch;
    } catch (error) {
      // Not a git repo or git not available
    }
    return this;
  }
  addWorkspace(workspacePath) {
    this.context.workspace = {
      path: workspacePath,
      structure: this.analyzeProjectStructure(workspacePath),
    };
    return this;
  }
  addRecentChanges(changes) {
    this.context.recentChanges = changes;
    return this;
  }
  async build() {
    return this.context;
  }
  detectLanguage(filePath) {
    const ext = path.extname(filePath);
    const languageMap = {
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
  analyzeProjectStructure(workspacePath) {
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
exports.ContextBuilder = ContextBuilder;
