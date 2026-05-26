# Linux AI Assistant - Packaging Guide

Complete guide for building and packaging the Linux AI Assistant for multiple Linux distributions.

## Overview

The Linux AI Assistant is packaged for multiple Linux distribution formats to maximize compatibility:

- **AppImage**: Universal Linux package (works on most distributions)
- **DEB**: Debian/Ubuntu and derivatives
- **RPM**: Red Hat/Fedora and derivatives
- **Snap**: Canonical's universal package (planned)
- **Flatpak**: Sandboxed application format (planned)

## Prerequisites

### System Requirements

```bash
# Install Rust and Node.js (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node

# Install build dependencies
sudo apt install libssl-dev libsqlite3-dev libdbus-1-dev libglib2.0-dev \
  libxcb-shape0-dev libxcb-xfixes0-dev  # Ubuntu/Debian

# For Fedora/RHEL
sudo dnf install openssl-devel sqlite-devel dbus-devel glib2-devel \
  libxcb-devel libxcb-shape-devel libxcb-xfixes-devel
```

### Project Dependencies

```bash
cd linux-ai-assistant

# Install Node dependencies
npm install

# Install Rust dependencies
cd src-tauri
cargo build --release
cd ..
```

## Building Packages

### AppImage (Universal Linux)

AppImage is a self-contained package that works on most Linux distributions.

**Build AppImage:**

```bash
# Build the AppImage package
npm run tauri build -- --target x86_64-unknown-linux-gnu

# Or using specific command
cd src-tauri
cargo tauri build --target x86_64-unknown-linux-gnu
cd ..
```

**Output Location:**

```text
src-tauri/target/release/bundle/appimage/linux-ai-assistant_*.AppImage
```

**Installation:**

```bash
# Make executable and run
chmod +x linux-ai-assistant_*.AppImage
./linux-ai-assistant_*.AppImage

# Or install to system
sudo cp linux-ai-assistant_*.AppImage /opt/linux-ai-assistant
sudo ln -s /opt/linux-ai-assistant /usr/local/bin/lai
```

**Advantages:**

- Works on virtually any Linux distribution
- No installation required (portable)
- Self-contained with all dependencies
- Easy to distribute

### DEB Package (Debian/Ubuntu)

Package for Debian, Ubuntu, and derivatives.

**Build DEB:**

```bash
# Build the DEB package
npm run tauri build

# DEB package will be generated automatically
```

**Output Location:**

```text
src-tauri/target/release/bundle/deb/linux-ai-assistant_*.deb
```

**Installation:**

```bash
# Install with apt
sudo apt install ./linux-ai-assistant_*.deb

# Or using dpkg
sudo dpkg -i linux-ai-assistant_*.deb
sudo apt install -f  # Install dependencies if needed
```

**For Distribution (PPA/Repository):**

```bash
# Create GPG key for signing (one-time)
gpg --gen-key

# Sign the DEB package
dpkg-sig -k [KEY_ID] -s builder linux-ai-assistant_*.deb

# Verify signature
dpkg-sig -v linux-ai-assistant_*.deb

# Upload to PPA/repository
# Example: using Launchpad
dput ppa:username/ppa linux-ai-assistant_*.deb
```

**Advantages:**

- Standard package format for Debian-based systems
- Easy dependency management
- Automatic desktop integration
- Repository support for automatic updates

### RPM Package (Red Hat/Fedora)

Package for Fedora, RHEL, CentOS, and derivatives.

**Build RPM:**

```bash
# Build the RPM package
npm run tauri build

# RPM package will be generated automatically
```

**Output Location:**

```text
src-tauri/target/release/bundle/rpm/linux-ai-assistant-*.rpm
```

**Installation:**

```bash
# Install with dnf (Fedora)
sudo dnf install ./linux-ai-assistant-*.rpm

# Or using rpm directly
sudo rpm -i linux-ai-assistant-*.rpm

# For older systems with yum
sudo yum install ./linux-ai-assistant-*.rpm
```

**For Distribution (Copr/Repository):**

```bash
# Create Copr repository (for Fedora)
# Visit https://copr.fedorainfracloud.org

# Upload RPM to Copr
copr-cli add-package-scm my-project \
  --clone-url https://github.com/tbmobb813/Linux-AI-Assistant \
  --commit main
```

**Advantages:**

- Standard package format for RPM-based systems
- Built-in dependency resolution
- Repository support
- Automatic updates through package manager

## Advanced Packaging

### Snap Package (Coming Soon)

**Create snapcraft.yaml:**

