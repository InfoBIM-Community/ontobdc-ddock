import source from './standard_ifc_element_selection.yaml?raw';
import { convertStatechart, stateSequence, type StatechartConfig } from '@/infobim/shared/adapter/statechart-converter';

/** Provides the statechart definition independently of machine execution. */
export class IfcElementSelectionStatechart {
  static config(): StatechartConfig {
    return convertStatechart(source);
  }

  static sequence(): string[] {
    return stateSequence(IfcElementSelectionStatechart.config());
  }
}
