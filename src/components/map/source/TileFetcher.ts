export class TileFetcher {
  private active = 0;
  private queue: (() => void)[] = [];
  private MAX = 6;

  constructor(max: number) {
    this.MAX = max;
  }

  private buildTileUrl(url: string, z: number, x: number, y: number): string {
    let replaceUrl = url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
    replaceUrl = replaceUrl.replace("{ratio}", "1").replace("{r}", "");
    return replaceUrl;
  }

  fetch(url: string, z: number, x: number, y: number, cb: (buf: ArrayBuffer) => void) {
    this.queue.push(() => {
      const replaceUrl = this.buildTileUrl(url, z, x, y);
      this.active += 1;
      fetch(replaceUrl)
        .then((r) => r.arrayBuffer())
        .then(cb)
        .finally(() => {
          this.active -= 1;
          this.run();
        });
    });
    this.run();
  }

  private run() {
    if (this.active >= this.MAX) return;
    const job = this.queue.shift();
    job?.();
  }
}
