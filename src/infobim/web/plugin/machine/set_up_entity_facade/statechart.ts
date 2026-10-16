import source from './standard_set_up_entity_facade.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class SetUpEntityFacadeStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(SetUpEntityFacadeStatechart.config());
  }
}
