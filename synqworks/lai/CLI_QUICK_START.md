# Linux AI Assistant - CLI Quick Start

The `lai` command-line tool brings AI assistance directly to your terminal, enabling seamless integration with your Linux development workflow.

## 🚀 Quick Examples

```bash
# Ask a question
lai chat "How do I fix permission denied errors?"

# Analyze piped input (🔥 KILLER FEATURE)
cat error.log | lai analyze
git diff | lai analyze "Review these changes"
npm test 2>&1 | lai analyze

# Open in GUI for detailed responses
lai chat "Explain Rust ownership" --gui

# Capture and analyze command output
lai capture "cargo build" --ai-analyze
```

## 📦 Installation

```bash
# Build the CLI (if not already built)
cd linux-ai-assistant/cli
cargo build --release

# Add to your PATH
sudo ln -s $(pwd)/target/release/linux-ai-cli /usr/local/bin/lai

# Or add alias to ~/.bashrc or ~/.zshrc
echo 'alias lai="$HOME/path/to/linux-ai-assistant/cli/target/release/linux-ai-cli"' >> ~/.bashrc
```

## 🎯 Core Commands

### `lai chat` / `lai ask`

Send questions to AI (both commands are identical).

```bash
lai chat "your question here"
lai ask "your question here"

# Options:
--model MODEL      # Use specific model (gpt-4, claude-sonnet, etc.)
--provider NAME    # Use specific provider (openai, anthropic, ollama)
--new              # Start new conversation
--gui              # Open response in desktop GUI
--stdin            # Read from stdin
```

### `lai analyze` ⭐ MOST USEFUL

Analyze piped input with AI.

```bash
cat file.txt | lai analyze
command 2>&1 | lai analyze "optional context prompt"

# Examples:
git diff | lai analyze "Security review"
docker ps -a | lai analyze "Any issues?"
journalctl -n 50 | lai analyze "Critical errors?"
```

### `lai capture`

Execute command, capture output, analyze it.

```bash
lai capture "command"
lai capture "npm test" --analyze          # Basic analysis
lai capture "cargo build" --ai-analyze    # AI analysis
lai capture "script.sh" --timeout 120     # With timeout
```

### `lai last`

Get most recent AI response.

```bash
lai last                    # Print to terminal
lai last > response.txt     # Save to file
```

### `lai notify`

Send desktop notification.

```bash
lai notify "Build completed!"
make && lai notify "Success!" || lai notify "Failed!"
```

## 💡 Real-World Workflows

### Error Debugging

```bash
# Run command, if it fails, analyze the error
npm test || npm test 2>&1 | lai analyze "Fix these errors"
```

### Code Review

```bash
# Review uncommitted changes
git diff | lai analyze "Code review" --gui

# Review specific commit
git show abc123 | lai analyze "Security check"
```

### Log Analysis

```bash
# Analyze recent errors
tail -100 /var/log/app.log | lai analyze "Find patterns"

# System diagnostics
journalctl -n 50 --priority=err | lai analyze
```

### Build Notifications

```bash
#!/bin/bash
lai notify "Build started"
if lai capture "npm run build" --ai-analyze; then
    lai notify "✅ Build successful!"
else
    lai notify "❌ Build failed"
fi
```

## 🔧 Helpful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Quick AI access
alias ai='lai chat'
alias aig='lai chat --gui'
alias why='lai analyze'

# Explain last command
alias explain='fc -ln -1 | lai chat --stdin "Explain this command"'

# Fix last command
alias fix='fc -ln -1 | lai chat --stdin "This failed. How to fix?"'

# Git helpers
alias git-review='git diff | lai analyze "Code review" --gui'
alias git-explain='git log -1 --pretty=format:"%B" | lai analyze "Explain"'
```

## 🎨 Advanced Tips

### Model Selection

```bash
# Fast/cheap for simple questions
lai chat "quick question" --model gpt-3.5-turbo

# Best quality for complex tasks
lai chat "explain async programming" --model gpt-4o

# Privacy-focused (local)
lai chat "sensitive question" --model llama2 --provider ollama
```

### Conversation Context

```bash
# Start new topic
lai chat "Let's discuss Python" --new

# Continue conversation
lai chat "Tell me more about that"
lai chat "Show an example"

# Reference previous answer
lai last > previous.txt
lai chat "Based on your previous answer, how do I..."
```

### Complex Piping

```bash
# Multiple files
cat *.log | lai analyze "Aggregate analysis"

# JSON analysis
curl api.example.com/data | jq '.' | lai analyze "Summarize"

# Database queries
psql -c "SELECT * FROM errors" | lai analyze
```

## 🐛 Troubleshooting

**CLI can't connect?**

```bash
# Check if desktop app is running
ps aux | grep linux-ai-assistant

# Verify IPC port
lsof -i :39871

# Start desktop app first
linux-ai-assistant &
sleep 2
lai chat "test"
```

**Stdin not working?**

```bash
# Use explicit --stdin flag
echo "question" | lai chat --stdin

# Verify stdin has content
cat file.txt | tee /dev/stderr | lai analyze
```

**Want GUI for long responses?**

```bash
# Use --gui flag
lai chat "Explain quantum computing in detail" --gui
```

## 📚 Examples by Use Case

### Python Development

```bash
# Debug error
python script.py 2>&1 | lai analyze

# Code review
git diff main..feature | lai analyze "Python best practices"

# Generate tests
lai chat "Generate pytest tests for this function" < my_function.py
```

### Rust Development

```bash
# Build analysis
cargo build 2>&1 | lai analyze "Help fix compilation errors"

# Explain error
cargo check 2>&1 | lai analyze "Explain these borrow checker errors"

# Code suggestions
lai chat "How to optimize this Rust code?" < main.rs
```

### DevOps

```bash
# Log monitoring
tail -f /var/log/nginx/error.log | grep ERROR | lai analyze

# Container debugging
docker logs container_name 2>&1 | lai analyze "Diagnose crash"

# Infrastructure review
terraform plan | lai analyze "Security concerns?"
```

### System Administration

```bash
# System health
journalctl -p err -n 50 | lai analyze "Critical issues?"

# Disk usage
df -h | lai analyze "Disk space concerns?"

# Process analysis
ps aux --sort=-%mem | head -20 | lai analyze "Memory usage issues?"
```

## 🎓 Best Practices

1. **Be specific with prompts**:

   ```bash
   # ❌ Vague
   cat error.log | lai analyze

   # ✅ Specific (better results)
   cat error.log | lai analyze "Find root cause of database connection failures"
   ```

2. **Use --gui for detailed analysis**:

   ```bash
   # Terminal is limited; GUI provides better formatting
   lai chat "Explain machine learning" --gui
   ```

3. **Chain commands intelligently**:

   ```bash
   command 2>&1 | lai analyze || lai notify "Analysis failed"
   ```

4. **Save important responses**:

   ```bash
   lai chat "Generate migration script" > migration.sql
   lai last > important_answer.txt
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
