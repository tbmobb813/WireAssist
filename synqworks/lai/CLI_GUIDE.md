# Linux AI Assistant - CLI Guide

The `lai` (Linux AI Assistant) command-line tool provides terminal-based access to the desktop assistant through IPC (Inter-Process Communication).

## Installation & Setup

The CLI tool is built alongside the main application and provides core functionality for automation and development workflows.

**Building the CLI:**

```bash
cd linux-ai-assistant/cli
cargo build --release
# Binary available at: target/release/linux-ai-cli
```

**Prerequisites:**

- Linux AI Assistant desktop app must be running
- IPC server listens on `127.0.0.1:39871` (automatic when app starts)

## Core Commands

### Ask Command

Send messages to the AI assistant:

```bash
# Basic question
lai ask "How do I optimize this SQL query?"

# With custom model
lai ask "Explain async/await" --model gpt-4

# With custom provider
lai ask "Review this code" --provider anthropic

# Force new conversation
lai ask "Start fresh topic" --new
```

### Last Command

Retrieve the most recent assistant response:

```bash
# Get last response
lai last

# Perfect for scripting
response=$(lai last)
echo "AI says: $response"
```

### Notify Command

Send desktop notifications through the app:

```bash
# Simple notification
lai notify "Build completed successfully"

# Script integration
if make build; then
    lai notify "✅ Build successful"
else
    lai notify "❌ Build failed"
fi
```

### Capture Command

Execute terminal commands safely with AI analysis and error handling:

```bash
# Basic command capture
lai capture "npm test"

# Capture with immediate analysis
lai capture "python script.py" --analyze

# Capture build commands
lai capture "cargo build --release"

# Capture with timeout
lai capture "long-running-command" --timeout 60

# Capture and get suggestions
lai capture "git push origin main" --suggest
```

**Features:**

- **Safety Validation**: Dangerous commands are flagged before execution
- **Error Analysis**: AI analyzes output and provides suggestions
- **Project Context**: Commands are executed with project awareness
- **Secure Execution**: Sandboxed environment prevents system damage

**Command Options:**

- `--analyze` - Request AI analysis of command output
- `--timeout <seconds>` - Set execution timeout (default: 30)
- `--suggest` - Get AI suggestions for errors or improvements
- `--dry-run` - Validate command without execution

**Safety Features:**

- Commands like `rm -rf /` are blocked
- Destructive operations require confirmation
- Project-aware file operations respect .gitignore
- User data protection with sandbox isolation

**Integration Examples:**

```bash
# Development workflow
lai capture "npm run build" && lai capture "npm run test"

# Git workflow with analysis
lai capture "git status" --analyze
lai capture "git log --oneline -10" --suggest

# System monitoring
lai capture "ps aux | grep node" --analyze
lai capture "df -h" --suggest

# Error debugging
lai capture "python debug_script.py" --analyze --timeout 120
```

### Create Command (Development Only)

Insert test messages for development and testing (requires `DEV_MODE=1`):

```bash
# Enable development mode
export DEV_MODE=1

# Create test assistant message
lai create "This is a test response from the assistant"

# Create in specific conversation
lai create "Follow-up message" --conversation-id "uuid-here"

# Verify creation
lai last
```

## Development Workflows

### Testing & Development

```bash
# Start backend in dev mode
export DEV_MODE=1
cd linux-ai-assistant
pnpm run tauri -- dev

# In another terminal, test CLI functionality
cd linux-ai-assistant/cli

# Test basic IPC communication
cargo run -- notify "Development test"

# Create test data
cargo run -- create "Sample assistant response"

# Verify test data
cargo run -- last

# Test full ask flow (requires running backend)
cargo run -- ask "What is 2+2?"
```

### Automation Scripts

**Git Integration:**

```bash
#!/bin/bash
# git-ai-commit.sh - AI-powered commit messages

# Get staged changes
diff=$(git diff --cached)

if [ -z "$diff" ]; then
    echo "No staged changes"
    exit 1
fi

# Ask AI for commit message
lai ask "Generate a concise git commit message for these changes: $diff" --new

# Get the response
commit_msg=$(lai last)

echo "Suggested commit message:"
echo "$commit_msg"

read -p "Use this message? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "$commit_msg"
fi
```

