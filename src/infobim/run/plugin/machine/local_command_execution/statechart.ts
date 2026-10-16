import source from './standard_local_command_execution.yaml?raw';
import { convertStatechart, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class LocalCommandExecutionStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }
}
