import source from './standard_remote_project_connection.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class RemoteProjectConnectionStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(RemoteProjectConnectionStatechart.config());
  }
}
