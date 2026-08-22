# Security Policy

## Supported Versions

We actively support the following versions of WireAssist with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| Beta    | :white_check_mark: |

## Reporting a Vulnerability

We take the security of WireAssist seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to: [security@wireassist.techtrendwire.com](mailto:security@wireassist.techtrendwire.com)

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to Expect

You can expect to receive:

1. **Acknowledgment** within 48 hours of your report
2. **Initial assessment** within 1 week
3. **Regular updates** on our progress
4. **Credit** in our security advisories (if desired)

### Security Update Process

1. **Triage**: We assess the severity and impact
2. **Fix Development**: We develop and test a fix
3. **Coordinated Disclosure**: We work with you on disclosure timing
4. **Release**: We release the security update
5. **Advisory**: We publish a security advisory

## Security Features

### Data Protection

- **Local Storage**: Agent memory and approvals are stored locally by default (`~/.wireassist`)
- **Secure API Keys**: Provider keys are supplied via environment variables, not committed to the repo
- **No Tracking**: No telemetry or usage data collection by default
- **Privacy Indicators**: Clear separation of local vs cloud processing where applicable

### Code Security

- **TypeScript**: Type-safe application and agent code
- **Dependency Scanning**: Regular automated dependency vulnerability scanning
- **Code Review**: All changes undergo security-focused code review

### API Security

- **Local-only defaults**: Command Center API binds to localhost in development
- **Input Validation**: Task and license endpoints validate request bodies
- **Tier gating**: Licensed features are gated server-side by plan tier

## Security Best Practices for Users

### API Key Management

- Store API keys only in `.env.local` (never commit secrets)
- Never share API keys in conversations or screenshots
- Rotate API keys regularly
- Use separate API keys for different applications

### System Security

- Keep your Linux distribution updated
- Run the application with standard user permissions (not root)
- Prefer official packages and verified releases when available

### Development Security

- Never expose development-only features in production builds
- Use secure development practices when contributing
- Follow security guidelines in CONTRIBUTING.md when present

## Known Security Considerations

### AI Provider Communication

- **Cloud Providers**: Communications are encrypted in transit (HTTPS)
- **Data Processing**: Some providers may log conversations for improvement
- **API Limits**: Rate limiting and token management prevent abuse

### Database Security

- **SQLite**: Local database with file system permissions under `~/.wireassist`
- **Encryption**: Consider using full-disk encryption for sensitive data
- **Access Control**: Standard file permissions protect the database

## Dependency Security

We use several automated tools to maintain dependency security:

- **Dependabot**: Automated dependency updates
- **GitHub Security Advisories**: Monitoring for known vulnerabilities
- **npm/pnpm audit**: Node.js dependency vulnerability scanning

## Incident Response

In the event of a security incident:

1. **Containment**: Immediate steps to limit exposure
2. **Assessment**: Evaluation of impact and affected systems
3. **Communication**: Transparent communication with users
4. **Remediation**: Rapid development and deployment of fixes
5. **Recovery**: Assistance for affected users
6. **Lessons Learned**: Process improvements to prevent recurrence

## Security Contact Information

- **Security Email**: [security@wireassist.techtrendwire.com](mailto:security@wireassist.techtrendwire.com)
- **Response Time**: 48 hours for acknowledgment
- **Languages**: English

## Legal and Compliance

- We follow responsible disclosure practices
- We respect security researchers and their work
- We do not pursue legal action against security researchers who follow this policy
- We may provide rewards for qualifying security discoveries (bug bounty)

## Security Acknowledgments

We thank the following security researchers for their responsible disclosure:

_(This section will be updated as we receive and address security reports)_

---

**Last Updated**: July 2026
**Next Review**: October 2026
