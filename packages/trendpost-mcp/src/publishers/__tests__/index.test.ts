jest.mock('../twitter', () => ({
  postToTwitter: jest.fn().mockResolvedValue({ platformPostId: 'tw-1' }),
}));
jest.mock('../linkedin', () => ({
  postToLinkedin: jest.fn().mockResolvedValue({ platformPostId: 'li-1' }),
}));
jest.mock('../meta', () => ({
  postToFacebook: jest.fn().mockResolvedValue({ platformPostId: 'fb-1' }),
  postToInstagram: jest.fn().mockResolvedValue({ platformPostId: 'ig-1' }),
}));

import { publishToPlatform } from '../index';
import { postToTwitter } from '../twitter';
import { postToLinkedin } from '../linkedin';
import { postToFacebook, postToInstagram } from '../meta';

describe('publishToPlatform()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches twitter to postToTwitter only', async () => {
    const result = await publishToPlatform('twitter', 'hi');
    expect(postToTwitter).toHaveBeenCalledWith('hi');
    expect(postToLinkedin).not.toHaveBeenCalled();
    expect(postToFacebook).not.toHaveBeenCalled();
    expect(postToInstagram).not.toHaveBeenCalled();
    expect(result).toEqual({ platformPostId: 'tw-1' });
  });

  it('dispatches linkedin to postToLinkedin only', async () => {
    await publishToPlatform('linkedin', 'hi');
    expect(postToLinkedin).toHaveBeenCalledWith('hi');
    expect(postToTwitter).not.toHaveBeenCalled();
  });

  it('dispatches facebook to postToFacebook only', async () => {
    await publishToPlatform('facebook', 'hi');
    expect(postToFacebook).toHaveBeenCalledWith('hi');
    expect(postToInstagram).not.toHaveBeenCalled();
  });

  it('dispatches instagram to postToInstagram only', async () => {
    await publishToPlatform('instagram', 'hi');
    expect(postToInstagram).toHaveBeenCalledWith('hi');
    expect(postToFacebook).not.toHaveBeenCalled();
  });

  it('throws for threads, which has no publisher', async () => {
    await expect(publishToPlatform('threads', 'hi')).rejects.toThrow(
      /Unsupported platform.*threads/
    );
  });
});
