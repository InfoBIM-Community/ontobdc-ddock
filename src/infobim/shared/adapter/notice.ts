import { translate } from '@/infobim/shared/plugin/i18n';

export type NoticeKind = 'error' | 'info';

const AUTO_CLOSE_MS = 12000;

/**
 * Tells the person something, in a notice over the page that closes by itself
 * after a while or when they close it. Notices stack in one place, the newest
 * last, and are announced to assistive technology.
 */
export function notify(message: string, kind: NoticeKind = 'info'): void {
  let host = document.querySelector<HTMLElement>('.notices');
  if (!host) {
    host = document.createElement('div');
    host.className = 'notices';
    document.body.append(host);
  }

  const notice = document.createElement('div');
  notice.className = `notice ${kind}`;
  notice.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.className = 'notice-text';
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'notice-close';
  close.textContent = '×';
  close.title = translate('notice.close');
  close.setAttribute('aria-label', close.title);
  const remove = (): void => {
    notice.remove();
    if (host && host.childElementCount === 0) host.remove();
  };
  close.addEventListener('click', remove);
  notice.append(text, close);
  host.append(notice);
  setTimeout(remove, AUTO_CLOSE_MS);
}
