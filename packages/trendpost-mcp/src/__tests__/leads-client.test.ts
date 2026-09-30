import { fetchLeadSignupCount } from '../leads-client';

describe('fetchLeadSignupCount()', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws a clear error when SUPABASE_URL/SUPABASE_ANON_KEY are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    await expect(fetchLeadSignupCount(new Date().toISOString())).rejects.toThrow(
      /Missing Supabase credentials/
    );
  });

  it('mentions only the specific missing variable(s)', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_ANON_KEY;
    await expect(fetchLeadSignupCount(new Date().toISOString())).rejects.toThrow(
      /SUPABASE_ANON_KEY/
    );
  });
});
