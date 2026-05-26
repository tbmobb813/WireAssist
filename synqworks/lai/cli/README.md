# Linux AI Assistant CLI

Command-line interface for the Linux AI Desktop Assistant.

## Installation

### Quick Install

```bash
# Run the installation script
curl -sSL https://raw.githubusercontent.com/tbmobb813/Linux-AI-Assistant---Project/main/linux-ai-assistant/cli/install.sh | bash

# Or download and run manually
wget https://raw.githubusercontent.com/tbmobb813/Linux-AI-Assistant---Project/main/linux-ai-assistant/cli/install.sh
chmod +x install.sh
./install.sh
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/tbmobb813/Linux-AI-Assistant---Project.git
cd Linux-AI-Assistant---Project/linux-ai-assistant

# Build CLI
pnpm cli:build

# The binary will be at: cli/target/release/linux-ai-cli
# Copy it to your PATH as 'lai'
sudo cp cli/target/release/linux-ai-cli /usr/local/bin/lai
```

## Usage

### Prerequisites

- Linux AI Desktop Assistant must be running
- IPC server automatically starts with the desktop app

### Commands

```bash
# Ask the AI a question
lai ask "How do I optimize this SQL query?"

# Send a desktop notification
lai notify "Build completed successfully"

# Get the last assistant response
lai last

# Get help
lai --help

# Check version
lai --version
```

### Examples

**Development Workflow:**

```bash
# Git commit message generation
lai ask "Generate a commit message for these changes: $(git diff --staged)"

# Build notifications
make build && lai notify "✅ Build successful" || lai notify "❌ Build failed"

# Code review
lai ask "Review this function: $(cat src/utils.py)"
```

**Quick Questions:**

```bash
lai ask "What's the difference between async and await?"
lai ask "How do I center a div in CSS?"
lai ask "Best practices for error handling in Rust"
```

**Scripting:**

```bash
# Get response and process it
response=$(lai ask "What's 2+2?")
echo "AI says: $response"

# Conditional notifications
if [[ $? -eq 0 ]]; then
    lai notify "Command succeeded"
fi
```

## Configuration

Configuration file: `~/.config/lai/config.toml`

```toml
[connection]
host = "127.0.0.1"
port = 39871
timeout = 10

[defaults]
# Optional: override desktop app defaults
# provider = "openai"
# model = "gpt-4"

[output]
color = true
timestamps = false
```

## Development Features

When `DEV_MODE=1` is set:

```bash
# Create test assistant messages
export DEV_MODE=1
lai create "This is a test assistant response"
lai create "Response for specific conversation" --conversation-id "uuid-here"
```

## Troubleshooting

**Connection Refused:**

```bash
# Check if desktop app is running
ps aux | grep linux-ai-assistant

# Check if IPC server is listening
ss -ltnp | grep 39871
```

**Command Not Found:**

```bash
# Check if CLI is in PATH
which lai

# Or use full path
/usr/local/bin/lai --version
```

**Permission Errors:**

```bash
# Re-run installer with proper permissions
sudo ./install.sh
```

## Uninstallation

```bash
# Using the installation script
./install.sh --uninstall

# Or manually
sudo rm /usr/local/bin/lai
rm -rf ~/.config/lai
```

## Development

### Building

```bash
cargo build --release
```

### Testing

```bash
cargo test
```

### Contributing

See the main project [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Same as the main project - see [LICENSE](../../LICENSE).
