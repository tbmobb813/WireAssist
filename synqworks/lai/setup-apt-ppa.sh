#!/bin/bash

##############################################################################
# APT PPA Setup Script for Linux AI Assistant
# 
# This script sets up an APT PPA (Personal Package Archive) for distributing
# Debian packages across Ubuntu and Debian systems. It handles:
# - GPG key generation and management
# - Launchpad PPA creation and configuration
# - Package building and uploading
# - Repository verification
#
# Usage:
#   ./setup-apt-ppa.sh [init|build|publish|verify]
#
# Commands:
#   init      Initialize PPA with GPG keys and metadata
#   build     Build DEB package from source
#   publish   Upload package to Launchpad PPA
#   verify    Verify PPA setup and packages
#
# Requirements:
#   - Launchpad account (https://launchpad.net)
#   - GPG installed
#   - debhelper, devscripts, dput
#   - Ubuntu build environment or pbuilder
#
# Author: Linux AI Assistant Team
# Date: October 2025
##############################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PPA_NAME="linux-ai-assistant"
LAUNCHPAD_USER="${LAUNCHPAD_USER:-tbmobb813}"
UBUNTU_RELEASES=("focal" "jammy" "noble")  # 20.04 LTS, 22.04 LTS, 24.04 LTS
GPG_EMAIL="${GPG_EMAIL:-linux-ai@example.com}"
GPG_NAME="${GPG_NAME:-Linux AI Assistant Builder}"
DEBIAN_DIST="unstable"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
DEB_BUILD_DIR="${BUILD_DIR}/deb"
REPO_DIR="${BUILD_DIR}/repo"
PPA_CONFIG="${SCRIPT_DIR}/.ppa-config"

##############################################################################
# Utility Functions
##############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

check_requirements() {
    local missing=()
    
    log_info "Checking requirements..."
    
    # Check for required tools
    for tool in gpg dput debhelper devscripts dpkg-buildpackage; do
        if ! command -v "$tool" &> /dev/null; then
            missing+=("$tool")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Install with: sudo apt-get install ${missing[*]}"
        return 1
    fi
    
    log_success "All requirements met"
    return 0
}

##############################################################################
# GPG Key Management
##############################################################################

init_gpg_key() {
    log_info "Initializing GPG key for PPA signing..."
    
    # Check if key already exists
    if gpg --list-secret-keys "$GPG_EMAIL" &> /dev/null; then
        log_warn "GPG key for $GPG_EMAIL already exists"
        return 0
    fi
    
    # Create batch file for key generation
    local key_batch=$(mktemp)
    cat > "$key_batch" << EOF
%echo Generating a basic OpenPGP key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $GPG_NAME
Name-Email: $GPG_EMAIL
Expire-Date: 5y
%commit
%echo done
EOF
    
    log_info "Generating GPG key (this may take a while)..."
    gpg --batch --generate-key "$key_batch" || true
    rm "$key_batch"
    
    local key_id=$(gpg --list-secret-keys --with-colons "$GPG_EMAIL" | grep 'sec:' | head -1 | cut -d: -f5)
    
    if [ -z "$key_id" ]; then
        log_error "Failed to generate GPG key"
        return 1
    fi
    
    log_success "GPG key generated: $key_id"
    
    # Export public key for upload to Launchpad
    log_info "Exporting public key for Launchpad..."
    gpg --armor --export "$key_id" > "${BUILD_DIR}/pubkey.asc"
    
    log_info "1. Go to https://launchpad.net/~$LAUNCHPAD_USER/+edit"
    log_info "2. Add the public key from: ${BUILD_DIR}/pubkey.asc"
    log_info "3. Wait for Launchpad to verify the key"
    
    # Save config
    mkdir -p "$(dirname "$PPA_CONFIG")"
    {
        echo "GPG_KEY_ID=$key_id"
        echo "GPG_EMAIL=$GPG_EMAIL"
        echo "GPG_NAME=$GPG_NAME"
    } >> "$PPA_CONFIG"
    
    return 0
}

##############################################################################
# Debian Package Building
##############################################################################

