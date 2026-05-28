#!/bin/bash

##############################################################################
# Copr Repository Setup Script for Linux AI Assistant
#
# This script sets up a Copr repository for distributing RPM packages
# across Fedora, RHEL, and derivative distributions. It handles:
# - Copr project creation and configuration
# - RPM spec file generation
# - Package building and submission
# - Repository verification
#
# Usage:
#   ./setup-copr.sh [init|build|publish|verify]
#
# Commands:
#   init      Initialize Copr project with configuration
#   build     Build RPM package from source
#   publish   Submit package to Copr for building
#   verify    Verify Copr setup and package status
#
# Requirements:
#   - Fedora Copr account (https://copr.fedorainfracloud.org)
#   - copr-cli installed and configured
#   - rpmbuild, rpmdevtools
#   - Fedora build environment
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
COPR_PROJECT="linux-ai-assistant"
COPR_USER="${COPR_USER:-tbmobb813}"
COPR_CHROOTS=("fedora-39-x86_64" "fedora-40-x86_64" "rhel-9-x86_64")
SPEC_VERSION="0.1.0"
SPEC_RELEASE="1"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
RPM_BUILD_DIR="${BUILD_DIR}/rpm"
COPR_CONFIG="${SCRIPT_DIR}/.copr-config"

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
    for tool in rpmbuild rpmspec copr-cli; do
        if ! command -v "$tool" &> /dev/null; then
            missing+=("$tool")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Install with: sudo dnf install ${missing[*]}"
        return 1
    fi
    
    log_success "All requirements met"
    return 0
}

##############################################################################
# RPM Spec File Generation
##############################################################################

create_spec_file() {
    log_info "Creating RPM spec file..."
    
    mkdir -p "$RPM_BUILD_DIR"
    
    cat > "$RPM_BUILD_DIR/linux-ai-assistant.spec" << 'EOF'
%global debug_package %{nil}
%global _build_id_links none

Name:           linux-ai-assistant
Version:        0.1.0
Release:        1%{?dist}
Summary:        Native Linux AI Desktop Assistant

License:        MIT
URL:            https://github.com/tbmobb813/Linux-AI-Assistant---Project
Source0:        https://github.com/tbmobb813/Linux-AI-Assistant---Project/archive/v%{version}.tar.gz

# Build requirements
BuildRequires:  gcc-c++
BuildRequires:  libwebkit2gtk-4.0-devel
BuildRequires:  gtk3-devel
BuildRequires:  libappindicator-gtk3-devel
BuildRequires:  openssl-devel
BuildRequires:  cargo
BuildRequires:  rustc
BuildRequires:  npm
BuildRequires:  desktop-file-utils

# Runtime requirements
Requires:       libwebkit2gtk-4.0
Requires:       gtk3
Requires:       libappindicator-gtk3
Requires:       (ollama if nodejs)

ExclusiveArch:  x86_64 aarch64

%description
A lightweight, native Linux desktop AI assistant built with Tauri.
Features multi-model support, local processing, developer workflows,
and system integration.

Supports multiple AI providers:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google Gemini
- Local models via Ollama

%prep
%autosetup -n Linux-AI-Assistant---Project-v%{version}

%build
cd linux-ai-assistant
npm install --production
cd src-tauri
cargo build --release

%install
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/128x128/apps
mkdir -p %{buildroot}%{_datadir}/licenses/%{name}

# Install binary
install -m 755 linux-ai-assistant/src-tauri/target/release/app %{buildroot}%{_bindir}/%{name}

# Install desktop file
install -m 644 linux-ai-assistant/linux-ai-assistant.desktop %{buildroot}%{_datadir}/applications/%{name}.desktop

# Install icon
install -m 644 linux-ai-assistant/src-tauri/icons/128x128.png %{buildroot}%{_datadir}/icons/hicolor/128x128/apps/%{name}.png

# Install license
install -m 644 LICENSE %{buildroot}%{_datadir}/licenses/%{name}/

%post
# Update desktop database
update-desktop-database %{_datadir}/applications &> /dev/null || true

# Update icon cache
touch --no-create %{_datadir}/icons/hicolor &>/dev/null || true
gtk-update-icon-cache -q %{_datadir}/icons/hicolor &> /dev/null || true

%postun
# Update icon cache
touch --no-create %{_datadir}/icons/hicolor &>/dev/null || true
gtk-update-icon-cache -q %{_datadir}/icons/hicolor &> /dev/null || true

%files
%license LICENSE
%doc README.md
%{_bindir}/%{name}
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/128x128/apps/%{name}.png

%changelog
* Mon Oct 28 2025 Linux AI Assistant Team <linux-ai@example.com> - 0.1.0-1
- Initial release
- Multi-provider AI support
- Local model support via Ollama
- Privacy-respecting architecture
- Developer-optimized workflows
EOF

    log_success "RPM spec file created"
}

