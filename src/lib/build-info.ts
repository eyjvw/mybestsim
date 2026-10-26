/** Build metadata, injected by CI as Docker build args. */
export const BUILD = {
  sha: process.env.GIT_SHA || "dev",
  builtAt: new Date().toISOString(),
};

export const REPO_URL = "https://github.com/eyjvw/MyBestSim-Dashboard";
