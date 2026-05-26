# Project Context Detection

## Overview

The Project Context Detection feature automatically identifies the type of project you're working in and displays relevant metadata alongside git information. This helps the AI provide more contextual and language-specific assistance.

## Supported Project Types

| Language/Framework | Detection File                 | Icon | Metadata Extracted         |
| ------------------ | ------------------------------ | ---- | -------------------------- |
| Node.js            | `package.json`                 | 📦   | name, version, description |
| Rust               | `Cargo.toml`                   | 🦀   | name, version, description |
| Python             | `pyproject.toml` or `setup.py` | 🐍   | name, version, description |
| Go                 | `go.mod`                       | 🐹   | module path                |
| Java               | `pom.xml`                      | ☕   | artifactId, version        |
| Ruby               | `Gemfile`                      | 💎   | gem name (from directory)  |
| PHP                | `composer.json`                | 🐘   | name, version, description |
| C#                 | `*.csproj`                     | #️⃣   | project name (from file)   |

## Architecture

### Backend (Rust)

**File:** `src-tauri/src/project.rs`

```rust
pub struct ProjectInfo {
    pub project_type: ProjectType,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
}

pub enum ProjectType {
    Node, Rust, Python, Go, Java, Ruby, Php, CSharp, Unknown
}
```

**Detection Logic:**

1. Checks for marker files in the project directory (package.json, Cargo.toml, etc.)
2. Parses the first matching file to extract metadata
3. Returns ProjectInfo with type and optional metadata

**Tauri Command:** `detect_project_type`

- **Input:** Optional path (defaults to current directory)
- **Output:** `Result<ProjectInfo, String>`
- **Registration:** Added to `commands/project.rs` and registered in `lib.rs`

### Frontend (TypeScript/React)

**File:** `src/components/GitContextWidget.tsx`

**Features:**

- Displays project type icon next to git icon
- Shows project name in header subtitle
- Expands to show full project details (name, version, description)
- Includes project info when "Include Context" button is clicked

**Integration:**

```typescript
interface ProjectInfo {
  project_type: string;
  name: string | null;
  version: string | null;
  description: string | null;
}

// Invokes Tauri command
const info = await invoke<ProjectInfo>("detect_project_type", {
  path: projectPath || undefined,
});
```

## User Experience

### Collapsed View

```
🦀 🔀 Rust Project
   feat/UI/UX • linux-ai-assistant
```

### Expanded View

```
📦 Project Info
   🦀 Linux AI Assistant v0.1.0
   Rust • AI assistant for Linux developers

✓ Working directory clean
🔗 https://github.com/user/linux-ai-assistant

📝 Recent Commits
   abc1234 • 2024-01-15
   Add project detection feature
   John Doe

[Include Git Context in Next Message]
```

### Context Injection

When "Include Context" is clicked, the following markdown is injected into the message input:

```markdown
## 📦 Project Information

**Type:** Rust
**Name:** linux-ai-assistant
**Version:** 0.1.0
**Description:** AI assistant for Linux developers

---

## 🔀 Git Context

**Branch:** feat/UI/UX  
**Status:** ✓ Clean working directory  
**Remote:** https://github.com/user/linux-ai-assistant

### Recent Commits

**abc1234** (2024-01-15) - John Doe  
Add project detection feature

**def5678** (2024-01-14) - Jane Smith  
Update UI components
```

## Benefits

1. **Context-Aware AI:** The AI knows what language/framework you're using and can provide better suggestions
2. **Quick Project Overview:** See project name, version, and type at a glance
3. **Comprehensive Context:** Combines project type + git context in one widget
4. **Zero Configuration:** Automatically detects based on standard project files

## Testing

To test project detection:

1. Navigate to a project directory
2. Open Linux AI Assistant
3. Look for the context widget in the chat interface
4. Verify the correct icon and project type are displayed
5. Expand to see full project details
6. Click "Include Context" to verify formatted output

### Test Cases

- ✅ Rust project (this repository!)
- ⏳ Node.js project with package.json
- ⏳ Python project with pyproject.toml
- ⏳ Go project with go.mod
- ⏳ Unknown project type (should hide icon, show "Git Context")

## Future Enhancements

1. **Workspace Detection:** Support monorepos with multiple projects
2. **Language Versions:** Detect Node/Python/Go version from config files
3. **Dependencies:** Show key dependencies in expanded view
4. **Scripts:** Quick access to npm scripts or cargo commands
5. **Framework Detection:** Identify React, Vue, Next.js, etc.
6. **Custom Icons:** Allow users to customize project type icons
7. **AI Model Routing:** Automatically route to best model based on project type
   - Rust projects → Claude (excellent at Rust)
   - Python projects → GPT-4 (strong Python knowledge)
   - Web projects → Gemini (good at modern web)

## Related Features

- **Git Context Detection** (`src-tauri/src/commands/git.rs`)
- **Terminal Integration** (`cli/src/main.rs`)
- **IPC Communication** (`src-tauri/src/ipc.rs`)

## Dependencies

- **toml** (0.8): Parse Cargo.toml files
- **serde_json** (1.0): Parse package.json, composer.json
- Standard library: File system operations

## Files Changed

### Backend

- `src-tauri/src/project.rs` - New project detection module
- `src-tauri/src/commands/project.rs` - Added detect_project_type command
- `src-tauri/src/lib.rs` - Registered new command
- `src-tauri/Cargo.toml` - Added toml dependency

### Frontend

- `src/components/GitContextWidget.tsx` - Enhanced with project detection UI

## Documentation

- [CLI Quick Start](./CLI_QUICK_START.md) - Terminal integration guide
- [User Guide](./USER_GUIDE.md) - End-user documentation
- [Developer Guide](./DEVELOPER_GUIDE.md) - Architecture overview
