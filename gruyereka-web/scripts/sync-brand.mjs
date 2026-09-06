// The brand marks live once, in the repository's assets/. Next only serves
// static files out of public/, so they are copied in before dev and build
// rather than kept as a second copy inside the source tree.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "assets");
const target = join(here, "..", "public", "brand");

await mkdir(target, { recursive: true });
const marks = (await readdir(source)).filter((name) => name.endsWith(".svg"));
await Promise.all(marks.map((name) => copyFile(join(source, name), join(target, name))));
process.stdout.write(`synced ${marks.length} brand marks into public/brand\n`);
