import source from './standard_set_up_group_table.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class SetUpGroupTableStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(SetUpGroupTableStatechart.config());
  }
}
