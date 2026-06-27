import { commands } from 'vitest/browser';

import { APP_BASE_URL, type AppLocatorTarget, type DragPointerType } from './browserCommands';

export type AppTarget = AppLocatorTarget;

export function byRole(role: string, name?: string): AppTarget {
  return { kind: 'role', role, name };
}

export function byLabel(text: string): AppTarget {
  return { kind: 'label', text };
}

export function byText(text: string): AppTarget {
  return { kind: 'text', text };
}

export function byTestId(text: string): AppTarget {
  return { kind: 'testid', text };
}

export class AppLocator {
  constructor(private readonly target: AppTarget) {}

  click(): Promise<void> {
    return commands.appClick(this.target);
  }

  fill(value: string): Promise<void> {
    return commands.appFill(this.target, value);
  }

  text(): Promise<string> {
    return commands.appText(this.target);
  }

  visible(): Promise<boolean> {
    return commands.appVisible(this.target);
  }

  checked(): Promise<boolean> {
    return commands.appChecked(this.target);
  }

  disabled(): Promise<boolean> {
    return commands.appDisabled(this.target);
  }

  value(): Promise<string> {
    return commands.appValue(this.target);
  }

  attribute(name: string): Promise<string | null> {
    return commands.appAttribute(this.target, name);
  }

  className(): Promise<string | null> {
    return commands.appClassName(this.target);
  }
}

export class AppHarness {
  async dragPointer(source: AppTarget, destination: AppTarget, options?: { pointerType?: DragPointerType; dropPosition?: 'center' | 'bottom' }): Promise<void> {
    await commands.appDragPointer(source, destination, options?.pointerType ?? 'mouse', options?.dropPosition ?? 'center');
  }

  async reload(): Promise<void> {
    await commands.reloadAppPage();
  }

  getByRole(role: string, options?: { name?: string }): AppLocator {
    return new AppLocator(byRole(role, options?.name));
  }

  getByLabelText(text: string): AppLocator {
    return new AppLocator(byLabel(text));
  }

  getByText(text: string): AppLocator {
    return new AppLocator(byText(text));
  }

  getByTestId(text: string): AppLocator {
    return new AppLocator(byTestId(text));
  }
}

export async function waitForApp(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      await fetch(APP_BASE_URL, { mode: 'no-cors', cache: 'no-store' });
      return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error(`Timed out waiting for ${APP_BASE_URL}`);
}

export async function clearAppStorage(): Promise<void> {
  await commands.clearAppStorage();
}

export async function closeApp(): Promise<void> {
  await commands.closeAppPage();
}

export async function mountApp(): Promise<AppHarness> {
  await commands.openAppPage();
  return new AppHarness();
}

export async function setupApp(): Promise<AppHarness> {
  await waitForApp();
  await clearAppStorage();
  await closeApp();
  return mountApp();
}
