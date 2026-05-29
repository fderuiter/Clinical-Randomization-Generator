const version = process.versions.node;
const majorVersion = parseInt(version.split('.')[0], 10);

if (majorVersion < 22) {
  console.error(`\x1b[31m[Error] You are using Node.js v${version}. Node.js v22 or higher is required.\x1b[0m`);
  console.error(`\x1b[33mPlease upgrade your Node.js version or use the provided Dev Container.\x1b[0m`);
  process.exit(1);
}
