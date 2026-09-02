import { buildBrowserHelperArchive } from "./browser-helper-archive.mjs";

buildBrowserHelperArchive()
  .then((output) => process.stdout.write(`browser_helper_archive_built ${output}\n`))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
