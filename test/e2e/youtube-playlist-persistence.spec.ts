/**
 * E2E tests for YouTube playlist position persistence feature.
 *
 * Because the YouTube IFrame API requires a real network connection and
 * real video content, these tests mock the YT global and the
 * onYouTubeIframeAPIReady callback so we can test the localStorage
 * persistence logic without needing a live YouTube connection.
 */
import { test, expect, Page } from '@playwright/test';

const PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workBL3Wr7TRf';
const ALT_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLDoPjvoNmBAx_X1PYGSoCDjOH9fFQVN_g';

/**
 * Inject a mock YouTube IFrame API into the page and immediately fire the
 * onYouTubeIframeAPIReady callback so the app thinks the API is loaded.
 *
 * The mock player exposes the same interface used by the app:
 *   - setSize, loadPlaylist, playVideoAt, seekTo
 *   - playVideo, pauseVideo, destroy
 *   - getCurrentTime, getPlaylistIndex
 *   - onReady / onStateChange events
 *
 * Controllable state is stored on window.__mockPlayer so tests can read or
 * mutate it directly.
 */
async function injectMockYouTubeAPI(page: Page, opts: {
  currentTime?: number;
  playlistIndex?: number;
} = {}): Promise<void> {
  await page.addInitScript(({ currentTime, playlistIndex }) => {
    // Block the real YouTube script from loading so our mock wins.
    const origCreateElement = document.createElement.bind(document);
    (document as any).createElement = (tag: string, ...args: any[]) => {
      const el = origCreateElement(tag, ...args);
      if (tag === 'script') {
        Object.defineProperty(el, 'src', {
          set(value: string) {
            if (value && value.includes('youtube.com/iframe_api')) {
              // swallow the real API load – we'll fire the callback ourselves
              return;
            }
            (el as any)._src = value;
          },
          get() {
            return (el as any)._src;
          },
        });
      }
      return el;
    };

    // Install mock player state on window so tests can inspect / mutate it
    (window as any).__mockPlayerState = {
      currentTime: currentTime ?? 0,
      playlistIndex: playlistIndex ?? 0,
      playerState: -1, // unstarted
      isDestroyed: false,
      calls: [] as string[],
    };

    function makeMockPlayer(elementOrId: any, config: any) {
      const state = (window as any).__mockPlayerState;

      const player = {
        setSize: (_w: any, _h: any) => { state.calls.push('setSize'); },
        loadPlaylist: (_opts: any) => { state.calls.push('loadPlaylist'); },
        playVideoAt: (index: number) => {
          state.calls.push(`playVideoAt:${index}`);
          state.playlistIndex = index;
          // Simulate the player firing a PLAYING state change so the app
          // can seek and then pause
          state.playerState = 1;
          if (config?.events?.onStateChange) {
            config.events.onStateChange({ data: 1, target: player });
          }
        },
        seekTo: (seconds: number, _allowSeekAhead: boolean) => {
          state.calls.push(`seekTo:${seconds}`);
          state.currentTime = seconds;
        },
        playVideo: () => {
          state.calls.push('playVideo');
          state.playerState = 1;
          if (config?.events?.onStateChange) {
            config.events.onStateChange({ data: 1, target: player });
          }
        },
        pauseVideo: () => {
          state.calls.push('pauseVideo');
          state.playerState = 2;
        },
        destroy: () => {
          state.calls.push('destroy');
          state.isDestroyed = true;
        },
        getCurrentTime: () => state.currentTime,
        getPlaylistIndex: () => state.playlistIndex,
      };

      (window as any).__mockPlayer = player;

      // Fire onReady asynchronously to mimic actual API behavior
      if (config?.events?.onReady) {
        setTimeout(() => config.events.onReady({ target: player }), 50);
      }

      return player;
    }

    // Install the mock YT global
    (window as any).YT = {
      Player: makeMockPlayer,
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
    };
  }, { currentTime: opts.currentTime ?? 0, playlistIndex: opts.playlistIndex ?? 0 });
}

/**
 * Navigate to the app and trigger the YouTube API ready callback so the app
 * sets up its player.
 */
async function gotoAndReadyAPI(page: Page): Promise<void> {
  await page.goto('/');
  // Fire the YouTube IFrame API ready callback that the app registered
  await page.evaluate(() => {
    if (typeof (window as any).onYouTubeIframeAPIReady === 'function') {
      (window as any).onYouTubeIframeAPIReady();
    }
  });
  // Give the app a moment to process the callback and (if a saved URL exists)
  // create the player + fire onReady
  await page.waitForTimeout(200);
}

/**
 * Load a playlist URL via the input field and submit.
 */