**Build Notifications:**

```bash
#!/bin/bash
# notify-build.sh - Build status notifications

start_time=$(date +%s)

if make build; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    lai notify "✅ Build completed successfully in ${duration}s"
else
    lai notify "❌ Build failed - check logs"
    exit 1
fi
```

**Code Review Assistant:**

```bash
#!/bin/bash
# code-review.sh - AI code review

if [ -z "$1" ]; then
    echo "Usage: $0 <file>"
    exit 1
fi

file="$1"
content=$(cat "$file")

lai ask "Please review this code for potential issues, improvements, and best practices:

\`\`\`$(file --mime-type -b "$file" | cut -d'/' -f2)
$content
\`\`\`" --new

echo "Review complete. Response:"
lai last
```

## IPC Communication Details

The CLI communicates with the desktop app via TCP IPC on localhost:39871.

**Message Format:**

```json
{
  "type": "ask|notify|last|create",
  "message": "optional string",
  "payload": {
    "prompt": "user message",
    "model": "optional model override",
    "provider": "optional provider override",
    "new": false
  }
}
```

**Response Format:**

```json
{
  "status": "ok|error",
  "data": {
    "id": "message-uuid",
    "content": "response text",
    "conversation_id": "conv-uuid",
    "role": "assistant",
    "timestamp": 1698765432,
    "tokens_used": 150
  }
}
```

## Environment Variables

```bash
# Enable development features
export DEV_MODE=1

# Custom IPC endpoint (if needed)
export LAI_IPC_HOST=127.0.0.1
export LAI_IPC_PORT=39871

# Debug logging
export RUST_LOG=debug
```

## Error Handling

**Common Issues:**

```bash
# Connection refused - app not running
lai ask "test"
# Error: connect 127.0.0.1:39871 failed: Connection refused

# Solution: Start the desktop app first
pnpm -w -C linux-ai-assistant run tauri -- dev

# DEV_MODE required for create command
lai create "test"
# Error: create command only available in DEV_MODE

# Solution: Enable dev mode
export DEV_MODE=1
lai create "test"
```

**Debugging:**

```bash
# Enable debug logging
RUST_LOG=debug lai ask "test question"

# Check if IPC server is listening
ss -ltnp | grep 39871

# Test basic connectivity
echo '{"type":"notify","message":"test"}' | nc 127.0.0.1 39871
```

## Testing Framework Integration

**Automated Smoke Testing:**

```bash
# Run comprehensive E2E tests
./dev/smoke_test_ipc.sh

# Test output:
# [smoke] ✅ All tests passed!
# - Backend started successfully with DEV_MODE=1
# - IPC server bound to port 39871
# - CLI create command inserted message
# - CLI last command retrieved correct message
```

**Custom Test Scripts:**

```bash
#!/bin/bash
# test-cli-integration.sh

set -e

echo "Testing CLI integration..."

# Start backend in background
export DEV_MODE=1
pnpm -w -C linux-ai-assistant run tauri -- dev &
BACKEND_PID=$!

# Wait for startup
sleep 5

# Test notify
if lai notify "Test notification"; then
    echo "✅ Notify command works"
else
    echo "❌ Notify command failed"
    exit 1
fi

# Test create/last flow
if lai create "Test message for integration"; then
    response=$(lai last)
    if [[ "$response" == "Test message for integration" ]]; then
        echo "✅ Create/Last commands work"
    else
        echo "❌ Create/Last mismatch"
        exit 1
    fi
else
    echo "❌ Create command failed"
    exit 1
fi

# Cleanup
kill $BACKEND_PID
echo "✅ All CLI integration tests passed"
```

## Performance Considerations

**Response Times:**

- IPC roundtrip: ~1-5ms
- Simple commands (notify/last): ~10-50ms
- AI requests: Variable (depends on provider/model)

**Memory Usage:**

- CLI binary: ~5-10MB RAM when running
- Minimal impact on system resources

