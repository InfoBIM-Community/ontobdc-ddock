import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDockComponentFactory } from '../infobim/shared/adapter/view';
import { SetUpEntityFacadeMachine } from '../infobim/web/plugin/machine/set_up_entity_facade/machine';
import { OnPanelEntityOpened } from '../infobim/web/plugin/listener/on-panel-entity-opened';
import { eventBus } from '../infobim/shared/adapter/event-bus';
import { EntityFacadeFoundCapability } from '../infobim/web/plugin/capability/transformation/entity_facade_found';
import { Etl } from '../infobim/shared/adapter/etl';
import { EntityRepository } from '../infobim/shared/adapter/entity-repository';

beforeEach(() => {
  EntityRepository.getInstance();
  eventBus.publish('presentation.project.entities.found', 'test', { groups: [{
    id: 'annotations', title: 'Annotations', entityTypes: ['Annotation'],
    items: ['one', 'urn:entity:one'].map((id) => ({ id, name: id, type: 'Annotation', fields: [] })),
  }] });
});
afterEach(() => {
  EntityRepository.getInstance().dispose();
  vi.unstubAllGlobals();
});

describe('entity facade lifecycle', () => {
  it('notifies only after Dockview init, once the element is connected', async () => {
    class Element { isConnected = false; }
    vi.stubGlobal('HTMLElement', Element);
    const element = new Element();
    const mounted = vi.fn();
    const factory = createDockComponentFactory({ entity: () => ({ element: element as unknown as HTMLElement, mounted }) });
    const panel = factory({ id: 'entity:one', name: 'entity' } as Parameters<typeof factory>[0]);
    panel.init!({} as never);
    expect(mounted).not.toHaveBeenCalled();
    element.isConnected = true;
    await Promise.resolve();
    expect(mounted).toHaveBeenCalledOnce();
  });

  it('does not notify when the panel is disposed before mounting', async () => {
    class Element { isConnected = true; }
    vi.stubGlobal('HTMLElement', Element);
    const mounted = vi.fn();
    const factory = createDockComponentFactory({ entity: () => ({ element: new Element() as unknown as HTMLElement, mounted }) });
    const panel = factory({ id: 'entity:one', name: 'entity' } as Parameters<typeof factory>[0]);
    panel.init!({} as never);
    panel.dispose!();
    await Promise.resolve();
    expect(mounted).not.toHaveBeenCalled();
  });

  it('runs facade setup through the listener with a rendered panel', async () => {
    const getElementById = vi.fn(() => ({
      isConnected: true, dataset: { state: 'ready' },
      querySelector: () => ({ disabled: true, querySelectorAll: () => [], append: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }),
      querySelectorAll: () => [{ id: 'entity-field:one:Name:value', dataset: {} }],
    }));
    vi.stubGlobal('document', { getElementById, documentElement: {} });
    const stop = eventBus.subscribe('presentation.main.command.requested', ({ payload }) => {
      if (!payload) return;
      eventBus.publish('presentation.main.code.success', 'test', { requestId: payload.requestId, result: {
        requestId: payload.requestId, success: true, code: 0, stdin: payload.command,
        stdout: { content: { identifier: 'facade:one', fields: [] } }, stderr: null,
      } });
    });
    try { await new OnPanelEntityOpened({
      type: 'presentation.main.panel.entity.opened', source: 'entity', timestamp: 0,
      payload: { id: 'one', panelId: 'entity-panel:one' },
    }).run(); } finally { stop(); }
    expect(getElementById).toHaveBeenCalledWith('entity-panel:one');
  });

  it('correlates command replies and stores the facade in the state ETL', async () => {
    const etl = new Etl();
    const stop = eventBus.subscribe('presentation.main.command.requested', ({ payload }) => {
      if (!payload) return;
      expect(payload.command).toBe('infobim context --entity "Annotation" --inspect');
      eventBus.publish('presentation.main.code.failure', 'test', { requestId: 'other', result: null, message: 'unrelated' });
      eventBus.publish('presentation.main.code.success', 'test', { requestId: payload.requestId, result: {
        requestId: payload.requestId, success: true, code: 0, stdin: payload.command,
        stdout: { content: { identifier: 'facade:one', fields: [] } }, stderr: null,
      } });
    });
    try {
      await new EntityFacadeFoundCapability().execute({ requestId: 'fsm', state: 'entity_facade_found', etl,
        parameters: { id: 'urn:entity:one', panelId: 'panel' } });
      expect(etl.read('set_up_entity_facade', 'fsm', 'entity_facade_found')?.result).toMatchObject({
        facade: { identifier: 'facade:one', fields: [] },
      });
    } finally { stop(); }
  });

  it('rejects a failed inspection without recording the state as done', async () => {
    const etl = new Etl();
    const stop = eventBus.subscribe('presentation.main.command.requested', ({ payload }) => {
      if (payload) eventBus.publish('presentation.main.code.failure', 'test', {
        requestId: payload.requestId, result: null, message: 'Facade not found',
      });
    });
    try {
      await expect(new EntityFacadeFoundCapability().execute({ requestId: 'fsm', state: 'entity_facade_found', etl,
        parameters: { id: 'one' } })).rejects.toThrow('Facade not found');
      expect(etl.read('set_up_entity_facade', 'fsm', 'entity_facade_found')).toBeUndefined();
    } finally { stop(); }
  });

  it('fails rather than completing setup when the panel is absent', async () => {
    vi.stubGlobal('document', { getElementById: () => null });
    await expect(new SetUpEntityFacadeMachine({ id: 'one', panelId: 'missing' }).execute()).rejects.toThrow('not mounted');
  });

  it('rejects entities without a known type before requesting a command', async () => {
    const requested = vi.fn();
    const stop = eventBus.subscribe('presentation.main.command.requested', requested);
    try {
      await expect(new EntityFacadeFoundCapability().execute({ requestId: 'fsm', state: 'entity_facade_found',
        etl: new Etl(), parameters: { id: 'unknown' } })).rejects.toThrow('no known type');
      expect(requested).not.toHaveBeenCalled();
    } finally { stop(); }
  });
});
