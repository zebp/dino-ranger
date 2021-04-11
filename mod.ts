import { Chunker } from "./chunker.ts";
import { ProgressBar } from "./deps.ts";
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

const numericLength = parseInt(length);
const ranges = createRanges(numericLength, 16);
const file = await Deno.create(outputName);
const chunker = new Chunker({ file });

const progressBar = new ProgressBar({
  title: "Downloading.",
  display: "Downloading :time [:bar] :percent",
  total: numericLength,
});

let progress = 0;

// Creates a writer in the chunker for all of the ranges for the content length.
ranges.forEach((range) => {
  chunker.addWriter((push) =>
    stream({
      dataChunkConsumer: (dataChunk) => {
        progress += dataChunk.data.length;
        progressBar.render(progress);
        push(dataChunk);
      },
      url,
      range,
    })
  );
});

await chunker.save();

Deno.exit(0);
