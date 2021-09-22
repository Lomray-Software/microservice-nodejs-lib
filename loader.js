import {
  resolve as resolveTs,
  getFormat,
  transformSource,
} from "ts-node/esm";
import * as tsConfigPaths from "tsconfig-paths";

export { getFormat, transformSource };

const { absoluteBaseUrl, paths } = tsConfigPaths.loadConfig()
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths)

/**
 * Special loader for typescript in node js + alias resolver
 */
export function resolve(specifier, context, defaultResolver) {
  const mappedSpecifier = matchPath(specifier)
  if (mappedSpecifier) {
    specifier = `${mappedSpecifier}.js`
  }
  return resolveTs(specifier, context, defaultResolver);
}
