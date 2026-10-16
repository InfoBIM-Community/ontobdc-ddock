/**
 * Builds the wheels of this project's own Python packages from their source, so
 * the browser always runs the code that is on disk and not a wheel someone built
 * once and committed.
 *
 * The manifest lists each package under `localSources`: its name and where its
 * source is. The folder is the first that exists of: the environment variable
 * the entry names, `/sources/<name>` (where docker-compose mounts it), and the
 * folder next to this repository. A package whose source is not found keeps the
 * release pinned in `localWheels[].pypi`, if there is one, else the wheel committed
 * there, and says so; one whose source is found
 * and cannot be built stops the start, so stale code never runs unnoticed.
 *
 * The source is copied before it is built, so nothing is written into the
 * repositories (which docker mounts read-only). A package is built again only
 * when its source changed.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = join(ROOT, '.cache', 'local-wheels');
/** Never part of a build, wherever they are. */
const SKIPPED = new Set(['.git', '__pycache__', 'node_modules', '.venv', 'venv', '.pytest_cache', '.mypy_cache', '.cache']);
/** Not part of a build when they are at the top of the source (inside the package they may be code). */
const SKIPPED_AT_TOP = new Set(['build', 'dist', 'test', 'tests']);

const keep = (path, top) => {
  const name = basename(path);
  if (SKIPPED.has(name) || name.endsWith('.egg-info') || name.endsWith('.pyc')) return false;
  return !(dirname(path) === top && SKIPPED_AT_TOP.has(name));
};

/** Every file the build reads, in a fixed order, as `<relative path>\0<content>`. */
function* files(directory, base = directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (!keep(path, base)) continue;
    if (entry.isDirectory()) yield* files(path, base);
    else if (statSync(path).isFile()) yield [relative(base, path), readFileSync(path)];
  }
}

const hashOf = (directory) => {
  const hash = createHash('sha256');
  for (const [path, content] of files(directory)) hash.update(path).update('\0').update(content).update('\0');
  return hash.digest('hex');
};

const sourceOf = ({ name, env, folder }) => {
  const candidates = [process.env[env], `/sources/${name}`, resolve(ROOT, '..', '..', folder)].filter(Boolean);
  return candidates.find((path) => existsSync(join(path, 'pyproject.toml')));
};

/**
 * Builds what has to be built and returns, by package name, the wheel and the
 * hash of the source it came from. Packages whose source was not found are left out.
 */
export function buildLocalWheels(manifest) {
  const built = new Map();
  for (const entry of manifest.localSources ?? []) {
    const source = sourceOf(entry);
    if (!source) {
      console.warn(`[python] no source of ${entry.name} found (${entry.env}, /sources/${entry.name}, ../../${entry.folder}): using its PyPI release, if the manifest pins one, else its committed wheel`);
      continue;
    }

    const output = join(BUILT, entry.name);
    const stamp = join(output, '.source-hash');
    const hash = hashOf(source);
    const existing = existsSync(output) ? readdirSync(output).find((file) => file.endsWith('.whl')) : undefined;
    if (existing && existsSync(stamp) && readFileSync(stamp, 'utf8') === hash) {
      console.log(`[python] ${entry.name}: ${existing} is up to date with ${source}`);
      built.set(entry.name, { path: join(output, existing), hash });
      continue;
    }

    console.log(`[python] building ${entry.name} from ${source}…`);
    const work = join(BUILT, `.work-${entry.name}`);
    rmSync(work, { recursive: true, force: true });
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    cpSync(source, work, { recursive: true, filter: (path) => path === source || keep(path, source) });
    try {
      // The build tools are installed with the image, so nothing is downloaded here.
      execFileSync('python3', ['-m', 'build', '--wheel', '--no-isolation', '--outdir', output, work], { stdio: ['ignore', 'inherit', 'inherit'] });
    } catch (error) {
      throw new Error(`The wheel of ${entry.name} could not be built from ${source}: ${error.message}`, { cause: error });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
    const wheel = readdirSync(output).find((file) => file.endsWith('.whl'));
    if (!wheel) throw new Error(`Building ${entry.name} from ${source} left no wheel`);
    writeFileSync(stamp, hash);
    built.set(entry.name, { path: join(output, wheel), hash });
  }

  return built;
}
