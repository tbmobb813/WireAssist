# AI Assist CLI

Command-line interface for the Linux AI Desktop Assistant.

## Installation

### Quick Install

```bash
# Run the installation script
curl -sSL https://raw.githubusercontent.com/tbmobb813/Linux-AI-Assistant---Project/main/ai-assist/cli/install.sh | bash

# Or download and run manually
wget https://raw.githubusercontent.com/tbmobb813/Linux-AI-Assistant---Project/main/ai-assist/cli/install.sh
chmod +x install.sh
./install.sh
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/tbmobb813/Linux-AI-Assistant---Project.git
cd Linux-AI-Assistant---Project/ai-assist

# Build CLI
pnpm cli:build

# The binary will be at: cli/target/release/linux-ai-cli
# Copy it to your PATH as 'aia'
sudo cp cli/target/release/linux-ai-cli /usr/local/bin/aia
```

## Usage

### Prerequisites

- Linux AI Desktop Assistant must be running
- IPC server automatically starts with the desktop app

### Commands

```bash
# Ask the AI a question
aia ask "How do I optimize this SQL query?"

# Send a desktop notification
aia notify "Build completed successfully"

# Get the last assistant response
aia last

# Get help
aia --help

# Check version
aia --version
```

### Examples

**Development Workflow:**

```bash
# Git commit message generation
aia ask "Generate a commit message for these changes: $(git diff --staged)"

# Build notifications
make build && aia notify "✅ Build successful" || aia notify "❌ Build failed"

# Code review
aia ask "Review this function: $(cat src/utils.py)"
```

**Quick Questions:**

```bash
aia ask "What's the difference between async and await?"
aia ask "How do I center a div in CSS?"
aia ask "Best practices for error handling in Rust"
```

**Scripting:**

```bash
# Get response and process it
response=$(aia ask "What's 2+2?")
echo "AI says: $response"

# Conditional notifications
if [[ $? -eq 0 ]]; then
    aia notify "Command succeeded"
fi
```

## Configuration

Configuration file: `~/.config/aia/config.toml`

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
aia create "This is a test assistant response"
aia create "Response for specific conversation" --conversation-id "uuid-here"
```

## Troubleshooting

**Connection Refused:**

```bash
# Check if desktop app is running
ps aux | grep ai-assist

# Check if IPC server is listening
ss -ltnp | grep 39871
```

**Command Not Found:**

```bash
# Check if CLI is in PATH
which aia

# Or use full path
/usr/local/bin/aia --version
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
sudo rm /usr/local/bin/aia
rm -rf ~/.config/aia
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
