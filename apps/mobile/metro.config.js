const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm hoists packages to the monorepo root — tell Metro to look there
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// The shared package imports its own files as "./x.js" (NodeNext style for the API); Metro needs the .ts source
const sharedRoot = path.resolve(monorepoRoot, "packages/shared");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const sharedSibling = moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath.startsWith(sharedRoot);
  return context.resolveRequest(context, sharedSibling ? moduleName.slice(0, -3) : moduleName, platform);
};

module.exports = config;