##############################################################################
# Copr Project Setup
##############################################################################

init_copr_project() {
    log_info "Initializing Copr project..."
    
    # Check if copr-cli is configured
    if ! [ -f ~/.config/copr ]; then
        log_error "copr-cli not configured. Run: copr-cli configure"
        return 1
    fi
    
    log_info "Creating Copr project: $COPR_PROJECT"
    
    # Check if project already exists
    if copr-cli get-package "$COPR_USER/$COPR_PROJECT" linux-ai-assistant 2>/dev/null; then
        log_warn "Project already exists"
    else
        # Create new project with appropriate settings
        copr-cli create "$COPR_PROJECT" \
            --chroot fedora-39-x86_64 \
            --chroot fedora-40-x86_64 \
            --chroot rhel-9-x86_64 \
            --description "Native Linux AI Desktop Assistant" \
            --instructions "Install with: dnf copr enable $COPR_USER/$COPR_PROJECT && dnf install linux-ai-assistant" \
            --repo-priority 100 \
            || log_warn "Project creation returned non-zero (may already exist)"
    fi
    
    log_success "Copr project configured"
    
    # Save config
    mkdir -p "$(dirname "$COPR_CONFIG")"
    {
        echo "COPR_PROJECT=$COPR_PROJECT"
        echo "COPR_USER=$COPR_USER"
        echo "SPEC_VERSION=$SPEC_VERSION"
        echo "SPEC_RELEASE=$SPEC_RELEASE"
    } >> "$COPR_CONFIG"
    
    log_info "Copr project available at:"
    log_info "https://copr.fedorainfracloud.org/coprs/$COPR_USER/$COPR_PROJECT/"
}

##############################################################################
# Build and Submit
##############################################################################

