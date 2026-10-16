import { Terminal as XTerm, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { Mountable } from '@/infobim/shared/adapter/view';
import type { CommandExecutionResult } from '@/infobim/shared/domain/model/command-execution';
import { translate } from '@/infobim/shared/plugin/i18n';
import { renderTerminalMessage } from '@/infobim/web/adapter/terminal-message';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';

const PROMPT = '>_ ';
const RED = '\x1b[31m';
const DIM = '\x1b[90m';
const RESET = '\x1b[0m';

const DARK_THEME: ITheme = {
  background: '#111111',
  foreground: '#e6e6e6',
  cursor: '#e6e6e6',
  cursorAccent: '#111111',
  selectionBackground: '#264f78',
  black: '#1e1e1e',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
};

const LIGHT_THEME: ITheme = {
  background: '#ffffff',
  foreground: '#171717',
  cursor: '#171717',
  cursorAccent: '#ffffff',
  selectionBackground: '#d9eafa',
  black: '#333333',
  red: '#c62828',
  green: '#238636',
  yellow: '#b08800',
  blue: '#005a9c',
  magenta: '#9c27b0',
  cyan: '#006d94',
  white: '#525252',
  brightBlack: '#777777',
  brightRed: '#c62828',
  brightGreen: '#238636',
  brightYellow: '#b08800',
  brightBlue: '#005a9c',
  brightMagenta: '#9c27b0',
  brightCyan: '#006d94',
  brightWhite: '#171717',
};

// The plugin keeps listening after Dockview disposes the mounted panel.
let reopenScheduled = false;
let pluginDisposed = false;
const unsubscribeReopening = eventBus.subscribe('presentation.main.panel.closed', ({ payload }) => {
  if (payload?.id !== 'terminal' || reopenScheduled) return;
  reopenScheduled = true;
  // Reopen after Dockview finishes removing the old tab.
  queueMicrotask(() => {
    reopenScheduled = false;
    if (pluginDisposed) return;
    eventBus.publish('presentation.main.panel.open.requested', 'terminal', {
      container: 'bottom',
      id: 'terminal',
      component: 'terminal',
      title: translate('terminal.tab'),
    });
  });
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  pluginDisposed = true;
  unsubscribeReopening();
});

/**
 * The terminal tab. It only shows: the command when it is requested and its
 * result when the run ends, matched by requestId. It runs nothing, starts no
 * machine and publishes no events; typing is off.
 */
export default function makeTerminal(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content xterm-panel';

  const host = document.createElement('div');
  host.className = 'xterm-host';
  root.appendChild(host);

  const term = new XTerm({
    fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.3,
    cursorBlink: false,
    disableStdin: true,
    convertEol: true,
    scrollback: 2000,
    theme: getTheme() === 'light' ? LIGHT_THEME : DARK_THEME,
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const writeLines = (text: string, color = ''): void => {
    if (!text) return;
    term.writeln(color ? `${color}${text}${RESET}` : text);
  };
  const showResult = (result: CommandExecutionResult): void => {
    writeLines(renderTerminalMessage(result.stdout, term.cols, !result.success));
    writeLines(renderTerminalMessage(result.stderr, term.cols, true), RED);
  };

  const unsubscribe = [
    eventBus.subscribe('presentation.main.command.requested', ({ payload }) => {
      if (payload) {
        term.writeln('');
        term.writeln(`${PROMPT}${payload.command}`);
      }
    }),
    eventBus.subscribe('presentation.main.code.success', ({ payload }) => {
      if (payload) showResult(payload.result);
    }),
    eventBus.subscribe('presentation.main.code.failure', ({ payload }) => {
      if (!payload) return;
      if (payload.result) showResult(payload.result);
      writeLines(translate('terminal.failure', { message: payload.message }), RED);
    }),
    eventBus.subscribe('presentation.main.command.invalid', ({ payload }) => {
      if (payload) writeLines(translate('terminal.invalid', { reason: payload.reason }), RED);
    }),
    onThemeChange((theme) => {
      term.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    }),
  ];

  let resizeObserver: ResizeObserver | null = null;
  let disposed = false;

  queueMicrotask(() => {
    if (disposed) return;
    term.open(host);
    try { fitAddon.fit(); } catch { /* the host has no size yet */ }
    resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* the host has no size */ }
    });
    resizeObserver.observe(host);

    writeLines(`${PROMPT}${translate('terminal.banner.1')}`);
    writeLines(`${DIM}${translate('terminal.banner.2')}${RESET}`);
    writeLines(`${DIM}${translate('terminal.banner.3')}${RESET}`);
  });

  return {
    element: root,
    dispose: () => {
      disposed = true;
      unsubscribe.forEach((stop) => stop());
      resizeObserver?.disconnect();
      term.dispose();
      root.remove();
    },
  };
}
