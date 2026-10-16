import { notify } from '@/infobim/shared/adapter/notice';
import type { AppEvent } from '@/infobim/shared/adapter/event-bus';
import type { ListenerMetadata } from '@/infobim/shared/domain/model/listener';
import { translate, type MessageKey } from '@/infobim/shared/plugin/i18n';

const FAILURES: Record<string, MessageKey> = {
  'presentation.entity.save.failed': 'notice.entity.save.failed',
  'presentation.entity.create.failed': 'notice.entity.create.failed',
  'presentation.entity.delete.failed': 'notice.entity.delete.failed',
  'presentation.database.group.new.failed': 'notice.database.new.failed',
  'presentation.explorer.file.upload.failed': 'notice.upload.failed',
};
const UPLOADED = 'presentation.explorer.file.uploaded';

type Payload = { message?: string; path?: string; skipped?: string[] };

export class OnFailureReported {
  static readonly METADATA: ListenerMetadata = {
    id: 'web_on_failure_reported',
    logical_component: 'web',
    description: 'Tells the person, in a notice, that saving, creating, deleting or uploading failed, and which uploaded files were left as they were.',
    arguments: [{
      listen: [...Object.keys(FAILURES), UPLOADED],
      valued: false,
      description: 'A failure of an action of the person, or an upload that left files as they were.',
      type: 'str',
    }],
  };

  constructor(private readonly event: AppEvent<Payload>) {}

  /** Shows the reason of the failure the event reports; an upload that skipped files shows which ones. */
  run(): void {
    const payload = this.event.payload;
    if (this.event.type === UPLOADED) {
      const skipped = payload?.skipped ?? [];
      if (skipped.length > 0) notify(translate('notice.upload.skipped', { path: payload?.path || '/', names: skipped.join(', ') }), 'info');
      return;
    }
    const key = FAILURES[this.event.type];
    if (!key) return;
    notify(translate(key, { message: payload?.message ?? '' }), 'error');
  }
}
