const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const env = { ...process.env };

const proxyKeys = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "GIT_HTTP_PROXY",
  "GIT_HTTPS_PROXY",
];

for (const key of proxyKeys) {
  const value = env[key];
  if (typeof value === "string" && value.includes("127.0.0.1:9")) {
    delete env[key];
  }
}

if (env.PETTY_CASH_EXPO_ONLINE !== "1" && !env.EXPO_OFFLINE) {
  env.EXPO_OFFLINE = "1";
}

const noProxyParts = new Set(
  String(env.NO_PROXY || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean),
);
for (const host of ["localhost", "127.0.0.1", "::1"]) {
  noProxyParts.add(host);
}
env.NO_PROXY = Array.from(noProxyParts).join(",");

const expoCliPath = path.join(__dirname, "..", "node_modules", "expo", "bin", "cli");
const child = spawn(process.execPath, [expoCliPath, ...args], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Unable to start Expo:", error.message);
  process.exit(1);
});
