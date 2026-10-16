import type { IfcViewPort } from '@/infobim/shared/domain/model/ifc-view';

/**
 * Knows the 3D view of each IFC tab, by the path of its file, so a machine can
 * reach the view without importing the panel that drew it.
 */
export class IfcViewRepository {
  private static instance: IfcViewRepository | null = null;
  private readonly views = new Map<string, IfcViewPort>();

  static getInstance(): IfcViewRepository {
    IfcViewRepository.instance ??= new IfcViewRepository();
    return IfcViewRepository.instance;
  }

  /** Registers the view of an item; the result forgets it. */
  register(item: string, view: IfcViewPort): () => void {
    this.views.set(item, view);
    return () => {
      if (this.views.get(item) === view) this.views.delete(item);
    };
  }

  get(item: string): IfcViewPort | undefined {
    return this.views.get(item);
  }
}
