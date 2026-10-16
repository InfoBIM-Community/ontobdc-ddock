import { eventBus } from '@/infobim/shared/adapter/event-bus';

type SplitterConfig = {
  panel: string;
  cssVariable: string;
  dimension: 'width' | 'height';
  minValue: number;
  maxValuePercent: number;
};

const splitterConfigs: Record<string, SplitterConfig> = {
  explorer: {
    panel: 'explorer',
    cssVariable: '--explorer-width',
    dimension: 'width',
    minValue: 140,
    maxValuePercent: 0.4,
  },
  llm: {
    panel: 'llm',
    cssVariable: '--llm-width',
    dimension: 'width',
    minValue: 180,
    maxValuePercent: 0.4,
  },
  terminal: {
    panel: 'terminal',
    cssVariable: '--terminal-height',
    dimension: 'height',
    minValue: 80,
    maxValuePercent: 0.6,
  },
};

function setupSplitter(splitter: HTMLElement): void {
  const panelName = splitter.dataset.panel;
  if (!panelName) return;
  const config = splitterConfigs[panelName];
  if (!config) return;

  let isDragging = false;
  let startPointer = 0;
  let startValue = 0;
  let previousValue = 0;
  let rafId: number | null = null;
  let pendingValue: number | null = null;

  const workspace = splitter.parentElement;
  if (!workspace) return;

  const readCurrentValue = (): number => {
    const style = getComputedStyle(document.documentElement);
    return parseFloat(style.getPropertyValue(config.cssVariable)) || 0;
  };

  const applyValue = (rawValue: number): number => {
    const containerSize = config.dimension === 'width'
      ? workspace.clientWidth
      : workspace.clientHeight;
    const maxValue = containerSize * config.maxValuePercent;
    const clamped = Math.max(config.minValue, Math.min(rawValue, maxValue));
    document.documentElement.style.setProperty(config.cssVariable, `${clamped}px`);
    return clamped;
  };

  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = config.dimension === 'width' ? 'col-resize' : 'row-resize';

    startPointer = config.dimension === 'width' ? e.clientX : e.clientY;
    startValue = readCurrentValue();
    previousValue = startValue;

    eventBus.publish('presentation.main.panel.resize.started', 'splitter', {
      panel: config.panel,
      dimension: config.dimension,
      value: startValue,
      previousValue: startValue,
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (!isDragging) return;
    const delta = config.dimension === 'width'
      ? (config.panel === 'llm' ? startPointer - e.clientX : e.clientX - startPointer)
      : (startPointer - e.clientY);
    const newValue = startValue + delta;

    if (rafId !== null) {
      pendingValue = newValue;
      return;
    }

    pendingValue = newValue;
    rafId = requestAnimationFrame(flushPending);
  };

  const flushPending = (): void => {
    rafId = null;
    if (pendingValue === null) return;
    const raw = pendingValue;
    pendingValue = null;
    const applied = applyValue(raw);
    if (applied !== previousValue) {
      const prev = previousValue;
      previousValue = applied;
      eventBus.publish('presentation.main.panel.resize.changed', 'splitter', {
        panel: config.panel,
        dimension: config.dimension,
        value: applied,
        previousValue: prev,
      });
    }
  };

  const onMouseUp = (): void => {
    if (!isDragging) return;
    isDragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      if (pendingValue !== null) {
        const applied = applyValue(pendingValue);
        if (applied !== previousValue) {
          const prev = previousValue;
          previousValue = applied;
          eventBus.publish('presentation.main.panel.resize.changed', 'splitter', {
            panel: config.panel,
            dimension: config.dimension,
            value: applied,
            previousValue: prev,
          });
        }
        pendingValue = null;
      }
    }

    const finalValue = readCurrentValue();
    eventBus.publish('presentation.main.panel.resize.ended', 'splitter', {
      panel: config.panel,
      dimension: config.dimension,
      value: finalValue,
      previousValue: startValue,
    });
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const step = e.shiftKey ? 20 : 5;
    let delta = 0;
    if (config.dimension === 'width') {
      if (e.key === 'ArrowLeft') delta = config.panel === 'llm' ? step : -step;
      else if (e.key === 'ArrowRight') delta = config.panel === 'llm' ? -step : step;
      else return;
    } else {
      if (e.key === 'ArrowUp') delta = step;
      else if (e.key === 'ArrowDown') delta = -step;
      else return;
    }
    e.preventDefault();
    const current = readCurrentValue();
    const before = current;
    const applied = applyValue(current + delta);
    if (applied !== before) {
      eventBus.publish('presentation.main.panel.resize.started', 'splitter', {
        panel: config.panel,
        dimension: config.dimension,
        value: before,
        previousValue: before,
      });
      eventBus.publish('presentation.main.panel.resize.changed', 'splitter', {
        panel: config.panel,
        dimension: config.dimension,
        value: applied,
        previousValue: before,
      });
      eventBus.publish('presentation.main.panel.resize.ended', 'splitter', {
        panel: config.panel,
        dimension: config.dimension,
        value: applied,
        previousValue: before,
      });
    }
  };

  splitter.addEventListener('mousedown', onMouseDown);
  splitter.addEventListener('keydown', onKeyDown);
}

/** Wires every `.splitter` under `root` to resize its panel (mouse and keyboard). */
export function setupSplitters(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.splitter').forEach((splitter) => setupSplitter(splitter));
}
