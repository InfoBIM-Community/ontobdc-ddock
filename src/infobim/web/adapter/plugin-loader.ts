import type { PanelFactory } from '@/infobim/shared/adapter/view';

/** Panel files export their factory as default; other modules may register several panels. */
export type PanelPlugin = {
  default?: PanelFactory;
  panelFactories?: Record<string, PanelFactory>;
};

type PluginImports = Record<string, () => Promise<PanelPlugin>>;

/** Discover plugin modules, and the panels of the other modules, without executing them yet. */
const pluginImports = import.meta.glob<PanelPlugin>([
  '../plugin/**/*.ts',
  '../../*/plugin/panel/*.ts',
  '!../plugin/**/*.d.ts',
  '!../../*/plugin/panel/*.d.ts',
]);

/**
 * Load modules in ascending file-path order, independent of filesystem order.
 * Assigning the same panel name again replaces its previous factory.
 * A panel file's name is its registration name: panel/home.ts registers home.
 * Modules elsewhere register panels through their exported panelFactories map.
 */
export async function loadPanelFactories(
  imports: PluginImports = pluginImports,
): Promise<Record<string, PanelFactory>> {
  const factories: Record<string, PanelFactory> = Object.create(null);

  for (const filePath of Object.keys(imports).sort()) {
    const plugin = await imports[filePath]();

    if (filePath.includes('/panel/') && plugin.default !== undefined) {
      const name = filePath.slice(filePath.lastIndexOf('/') + 1, -'.ts'.length);
      if (typeof plugin.default !== 'function') {
        throw new Error(`Panel plugin ${filePath} must export a factory function as default.`);
      }
      factories[name] = plugin.default;
    }

    for (const [name, factory] of Object.entries(plugin.panelFactories ?? {})) {
      if (typeof factory !== 'function') {
        throw new Error(`Plugin ${filePath} exports an invalid factory for panel ${name}.`);
      }
      factories[name] = factory;
    }
  }

  return factories;
}
