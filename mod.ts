import { Chunker } from "./chunker.ts";
import { createRanges, stream } from "./stream.ts";

const url = Deno.args[0];
const outputName = Deno.args[1];

if (!url) {
  console.error("No url provided.");
  Deno.exit(1);
}

if (!outputName) {
  console.error("No output file provided.");
  Deno.exit(1);
}

const length = await fetch(url).then((res) =>
  res.headers.get("Content-Length")
);

if (!length) {
  console.error("URL does not specify it's body length.");
  Deno.exit(1);
}

const ranges = createRanges(parseInt(length), 16);
const file = await Deno.create(outputName);
const chunker = new Chunker({ file });

ranges.forEach((range) => {
  chunker.addWriter((push) => stream({ dataChunkConsumer: push, url, range }));
});

await chunker.save();

Deno.exit(0);
