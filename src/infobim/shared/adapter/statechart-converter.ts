import { parse } from 'yaml';

/** A guard or action named by the YAML: `object.method(key = Port.CONSTANT)`. */
export type NamedCall = {
  type: string;
  params: Record<string, string>;
  negated: boolean;
};

type Transition = { target: string; guard?: NamedCall; actions?: NamedCall[] };
type StateNode = {
  type?: 'final';
  meta: { label: Record<string, string>; description: Record<string, string> };
  on?: { STEP: Transition[] };
};

export type StatechartConfig = {
  id: string;
  initial: string;
  states: Record<string, StateNode>;
};

const CALL = /^(not\s+)?([A-Za-z_]\w*\.[A-Za-z_]\w*)\(\s*([^)]*?)\s*\)$/;
const PARAMETER = /^([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*\.[A-Za-z_]\w*)$/;

const fail = (message: string): never => {
  throw new Error(`Statechart: ${message}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `not handler.method(key = Port.CONSTANT)` into a named call; anything else fails. */
export function parseCall(expression: string): NamedCall {
  const match = CALL.exec(expression.trim());
  if (!match) return fail(`unsupported expression: ${expression}`);

  const params: Record<string, string> = {};
  const raw = match[3].trim();
  if (raw) {
    for (const part of raw.split(',')) {
      const parameter = PARAMETER.exec(part.trim());
      if (!parameter) return fail(`unsupported parameter "${part.trim()}" in: ${expression}`);
      params[parameter[1]] = parameter[2];
    }
  }
  return { type: match[2], params, negated: Boolean(match[1]) };
}

const text = (value: unknown, where: string): Record<string, string> => {
  if (value === undefined) return {};
  if (!isRecord(value)) return fail(`${where} must be a mapping of languages to text.`);
  return Object.fromEntries(Object.entries(value).map(([language, content]) => [language, String(content)]));
};

const KNOWN_STATE_KEYS = new Set(['name', 'label', 'description', 'transitions', 'type']);
const KNOWN_TRANSITION_KEYS = new Set(['target', 'guard', 'action', 'contract']);

/**
 * Turns an OntoBDC statechart (the sismic YAML subset it uses) into an XState
 * configuration. Every transition is a `STEP`; guards and actions stay named
 * calls, for the machine to give an implementation.
 */
export function convertStatechart(source: string): StatechartConfig {
  const document: unknown = parse(source);
  const statechart = isRecord(document) ? document.statechart : undefined;
  const root = isRecord(statechart) ? statechart['root state'] : undefined;
  if (!isRecord(statechart) || !isRecord(root)) return fail('no "statechart" with a "root state".');
  if (typeof root.name !== 'string' || typeof root.initial !== 'string' || !Array.isArray(root.states)) {
    return fail('the root state needs name, initial and states.');
  }

  const states: Record<string, StateNode> = {};
  for (const entry of root.states as unknown[]) {
    if (!isRecord(entry) || typeof entry.name !== 'string') return fail('a state has no name.');
    const name = entry.name;
    for (const key of Object.keys(entry)) if (!KNOWN_STATE_KEYS.has(key)) fail(`state ${name}: unsupported key "${key}".`);
    if (entry.type !== undefined && entry.type !== 'final') fail(`state ${name}: unsupported type "${String(entry.type)}".`);

    const node: StateNode = {
      meta: { label: text(entry.label, `${name}.label`), description: text(entry.description, `${name}.description`) },
    };
    if (entry.type === 'final') node.type = 'final';

    if (entry.transitions !== undefined) {
      if (!Array.isArray(entry.transitions)) return fail(`state ${name}: transitions must be a list.`);
      node.on = {
        STEP: (entry.transitions as unknown[]).map((transition): Transition => {
          if (!isRecord(transition) || typeof transition.target !== 'string') return fail(`state ${name}: a transition has no target.`);
          for (const key of Object.keys(transition)) if (!KNOWN_TRANSITION_KEYS.has(key)) fail(`state ${name}: unsupported transition key "${key}".`);
          return {
            target: transition.target,
            ...(typeof transition.guard === 'string' ? { guard: parseCall(transition.guard) } : {}),
            ...(typeof transition.action === 'string' ? { actions: [parseCall(transition.action)] } : {}),
          };
        }),
      };
    }
    states[name] = node;
  }

  if (!(root.initial in states)) return fail(`initial state "${root.initial}" is not defined.`);
  for (const [name, node] of Object.entries(states)) {
    for (const transition of node.on?.STEP ?? []) {
      if (!(transition.target in states)) fail(`state ${name}: target "${transition.target}" is not defined.`);
    }
  }

  return { id: root.name, initial: root.initial, states };
}

/** The states in the order the first transitions lead through them. */
export function stateSequence(config: StatechartConfig): string[] {
  const sequence: string[] = [];
  let current: string | undefined = config.initial;
  while (current !== undefined && !sequence.includes(current)) {
    sequence.push(current);
    current = config.states[current].on?.STEP[0]?.target;
  }
  return sequence;
}

export type ChainStateNode = { type?: 'final'; on?: { STEP: Transition[] } };
export type ChainRegionConfig = { initial: string; states: Record<string, ChainStateNode> };
export type ChainStatechartConfig = { id: string; regions: Record<string, ChainRegionConfig> };

const CHAIN_CALL = /^(not\s+)?([A-Za-z_]\w*\.[A-Za-z_]\w*)\(\s*'([^']*)'\s*\)$/;
const KNOWN_CHAIN_REGION_KEYS = new Set(['name', 'initial', 'states']);
const KNOWN_CHAIN_STATE_KEYS = new Set(['name', 'transitions', 'type']);

/** `not worker.can_handle('<capability id>')` into a named call; anything else fails. */
export function parseChainCall(expression: string): NamedCall {
  const match = CHAIN_CALL.exec(expression.trim());
  if (!match) return fail(`unsupported chain expression: ${expression}`);
  return { type: match[2], params: { id: match[3] }, negated: Boolean(match[1]) };
}

/**
 * Turns a chain-of-responsibility statechart (parallel root, one region per
 * responsibility) into an XState parallel configuration. Each region's guard
 * and action name, as a string literal, the id of the capability it runs.
 */
export function convertChainStatechart(source: string): ChainStatechartConfig {
  const document: unknown = parse(source);
  const statechart = isRecord(document) ? document.statechart : undefined;
  const root = isRecord(statechart) ? statechart['root state'] : undefined;
  if (!isRecord(statechart) || !isRecord(root)) return fail('no "statechart" with a "root state".');
  if (typeof root.name !== 'string' || !Array.isArray(root['parallel states'])) {
    return fail('the root state needs name and "parallel states".');
  }

  const regions: Record<string, ChainRegionConfig> = {};
  for (const entry of root['parallel states'] as unknown[]) {
    if (!isRecord(entry) || typeof entry.name !== 'string') return fail('a region has no name.');
    const regionName = entry.name;
    for (const key of Object.keys(entry)) if (!KNOWN_CHAIN_REGION_KEYS.has(key)) fail(`region ${regionName}: unsupported key "${key}".`);
    if (typeof entry.initial !== 'string' || !Array.isArray(entry.states)) {
      return fail(`region ${regionName}: needs initial and states.`);
    }

    const states: Record<string, ChainStateNode> = {};
    for (const stateEntry of entry.states as unknown[]) {
      if (!isRecord(stateEntry) || typeof stateEntry.name !== 'string') return fail(`region ${regionName}: a state has no name.`);
      const name = stateEntry.name;
      for (const key of Object.keys(stateEntry)) if (!KNOWN_CHAIN_STATE_KEYS.has(key)) fail(`region ${regionName}: state ${name}: unsupported key "${key}".`);
      if (stateEntry.type !== undefined && stateEntry.type !== 'final') fail(`region ${regionName}: state ${name}: unsupported type "${String(stateEntry.type)}".`);

      const node: ChainStateNode = {};
      if (stateEntry.type === 'final') node.type = 'final';

      if (stateEntry.transitions !== undefined) {
        if (!Array.isArray(stateEntry.transitions)) return fail(`region ${regionName}: state ${name}: transitions must be a list.`);
        node.on = {
          STEP: (stateEntry.transitions as unknown[]).map((transition): Transition => {
            if (!isRecord(transition) || typeof transition.target !== 'string') return fail(`region ${regionName}: state ${name}: a transition has no target.`);
            for (const key of Object.keys(transition)) if (!KNOWN_TRANSITION_KEYS.has(key)) fail(`region ${regionName}: state ${name}: unsupported transition key "${key}".`);
            return {
              target: transition.target,
              ...(typeof transition.guard === 'string' ? { guard: parseChainCall(transition.guard) } : {}),
              ...(typeof transition.action === 'string' ? { actions: [parseChainCall(transition.action)] } : {}),
            };
          }),
        };
      }
      states[name] = node;
    }

    if (!(entry.initial in states)) return fail(`region ${regionName}: initial state "${entry.initial}" is not defined.`);
    for (const node of Object.values(states)) {
      for (const transition of node.on?.STEP ?? []) {
        if (!(transition.target in states)) fail(`region ${regionName}: target "${transition.target}" is not defined.`);
      }
    }

    regions[regionName] = { initial: entry.initial, states };
  }

  return { id: root.name, regions };
}
