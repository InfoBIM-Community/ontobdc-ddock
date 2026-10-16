/** Architecture boundary rules. Run with: npm run check:arch */
module.exports = {
  forbidden: [
    {
      name: 'domain-model-isolated',
      comment: 'Contracts in domain/model must not depend on adapters, plugins or the web layer.',
      severity: 'error',
      from: { path: '^infobim/shared/domain/model' },
      to: { path: '^infobim/(shared/(adapter|plugin)|web)/' },
    },
    {
      name: 'shared-not-web',
      comment: 'Shared code must not know the web layer.',
      severity: 'error',
      from: { path: '^infobim/shared/' },
      to: { path: '^infobim/web/' },
    },
    {
      name: 'project-only-shared',
      comment: 'Project code may only depend on shared (and on itself).',
      severity: 'error',
      from: { path: '^infobim/project/' },
      to: { path: '^infobim/', pathNot: '^infobim/(shared|project)/' },
    },
    {
      name: 'run-only-shared',
      comment: 'Run code may only depend on shared (and on itself).',
      severity: 'error',
      from: { path: '^infobim/run/' },
      to: { path: '^infobim/', pathNot: '^infobim/(shared|run)/' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
