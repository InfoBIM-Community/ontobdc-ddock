export type EntityField = { name: string; labels: Record<string, string>; editable: boolean; values: string[] };

/** One entity of a dataset, as `infobim project --entity` tells it: its fields are whatever its data source holds. */
export type EntityItem = { id: string; name: string; type: string; fields: EntityField[] };

/**
 * One group of the database panel: a dataset of the project's container, with
 * the entities its data sources hold. `id` is the dataset's path in the
 * project, `title` its name, `entityTypes` the entity types it declares.
 */
export type EntityGroup = { id: string; title: string; entityTypes: string[]; items: EntityItem[] };
