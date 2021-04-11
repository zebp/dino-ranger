import { setImmediate } from "https://cdn.deno.land/std/versions/0.92.0/raw/node/timers.ts";

export interface DataChunk {
  offset: number;
  data: Uint8Array;
}

export type DataChunkConsumer = (dataChunk: DataChunk) => void;

export interface ChunkerOptions {
  file: Deno.File;
  delay?: number;
}

export class Chunker {
  private currentWriters = 0;
  private innerQueue: DataChunk[] = [];
  private file: Deno.File;
  private delay?: number;

  /**
   * Creates a new chunker for writing to a file in parallel.
   * @param file The file to write to.
   * @param delay The delay between checking for new chunks to write so the event lop isn't blocked.
   */
  public constructor({ file, delay }: ChunkerOptions) {
    this.file = file;
    this.delay = delay;
  }

  public async addWriter(
    writerFn: (pushFn: DataChunkConsumer) => Promise<void>,
  ): Promise<void> {
    this.currentWriters++;

    const push = (dataChunk: DataChunk) => this.innerQueue.push(dataChunk);
    const finish = () => this.currentWriters--;

    await writerFn(push)
      .then(finish)
      .catch(finish);
  }

  public async save(): Promise<void> {
    // Checks if there is still the potential of new data being written to the chunker.
    while (this.currentWriters > 0 || this.innerQueue.length > 0) {
      // Sleep for the chunker's delay so we don't block the event loop, without this we would just spin here.
      // In the future it might be worth it to find a "best" default delay to maximize throughput.
      await new Promise((resolve) => {
        if (this.delay) {
          setTimeout(resolve, this.delay);
        } else {
          setImmediate(resolve);
        }
      });

      // Deno's event loop literally isn't fast enough to feed all the writers, so the input queue just keeps growing
      // until the writers finish, so this hackily tries to just process multiple data chunks per iteration.
      for (let i = 0; i < 64; i++) {
        const dataChunk = this.innerQueue.shift();

        // Ensure there are chunks in the queue.
        if (!dataChunk) break;

        // TODO: Keep track of the current offset to see if we can get away with not calling seek for a potential
        // performance improvement.
        await this.file.seek(dataChunk.offset, Deno.SeekMode.Start);
        await this.file.write(dataChunk.data);
      }
    }

    // At this point the file should be done writing, so we will just close it.
    this.file.close();
  }
}
