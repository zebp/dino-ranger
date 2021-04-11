import { assertEquals } from "./deps.ts";
import { DataChunkConsumer } from "./chunker.ts";

export type Range = [number, number];

export interface StreamOptions {
  url: string;
  dataChunkConsumer: DataChunkConsumer;
  userAgent?: string;
  range: [number, number];
}

export async function stream(
  { url, dataChunkConsumer, userAgent, range }: StreamOptions,
) {
  const [start, end] = range;
  const response = await fetch(url, {
    headers: {
      range: `bytes=${start}-${end}`,
      "user-agent": userAgent ?? "ranger",
    },
  });

  if (!response.body) {
    throw new Error("no body");
  }

  let offset = start;

  for await (const data of response.body) {
    dataChunkConsumer({ offset, data });
    offset += data.length;
  }
}

export function createRanges(length: number, chunks: number): Range[] {
  if (chunks < 1 || length < 1) {
    throw new Error("invalid input");
  }

  const perChunk = Math.floor(length / chunks);
  const ranges: Range[] = [];

  let start = 0;
  let remaining = length;

  while (remaining > 0) {
    const size = Math.min(perChunk, remaining);
    ranges.push([start, start + size]);

    start += size;
    remaining -= size;
  }

  return ranges;
}

Deno.test({
  name: "createRanges",
  fn: () =>
    assertEquals(createRanges(1024, 4), [
      [0, 256],
      [256, 512],
      [512, 768],
      [768, 1024],
    ]),
});
