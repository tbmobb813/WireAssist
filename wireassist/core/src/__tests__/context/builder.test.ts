import { ContextBuilder } from '../../context/builder';
import * as fs from 'fs';
import * as path from 'path';

describe('ContextBuilder', () => {
  const testDir = path.join(__dirname, 'test-files');
  const testFile = path.join(testDir, 'test.ts');

  beforeAll(() => {
    // Create test directory and file
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFile, 'const x = 1;');
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  test('should create a new context builder', () => {
    const builder = new ContextBuilder();
    expect(builder).toBeDefined();
  });

  test('should add files', async () => {
    const builder = new ContextBuilder();
    builder.addFiles([testFile]);

    const context = await builder.build();
    expect(context.files).toBeDefined();
    expect(context.files?.length).toBe(1);
    expect(context.files?.[0].path).toBe(testFile);
    expect(context.files?.[0].content).toBe('const x = 1;');
  });

  test('should detect file language', async () => {
    const builder = new ContextBuilder();
    builder.addFiles([testFile]);

    const context = await builder.build();
    expect(context.files?.[0].language).toBe('typescript');
  });

  test('should add workspace context', async () => {
    const builder = new ContextBuilder();
    builder.addWorkspace(testDir);

    const context = await builder.build();
    expect(context.workspace).toBeDefined();
    expect(context.workspace?.path).toBe(testDir);
  });

  test('should build context', async () => {
    const builder = new ContextBuilder();
    builder.addFiles([testFile]);

    const context = await builder.build();
    expect(context).toBeDefined();
    expect(typeof context).toBe('object');
  });

  test('should handle empty builder', async () => {
    const builder = new ContextBuilder();
    const context = await builder.build();

    expect(context).toBeDefined();
    expect(typeof context).toBe('object');
  });
});