```yaml
name: linux-ai-assistant
version: "0.1.0"
summary: Linux AI Assistant - Desktop AI Companion
description: |
  Privacy-respecting AI assistant for Linux with local and cloud provider support.

grade: stable
confinement: strict

apps:
  linux-ai-assistant:
    command: linux-ai-assistant
    plugs:
      - desktop
      - desktop-legacy
      - wayland
      - x11
      - network
      - home

parts:
  desktop-glib-only:
    source: https://github.com/ubuntu/snapcraft-desktop-helpers.git
    source-subdir: glib-only
    plugin: make
    build-packages:
      - libglib2.0-dev
    stage-packages:
      - libglib2.0-bin

  linux-ai-assistant:
    after: [desktop-glib-only]
    plugin: rust
    source: .
    build-packages:
      - libssl-dev
      - libsqlite3-dev
      - libdbus-1-dev
```

**Build and Test Snap:**

```bash
# Install snapcraft
sudo apt install snapcraft

# Build snap package
snapcraft

# Test snap locally
sudo snap install --devmode --dangerous linux-ai-assistant_*.snap

# Release to snap store
snapcraft login
snapcraft push linux-ai-assistant_*.snap --release=stable
```

### Flatpak Package (Coming Soon)

**Create com.linuxai.assistant.json:**

```json
{
  "app-id": "com.linuxai.assistant",
  "runtime": "org.freedesktop.Platform",
  "runtime-version": "23.08",
  "sdk": "org.freedesktop.Sdk",
  "sdk-extensions": ["org.freedesktop.Sdk.Extension.rust-stable"],
  "command": "linux-ai-assistant",
  "finish-args": [
    "--share=network",
    "--share=ipc",
    "--socket=x11",
    "--socket=wayland",
    "--filesystem=home",
    "--device=dri"
  ],
  "modules": [
    {
      "name": "linux-ai-assistant",
      "buildsystem": "simple",
      "build-commands": [
        "npm install",
        "npm run tauri build",
        "install -Dm755 src-tauri/target/release/linux-ai-assistant /app/bin/linux-ai-assistant"
      ],
      "sources": [
        {
          "type": "git",
          "url": "https://github.com/tbmobb813/Linux-AI-Assistant.git",
          "branch": "main"
        }
      ]
    }
  ]
}
```

**Build and Test Flatpak:**

```bash
# Install flatpak tools
sudo apt install flatpak flatpak-builder

# Build flatpak
flatpak-builder --user --install --force-clean build-dir com.linuxai.assistant.json

# Test
flatpak run com.linuxai.assistant

# Release to Flathub
# See https://docs.flathub.org/docs/for-app-authors/submission
```

## Distribution & Deployment

### GitHub Releases

Automate package distribution via GitHub Actions:

**Create .github/workflows/publish.yml:**

```yaml
name: Publish Release

on:
  push:
    tags:
      - "v*"

jobs:
  create-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build packages
        run: |
          npm install
          npm run tauri build

      - name: Upload to Release
        uses: softprops/action-gh-release@v1
        with:
          files: src-tauri/target/release/bundle/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Linux Package Repositories

**Set up APT Repository (Debian/Ubuntu):**

```bash
# Create repository structure
mkdir -p ~/linux-ai-assistant-repo/pool/main/l/linux-ai-assistant
mkdir -p ~/linux-ai-assistant-repo/dists/focal/main/binary-amd64

# Copy DEB package
cp linux-ai-assistant_*.deb ~/linux-ai-assistant-repo/pool/main/l/linux-ai-assistant/

# Create Packages file
cd ~/linux-ai-assistant-repo
apt-ftparchive packages pool > dists/focal/main/binary-amd64/Packages
gzip -9c dists/focal/main/binary-amd64/Packages > dists/focal/main/binary-amd64/Packages.gz

# Create Release file
apt-ftparchive -c Release.conf release dists/focal > dists/focal/Release

# Sign Release
gpg --clearsign -u [KEY_ID] -o dists/focal/InRelease dists/focal/Release
```

**Set up Copr Repository (Fedora/RHEL):**

```bash
# Login to Copr
copr-cli login

# Create new project
copr-cli create linux-ai-assistant \
  --chroot fedora-latest-x86_64 \
  --description "Linux AI Assistant"

# Upload RPM
copr-cli add-package-scm linux-ai-assistant \
  --clone-url https://github.com/tbmobb813/Linux-AI-Assistant
```

## Testing Packages

### Automated Testing

```bash
# Test AppImage
./linux-ai-assistant_*.AppImage --version
./linux-ai-assistant_*.AppImage --help

# Test DEB
sudo apt install ./linux-ai-assistant_*.deb
which linux-ai-assistant
linux-ai-assistant --version

