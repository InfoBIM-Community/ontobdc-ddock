import type {
  PythonCommandRequest,
  PythonCommandResult,
  PythonFeatureMessageRequest,
  PythonPackageVersionsRequest,
  PythonPackageVersionsResult,
  PythonFeatureMessageResult,
} from '@/infobim/shared/domain/model/python-command';
import type { CommandExecutionResult } from '@/infobim/shared/domain/model/command-execution';
import type { EntityGroup } from '@/infobim/shared/domain/model/entity';
import type { IfcElementInfo } from '@/infobim/shared/domain/model/ifc-mesh';
import type { ProjectOpened } from '@/infobim/shared/domain/model/project';

/**
 * 
 */
import type { ExplorerNode } from '@/infobim/shared/domain/model/explorer-node';
import type { PanelClosedPayload, PanelResizePayload } from '@/infobim/shared/domain/model/panel-event';

/**
 * Event names and the data each event carries.
 * These declarations only help TypeScript check the code. They do not store,
 * publish, or subscribe to events, and they do not validate data at runtime.
 */

/** The three explorer groups that can publish or receive explorer events. */
export type ExplorerGroupId = 'files' | 'models' | 'drawings';


/**
 * 
 */
export type ExplorerMenuAction = { group: ExplorerGroupId; action: string; item: string };

/** How the name of an explorer item event calls the items of each group. */
type ExplorerItemKind = { files: 'file'; models: 'model'; drawings: 'drawing' };

/**
 * Defines the same three kinds of events for each explorer group.
 * Each block loops over the group names using G, then builds an event name.
 * The & symbols combine all three blocks into one event contract.
 */
/** Groups populated through the generic `presentation.project.<group>.found` event; FILES has its own name instead. */
type GenericPopulateGroupId = Exclude<ExplorerGroupId, 'files'>;

type ExplorerEvents = {
  /**
   * Creates presentation.project.models.found and presentation.project.drawings.found. Each
   * carries the nodes used to fill its group. FILES uses
   * presentation.project.files.found instead, declared below.
   */
  [G in GenericPopulateGroupId as `presentation.project.${G}.found`]: { nodes: ExplorerNode[] };
} & {
  /**
   * Creates presentation.explorer.file.activated, .model.activated and
   * .drawing.activated. A file was double-clicked; item contains its path in
   * the project.
   */
  [G in ExplorerGroupId as `presentation.explorer.${ExplorerItemKind[G]}.activated`]: { item: string };
} & {
  /** An entry of the menu of an item of any group was chosen. */
  'presentation.explorer.activated': ExplorerMenuAction;
  /** The user opened a group (FILES, MODELS or DRAWINGS) of the explorer. */
  'presentation.explorer.group.activated': { group: ExplorerGroupId };
  /** The user chose to upload files; path is where they go, in the project: a directory, or "" for the root of the container. */
  'presentation.explorer.file.upload.requested': { path: string };
  /** The user picked files on their computer to upload to path (as in the request); nothing was sent yet. */
  'presentation.explorer.file.upload.selected': { path: string; files: File[] };
  /** The picked files were written into path of the project; skipped are the names that already existed there and were left as they were. */
  'presentation.explorer.file.uploaded': { path: string; files: string[]; skipped: string[] };
  /** The picked files could not be written into path of the project. */
  'presentation.explorer.file.upload.failed': { path: string; message: string };
  /** The FILES group's tree was (re)found; replaces its nodes. */
  'presentation.project.files.found': { nodes: ExplorerNode[] };
};

/**
 * Combines explorer events with panel resize and theme change events.
 * Each property is an allowed event name; its value is the required data type.
 * For example, AppEventMap['presentation.project.files.found'] is { nodes: ExplorerNode[] }.
 * Despite its name, this is a type declaration, not a Map object or repository.
 */
