import { describe, expect, it } from 'vitest';
import { renderTerminalMessage } from '../infobim/web/adapter/terminal-message';

describe('terminal message box', () => {
  it('renders the structured response as a framed message with labeled content', () => {
    const output = renderTerminalMessage({
      title: 'Project Refreshed', description: 'Refresh completed.', severity: null,
      content: { container_id: 'urn:uuid:123', visited_states: ['ready', 'done'] },
    }, 60);
    expect(output).toContain('[INFO] Project Refreshed');
    expect(output).toContain('Container Id');
    expect(output).toContain('• ready');
    expect(output).not.toContain('"content"');
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain.split('\r\n').every((line) => Array.from(line).length === 60)).toBe(true);
  });

  it('wraps long paths to fit a narrow terminal and marks failures', () => {
    const output = renderTerminalMessage({ title: 'Failed', description: '', content: { path: '/storage/' + 'x'.repeat(90) } }, 24, true);
    expect(output).toContain('[ERROR] Failed');
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain.split('\r\n').every((line) => Array.from(line).length === 24)).toBe(true);
  });

  it('keeps unstructured diagnostics readable', () => {
    expect(renderTerminalMessage('Traceback\nError', 80, true)).toBe('Traceback\nError');
    expect(renderTerminalMessage(null, 80)).toBe('');
  });
});
