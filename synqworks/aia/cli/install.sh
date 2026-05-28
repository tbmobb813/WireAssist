#!/bin/bash
# Linux AI Assistant CLI Installation Script
# This script installs the 'lai' CLI tool for terminal access to the desktop assistant

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation configuration
CLI_NAME="lai"
BINARY_NAME="linux-ai-cli"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="$HOME/.config/lai"
VERSION="0.1.0"

# GitHub release information
REPO="tbmobb813/Linux-AI-Assistant---Project"
RELEASE_URL="https://github.com/$REPO/releases/latest"

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════╗"
    echo "║          Linux AI Assistant CLI               ║"
    echo "║             Installation Script               ║"
    echo "╚════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_requirements() {
    print_step "Checking system requirements..."

    # Check if running on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "This installer is for Linux systems only"
        exit 1
    fi

    # Check for required commands
    for cmd in curl tar; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is required but not installed"
            exit 1
        fi
    done

    print_success "System requirements met"
}

detect_architecture() {
    print_step "Detecting system architecture..."

    local arch=$(uname -m)
    case $arch in
        x86_64)
            ARCH="x86_64-unknown-linux-gnu"
            ;;
        aarch64)
            ARCH="aarch64-unknown-linux-gnu"
            ;;
        *)
            print_error "Unsupported architecture: $arch"
            print_info "Supported architectures: x86_64, aarch64"
            exit 1
            ;;
    esac

    print_success "Architecture: $ARCH"
}

check_permissions() {
    print_step "Checking installation permissions..."

    if [[ ! -w "$INSTALL_DIR" ]]; then
        print_info "Installation requires sudo privileges for $INSTALL_DIR"
        if ! sudo -n true 2>/dev/null; then
            print_info "You may be prompted for your password"
        fi
    fi
}

download_binary() {
    print_step "Downloading CLI binary..."

    # Create temporary directory
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"

    # For now, we'll build from source since releases don't exist yet
    # TODO: Update this when releases are available
    print_info "Building from source (releases not yet available)..."

    # Clone the repository
    if ! git clone "https://github.com/$REPO.git" --depth 1 &>/dev/null; then
        print_error "Failed to clone repository"
        exit 1
    fi

    cd "Linux-AI-Assistant---Project/linux-ai-assistant/cli"

    # Check if Rust is installed
    if ! command -v cargo &> /dev/null; then
        print_error "Rust/Cargo is required to build from source"
        print_info "Install Rust from: https://rustup.rs/"
        exit 1
    fi

    # Build the binary
    print_step "Building CLI binary with Cargo..."
    if ! cargo build --release; then
        print_error "Failed to build CLI binary"
        exit 1
    fi

    # Copy the binary
    BINARY_PATH="target/release/$BINARY_NAME"
    if [[ ! -f "$BINARY_PATH" ]]; then
        print_error "Built binary not found at $BINARY_PATH"
        exit 1
    fi

    print_success "Binary built successfully"
    echo "$temp_dir/Linux-AI-Assistant---Project/linux-ai-assistant/cli/$BINARY_PATH"
}

install_binary() {
    local binary_path="$1"
    print_step "Installing CLI binary..."

    # Install the binary
    if [[ -w "$INSTALL_DIR" ]]; then
        cp "$binary_path" "$INSTALL_DIR/$CLI_NAME"
    else
        sudo cp "$binary_path" "$INSTALL_DIR/$CLI_NAME"
    fi

    # Make it executable
    if [[ -w "$INSTALL_DIR/$CLI_NAME" ]]; then
        chmod +x "$INSTALL_DIR/$CLI_NAME"
    else
        sudo chmod +x "$INSTALL_DIR/$CLI_NAME"
    fi

    print_success "Binary installed to $INSTALL_DIR/$CLI_NAME"
}

setup_config() {
    print_step "Setting up configuration directory..."

    # Create config directory
    mkdir -p "$CONFIG_DIR"

    # Create default configuration file
    cat > "$CONFIG_DIR/config.toml" << EOF
# Linux AI Assistant CLI Configuration
# See: https://github.com/$REPO

[connection]
# IPC server host and port
host = "127.0.0.1"
port = 39871
timeout = 10

[defaults]
# Default provider and model (if not specified by desktop app)
# provider = "openai"
# model = "gpt-4"

[output]
# Output formatting preferences
color = true
timestamps = false
EOF

    print_success "Configuration created at $CONFIG_DIR/config.toml"
}

verify_installation() {
    print_step "Verifying installation..."

    # Check if binary is in PATH
    if command -v $CLI_NAME &> /dev/null; then
        local version=$($CLI_NAME --version 2>/dev/null || echo "unknown")
        print_success "CLI installed successfully: $version"

        # Test basic functionality
        print_step "Testing CLI functionality..."
        if $CLI_NAME --help &>/dev/null; then
            print_success "CLI help command works"
        else
            print_error "CLI help command failed"
        fi
    else
        print_error "CLI not found in PATH after installation"
        print_info "You may need to restart your terminal or add $INSTALL_DIR to your PATH"
        return 1
    fi
}

cleanup() {
    print_step "Cleaning up temporary files..."
    if [[ -n "$temp_dir" && -d "$temp_dir" ]]; then
        rm -rf "$temp_dir"
    fi
}

show_usage() {
    print_success "Installation complete!"
    echo
    print_info "Usage examples:"
    echo "  $CLI_NAME ask \"How do I optimize this SQL query?\""
    echo "  $CLI_NAME notify \"Build completed successfully\""
    echo "  $CLI_NAME last"
    echo "  $CLI_NAME --help"
    echo
    print_info "Configuration: $CONFIG_DIR/config.toml"
    print_info "Documentation: https://github.com/$REPO"
    echo
    print_info "Make sure the Linux AI Desktop Assistant is running for CLI commands to work!"
}

main() {
    print_header

    # Set up cleanup trap
    trap cleanup EXIT

    check_requirements
    detect_architecture
    check_permissions

    local binary_path=$(download_binary)
    install_binary "$binary_path"
    setup_config

    if verify_installation; then
        show_usage
    else
        print_error "Installation verification failed"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        print_header
        echo "Linux AI Assistant CLI Installation Script"
        echo
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --uninstall    Remove the CLI tool"
        echo
        echo "Environment Variables:"
        echo "  INSTALL_DIR    Installation directory (default: /usr/local/bin)"
        echo
        exit 0
        ;;
    --uninstall)
        print_header
        print_step "Uninstalling Linux AI Assistant CLI..."

        if [[ -f "$INSTALL_DIR/$CLI_NAME" ]]; then
            if [[ -w "$INSTALL_DIR" ]]; then
                rm "$INSTALL_DIR/$CLI_NAME"
            else
                sudo rm "$INSTALL_DIR/$CLI_NAME"
            fi
            print_success "CLI binary removed"
        else
            print_info "CLI binary not found at $INSTALL_DIR/$CLI_NAME"
        fi

        if [[ -d "$CONFIG_DIR" ]]; then
            read -p "Remove configuration directory $CONFIG_DIR? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$CONFIG_DIR"
                print_success "Configuration removed"
            fi
        fi

        print_success "Uninstallation complete"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        print_info "Use --help for usage information"
        exit 1
        ;;
esac
