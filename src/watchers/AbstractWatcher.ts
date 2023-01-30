export default abstract class AbstractWatcher {
    protected watchList: any[];
    protected intervalId: any;

    public constructor() {
        this.watchList = [];
    }

    protected getElapsedTimeMins(d1: Date, d2: Date): number {
        const diff = d1.getTime() - d2.getTime();

        return Math.floor(diff / 1000 / 60);
    }

    public abstract watch(param: unknown): void;

    public unwatch() {
        if (this.watchList.length > 0) return;

        clearInterval(this.intervalId);
        this.intervalId = null;
    }
}
