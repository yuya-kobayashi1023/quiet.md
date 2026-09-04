/**
 * 最小の observable store。
 *
 * architecture.md §7「Global state library を最初から大きく入れすぎない」に従い、
 * React 標準の useSyncExternalStore だけで済ませる。
 */

export type Listener = () => void;

export class Store<T> {
  private state: T;
  private listeners = new Set<Listener>();

  constructor(initial: T) {
    this.state = initial;
  }

  get = (): T => this.state;

  set = (next: T | ((prev: T) => T)): void => {
    const value =
      typeof next === "function" ? (next as (prev: T) => T)(this.state) : next;
    if (Object.is(value, this.state)) return;
    this.state = value;
    for (const listener of this.listeners) listener();
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
