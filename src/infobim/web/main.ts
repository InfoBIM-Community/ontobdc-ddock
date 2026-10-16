import '@/asset/common.css';
import '@xterm/xterm/css/xterm.css';
import 'dockview/dist/styles/dockview.css';
import '@/asset/dockview-theme.css';

import { loadPanelFactories } from '@/infobim/web/adapter/plugin-loader';
import { ListenerLoader } from '@/infobim/web/adapter/loader';
import { renderShell } from '@/infobim/web/adapter/layout';
import { initSurface } from '@/infobim/web/adapter/surface';
import { initBottom } from '@/infobim/web/adapter/bottom';
import { initSidebar } from '@/infobim/web/adapter/sidebar';
import { initAssistant } from '@/infobim/web/adapter/assistant';
import { initPython } from '@/infobim/shared/adapter/python';
import { initProjects } from '@/infobim/shared/adapter/project';
import { EntityRepository } from '@/infobim/shared/adapter/entity-repository';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import { initProjectStatus } from '@/infobim/web/adapter/project-status';
import { setupSplitters } from '@/infobim/web/adapter/splitters';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root not found');

const componentFactories = await loadPanelFactories();
const disposeSurface = initSurface(componentFactories);
const disposeBottom = initBottom(componentFactories);
const disposeSidebar = initSidebar(componentFactories);
const disposeAssistant = initAssistant(componentFactories);
const disposePython = initPython();
const disposeProjects = initProjects();
const projectRepository = ProjectRepository.getInstance();
const entityRepository = EntityRepository.getInstance();
const disposeProjectStatus = initProjectStatus();
const disposeListeners = await new ListenerLoader().load();

renderShell(app);
setupSplitters(app);

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposeSurface();
  disposeBottom();
  disposeSidebar();
  disposeAssistant();
  disposeProjects();
  projectRepository.dispose();
  entityRepository.dispose();
  disposeProjectStatus();
  disposeListeners();
  disposePython();
});