build_rpm_package() {
    log_info "Building RPM package..."
    
    # Set up RPM build directories
    mkdir -p ~/rpmbuild/{SOURCES,SPECS,BUILD,SRPMS,RPMS}
    
    # Copy spec file
    cp "$RPM_BUILD_DIR/linux-ai-assistant.spec" ~/rpmbuild/SPECS/
    
    # Download source
    log_info "Downloading source..."
    cd ~/rpmbuild/SOURCES
    wget -q https://github.com/tbmobb813/Linux-AI-Assistant---Project/archive/v${SPEC_VERSION}.tar.gz \
        -O linux-ai-assistant-${SPEC_VERSION}.tar.gz || true
    
    # Build RPM
    log_info "Building RPM (this may take a while)..."
    cd ~/rpmbuild
    rpmbuild -ba SPECS/linux-ai-assistant.spec 2>&1 | tee build.log || {
        log_error "Build failed. See build.log for details."
        return 1
    }
    
    log_success "RPM package built successfully"
    
    # Copy built packages
    mkdir -p "$RPM_BUILD_DIR/dist"
    cp SRPMS/linux-ai-assistant*.src.rpm "$RPM_BUILD_DIR/dist/"
    cp RPMS/*/linux-ai-assistant*.rpm "$RPM_BUILD_DIR/dist/" 2>/dev/null || true
    
    log_info "Built packages:"
    ls -lh "$RPM_BUILD_DIR/dist/"
}

submit_to_copr() {
    log_info "Submitting package to Copr for building..."
    
    # Load config
    if [ -f "$COPR_CONFIG" ]; then
        source "$COPR_CONFIG"
    fi
    
    local srpm_path="${RPM_BUILD_DIR}/dist/linux-ai-assistant-${SPEC_VERSION}-${SPEC_RELEASE}.src.rpm"
    
    if [ ! -f "$srpm_path" ]; then
        log_error "SRPM not found: $srpm_path"
        return 1
    fi
    
    log_info "Submitting SRPM to $COPR_USER/$COPR_PROJECT..."
    
    copr-cli build "$COPR_USER/$COPR_PROJECT" "$srpm_path" || {
        log_error "Build submission failed"
        return 1
    }
    
    log_success "Package submitted to Copr for building"
    log_info "Monitor build progress at:"
    log_info "https://copr.fedorainfracloud.org/coprs/$COPR_USER/$COPR_PROJECT/monitor"
}

##############################################################################
# Verification
##############################################################################

verify_copr_setup() {
    log_info "Verifying Copr setup..."
    
    local issues=0
    
    # Check copr-cli configuration
    if [ -f ~/.config/copr ]; then
        log_success "copr-cli is configured"
    else
        log_error "copr-cli not configured at ~/.config/copr"
        issues=$((issues + 1))
    fi
    
    # Check Copr project
    if copr-cli get-package "$COPR_USER/$COPR_PROJECT" linux-ai-assistant 2>/dev/null; then
        log_success "Copr project found: $COPR_USER/$COPR_PROJECT"
    else
        log_warn "Could not verify Copr project (may not exist yet)"
    fi
    
    # Check spec file
    if [ -f "$RPM_BUILD_DIR/linux-ai-assistant.spec" ]; then
        log_success "RPM spec file found"
    else
        log_warn "RPM spec file not found"
    fi
    
    # Check build artifacts
    if [ -d "$RPM_BUILD_DIR/dist" ]; then
        local rpm_count=$(find "$RPM_BUILD_DIR/dist" -name "*.rpm" 2>/dev/null | wc -l)
        if [ "$rpm_count" -gt 0 ]; then
            log_success "Found $rpm_count RPM packages"
        fi
    fi
    
    if [ $issues -eq 0 ]; then
        log_success "Copr setup verification passed"
        return 0
    else
        log_warn "Copr setup has $issues issues (may be expected for new setup)"
        return 0
    fi
}

##############################################################################
# Main Command Handler
##############################################################################

show_help() {
    cat << EOF
${BLUE}Linux AI Assistant - Copr Repository Setup${NC}

${YELLOW}Usage:${NC}
  $0 [command]

${YELLOW}Commands:${NC}
  init      Initialize Copr project configuration
  build     Build RPM package from source
  publish   Submit package to Copr for building
  verify    Verify Copr setup and build status
  help      Show this help message

${YELLOW}Examples:${NC}
  # First time setup
  $0 init
  $0 build
  $0 publish

  # Check build status
  $0 verify

${YELLOW}Prerequisites:${NC}
  - Copr account at https://copr.fedorainfracloud.org
  - copr-cli installed and configured
  - rpmbuild, rpmdevtools packages
  - Fedora/RHEL build environment

${YELLOW}Environment Variables:${NC}
  COPR_USER      Your Copr username (default: $COPR_USER)
  COPR_PROJECT   Project name (default: $COPR_PROJECT)

${YELLOW}Installation for Users:${NC}
  dnf copr enable $COPR_USER/$COPR_PROJECT
  dnf install linux-ai-assistant

${YELLOW}Documentation:${NC}
  See REPOSITORY_SETUP.md for detailed setup instructions
EOF
}

main() {
    local command="${1:-help}"
    
    # Ensure build directories exist
    mkdir -p "$BUILD_DIR" "$RPM_BUILD_DIR"
    
    case "$command" in
        init)
            check_requirements || exit 1
            create_spec_file
            init_copr_project
            ;;
        build)
            check_requirements || exit 1
            create_spec_file
            build_rpm_package
            ;;
        publish)
            check_requirements || exit 1
            submit_to_copr
            ;;
        verify)
            verify_copr_setup
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