create_debian_package() {
    log_info "Creating Debian package..."
    
    mkdir -p "$DEB_BUILD_DIR"
    cd "$DEB_BUILD_DIR"
    
    # Create debian directory structure
    mkdir -p debian/source
    
    # Create debian/source/format
    echo "3.0 (quilt)" > debian/source/format
    
    # Create debian/control
    cat > debian/control << 'EOF'
Source: linux-ai-assistant
Section: utils
Priority: optional
Maintainer: Linux AI Assistant Team <linux-ai@example.com>
Build-Depends: debhelper (>= 13), node-npm, cargo, rustc
Standards-Version: 4.6.0
Homepage: https://github.com/tbmobb813/Linux-AI-Assistant---Project
Vcs-Git: https://github.com/tbmobb813/Linux-AI-Assistant---Project.git
Vcs-Browser: https://github.com/tbmobb813/Linux-AI-Assistant---Project

Package: linux-ai-assistant
Architecture: any
Depends: libwebkit2gtk-4.0-37 (>= 2.38.0), libgtk-3-0 (>= 3.18), libayatana-appindicator3-1
Recommends: ollama
Description: Native Linux AI Desktop Assistant
 A lightweight, native Linux desktop AI assistant built with Tauri.
 Features multi-model support, local processing, developer workflows,
 and system integration.
 .
 Supports multiple AI providers:
 - OpenAI (GPT-4, GPT-3.5)
 - Anthropic (Claude)
 - Google Gemini
 - Local models via Ollama
EOF

    # Create debian/changelog
    cat > debian/changelog << EOF
linux-ai-assistant (0.1.0-1ubuntu1) focal; urgency=medium

  * Initial release
  * Multi-provider AI support
  * Local model support via Ollama
  * Privacy-respecting architecture
  * Developer-optimized workflows

 -- Linux AI Assistant Team <linux-ai@example.com>  $(date -R)
EOF

    # Create debian/rules
    cat > debian/rules << 'EOF'
#!/usr/bin/make -f

export DH_VERBOSE = 1

%:
	dh $@

override_dh_auto_build:
	cd $(CURDIR)/linux-ai-assistant && npm run build
	cd $(CURDIR)/linux-ai-assistant && cargo build --release -p app

override_dh_auto_install:
	dh_auto_install
	mkdir -p debian/linux-ai-assistant/usr/bin
	install -m 755 linux-ai-assistant/src-tauri/target/release/app \
		debian/linux-ai-assistant/usr/bin/linux-ai-assistant
	mkdir -p debian/linux-ai-assistant/usr/share/applications
	install -m 644 linux-ai-assistant/linux-ai-assistant.desktop \
		debian/linux-ai-assistant/usr/share/applications/
	mkdir -p debian/linux-ai-assistant/usr/share/icons/hicolor/128x128/apps
	install -m 644 linux-ai-assistant/src-tauri/icons/128x128.png \
		debian/linux-ai-assistant/usr/share/icons/hicolor/128x128/apps/linux-ai-assistant.png
EOF

    chmod +x debian/rules

    # Create debian/copyright
    cat > debian/copyright << EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Linux AI Assistant
Upstream-Contact: tbmobb813 <tbmobb813@users.noreply.github.com>
Source: https://github.com/tbmobb813/Linux-AI-Assistant---Project

Files: *
Copyright: 2025 Linux AI Assistant Contributors
License: MIT

License: MIT
 Permission is hereby granted, free of charge, to any person obtaining
 a copy of this software and associated documentation files (the
 "Software"), to deal in the Software without restriction, including
 without limitation the rights to use, copy, modify, merge, publish,
 distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to
 the following conditions:
 .
 The above copyright notice and this permission notice shall be included
 in all copies or substantial portions of the Software.
 .
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
EOF

    log_success "Debian package structure created"
}

