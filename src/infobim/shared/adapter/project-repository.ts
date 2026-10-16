import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { ProjectOpened } from '@/infobim/shared/domain/model/project';

/**
 * Keeps the currently opened project in memory so capabilities and adapters
 * can read it synchronously without going through the event bus. The project
 * adapter still owns the truth and publishes it on open; this just caches it.
 */
export class ProjectRepository {
  private static instance: ProjectRepository | null = null;
  private current: ProjectOpened | null = null;
  private readonly unsubscribe: Array<() => void> = [];

  private constructor() {
    this.unsubscribe.push(
      eventBus.subscribe('presentation.project.local.opened', ({ payload }) => {
        this.current = payload ?? null;
      }),
      eventBus.subscribe('presentation.project.remote.opened', ({ payload }) => {
        this.current = payload ?? null;
      }),
      eventBus.subscribe('presentation.project.state.reported', ({ payload }) => {
        this.current = payload?.project ?? null;
      }),
    );
  }

  static getInstance(): ProjectRepository {
    if (!ProjectRepository.instance) ProjectRepository.instance = new ProjectRepository();
    return ProjectRepository.instance;
  }

  get(): ProjectOpened | null {
    return this.current;
  }

  dispose(): void {
    this.unsubscribe.forEach((dispose) => dispose());
    this.current = null;
    ProjectRepository.instance = null;
  }
}
