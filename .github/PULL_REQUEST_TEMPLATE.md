# Pull Request

## Summary

<!-- Provide a clear and concise description of what this PR does -->

### What changed?

<!-- Describe the changes made in this PR -->

### Why was this change needed?

<!-- Explain the motivation for this change -->

## Type of Change

Please check all that apply:

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Code refactoring (no functional changes)
- [ ] 🧪 Test updates
- [ ] 🚀 Performance improvement
- [ ] 🔒 Security fix

## Testing

### How has this been tested?

<!-- Describe the tests that you ran to verify your changes -->

- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Manual testing

### Test Configuration

- **OS/Distribution**:
- **Installation method**:
- **AI Provider(s) tested**:

### Testing Steps

<!-- Provide specific steps for reviewers to test your changes -->

1.
2.
3.

## Related Issues

<!-- Link any related issues -->

- Fixes #(issue number)
- Relates to #(issue number)
- Part of #(issue number)

## Screenshots/Videos

<!-- If your changes affect the UI, please include screenshots or videos -->

## Checklist

### Code Quality

- [ ] My code follows the project's code style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors

### Testing

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have run the smoke tests (`./dev/smoke_test_ipc.sh`) if applicable

### Documentation

- [ ] I have made corresponding changes to the documentation
- [ ] I have updated the CHANGELOG.md if this is a user-facing change
- [ ] Any new dependencies are documented and justified

### Rust/Tauri Specific (if applicable)

- [ ] `cargo clippy` passes without warnings
- [ ] `cargo fmt` has been run
- [ ] `cargo test` passes
- [ ] Tauri commands are properly typed and documented

### Frontend Specific (if applicable)

- [ ] TypeScript compilation passes (`pnpm run typecheck`)
- [ ] Vitest tests pass (`pnpm test`)
- [ ] Components are properly typed
- [ ] No console errors in browser dev tools

### CLI Specific (if applicable)

- [ ] CLI commands work as expected
- [ ] IPC communication functions correctly
- [ ] Error handling is implemented
- [ ] Help text is updated if needed

## Performance Impact

<!-- Describe any performance implications of your changes -->

- [ ] No performance impact
- [ ] Performance improvement
- [ ] Minor performance impact (justify below)
- [ ] Significant performance impact (justify and discuss mitigation)

**Performance notes**:

## Breaking Changes

<!-- If this PR contains breaking changes, describe them here -->

- [ ] No breaking changes
- [ ] Breaking changes (describe below)

**Breaking change description**:

## Deployment Notes

<!-- Any special deployment considerations -->

- [ ] No special deployment considerations
- [ ] Database migrations required
- [ ] Configuration changes required
- [ ] Dependencies updated

## Additional Notes

<!-- Any additional information that reviewers should know -->

## Review Focus Areas

<!-- Highlight specific areas where you'd like focused review -->

- [ ] Code logic and correctness
- [ ] Performance implications
- [ ] Security considerations
- [ ] User experience
- [ ] Documentation accuracy

---

**For Maintainers:**

- [ ] PR title follows conventional commit format
- [ ] Labels are applied appropriately
- [ ] Milestone is set (if applicable)
- [ ] Assignees are set
