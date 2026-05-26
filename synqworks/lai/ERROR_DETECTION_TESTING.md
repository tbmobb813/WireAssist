# Error Detection Testing Samples

## How to Test

You can test error detection in several ways:

### 1. Manual Testing in UI

```typescript
// In browser console:
import { detectErrors } from "./types/errors";
const errors = detectErrors(testErrorSamples.typescript);
console.log(errors);
```

### 2. CLI Testing

```bash
# Pipe error output to analyze:
echo "src/App.tsx(42,15): error TS2307: Cannot find module 'missing'." | lai analyze

# Or from a file:
cat error.log | lai analyze
```

### 3. Component Testing

The ErrorMonitor component will automatically show notifications for detected errors.

---

## Test Error Samples

### TypeScript Errors

```
src/components/Button.tsx(15,8): error TS2307: Cannot find module '@types/react' or its corresponding type declarations.
src/lib/utils.ts(42,15): error TS2322: Type 'string' is not assignable to type 'number'.
src/App.tsx(100,3): warning TS6133: 'unused' is declared but its value is never read.
```

### Rust Errors

```
error[E0308]: mismatched types
  --> src/main.rs:10:18
   |
10 |     let x: i32 = "hello";
   |            ---   ^^^^^^^ expected `i32`, found `&str`
   |            |
   |            expected due to this

error[E0425]: cannot find function `missing_func` in this scope
  --> src/lib.rs:25:5
   |
25 |     missing_func();
   |     ^^^^^^^^^^^^ not found in this scope
```

### Python Errors

```
Traceback (most recent call last):
  File "app.py", line 42, in main
    result = process_data(data)
  File "app.py", line 15, in process_data
    return data['key']
KeyError: 'key'

File "server.py", line 100
    def broken_function(
                       ^
SyntaxError: unexpected EOF while parsing
```

### JavaScript Errors

```
TypeError: Cannot read property 'map' of undefined
    at processArray (utils.js:25:15)
    at main (app.js:10:5)
    at Object.<anonymous> (app.js:50:1)

ReferenceError: undefinedVariable is not defined
    at calculate (math.js:15:10)
    at run (index.js:42:20)
```

### Go Errors

```
./main.go:15:9: undefined: fmt.Printl
./server.go:42:15: cannot use "test" (type string) as type int in assignment
./utils.go:100:2: syntax error: unexpected newline, expecting comma or }
```

### NPM Errors

```
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /home/user/project/package.json
npm ERR! errno -2
npm ERR! enoent ENOENT: no such file or directory, open '/home/user/project/package.json'

npm ERR! peer dep missing: react@^18.0.0, required by react-dom@18.2.0
```

### Cargo Errors

```
error: failed to compile `project v0.1.0`, intermediate artifacts can be found at `/tmp/cargo-installxyz`

Caused by:
  failed to parse manifest at `/home/user/project/Cargo.toml`

error: unresolved import `tokio::stream`
 --> src/main.rs:5:17
```

### Git Errors

```
fatal: not a git repository (or any of the parent directories): .git
error: pathspec 'nonexistent-file.txt' did not match any file(s) known to git
fatal: refusing to merge unrelated histories
```

---

## Usage Examples

### Example 1: Scan Build Output

```bash
cargo build 2>&1 | lai analyze "Help me fix these compilation errors"
```

### Example 2: Check TypeScript

```bash
npx tsc --noEmit 2>&1 | lai analyze "Review these TypeScript errors"
```

### Example 3: Python Script Errors

```bash
python script.py 2>&1 | lai analyze "Debug this Python error"
```

### Example 4: Watch for Errors

```bash
# In terminal:
npm run dev 2>&1 | tee /dev/tty | lai analyze --auto
```

---

## Expected Behavior

When errors are detected:

1. **Toast Notification** appears in bottom-right
2. **ErrorNotification** component shows:
   - Error icon (🔴⚠️ℹ️)
   - Error message summary
   - File and line number
   - "Fix This Error" button
   - Copy button

3. **Fix This Error** button:
   - Creates/opens conversation
   - Sends formatted error context to AI
   - Includes file, line, error message, stack trace
   - AI provides specific fix suggestions

4. **Error persists** in ErrorMonitor until:
   - User dismisses notification
   - Error is removed from store
   - 3 maximum simultaneous notifications

---

## Testing Checklist

- [ ] TypeScript errors detected correctly
- [ ] Rust errors with error codes parsed
- [ ] Python tracebacks extracted
- [ ] JavaScript stack traces work
- [ ] NPM/Cargo errors recognized
- [ ] Git errors captured
- [ ] File paths extracted correctly
- [ ] Line numbers identified
- [ ] Error codes (TS2307, E0308) captured
- [ ] Toast notifications appear
- [ ] Fix button opens chat with context
- [ ] Copy button works
- [ ] Multiple errors show (max 3)
- [ ] Dismiss button removes notification
- [ ] No false positives on normal output
- [ ] Performance acceptable (< 10ms detection)

---

## Integration Points

### 1. CLI Integration

The `lai analyze` command automatically detects errors in piped content.

### 2. IPC Integration

Backend can send error events to frontend via IPC:

```rust
send_ipc_event("error_detected", error_json);
```

### 3. File Watcher Integration

Project file changes can trigger error detection on save.

### 4. Terminal Integration

Future: Watch terminal output in background for errors.

---

## Future Enhancements

1. **Auto-fix Suggestions**: AI proposes fix, user applies with one click
2. **Error History**: Track recurring errors
3. **Smart Grouping**: Group related errors
4. **Severity Filtering**: Show only errors, hide warnings
5. **Custom Patterns**: User-defined error regex
6. **IDE Integration**: Jump to error in VS Code
7. **Error Trends**: Analytics on error frequency
8. **Team Sharing**: Share common errors and fixes
