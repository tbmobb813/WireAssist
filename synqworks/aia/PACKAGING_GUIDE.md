# AI Assist - Packaging Guide

Complete guide for building and packaging the AI Assist for multiple Linux distributions.

## Overview

The AI Assist is packaged for multiple Linux distribution formats to maximize compatibility:

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
cd ai-assist

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
src-tauri/target/release/bundle/appimage/ai-assist_*.AppImage
```

**Installation:**

```bash
# Make executable and run
chmod +x ai-assist_*.AppImage
./ai-assist_*.AppImage

# Or install to system
sudo cp ai-assist_*.AppImage /opt/ai-assist
sudo ln -s /opt/ai-assist /usr/local/bin/aia
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
src-tauri/target/release/bundle/deb/ai-assist_*.deb
```

**Installation:**

```bash
# Install with apt
sudo apt install ./ai-assist_*.deb

# Or using dpkg
sudo dpkg -i ai-assist_*.deb
sudo apt install -f  # Install dependencies if needed
```

**For Distribution (PPA/Repository):**

```bash
# Create GPG key for signing (one-time)
gpg --gen-key

# Sign the DEB package
dpkg-sig -k [KEY_ID] -s builder ai-assist_*.deb

# Verify signature
dpkg-sig -v ai-assist_*.deb

# Upload to PPA/repository
# Example: using Launchpad
dput ppa:username/ppa ai-assist_*.deb
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
src-tauri/target/release/bundle/rpm/ai-assist-*.rpm
```

**Installation:**

```bash
# Install with dnf (Fedora)
sudo dnf install ./ai-assist-*.rpm

# Or using rpm directly
sudo rpm -i ai-assist-*.rpm

# For older systems with yum
sudo yum install ./ai-assist-*.rpm
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
name: ai-assist
version: "0.1.0"
summary: AI Assist - Desktop AI Companion
description: |
  Privacy-respecting AI assistant for Linux with local and cloud provider support.

grade: stable
confinement: strict

apps:
  ai-assist:
    command: ai-assist
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

  ai-assist:
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
sudo snap install --devmode --dangerous ai-assist_*.snap

# Release to snap store
snapcraft login
snapcraft push ai-assist_*.snap --release=stable
```

### Flatpak Package (Coming Soon)

**Create com.aiassist.app.json:**

```json
{
  "app-id": "com.aiassist.app",
  "runtime": "org.freedesktop.Platform",
  "runtime-version": "23.08",
  "sdk": "org.freedesktop.Sdk",
  "sdk-extensions": ["org.freedesktop.Sdk.Extension.rust-stable"],
  "command": "ai-assist",
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
      "name": "ai-assist",
      "buildsystem": "simple",
      "build-commands": [
        "npm install",
        "npm run tauri build",
        "install -Dm755 src-tauri/target/release/ai-assist /app/bin/ai-assist"
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
flatpak-builder --user --install --force-clean build-dir com.aiassist.app.json

# Test
flatpak run com.aiassist.app

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
mkdir -p ~/ai-assist-repo/pool/main/l/ai-assist
mkdir -p ~/ai-assist-repo/dists/focal/main/binary-amd64

# Copy DEB package
cp ai-assist_*.deb ~/ai-assist-repo/pool/main/l/ai-assist/

# Create Packages file
cd ~/ai-assist-repo
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
copr-cli create ai-assist \
  --chroot fedora-latest-x86_64 \
  --description "AI Assist"

# Upload RPM
copr-cli add-package-scm ai-assist \
  --clone-url https://github.com/tbmobb813/Linux-AI-Assistant
```

## Testing Packages

### Automated Testing

```bash
# Test AppImage
./ai-assist_*.AppImage --version
./ai-assist_*.AppImage --help

# Test DEB
sudo apt install ./ai-assist_*.deb
which ai-assist
ai-assist --version

# Test RPM
sudo dnf install ./ai-assist-*.rpm
which ai-assist
ai-assist --version
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
  bash -c "cd /workspace && sudo apt install ./ai-assist_*.deb && ai-assist --version"

docker run -it --rm -v $(pwd):/workspace fedora:38 \
  bash -c "cd /workspace && sudo dnf install ./ai-assist-*.rpm && ai-assist --version"

docker run -it --rm -v $(pwd):/workspace debian:bookworm \
  bash -c "cd /workspace && sudo apt install ./ai-assist_*.deb && ai-assist --version"
```

## Troubleshooting Packaging

### AppImage Issues

```bash
# Extract AppImage to debug
./ai-assist_*.AppImage --appimage-extract

# Check dependencies
ldd squashfs-root/usr/bin/ai-assist

# View AppImage info
file ai-assist_*.AppImage
```

### DEB/RPM Issues

```bash
# Check DEB contents
dpkg -c ai-assist_*.deb

# Check RPM contents
rpm -qlp ai-assist-*.rpm

# Verify dependencies
dpkg-deb -I ai-assist_*.deb
rpm -qpR ai-assist-*.rpm
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
- **APT PPA**: ppa:tbmobb813/ai-assist
- **Copr Repository**: copr.fedorainfracloud.org/tbmobb813/ai-assist
- **Snap Store**: https://snapcraft.io/ai-assist
- **Flathub**: https://flathub.org/apps/com.aiassist.app

### Direct Installation

```bash
# From GitHub releases
curl -L https://github.com/tbmobb813/Linux-AI-Assistant/releases/download/v0.1.0/ai-assist_0.1.0_amd64.AppImage -o ai-assist
chmod +x ai-assist
./ai-assist

# Via system package manager (after repository setup)
sudo apt install ai-assist    # Debian/Ubuntu
sudo dnf install ai-assist    # Fedora/RHEL
snap install ai-assist        # Snap
flatpak install com.aiassist.app  # Flatpak
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
