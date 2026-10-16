import { projectDocuments } from '@/infobim/shared/adapter/container-documents';
import { ProjectRepository } from '@/infobim/shared/adapter/project-repository';
import { translate } from '@/infobim/shared/plugin/i18n';

/**
 * Asks the person to choose a file of the project as a document, in a modal
 * over the page with the files of the project and a filter by name. It answers
 * the IRI of the chosen document, or null when they cancel, press Escape or
 * close the modal in any other way. The modal is removed once answered.
 */
export async function pickDocument(): Promise<string | null> {
  const folder = ProjectRepository.getInstance().get()?.folder;
  if (!folder) throw new Error('The files of the project cannot be listed: it is not open with write access.');
  const documents = await projectDocuments(folder);

  return new Promise<string | null>((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog document-picker';
    dialog.setAttribute('aria-label', translate('entity.documents.title'));

    const title = document.createElement('h2');
    title.textContent = translate('entity.documents.title');
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.className = 'entity-editor';
    filter.placeholder = translate('entity.documents.filter');
    filter.setAttribute('aria-label', filter.placeholder);
    const list = document.createElement('ul');
    list.className = 'document-picker-list';
    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'confirm-dialog-cancel';
    cancel.textContent = translate('confirm.cancel');
    actions.append(cancel);
    dialog.append(title, filter, list, actions);

    let chosen: string | null = null;
    const draw = (): void => {
      const wanted = filter.value.trim().toLocaleLowerCase();
      const shown = documents.filter(({ path }) => path.toLocaleLowerCase().includes(wanted));
      if (shown.length === 0) {
        const none = document.createElement('li');
        none.className = 'tree-empty';
        none.textContent = translate('entity.documents.none');
        list.replaceChildren(none);
        return;
      }
      list.replaceChildren(...shown.map(({ path, iri }) => {
        const item = document.createElement('li');
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.textContent = path;
        choose.title = path;
        choose.addEventListener('click', () => { chosen = iri; dialog.close(); });
        item.append(choose);
        return item;
      }));
    };
    draw();
    filter.addEventListener('input', draw);

    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(chosen);
    });
    cancel.addEventListener('click', () => dialog.close());
    document.body.append(dialog);
    dialog.showModal();
    filter.focus();
  });
}
