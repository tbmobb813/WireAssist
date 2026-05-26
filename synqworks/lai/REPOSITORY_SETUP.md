# Phase 6.6 - Repository Setup Guide

## Overview

This guide covers setting up and maintaining APT PPA (Personal Package Archive) and Copr repositories for the Linux AI Assistant, enabling automatic package distribution across Ubuntu/Debian and Fedora/RHEL systems respectively.

## Table of Contents

1. [APT PPA Setup (Ubuntu/Debian)](#apt-ppa-setup)
2. [Copr Setup (Fedora/RHEL)](#copr-setup)
3. [Automated CI/CD](#automated-cicd)
4. [Repository Management](#repository-management)
5. [Troubleshooting](#troubleshooting)
6. [User Installation](#user-installation)

---

## APT PPA Setup

### Prerequisites

- Ubuntu/Debian system or build environment
- Launchpad account: https://launchpad.net/
- GPG installed
- Required packages: `debhelper`, `devscripts`, `dput`

### Installation

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install debhelper devscripts dput dpkg-dev

# Fedora/RHEL (if building on those systems)
sudo dnf install rpm-build rpmdevtools
```

### Step 1: Launchpad Account Setup

1. Go to https://launchpad.net and create an account
2. Set your Ubuntu SSH key:
   - https://launchpad.net/~/+edit
   - Add your SSH public key (~/.ssh/id_rsa.pub)
3. Create a PPA:
   - https://launchpad.net/~/+create-ppa
   - Name: `linux-ai-assistant`
   - Description: "Linux AI Desktop Assistant"

### Step 2: Initialize Repository

```bash
cd linux-ai-assistant

# Set your Launchpad username
export LAUNCHPAD_USER=your_username
export GPG_EMAIL=your_email@example.com
export GPG_NAME="Your Full Name"

# Run initialization
./setup-apt-ppa.sh init
```

This will:

- Generate GPG key for signing packages
- Export public key to upload to Launchpad
- Create configuration files

### Step 3: Upload GPG Key

1. Copy the GPG key:

   ```bash
   cat build/pubkey.asc
   ```

2. Add to Launchpad:
   - Go to https://launchpad.net/~/+edit
   - Paste the key in "OpenPGP keys" section
   - Wait for Launchpad to verify (usually 5-10 minutes)

### Step 4: Build Package

```bash
./setup-apt-ppa.sh build
```

This creates:

- `.deb` binary packages
- `.dsc` source package
- `.changes` file for upload
- `.orig.tar.gz` source tarball

### Step 5: Publish to PPA

```bash
./setup-apt-ppa.sh publish
```

**Note**: Launchpad will automatically build for all supported Ubuntu releases:

- Focal (20.04 LTS)
- Jammy (22.04 LTS)
- Noble (24.04 LTS)

Monitor builds at: `https://launchpad.net/~your_username/+archive/ubuntu/linux-ai-assistant`

### Verification

```bash
./setup-apt-ppa.sh verify
```

---

## Copr Setup

### Prerequisites

- Fedora Workstation or build system
- Copr account: https://copr.fedorainfracloud.org
- `copr-cli` installed and configured
- Required packages: `rpmbuild`, `rpmdevtools`

### Installation

```bash
# Fedora
sudo dnf install copr-cli rpmdevtools rpm-build

# RHEL/CentOS
sudo yum install copr-cli rpmdevtools rpm-build
```

### Step 1: Copr Account Setup

1. Go to https://copr.fedorainfracloud.org and create account
2. Generate API token:
   - https://copr.fedorainfracloud.org/api
   - Copy the API token
3. Configure copr-cli:
   ```bash
   copr-cli configure
   # Paste your API token when prompted
   ```

### Step 2: Initialize Project

```bash
cd linux-ai-assistant

# Set your Copr username
export COPR_USER=your_username
export COPR_PROJECT=linux-ai-assistant

# Run initialization
./setup-copr.sh init
```

This will:

- Create RPM spec file
- Initialize Copr project
- Configure build targets

### Step 3: Build Package

```bash
./setup-copr.sh build
```

This creates:

- `.src.rpm` source RPM
- Binary `.rpm` files
- Build artifacts in `build/rpm/dist/`

### Step 4: Submit to Copr

```bash
./setup-copr.sh publish
```

Copr will automatically build for:

- Fedora 39 (x86_64)
- Fedora 40 (x86_64)
- RHEL 9 (x86_64)

Monitor builds at: `https://copr.fedorainfracloud.org/coprs/your_username/linux-ai-assistant/`

### Verification

```bash
./setup-copr.sh verify
```

---

## Automated CI/CD

### GitHub Actions Workflow

The automated workflow (`.github/workflows/repository-setup.yml`) handles:

- Building packages on tag push
- Publishing to Launchpad PPA and Copr
- Creating GitHub releases with announcements

### Setup Instructions

1. Add secrets to GitHub repository:

   ```text
   Settings → Secrets and variables → Actions
   ```

2. Required secrets:
   - `LAUNCHPAD_USER`: Your Launchpad username
   - `LAUNCHPAD_PASSWORD`: Your Launchpad password
   - `COPR_USER`: Your Copr username
   - `COPR_API_TOKEN`: Your Copr API token
   - `GPG_EMAIL`: Email for package signing
   - `GPG_PRIVATE_KEY`: Base64 encoded GPG private key

3. Encode GPG key:
   ```bash
   gpg --export-secret-key your_email@example.com | base64 > gpg_key.txt
   # Copy contents of gpg_key.txt to GITHUB_GPG_PRIVATE_KEY secret
   ```

### Creating Releases

Once configured, releases happen automatically:

```bash
# Tag a release
git tag -a v0.2.0 -m "Version 0.2.0 - New Features"
git push origin v0.2.0

# GitHub Actions will:
# 1. Build all packages
# 2. Publish to PPA and Copr
# 3. Create GitHub release
# 4. Post release announcement
```

---

## Repository Management

### Updating Packages

#### APT PPA

```bash
# Make changes and increment version in debian/changelog
./setup-apt-ppa.sh build
./setup-apt-ppa.sh publish
```

#### Copr

```bash
# Update spec file and version
./setup-copr.sh build
./setup-copr.sh publish
```

### Tracking Build Status

#### APT PPA

- UI: https://launchpad.net/~username/+archive/ubuntu/linux-ai-assistant
- Logs: Each distro has separate build logs

#### Copr

- UI: https://copr.fedorainfracloud.org/coprs/username/linux-ai-assistant/
- API: `copr-cli get-project username/linux-ai-assistant`

### Troubleshooting Builds

#### APT PPA Build Failures

```bash
# Check build log
curl https://launchpad.net/~username/+archive/ubuntu/linux-ai-assistant/+buildjobs

# Common issues:
# - Missing build dependencies → Update debian/control
# - Upstream source unavailable → Check URL in debian/rules
# - GPG key issues → Verify key at Launchpad
```

#### Copr Build Failures

```bash
# Check build status
copr-cli get-package username/linux-ai-assistant linux-ai-assistant

# View specific build log
copr-cli status username/linux-ai-assistant

# Common issues:
# - Missing build deps → Update Requires in spec
# - Source URL broken → Verify in .spec file
# - Platform compatibility → Check ExclusiveArch
```

---

## Repository Management

### Adding New Ubuntu Releases

Edit `setup-apt-ppa.sh`:

```bash
UBUNTU_RELEASES=("focal" "jammy" "noble" "oracular")
```

### Adding New Fedora Releases

Edit `setup-copr.sh`:

```bash
COPR_CHROOTS=("fedora-39-x86_64" "fedora-40-x86_64" "fedora-41-x86_64")
```

Then update Copr project:

```bash
copr-cli edit-project username/linux-ai-assistant \
  --chroot fedora-41-x86_64
```

### Repository Statistics

Check package download stats:

```bash
# APT PPA
curl -s https://launchpad.net/~username/+archive/ubuntu/linux-ai-assistant/+packages | grep -i downloads

# Copr
copr-cli get-project username/linux-ai-assistant
```

---

## User Installation

### Ubuntu/Debian Users

```bash
# Add PPA
sudo add-apt-repository ppa:username/linux-ai-assistant

# Update and install
sudo apt update
sudo apt install linux-ai-assistant

# Upgrades
sudo apt upgrade
```

### Fedora/RHEL Users

```bash
# Enable Copr
sudo dnf copr enable username/linux-ai-assistant

# Install
sudo dnf install linux-ai-assistant

# Updates
sudo dnf upgrade
```

### Snap

```bash
snap install linux-ai-assistant
# Automatic updates via snapd
```

### Flatpak

```bash
flatpak install com.linuxai.assistant
# Automatic updates via flatpak
```

---

## Security Considerations

### GPG Key Management

```bash
# Backup GPG keys
gpg --export-secret-keys your_email > ~/backup-secret.gpg

# Import from backup
gpg --import ~/backup-secret.gpg

# Change passphrase
gpg --edit-key your_email@example.com
# Command: passwd
```

### API Token Security

- Store API tokens in environment only, never in version control
- Rotate tokens quarterly
- Use GitHub Secrets for CI/CD tokens

### Package Verification

Users can verify package signatures:

```bash
# Debian
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys YOUR_KEY_ID

# RPM
rpm --import https://copr.fedorainfracloud.org/coprs/username/linux-ai-assistant/repo/fedora-40/pubkey.gpg
```

---

## Troubleshooting

### PPA Connection Issues

```bash
# Test Launchpad connection
ssh -T bzr+ssh://your_username@bazaar.launchpad.net/

# Fix SSH key issues
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_rsa
```

### Copr API Issues

```bash
# Test Copr API
copr-cli whoami

# Re-authenticate if needed
copr-cli configure
```

### Build Dependency Issues

**APT:**

```bash
# Update dependencies in debian/control
Build-Depends: debhelper (>= 13), node-npm, cargo, rustc

# Force rebuild
rm -rf debian/
./setup-apt-ppa.sh build
```

**Copr:**

```bash
# Update spec file
BuildRequires:  cargo, rustc, npm

# Rebuild
./setup-copr.sh build
```

### GPG Key Problems

```bash
# List keys
gpg --list-secret-keys

# Delete key if needed
gpg --delete-secret-key your_email@example.com

# Regenerate
./setup-apt-ppa.sh init
```

---

## Future Enhancements

### Planned Features

1. **Automatic Rebuilds**: Trigger rebuilds on source updates
2. **Release Signatures**: Add cryptographic verification
3. **Multi-Architecture**: Support ARM64 and other architectures
4. **Beta Channel**: Separate unstable/beta repository
5. **Repository Mirroring**: Distributed mirror network
6. **Analytics**: Track downloads and user statistics

### Configuration

```yaml
# Planned: repository-config.yml
repositories:
  apt-ppa:
    enabled: true
    releases: [focal, jammy, noble]
  copr:
    enabled: true
    chroots: [fedora-40, rhel-9]
  snap:
    enabled: true
    channels: [stable, edge]
  flatpak:
    enabled: true
    branches: [stable]
```

---

## References

- [Launchpad PPA Guide](https://help.launchpad.net/Packaging/PPA)
- [Copr User Documentation](https://docs.pagure.org/copr.github.io/)
- [Debian Packaging](https://www.debian.org/doc/manuals/packaging-tutorial/packaging-tutorial.en.pdf)
- [RPM Packaging](https://rpm-packaging-guide.github.io/)

---

## Quick Reference

### One-Time Setup

```bash
# APT PPA
export LAUNCHPAD_USER=your_username
export GPG_EMAIL=your_email@example.com
./setup-apt-ppa.sh init
# ... upload GPG key to Launchpad ...
./setup-apt-ppa.sh build
./setup-apt-ppa.sh publish

# Copr
export COPR_USER=your_username
./setup-copr.sh init
./setup-copr.sh build
./setup-copr.sh publish
```

### Release Workflow

```bash
# Tag release
git tag -a v0.2.0 -m "Release version 0.2.0"
git push origin v0.2.0

# Or manual:
./setup-apt-ppa.sh build && ./setup-apt-ppa.sh publish
./setup-copr.sh build && ./setup-copr.sh publish
```

### Monitoring

```bash
# APT PPA Status
./setup-apt-ppa.sh verify

# Copr Status
./setup-copr.sh verify

# Both in background
watch -n 60 './setup-apt-ppa.sh verify && ./setup-copr.sh verify'
```

---

**Last Updated**: October 2025  
**Status**: Production Ready  
**Maintainer**: Linux AI Assistant Team
