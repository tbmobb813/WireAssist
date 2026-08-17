import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
const CREDENTIALS_PATH = path.join(HOME_PATH, '.wireassist', 'youtube-credentials.json');

interface YouTubeCredentials {
  apiKey: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
}

function loadCredentials(): YouTubeCredentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `YouTube credentials not found at ${CREDENTIALS_PATH}.\n` +
        `Create it with: { "apiKey": "<Google Cloud API key with YouTube Data API v3 enabled>" }`
    );
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as YouTubeCredentials;
  if (!creds.apiKey) {
    throw new Error(`YouTube credentials at ${CREDENTIALS_PATH} are missing "apiKey".`);
  }
  return creds;
}

export async function searchVideos(query: string, maxResults = 5): Promise<YouTubeSearchResult[]> {
  const creds = loadCredentials();
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    key: creds.apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`YouTube search failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    items: Array<{
      id: { videoId: string };
      snippet: { title: string; channelTitle: string };
    }>;
  };

  return data.items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}
