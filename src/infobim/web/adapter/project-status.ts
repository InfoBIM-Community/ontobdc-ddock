import { eventBus } from '@/infobim/shared/adapter/event-bus';
import { translate } from '@/infobim/shared/plugin/i18n';
import type { ProjectOpened } from '@/infobim/shared/domain/model/project';

/** Presentation listens to project state; it never calls the filesystem adapter. */
export function initProjectStatus(): () => void {
  let project: ProjectOpened | null = null;
  let availability: 'LOCAL' | 'REMOTE' | null = null;
  const render = (): void => {
    const name = document.querySelector<HTMLElement>('.project');
    if (name) {
      if (project) {
        delete name.dataset.i18n;
        name.textContent = project.name;
      } else {
        name.dataset.i18n = 'titlebar.noProject';
        name.textContent = translate('titlebar.noProject');
      }
    }
    const permission = document.querySelector<HTMLElement>('.statusbar-permission');
    const availabilityLabel = document.querySelector<HTMLElement>('.statusbar-project-availability');
    if (availabilityLabel) availabilityLabel.textContent = project ? availability ?? '' : '';
    const label = permission?.querySelector<HTMLElement>('.statusbar-permission-label');
    if (permission && label) {
      permission.dataset.state = !project ? 'disconnected' : project.access === 'readwrite' ? 'connected' : 'read-only';
      const key = !project ? 'statusbar.permission.disconnected' : project.access === 'readwrite' ? 'statusbar.permission.connected' : 'statusbar.permission.readOnly';
      label.dataset.i18n = key;
      label.textContent = translate(key);
    }
  };
  const unsubscribe = [
    eventBus.subscribe('presentation.project.local.opened', ({ payload }) => { project = payload ?? null; availability = 'LOCAL'; render(); }),
    eventBus.subscribe('presentation.project.remote.opened', ({ payload }) => { project = payload ?? null; availability = 'REMOTE'; render(); }),
    eventBus.subscribe('presentation.project.state.reported', ({ payload }) => { project = payload?.project ?? null; render(); }),
    eventBus.subscribe('presentation.main.layout.loaded', () => {
      eventBus.publish('presentation.project.state.requested', 'project-status');
    }),
    eventBus.subscribe('presentation.main.locale.changed', render),
  ];
  return () => unsubscribe.forEach((dispose) => dispose());
}
