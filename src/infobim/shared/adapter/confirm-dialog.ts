export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

/**
 * Asks the person to confirm something, in a modal over the page. It answers
 * true when they confirm, and false when they cancel, press Escape, or close
 * the modal in any other way. The modal is removed from the page once answered.
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');

    const title = document.createElement('h2');
    title.id = 'confirm-dialog-title';
    title.textContent = options.title;
    const message = document.createElement('p');
    message.textContent = options.message;
    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'confirm-dialog-cancel';
    cancel.textContent = options.cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'confirm-dialog-confirm';
    confirm.textContent = options.confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(title, message, actions);

    // `close` is the one way out: Escape, the buttons and the browser all end here.
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirmed';
      dialog.remove();
      resolve(confirmed);
    });
    cancel.addEventListener('click', () => dialog.close('cancelled'));
    confirm.addEventListener('click', () => dialog.close('confirmed'));

    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
