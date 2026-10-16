import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { Facade } from '@/infobim/shared/adapter/facade-labels';
import type { EntityGroup, EntityItem } from '@/infobim/shared/domain/model/entity';

/**
 * Keeps the groups the database last showed, so a tab of one entity can read
 * it by its global id without going through the event bus. The project
 * listeners own the truth and publish it in `presentation.project.entities.found`;
 * this just caches it.
 */
export class EntityRepository {
  private static instance: EntityRepository | null = null;
  private groups: EntityGroup[] = [];
  private readonly facades = new Map<string, Facade>();
  private readonly unsubscribe: Array<() => void> = [];

  private constructor() {
    this.unsubscribe.push(
      eventBus.subscribe('presentation.project.entities.found', ({ payload }) => {
        this.groups = Array.isArray(payload?.groups) ? payload.groups : [];
      }),
    );
  }

  static getInstance(): EntityRepository {
    EntityRepository.instance ??= new EntityRepository();
    return EntityRepository.instance;
  }

  /** The entity with this global id, with its group, among the groups last shown. */
  find(id: string): { group: EntityGroup; item: EntityItem } | null {
    for (const group of this.groups) {
      const item = group.items.find((candidate) => candidate.id === id);
      if (item) return { group, item };
    }
    return null;
  }

  /** The group with this id (the dataset's path in the project), as last shown. */
  findGroup(id: string): EntityGroup | null {
    return this.groups.find((group) => group.id === id) ?? null;
  }

  /** The facade a listener found for the entities of the group, to draw the header of its table. */
  setFacade(group: string, facade: Facade): void {
    this.facades.set(group, facade);
  }

  facadeOf(group: string): Facade | null {
    return this.facades.get(group) ?? null;
  }

  dispose(): void {
    this.unsubscribe.forEach((dispose) => dispose());
    this.groups = [];
    this.facades.clear();
    EntityRepository.instance = null;
  }
}
