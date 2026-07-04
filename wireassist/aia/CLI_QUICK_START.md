# AI Assist - CLI Quick Start

The `aia` command-line tool brings AI assistance directly to your terminal, enabling seamless integration with your Linux development workflow.

## 🚀 Quick Examples

```bash
# Ask a question
aia chat "How do I fix permission denied errors?"

# Analyze piped input (🔥 KILLER FEATURE)
cat error.log | aia analyze
git diff | aia analyze "Review these changes"
npm test 2>&1 | aia analyze

# Open in GUI for detailed responses
aia chat "Explain Rust ownership" --gui

# Capture and analyze command output
aia capture "cargo build" --ai-analyze
```

## 📦 Installation

```bash
# Build the CLI (if not already built)
cd ai-assist/cli
cargo build --release

# Add to your PATH
sudo ln -s $(pwd)/target/release/linux-ai-cli /usr/local/bin/aia

# Or add alias to ~/.bashrc or ~/.zshrc
echo 'alias aia="$HOME/path/to/ai-assist/cli/target/release/linux-ai-cli"' >> ~/.bashrc
```

## 🎯 Core Commands

### `aia chat` / `aia ask`

Send questions to AI (both commands are identical).

```bash
aia chat "your question here"
aia ask "your question here"

# Options:
--model MODEL      # Use specific model (gpt-4, claude-sonnet, etc.)
--provider NAME    # Use specific provider (openai, anthropic, ollama)
--new              # Start new conversation
--gui              # Open response in desktop GUI
--stdin            # Read from stdin
```

### `aia analyze` ⭐ MOST USEFUL

Analyze piped input with AI.

```bash
cat file.txt | aia analyze
command 2>&1 | aia analyze "optional context prompt"

# Examples:
git diff | aia analyze "Security review"
docker ps -a | aia analyze "Any issues?"
journalctl -n 50 | aia analyze "Critical errors?"
```

### `aia capture`

Execute command, capture output, analyze it.

```bash
aia capture "command"
aia capture "npm test" --analyze          # Basic analysis
aia capture "cargo build" --ai-analyze    # AI analysis
aia capture "script.sh" --timeout 120     # With timeout
```

### `aia last`

Get most recent AI response.

```bash
aia last                    # Print to terminal
aia last > response.txt     # Save to file
```

### `aia notify`

Send desktop notification.

```bash
aia notify "Build completed!"
make && aia notify "Success!" || aia notify "Failed!"
```

## 💡 Real-World Workflows

### Error Debugging

```bash
# Run command, if it fails, analyze the error
npm test || npm test 2>&1 | aia analyze "Fix these errors"
```

### Code Review

```bash
# Review uncommitted changes
git diff | aia analyze "Code review" --gui

# Review specific commit
git show abc123 | aia analyze "Security check"
```

### Log Analysis

```bash
# Analyze recent errors
tail -100 /var/log/app.log | aia analyze "Find patterns"

# System diagnostics
journalctl -n 50 --priority=err | aia analyze
```

### Build Notifications

```bash
#!/bin/bash
aia notify "Build started"
if aia capture "npm run build" --ai-analyze; then
    aia notify "✅ Build successful!"
else
    aia notify "❌ Build failed"
fi
```

## 🔧 Helpful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Quick AI access
alias ai='aia chat'
alias aig='aia chat --gui'
alias why='aia analyze'

# Explain last command
alias explain='fc -ln -1 | aia chat --stdin "Explain this command"'

# Fix last command
alias fix='fc -ln -1 | aia chat --stdin "This failed. How to fix?"'

# Git helpers
alias git-review='git diff | aia analyze "Code review" --gui'
alias git-explain='git log -1 --pretty=format:"%B" | aia analyze "Explain"'
```

## 🎨 Advanced Tips

### Model Selection

```bash
# Fast/cheap for simple questions
aia chat "quick question" --model gpt-3.5-turbo

# Best quality for complex tasks
aia chat "explain async programming" --model gpt-4o

# Privacy-focused (local)
aia chat "sensitive question" --model llama2 --provider ollama
```

### Conversation Context

```bash
# Start new topic
aia chat "Let's discuss Python" --new

# Continue conversation
aia chat "Tell me more about that"
aia chat "Show an example"

# Reference previous answer
aia last > previous.txt
aia chat "Based on your previous answer, how do I..."
```

### Complex Piping

```bash
# Multiple files
cat *.log | aia analyze "Aggregate analysis"

# JSON analysis
curl api.example.com/data | jq '.' | aia analyze "Summarize"

# Database queries
psql -c "SELECT * FROM errors" | aia analyze
```

## 🐛 Troubleshooting

**CLI can't connect?**

```bash
# Check if desktop app is running
ps aux | grep ai-assist

# Verify IPC port
lsof -i :39871

# Start desktop app first
ai-assist &
sleep 2
aia chat "test"
```

**Stdin not working?**

```bash
# Use explicit --stdin flag
echo "question" | aia chat --stdin

# Verify stdin has content
cat file.txt | tee /dev/stderr | aia analyze
```

**Want GUI for long responses?**

```bash
# Use --gui flag
aia chat "Explain quantum computing in detail" --gui
```

## 📚 Examples by Use Case

### Python Development

```bash
# Debug error
python script.py 2>&1 | aia analyze

# Code review
git diff main..feature | aia analyze "Python best practices"

# Generate tests
aia chat "Generate pytest tests for this function" < my_function.py
```

### Rust Development

```bash
# Build analysis
cargo build 2>&1 | aia analyze "Help fix compilation errors"

# Explain error
cargo check 2>&1 | aia analyze "Explain these borrow checker errors"

# Code suggestions
aia chat "How to optimize this Rust code?" < main.rs
```

### DevOps

```bash
# Log monitoring
tail -f /var/log/nginx/error.log | grep ERROR | aia analyze

# Container debugging
docker logs container_name 2>&1 | aia analyze "Diagnose crash"

# Infrastructure review
terraform plan | aia analyze "Security concerns?"
```

### System Administration

```bash
# System health
journalctl -p err -n 50 | aia analyze "Critical issues?"

# Disk usage
df -h | aia analyze "Disk space concerns?"

# Process analysis
ps aux --sort=-%mem | head -20 | aia analyze "Memory usage issues?"
```

## 🎓 Best Practices

1. **Be specific with prompts**:

   ```bash
   # ❌ Vague
   cat error.log | aia analyze

   # ✅ Specific (better results)
   cat error.log | aia analyze "Find root cause of database connection failures"
   ```

2. **Use --gui for detailed analysis**:

   ```bash
   # Terminal is limited; GUI provides better formatting
   aia chat "Explain machine learning" --gui
   ```

3. **Chain commands intelligently**:

   ```bash
   command 2>&1 | aia analyze || aia notify "Analysis failed"
   ```

4. **Save important responses**:

   ```bash
   aia chat "Generate migration script" > migration.sql
   aia last > important_answer.txt
   ```

5. **Choose right model for task**:
   - Simple questions → gpt-3.5-turbo (fast/cheap)
   - Complex reasoning → gpt-4o (best quality)
   - Code-focused → claude-sonnet-3.5
   - Privacy-sensitive → ollama models (local)

## 🔗 See Also

- [Full CLI Guide](CLI_GUIDE.md) - Complete documentation
- [User Guide](USER_GUIDE.md) - Desktop app usage
- [Developer Guide](DEVELOPER_GUIDE.md) - Contributing

---

**Made with ❤️ for Linux developers**
