#!/bin/bash

##
# Linux AI Assistant - Build All Packages Script
# Builds AppImage, DEB, and RPM packages for distribution
##

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="linux-ai-assistant"
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version"[": ]*\([^"]*\).*/\1/')
BUILD_DIR="src-tauri/target/release/bundle"
OUTPUT_DIR="dist/packages"

# Functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[ℹ]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo -e "\n${YELLOW}==>${NC} $1\n"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking Prerequisites"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js."
        exit 1
    fi
    print_status "Node.js $(node --version)"

    # Check Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Rust/Cargo not found. Please install Rust."
        exit 1
    fi
    print_status "Rust $(rustc --version)"

    # Check build dependencies for Linux
    print_info "Checking Linux build dependencies..."
}

# Clean previous builds
clean_builds() {
    print_step "Cleaning Previous Builds"

    rm -rf "$BUILD_DIR"
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    print_status "Build directories cleaned"
}

# Build packages
build_packages() {
    print_step "Building Packages"

    print_info "Installing Node dependencies..."
    npm install

    print_info "Building frontend..."
    npm run build

    print_info "Building Tauri application and packages..."
    cd src-tauri
    cargo tauri build
    cd ..

    print_status "All packages built successfully"
}

# Copy packages to output directory
copy_packages() {
    print_step "Copying Packages to Output Directory"

    # Copy AppImage
    if [ -d "$BUILD_DIR/appimage" ]; then
        print_info "Copying AppImage..."
        cp "$BUILD_DIR/appimage/$PROJECT_NAME"*.AppImage "$OUTPUT_DIR/" 2>/dev/null || true
        ls -lh "$OUTPUT_DIR"/*.AppImage 2>/dev/null | awk '{print "  - " $9, "(" $5 ")"}'
    fi

    # Copy DEB
    if [ -d "$BUILD_DIR/deb" ]; then
        print_info "Copying DEB package..."
        cp "$BUILD_DIR/deb/$PROJECT_NAME"*.deb "$OUTPUT_DIR/" 2>/dev/null || true
        ls -lh "$OUTPUT_DIR"/*.deb 2>/dev/null | awk '{print "  - " $9, "(" $5 ")"}'
    fi

    # Copy RPM
    if [ -d "$BUILD_DIR/rpm" ]; then
        print_info "Copying RPM package..."
        cp "$BUILD_DIR/rpm/$PROJECT_NAME"*.rpm "$OUTPUT_DIR/" 2>/dev/null || true
        ls -lh "$OUTPUT_DIR"/*.rpm 2>/dev/null | awk '{print "  - " $9, "(" $5 ")"}'
    fi

    print_status "Packages copied to $OUTPUT_DIR"
}

# Generate checksums
generate_checksums() {
    print_step "Generating Checksums"

    cd "$OUTPUT_DIR"

    # Generate SHA256 checksums
    if command -v sha256sum &> /dev/null; then
        sha256sum * > SHA256SUMS
        print_status "SHA256 checksums generated"
    fi

    # Generate MD5 checksums (optional)
    if command -v md5sum &> /dev/null; then
        md5sum * > MD5SUMS
        print_status "MD5 checksums generated"
    fi

    cd - > /dev/null
}

# Generate build report
generate_report() {
    print_step "Generating Build Report"

    local report_file="$OUTPUT_DIR/BUILD_REPORT.txt"

    cat > "$report_file" << EOF
Linux AI Assistant - Build Report
==================================
Build Date: $(date)
Version: $VERSION
Platform: $(uname -s) $(uname -m)

Build Environment:
- Node.js: $(node --version)
- npm: $(npm --version)
- Rust: $(rustc --version)
- Cargo: $(cargo --version)

Packages Generated:
EOF

    # List all packages
    cd "$OUTPUT_DIR"
    for file in *; do
        if [[ ! "$file" =~ ^(SHA256SUMS|MD5SUMS|BUILD_REPORT.txt)$ ]]; then
            local size=$(ls -lh "$file" | awk '{print $5}')
            echo "- $file ($size)" >> "$report_file"
        fi
    done
    cd - > /dev/null

    print_status "Build report generated: $report_file"
}

# Display summary
display_summary() {
    print_step "Build Summary"

    echo "Version: $VERSION"
    echo "Output Directory: $OUTPUT_DIR"
    echo ""
    echo "Generated packages:"
    ls -lh "$OUTPUT_DIR"/ 2>/dev/null | grep -E '\.(AppImage|deb|rpm|txt|sums)$' | awk '{print "  " $9, "(" $5 ")"}'

    echo ""
    echo "Next steps:"
    echo "  1. Test packages on target distributions"
    echo "  2. Create git tag: git tag v$VERSION"
    echo "  3. Upload to GitHub Releases"
    echo "  4. Publish to distribution repositories"
    echo ""
}

# Main execution
main() {
    print_info "Linux AI Assistant - Package Builder"
    print_info "Version: $VERSION"
    echo ""

    check_prerequisites
    clean_builds
    build_packages
    copy_packages
    generate_checksums
    generate_report
    display_summary

    print_status "Build process completed successfully!"
}

# Run main function
main
