#!/bin/bash
# Demo script for Linux AI Assistant CLI features

set -e

CLI="./lai"
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=================================${NC}"
echo -e "${BOLD}${BLUE}Linux AI Assistant CLI Demo${NC}"
echo -e "${BOLD}${BLUE}=================================${NC}\n"

# Check if CLI exists
if [ ! -f "$CLI" ]; then
    echo -e "${BOLD}Error: CLI not found at $CLI${NC}"
    echo "Build it first with: cd cli && cargo build --release"
    exit 1
fi

# Check if backend is running
if ! lsof -i:39871 >/dev/null 2>&1; then
    echo -e "${BOLD}⚠️  Warning: Backend IPC server not detected on port 39871${NC}"
    echo "Start the desktop app first: pnpm tauri dev"
    echo ""
    read -p "Continue anyway to see command syntax? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} CLI found: $CLI"
echo -e "${GREEN}✓${NC} Ready to demonstrate features\n"

# Demo 1: Help
echo -e "${BOLD}1. Command Help${NC}"
echo "$ lai --help"
$CLI --help | head -20
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 2: Analyze command help
echo -e "${BOLD}2. Analyze Command (Piping Support)${NC}"
echo "$ lai analyze --help"
$CLI analyze --help
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 3: Demonstrate stdin piping (without actually running)
echo -e "${BOLD}3. Example: Analyze Error Log${NC}"
echo "$ cat error.log | lai analyze"
echo ""
echo "This would analyze the contents of error.log with AI."
echo "The analyze command reads from stdin and sends to AI."
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 4: Chat command
echo -e "${BOLD}4. Example: Chat Command${NC}"
echo "$ lai chat \"What's the difference between REST and GraphQL?\""
echo ""
echo "This sends a question to the AI assistant."
echo "Response appears in terminal unless --gui flag is used."
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 5: GUI flag
echo -e "${BOLD}5. Example: Open in GUI${NC}"
echo "$ lai chat \"Explain Rust ownership\" --gui"
echo ""
echo "The --gui flag opens the response in the desktop app window"
echo "instead of printing to terminal. Useful for long/formatted responses."
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 6: Real examples
echo -e "${BOLD}6. Real-World Workflow Examples${NC}"
echo ""
echo -e "${BLUE}Error Debugging:${NC}"
echo "$ npm test 2>&1 | lai analyze \"Help fix these test failures\""
echo ""
echo -e "${BLUE}Code Review:${NC}"
echo "$ git diff | lai analyze \"Security review\" --gui"
echo ""
echo -e "${BLUE}Log Monitoring:${NC}"
echo "$ journalctl -n 50 --priority=err | lai analyze"
echo ""
echo -e "${BLUE}System Diagnostics:${NC}"
echo "$ docker ps -a | lai analyze \"Any container issues?\""
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 7: Capture command
echo -e "${BOLD}7. Capture Command (Execute & Analyze)${NC}"
echo "$ lai capture \"npm test\" --ai-analyze"
echo ""
echo "This executes a command, captures stdout/stderr,"
echo "and optionally analyzes the output with AI."
echo ""
read -p "Press Enter to continue..."
echo ""

# Demo 8: Helpful aliases
echo -e "${BOLD}8. Recommended Shell Aliases${NC}"
echo ""
echo "Add these to your ~/.bashrc or ~/.zshrc:"
echo ""
cat << 'EOF'
# Quick AI access
alias ai='lai chat'
alias aig='lai chat --gui'
alias why='lai analyze'

# Explain last command
alias explain='fc -ln -1 | lai chat --stdin "Explain this"'

# Git helpers
alias git-review='git diff | lai analyze "Code review" --gui'
EOF
echo ""
read -p "Press Enter to continue..."
echo ""

# Final summary
echo -e "${BOLD}${GREEN}=================================${NC}"
echo -e "${BOLD}${GREEN}Demo Complete!${NC}"
echo -e "${BOLD}${GREEN}=================================${NC}\n"

echo "Next steps:"
echo "1. Ensure desktop app is running: pnpm tauri dev"
echo "2. Try: echo 'test question' | $CLI analyze"
echo "3. Try: $CLI chat 'What is Linux?'"
echo "4. Read: CLI_QUICK_START.md for more examples"
echo ""
echo "Documentation:"
echo "- CLI_QUICK_START.md - Quick reference with examples"
echo "- CLI_GUIDE.md - Complete documentation"
echo ""