build_deb_package() {
    log_info "Building Debian package..."
    
    cd "$DEB_BUILD_DIR"
    
    # Build source package
    dpkg-buildpackage -S -uc -us 2>&1 | tee build.log || {
        log_error "Build failed. See build.log for details."
        return 1
    }
    
    log_success "DEB package built successfully"
    
    # List generated packages
    log_info "Generated packages:"
    ls -lh ../*.deb ../*.changes ../*.dsc 2>/dev/null || true
}

##############################################################################
# PPA Upload
##############################################################################

upload_to_ppa() {
    log_info "Uploading package to Launchpad PPA..."
    
    # Load PPA config
    if [ -f "$PPA_CONFIG" ]; then
        source "$PPA_CONFIG"
    fi
    
    if [ -z "$GPG_KEY_ID" ]; then
        log_error "GPG key not configured. Run 'init' first."
        return 1
    fi
    
    # Create dput configuration
    cat > ~/.dput.cf << EOF
[linux-ai-assistant-ppa]
fqdn = ppa.launchpad.net
method = sftp
incoming = ~$LAUNCHPAD_USER/ppa/ubuntu/
login = $LAUNCHPAD_USER
allow_unsigned_uploads = 0
EOF

    # Upload for each Ubuntu release
    for release in "${UBUNTU_RELEASES[@]}"; do
        log_info "Uploading to $release..."
        
        cd "$DEB_BUILD_DIR/.."
        
        # Sign and upload
        if dput -U linux-ai-assistant-ppa \
            "linux-ai-assistant_0.1.0-1ubuntu1_source.changes"; then
            log_success "Uploaded to $release successfully"
        else
            log_warn "Upload to $release failed"
        fi
    done
    
    log_info "PPA upload complete. Packages available at:"
    log_info "https://launchpad.net/~$LAUNCHPAD_USER/+archive/ubuntu/$PPA_NAME"
}

##############################################################################
# Verification
##############################################################################

verify_ppa_setup() {
    log_info "Verifying PPA setup..."
    
    local issues=0
    
    # Check GPG key
    if gpg --list-secret-keys "$GPG_EMAIL" &> /dev/null; then
        log_success "GPG key found for $GPG_EMAIL"
    else
        log_error "No GPG key found for $GPG_EMAIL"
        issues=$((issues + 1))
    fi
    
    # Check Launchpad account
    if curl -s "https://api.launchpad.net/1.0/~$LAUNCHPAD_USER" | grep -q '"name"'; then
        log_success "Launchpad account verified: $LAUNCHPAD_USER"
    else
        log_error "Could not verify Launchpad account: $LAUNCHPAD_USER"
        issues=$((issues + 1))
    fi
    
    # Check package files
    if [ -d "$DEB_BUILD_DIR" ]; then
        local deb_count=$(find "$DEB_BUILD_DIR" -name "*.deb" 2>/dev/null | wc -l)
        if [ "$deb_count" -gt 0 ]; then
            log_success "Found $deb_count DEB packages"
        fi
    fi
    
    # Check PPA config
    if [ -f "$PPA_CONFIG" ]; then
        log_success "PPA configuration found"
        log_info "Configuration:"
        sed 's/^/  /' "$PPA_CONFIG"
    fi
    
    if [ $issues -eq 0 ]; then
        log_success "PPA setup verification passed"
        return 0
    else
        log_error "PPA setup verification found $issues issues"
        return 1
    fi
}

##############################################################################
# Main Command Handler
##############################################################################

show_help() {
    cat << EOF
${BLUE}Linux AI Assistant - APT PPA Setup${NC}

${YELLOW}Usage:${NC}
  $0 [command]

${YELLOW}Commands:${NC}
  init      Initialize PPA with GPG keys and configuration
  build     Build DEB package from source
  publish   Upload package to Launchpad PPA
  verify    Verify PPA setup and packages
  help      Show this help message

${YELLOW}Examples:${NC}
  # First time setup
  $0 init
  $0 build
  $0 publish

  # Verify everything is configured
  $0 verify

${YELLOW}Prerequisites:${NC}
  - Launchpad account at https://launchpad.net/
  - GPG installed
  - debhelper, devscripts, dput packages
  - PPA created at https://launchpad.net/~\$LAUNCHPAD_USER/+create-ppa

${YELLOW}Environment Variables:${NC}
  LAUNCHPAD_USER   Your Launchpad username (default: $LAUNCHPAD_USER)
  GPG_EMAIL        Email for GPG key (default: $GPG_EMAIL)
  GPG_NAME         Name for GPG key (default: $GPG_NAME)

${YELLOW}Documentation:${NC}
  See REPOSITORY_SETUP.md for detailed setup instructions
EOF
}

main() {
    local command="${1:-help}"
    
    # Ensure build directories exist
    mkdir -p "$BUILD_DIR" "$DEB_BUILD_DIR" "$REPO_DIR"
    
    case "$command" in
        init)
            check_requirements || exit 1
            init_gpg_key
            ;;
        build)
            check_requirements || exit 1
            create_debian_package
            build_deb_package
            ;;
        publish)
            upload_to_ppa
            ;;
        verify)
            verify_ppa_setup
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
