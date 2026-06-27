import { type Page } from 'playwright';

export const APP_BASE_URL = 'http://localhost:5173';

export type AppLocatorTarget =
  | { kind: 'role'; role: string; name?: string }
  | { kind: 'label'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'testid'; text: string };

type BrowserCommandContext = {
  context: {
    newPage(): Promise<Page>;
  };
  sessionId: string;
};

const appPages = new Map<string, Page>();

function getAppLocator(page: Page, target: AppLocatorTarget) {
  switch (target.kind) {
    case 'role':
      return page.getByRole(target.role as never, target.name ? { name: target.name } : undefined);
    case 'label':
      return page.getByLabel(target.text);
    case 'text':
      return page.getByText(target.text);
    case 'testid':
      return page.getByTestId(target.text);
  }
}

function getAppPage(sessionId: string): Page {
  const page = appPages.get(sessionId);
  if (!page) {
    throw new Error(`App page has not been opened for session ${sessionId}`);
  }
  return page;
}

export const browserCommands = {
  openAppPage: async ({ context, sessionId }: BrowserCommandContext) => {
    const existing = appPages.get(sessionId);
    if (existing && !existing.isClosed()) {
      await existing.close();
    }

    const page = await context.newPage();
    appPages.set(sessionId, page);
    await page.goto(APP_BASE_URL);
    await page.waitForLoadState('domcontentloaded');
  },
  closeAppPage: async ({ sessionId }: BrowserCommandContext) => {
    const page = appPages.get(sessionId);
    if (page) {
      await page.close();
      appPages.delete(sessionId);
    }
  },
  clearAppStorage: async ({ context }: BrowserCommandContext) => {
    const tempPage = await context.newPage();
    try {
      await tempPage.goto(APP_BASE_URL);
      await tempPage.evaluate(() => {
        localStorage.clear();
      });
    } finally {
      await tempPage.close();
    }
  },
  appClick: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    await getAppLocator(getAppPage(sessionId), target).click();
  },
  appFill: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget, value: string) => {
    await getAppLocator(getAppPage(sessionId), target).fill(value);
  },
  appText: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return (await getAppLocator(getAppPage(sessionId), target).textContent()) ?? '';
  },
  appVisible: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return getAppLocator(getAppPage(sessionId), target).isVisible();
  },
  appChecked: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return getAppLocator(getAppPage(sessionId), target).isChecked();
  },
  appDisabled: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return getAppLocator(getAppPage(sessionId), target).isDisabled();
  },
  appValue: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return getAppLocator(getAppPage(sessionId), target).inputValue();
  },
  appAttribute: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget, name: string) => {
    return getAppLocator(getAppPage(sessionId), target).getAttribute(name);
  },
  appClassName: async ({ sessionId }: BrowserCommandContext, target: AppLocatorTarget) => {
    return getAppLocator(getAppPage(sessionId), target).getAttribute('class');
  },
};