export type AppEventMap = ExplorerEvents & {
  /** The shell HTML and header controls are mounted; Dockview panels may not be ready yet. */
  'presentation.main.layout.loaded': undefined;

  /** The active translation locale changed. */
  'presentation.main.locale.changed': { locale: string };

  /** Home requests a project operation; project adapters handle the request. */
  'presentation.project.open.requested': undefined;
  'presentation.project.new.requested': { name: string };
  /** Home asks to connect to a project hosted at a URL. */
  'presentation.project.connect.requested': { url: string; apiToken?: string };
  /** Project adapters report operation progress and results to panels. */
  'presentation.project.create.started': { name: string };
  'presentation.project.create.failed': {
    reason: 'unsupported' | 'permission-denied' | 'init-failed' | 'create-failed';
    message?: string;
  };
  'presentation.project.inspect.started': { name: string };
  /** A project on local disk was opened or created. */
  'presentation.project.local.opened': ProjectOpened;
  /** A project hosted at a remote URL was opened. */
  'presentation.project.remote.opened': ProjectOpened;
  'presentation.project.create.cancelled': undefined;
  'presentation.project.open.cancelled': undefined;
  /** Request and report the last successfully opened project without a getter. */
  'presentation.project.state.requested': undefined;
  'presentation.project.state.reported': { project: ProjectOpened | null };
  'presentation.project.open.failed': {
    reason: 'unsupported' | 'permission-denied' | 'crate-not-found' | 'crate-invalid'
      | 'location-not-found' | 'inspect-failed' | 'read-error';
    name: string | null;
    message?: string;
  };

  /** Something failed but the application keeps running; the message says what. */
  'presentation.exception.listener.raised': { message: string };

  /** The Python worker is loading the runtime and its local packages. */
  'presentation.python.loading': undefined;
  /** Runtime and packages are ready; includes the installed InfoBIM version. */
  'presentation.python.ready': { infobimVersion: string };
  /** Python initialization failed; ready remains false. */
  'presentation.python.failed': { message: string };
  /** The runtime worker has been terminated. */
  'presentation.python.disconnected': undefined;
  /** Query readiness through the bus, including after a panel is remounted. */
  'presentation.python.state.requested': undefined;
  'presentation.python.state.reported': { ready: boolean };
  /** Correlated CLI requests and replies; callers never import the runtime adapter. */
  'presentation.python.command.requested': PythonCommandRequest;
  'presentation.python.command.completed': PythonCommandResult;
  'presentation.python.command.failed': { requestId: string; message: string };
  /** Correlated feature-message lookups; no project mount involved. */
  'presentation.brasidatacenter.message.requested': PythonFeatureMessageRequest;
  'presentation.brasidatacenter.message.completed': PythonFeatureMessageResult;
  'presentation.brasidatacenter.message.failed': { requestId: string; message: string };
  /** Ask the runtime which versions of these packages are installed in it. */
  'presentation.python.packages.requested': PythonPackageVersionsRequest;
  'presentation.python.packages.completed': PythonPackageVersionsResult;
  'presentation.python.packages.failed': { requestId: string; message: string };

  /** A panel resize interaction began, carrying the panel resize data. */
  'presentation.main.panel.resize.started': PanelResizePayload;
  /** A panel resize interaction progressed, carrying the updated resize data. */
  'presentation.main.panel.resize.changed': PanelResizePayload;
  /** A panel resize interaction finished, carrying the final resize data. */
  'presentation.main.panel.resize.ended': PanelResizePayload;

  /** A tab was removed by Dockview, through the UI or its panel removal API. */
  'presentation.main.panel.closed': PanelClosedPayload;
  /** Ask a container to mount a registered panel; existing ids are reused. */
  'presentation.main.panel.open.requested': {
    container: string;
    id: string;
    component: string;
    title?: string;
  };

  /** The table of a group was mounted in its tab; group is the dataset's path in the project and panelId the DOM id of the panel. */
  'presentation.main.panel.table.opened': { group: string; panelId: string };
  /** The person opened the about menu and wants the versions of the packages installed in the runtime of the application. */
  'presentation.main.about.requested': undefined;
  /** The installed versions: one entry per package, `version` null when the package is not installed. */
  'presentation.main.about.found': { packages: Array<{ name: string; label: string; version: string | null }> };

  /** Ask a container to close the tab with this id; an id that is not open is ignored. */
  'presentation.main.panel.close.requested': { container: string; id: string };

  /** The tab of an image was closed; item is the path of the image in the project. */
  'presentation.main.image.closed': { item: string };
  /** The tab of a PDF was closed; item is the path of the file in the project. */
  'presentation.main.pdf.closed': { item: string };
  /** The tab of a text file was closed; item is the path of the file in the project. */
  'presentation.main.txt.closed': { item: string };
  /** The tab of a CSV file was closed; item is the path of the file in the project. */
  'presentation.main.csv.closed': { item: string };
  /** The tab of a Markdown file was closed; item is the path of the file in the project. */
  'presentation.main.md.closed': { item: string };
  /** The tab of an Excel file was closed; item is the path of the file in the project. */
  'presentation.main.xlsx.closed': { item: string };
  /** The tab of a Word file was closed; item is the path of the file in the project. */
  'presentation.main.docx.closed': { item: string };
  /** The tab of an HTML file was closed; item is the path of the file in the project. */
  'presentation.main.html.closed': { item: string };
  /** The tab of a DXF drawing was closed; item is the path of the file in the project. */
  'presentation.main.dxf.closed': { item: string };
  /** The tab of a DWG drawing was closed; item is the path of the file in the project. */
  'presentation.main.dwg.closed': { item: string };
  /** The tab of an entity of the database was closed; id is the global id of the entity. */
  'presentation.main.entity.closed': { id: string };
  /** The entity tab's initial visual is rendered and attached to the document. */
  'presentation.main.panel.entity.opened': { id: string; panelId: string };
  /** The tab of an IFC model was closed; item is the path of the file in the project. */
  'presentation.main.ifc.closed': { item: string };
  /** The tab of a HEIC photo was closed; item is the path of the file in the project. */
  'presentation.main.heic.closed': { item: string };

  /** The user clicked in the 3D view of an IFC tab; x and y are normalized device coordinates (-1 to 1, y up). */
  'presentation.ifc.view.clicked': { item: string; x: number; y: number };
  /** An element of the 3D view of an IFC tab was selected; element is null when the click cleared the selection. */
  'presentation.ifc.element.selected': { item: string; element: IfcElementInfo | null };

  /** `infobim project --entity` answered: the groups of the database, one per dataset; replaces every group. */
  'presentation.project.entities.found': { groups: EntityGroup[] };
  /** `infobim project --entity` could not be read; the database keeps what it showed. */
  'presentation.project.entities.failed': { message: string };
  /** A group (a dataset) of the database became the active one; group is its path in the project. Only the active group shows its ⋯ menu. */
  'presentation.database.group.activated': { group: string };
  /** The user asked to open a group (a dataset) of the database; group is its path in the project. */
  'presentation.database.group.open.requested': { group: string };
  /** The user asked for a new item in a group (a dataset) of the database; group is its path in the project. */
  'presentation.database.group.new.requested': { group: string };
  /** The user opened an item of the database; id is the global id of the entity. */
  'presentation.database.item.opened': { group: string; id: string };
  /** The person asked to create an entity in group (a dataset's path in the project); `values` has the fields they filled in, by name, with their values. */
  'presentation.entity.create.requested': { group: string; values: Record<string, string> };
  /** The person asked to remove an item from a list field. owner is the entity being edited (its global id) or `new:<group>` for the tab of a new entity; field is the identifier of the field; item the value to remove. */
  'presentation.entity.list.item.remove.requested': { owner: string; field: string; item: string };
  /** The person asked to add an item to a list field. documents says its values are documents of the project, chosen from its files. */
  'presentation.entity.list.item.add.requested': { owner: string; field: string; documents: boolean };
  /** The person chose the item to add to a list field. */
  'presentation.entity.list.item.chosen': { owner: string; field: string; item: string };
  /** A new entity could not be started in group (a dataset's path in the project). */
  'presentation.database.group.new.failed': { group: string; message: string };
  /** The entity was created in group; id is its global id. */
  'presentation.entity.created': { group: string; id: string };
  /** The entity could not be created in group. */
  'presentation.entity.create.failed': { group: string; message: string };
  'presentation.entity.edit.requested': { id: string };
  'presentation.entity.edit.cancelled': { id: string };
  /** The person asked to save: `changes` has the fields they changed, by name, with their new values. */
  'presentation.entity.save.requested': { id: string; changes: Record<string, string> };
  /** The changes were saved; the edit is over. */
  'presentation.entity.saved': { id: string };
  'presentation.entity.save.failed': { id: string; message: string };
  'presentation.entity.delete.requested': { id: string };
  'presentation.entity.delete.confirmed': { id: string };
  'presentation.entity.delete.cancelled': { id: string };
  'presentation.entity.deleted': { id: string };
  'presentation.entity.delete.failed': { id: string; message: string };

  /** `infobim project --refresh` ran and worked; requestId is the one of that command. */
  'presentation.project.refresh.completed': { requestId: string };

  /** A command was requested; the terminal shows it and the run listener executes it. */
  'presentation.main.command.requested': { requestId: string; command: string };
  /** The command ran and worked; carries the result, matched by requestId. */
  'presentation.main.code.success': { requestId: string; result: CommandExecutionResult };
  /** The command could not run or did not work; result is null when nothing ran. */
  'presentation.main.code.failure': { requestId: string; result: CommandExecutionResult | null; message: string };
  /** The command was rejected before running, with the reason. */
  'presentation.main.command.invalid': { requestId: string; reason: string };

  /** The assistant has a new message to show, such as the first-load welcome text. */
  'presentation.assistant.message.sent': { text: string };

  /** Requests the light or dark color theme; does not mean it has been applied. */
  'presentation.main.theme.change.requested': { theme: 'light' | 'dark' };
  /** The color theme was applied, carrying the active and previous themes. */
  'presentation.main.theme.changed': {
    theme: 'light' | 'dark';
    previousTheme: 'light' | 'dark';
  };
};

/**
 * Extracts the allowed event names from AppEventMap, without their data types.
 * This lets the event bus reject unknown event names during TypeScript checking.
 */
export type AppEventType = keyof AppEventMap;