async function loadPlaylist(page: Page, url: string = PLAYLIST_URL): Promise<void> {
  await page.fill('#youtube-url-input', url);
  await page.click('#btn-load-playlist');
  // Wait for the mock player's onReady callback to fire
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('YouTube playlist position persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Always start with a clean localStorage
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 1 – Basic position save
  // -------------------------------------------------------------------------
  test('saves playlist index and position to localStorage during playback tracking interval', async ({ page }) => {
    await injectMockYouTubeAPI(page, { currentTime: 42, playlistIndex: 2 });
    await gotoAndReadyAPI(page);

    await loadPlaylist(page);

    // Start the work timer so the player would play (and tracking starts)
    await page.click('#btn-work');

    // Wait longer than the 5-second tracking interval
    await page.waitForTimeout(6000);

    const index = await page.evaluate(() => localStorage.getItem('youtube-playlist-index'));
    const position = await page.evaluate(() => localStorage.getItem('youtube-playlist-position'));

    expect(index).not.toBeNull();
    expect(position).not.toBeNull();
    expect(Number(index)).toBeGreaterThanOrEqual(0);
    expect(Number(position)).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 1b – Position saved on beforeunload
  // -------------------------------------------------------------------------
  test('saves playlist index and position to localStorage on beforeunload', async ({ page }) => {
    await injectMockYouTubeAPI(page, { currentTime: 123.5, playlistIndex: 1 });
    await gotoAndReadyAPI(page);

    await loadPlaylist(page);

    // Trigger beforeunload by navigating away (without actually leaving)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    const index = await page.evaluate(() => localStorage.getItem('youtube-playlist-index'));
    const position = await page.evaluate(() => localStorage.getItem('youtube-playlist-position'));

    expect(index).toBe('1');
    expect(position).toBe('123.5');
  });

  // -------------------------------------------------------------------------
  // Scenario 2 – Position restore on reload
  // -------------------------------------------------------------------------
  test('restores saved video index and seek position after page reload', async ({ page }) => {
    // Pre-seed localStorage with a saved position
    await page.addInitScript(() => {
      localStorage.setItem('youtube-playlist-url', 'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workBL3Wr7TRf');
      localStorage.setItem('youtube-playlist-index', '3');
      localStorage.setItem('youtube-playlist-position', '75.5');
    });

    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // The app should have loaded the saved URL and called playVideoAt with index 3
    const calls: string[] = await page.evaluate(() => (window as any).__mockPlayerState?.calls ?? []);

    expect(calls).toContain('playVideoAt:3');
    expect(calls).toContain('seekTo:75.5');
  });

  // -------------------------------------------------------------------------
  // Scenario 2b – Player paused after restore (timer is idle)
  // -------------------------------------------------------------------------
  test('player is paused after restore when timer is idle', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('youtube-playlist-url', 'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workBL3Wr7TRf');
      localStorage.setItem('youtube-playlist-index', '0');
      localStorage.setItem('youtube-playlist-position', '10');
    });

    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // After restore the app should pause the video (timer is not running)
    const playerState: number = await page.evaluate(() => (window as any).__mockPlayerState?.playerState ?? -1);

    // State 2 = PAUSED. The app calls pauseVideo after seekTo.
    expect(playerState).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Scenario 3 – New URL clears saved state
  // -------------------------------------------------------------------------
  test('loading a new playlist URL clears saved index and position', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('youtube-playlist-index', '5');
      localStorage.setItem('youtube-playlist-position', '200');
    });

    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // User types a new URL and submits (user-initiated, no url argument)
    await loadPlaylist(page, ALT_PLAYLIST_URL);

    const index = await page.evaluate(() => localStorage.getItem('youtube-playlist-index'));
    const position = await page.evaluate(() => localStorage.getItem('youtube-playlist-position'));

    expect(index).toBeNull();
    expect(position).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Scenario 4 – Clear playlist removes state
  // -------------------------------------------------------------------------
  test('clicking the close button removes index and position from localStorage', async ({ page }) => {
    await injectMockYouTubeAPI(page, { currentTime: 50, playlistIndex: 2 });
    await gotoAndReadyAPI(page);

    await loadPlaylist(page);

    // Confirm keys are set after loading (beforeunload saves them)
    await page.evaluate(() => {
      localStorage.setItem('youtube-playlist-index', '2');
      localStorage.setItem('youtube-playlist-position', '50');
    });

    // The button icon should now be "close" – click it
    const btn = page.locator('#btn-load-playlist');
    await expect(btn.locator('.material-icons')).toHaveText('close');
    await btn.click();

    const index = await page.evaluate(() => localStorage.getItem('youtube-playlist-index'));
    const position = await page.evaluate(() => localStorage.getItem('youtube-playlist-position'));

    expect(index).toBeNull();
    expect(position).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Scenario 5 – Timer controls playback after restore
  // -------------------------------------------------------------------------
  test('video starts playing when work timer is started after position restore', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('youtube-playlist-url', 'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workBL3Wr7TRf');
      localStorage.setItem('youtube-playlist-index', '1');
      localStorage.setItem('youtube-playlist-position', '30');
    });

    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // Confirm the player started paused
    const stateAfterRestore: number = await page.evaluate(() => (window as any).__mockPlayerState?.playerState ?? -1);
    expect(stateAfterRestore).toBe(2); // PAUSED

    // Clear calls log to make assertions about what happens next
    await page.evaluate(() => { (window as any).__mockPlayerState.calls = []; });

    // Start the work timer
    await page.click('#btn-work');
    await page.waitForTimeout(100);

    const callsAfterStart: string[] = await page.evaluate(() => (window as any).__mockPlayerState?.calls ?? []);
    expect(callsAfterStart).toContain('playVideo');
  });

  // -------------------------------------------------------------------------
  // Scenario 5b – Video plays when work timer starts after restore
  // -------------------------------------------------------------------------
  test('video plays when work timer starts after restore from localStorage', async ({ page }) => {
    // Pre-seed localStorage with a saved position
    await page.addInitScript(() => {
      localStorage.setItem('youtube-playlist-url', 'https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workBL3Wr7TRf');
      localStorage.setItem('youtube-playlist-index', '0'); // Start with the first video
      localStorage.setItem('youtube-playlist-position', '10'); // Seek to 10 seconds
    });

    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // The app should have loaded the saved URL and called playVideoAt for index 0
    const callsAfterRestore: string[] = await page.evaluate(() => (window as any).__mockPlayerState?.calls ?? []);
    expect(callsAfterRestore).toContain('playVideoAt:0');
    expect(callsAfterRestore).toContain('seekTo:10'); // The seekTo might be called by the player API or by our logic

    // Clear calls log to focus on what happens after timer start
    await page.evaluate(() => { (window as any).__mockPlayerState.calls = []; });

    // Start the work timer
    await page.click('#btn-work');
    await page.waitForTimeout(100); // Give it a moment to process

    const callsAfterTimerStart: string[] = await page.evaluate(() => (window as any).__mockPlayerState?.calls ?? []);
    expect(callsAfterTimerStart).toContain('playVideo'); // This is the crucial check: playVideo should be called
  });

  // -------------------------------------------------------------------------
  // Extra – Player container becomes visible after loading a playlist
  // -------------------------------------------------------------------------
  test('player container is visible after loading a playlist URL', async ({ page }) => {
    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    // Before loading, container should be hidden
    await expect(page.locator('#youtube-player-container')).toHaveClass(/hidden/);

    await loadPlaylist(page);

    await expect(page.locator('#youtube-player-container')).not.toHaveClass(/hidden/);
  });

  // -------------------------------------------------------------------------
  // Extra – Playlist URL persisted in localStorage
  // -------------------------------------------------------------------------
  test('playlist URL is saved to localStorage when loaded', async ({ page }) => {
    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    await loadPlaylist(page, PLAYLIST_URL);

    const saved = await page.evaluate(() => localStorage.getItem('youtube-playlist-url'));
    expect(saved).toBe(PLAYLIST_URL);
  });

  // -------------------------------------------------------------------------
  // Extra – Playlist URL removed from localStorage on clear
  // -------------------------------------------------------------------------
  test('playlist URL removed from localStorage when playlist is cleared', async ({ page }) => {
    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    await loadPlaylist(page);

    const btn = page.locator('#btn-load-playlist');
    await expect(btn.locator('.material-icons')).toHaveText('close');
    await btn.click();

    const saved = await page.evaluate(() => localStorage.getItem('youtube-playlist-url'));
    expect(saved).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Extra – Invalid URL shows alert and does not save to localStorage
  // -------------------------------------------------------------------------
  test('invalid playlist URL shows alert and does not save state', async ({ page }) => {
    await injectMockYouTubeAPI(page);
    await gotoAndReadyAPI(page);

    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.fill('#youtube-url-input', 'not-a-valid-url');
    await page.click('#btn-load-playlist');

    await page.waitForTimeout(200);

    expect(alertFired).toBe(true);

    const saved = await page.evaluate(() => localStorage.getItem('youtube-playlist-url'));
    expect(saved).toBeNull();
  });
});