**Concurrency:**

- Multiple CLI instances can run simultaneously
- IPC server handles concurrent connections
- Responses are properly isolated per request

## Security & Safety

### Command Validation

The `capture` command includes comprehensive safety measures:

**Dangerous Command Detection:**

```bash
# These commands are flagged and require confirmation
lai capture "rm -rf /"          # System destruction
lai capture "chmod 777 /etc"     # Permission tampering
lai capture "dd if=/dev/zero"    # Data destruction
lai capture ":(){ :|:& };:"      # Fork bomb
```

**Safe Command Categories:**

```bash
# These commands are generally safe
lai capture "ls -la"             # File listing
lai capture "git status"         # Git operations
lai capture "npm test"           # Package manager tasks
lai capture "ps aux"             # Process inspection
lai capture "df -h"              # Disk usage
```

### Sandbox Environment

The capture system provides isolation:

- **Working Directory**: Commands execute in detected project directory
- **Environment Isolation**: Limited environment variable access
- **Resource Limits**: CPU and memory usage constraints
- **Network Restrictions**: Configurable network access controls
- **File System Protection**: Write access limited to project directory

### Privacy Protection

- **No Command Logging**: Commands are not permanently stored by default
- **Local Analysis**: Error analysis happens locally when possible
- **API Integration**: Only analysis results sent to AI providers (not raw command output)
- **User Control**: Full control over what data is shared with AI providers

### Best Practices

**For Development:**

```bash
# Good: Project-specific commands
lai capture "npm run build"
lai capture "python -m pytest"
lai capture "git diff HEAD~1"

# Avoid: System-wide changes
# lai capture "sudo systemctl restart networking"
# lai capture "chmod -R 777 /"
```

**For Scripts:**

```bash
# Always validate before bulk operations
lai capture "find . -name '*.tmp'" --dry-run
# Only proceed if safe
lai capture "find . -name '*.tmp' -delete"
```

## Use Cases & Examples

**1. Development Workflow Automation:**

```bash
# Pre-commit hook
#!/bin/bash
export DEV_MODE=1
lai create "Starting commit review process"
# ... other pre-commit logic
lai notify "Pre-commit checks completed"
```

**2. CI/CD Integration:**

```bash
# In GitHub Actions or similar
- name: Notify AI Assistant
  run: |
    if [ "${{ job.status }}" == "success" ]; then
      lai notify "✅ CI pipeline completed successfully"
    else
      lai notify "❌ CI pipeline failed"
    fi
```

**3. Monitoring & Alerting:**

```bash
# System monitoring script
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')

if (( $(echo "$cpu_usage > 80" | bc -l) )); then
    lai notify "⚠️ High CPU usage detected: ${cpu_usage}%"
fi
```

**4. Learning & Documentation:**

```bash
# Quick learning helper
learn() {
    lai ask "Explain $1 in simple terms with examples" --new
    lai last | tee "~/notes/$(date +%Y%m%d)-$1.md"
}

# Usage: learn "docker containers"
```

## Best Practices

1. **Check app status** before CLI operations
2. **Use DEV_MODE judiciously** - only for development/testing
3. **Handle errors gracefully** in scripts
4. **Leverage last command** for response processing
5. **Combine with system tools** for powerful workflows
6. **Use meaningful notification messages** for debugging
7. **Test IPC connectivity** before complex operations

## Future Enhancements

Planned improvements for the CLI tool:

- **Configuration file support** (`~/.config/lai/cli.toml`)
- **Conversation management** (list, switch, delete)
- **Response formatting options** (json, markdown, plain)
- **Batch operation support** (multiple questions)
- **Local model integration** (direct Ollama access)
- **Plugin system** for custom commands

## Getting Help

```bash
# Show usage information
lai --help

# Check specific command help
lai ask --help
lai create --help

# Verify installation
lai --version  # (when implemented)

# Test connectivity
lai notify "CLI test message"
```

---

**Version**: 2.0 (IPC-based)  
**Last Updated**: November 2025  
**See Also**: [dev/README.md](../dev/README.md), [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
