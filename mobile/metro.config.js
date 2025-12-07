const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent directory for the convex folder
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, 'convex'),
];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Map 'convex' to the parent convex folder for imports like 'convex/_generated/api'
config.resolver.extraNodeModules = new Proxy(
  {
    convex: path.resolve(workspaceRoot, 'convex'),
  },
  {
    get: (target, name) => {
      if (target.hasOwnProperty(name)) {
        return target[name];
      }
      // Fallback to node_modules
      return path.join(projectRoot, 'node_modules', name);
    },
  }
);

module.exports = config;

