/** One thing a listener reads: the events that carry it and the payload field it binds. */
export type ListenerArgument = {
  /** Names of the events this argument is heard on. */
  listen: string[];
  valued: boolean;
  parameter?: string;
  description: string;
  type: 'str';
};

/** What a listener class declares about itself, as a static METADATA. */
export type ListenerMetadata = {
  id: string;
  logical_component: string;
  description: string;
  arguments: ListenerArgument[];
};
