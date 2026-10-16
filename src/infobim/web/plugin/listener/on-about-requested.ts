import { runPackageVersionsQuery, waitForPythonReady } from '@/infobim/shared/adapter/command';
import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';

const ABOUT_REQUESTED = 'presentation.main.about.requested';
const SOURCE = 'web_on_about_requested';

/** The packages the application runs on, by the name they are installed under. */
const PACKAGES = [
  { name: 'ontobdc', label: 'OntoBDC' },
  { name: 'infobim', label: 'InfoBIM' },
  { name: 'brasidatacenter', label: 'BrasidataCenter' },
] as const;

export class OnAboutRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'web',
    description: 'Asks the Python runtime which versions of OntoBDC, InfoBIM and BrasidataCenter are installed in it and publishes them.',
    arguments: [
      {
        listen: [ABOUT_REQUESTED],
        valued: false,
        description: 'The person opened the about menu.',
        type: 'str',
      },
    ],
  };

  /**
   * Waits for the runtime to be ready and asks its installer (micropip, the `pip`
   * of Pyodide) which version of each package it holds, then publishes
   * `presentation.main.about.found` with them. A package that is not installed has
   * a null version. Asked every time: the runtime is the truth, and it is cheap.
   */
  async run(): Promise<void> {
    await waitForPythonReady();
    const { versions } = await runPackageVersionsQuery(SOURCE, PACKAGES.map(({ name }) => name));
    eventBus.publish('presentation.main.about.found', SOURCE, {
      packages: PACKAGES.map(({ name, label }) => ({ name, label, version: versions[name] ?? null })),
    });
  }
}