# Test RPM
sudo dnf install ./linux-ai-assistant-*.rpm
which linux-ai-assistant
linux-ai-assistant --version
```

### Manual Testing Checklist

- [ ] Application launches successfully
- [ ] Chat interface is responsive
- [ ] Database operations work (save/load conversations)
- [ ] Settings are persisted across restarts
- [ ] CLI companion works (if included)
- [ ] Export/import functionality
- [ ] Global hotkey responds
- [ ] Network operations (AI providers)
- [ ] Local model operations (Ollama)
- [ ] Error handling works properly

### Distribution Testing

```bash
# Test on different distributions
docker run -it --rm -v $(pwd):/workspace ubuntu:22.04 \
  bash -c "cd /workspace && sudo apt install ./linux-ai-assistant_*.deb && linux-ai-assistant --version"

docker run -it --rm -v $(pwd):/workspace fedora:38 \
  bash -c "cd /workspace && sudo dnf install ./linux-ai-assistant-*.rpm && linux-ai-assistant --version"

docker run -it --rm -v $(pwd):/workspace debian:bookworm \
  bash -c "cd /workspace && sudo apt install ./linux-ai-assistant_*.deb && linux-ai-assistant --version"
```

## Troubleshooting Packaging

### AppImage Issues

```bash
# Extract AppImage to debug
./linux-ai-assistant_*.AppImage --appimage-extract

# Check dependencies
ldd squashfs-root/usr/bin/linux-ai-assistant

# View AppImage info
file linux-ai-assistant_*.AppImage
```

### DEB/RPM Issues

```bash
# Check DEB contents
dpkg -c linux-ai-assistant_*.deb

# Check RPM contents
rpm -qlp linux-ai-assistant-*.rpm

# Verify dependencies
dpkg-deb -I linux-ai-assistant_*.deb
rpm -qpR linux-ai-assistant-*.rpm
```

## Size Optimization

Current package sizes (approximate):

| Format   | Size   | Advantages                  |
| -------- | ------ | --------------------------- |
| AppImage | ~45 MB | Portable, self-contained    |
| DEB      | ~35 MB | Standard, slim dependencies |
| RPM      | ~35 MB | Standard, slim dependencies |
| Snap     | ~50 MB | Sandboxed, auto-updating    |
| Flatpak  | ~55 MB | Sandboxed, universal        |

## Distribution Channels

### Official Sources

- **GitHub Releases**: https://github.com/tbmobb813/Linux-AI-Assistant/releases
- **APT PPA**: ppa:tbmobb813/linux-ai-assistant
- **Copr Repository**: copr.fedorainfracloud.org/tbmobb813/linux-ai-assistant
- **Snap Store**: https://snapcraft.io/linux-ai-assistant
- **Flathub**: https://flathub.org/apps/com.linuxai.assistant

### Direct Installation

```bash
# From GitHub releases
curl -L https://github.com/tbmobb813/Linux-AI-Assistant/releases/download/v0.1.0/linux-ai-assistant_0.1.0_amd64.AppImage -o linux-ai-assistant
chmod +x linux-ai-assistant
./linux-ai-assistant

# Via system package manager (after repository setup)
sudo apt install linux-ai-assistant    # Debian/Ubuntu
sudo dnf install linux-ai-assistant    # Fedora/RHEL
snap install linux-ai-assistant        # Snap
flatpak install com.linuxai.assistant  # Flatpak
```

## Version Management

### Semantic Versioning

```text
MAJOR.MINOR.PATCH
0.1.0
│ │ └─ Patch: Bug fixes (0.1.1, 0.1.2)
│ └─── Minor: New features (0.2.0, 0.3.0)
└───── Major: Breaking changes (1.0.0)
```

### Release Workflow

1. Develop features in branches
2. Test thoroughly
3. Update version in:
   - `package.json`
   - `Cargo.toml`
   - `tauri.conf.json`
4. Create git tag: `git tag v0.2.0`
5. Build all packages
6. Upload to repositories
7. Announce release

## Maintenance & Updates

### Regular Updates

```bash
# Check for new upstream releases
git fetch upstream
git log upstream/main

# Update dependencies
npm update
cargo update

# Run security checks
npm audit
cargo audit

# Rebuild and test
npm run build
npm run tauri build
```

### Security Updates

- Monitor dependencies for vulnerabilities
- Apply critical security patches immediately
- Release security patches with priority
- Use GPG signing for releases

### Long-term Support

- Maintain stable branches for older versions
- Security patches for last 2 major versions
- Monthly release cycle for bug fixes
- Quarterly cycle for feature releases

---

**Version**: 1.0  
**Last Updated**: October 2025  
**See Also**: DEVELOPER_GUIDE.md, USER_GUIDE.md
