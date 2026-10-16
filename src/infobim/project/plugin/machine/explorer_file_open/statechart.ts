import source from './standard_explorer_file_open.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class ExplorerFileOpenStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(ExplorerFileOpenStatechart.config());
  }
}
