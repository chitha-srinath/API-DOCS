/** A single-value cache keyed on a structural fingerprint of the app. */
export class SpecCache<T> {
  private key: unknown = undefined;
  private value: T | undefined = undefined;

  get(key: unknown, build: () => T): T {
    if (this.value === undefined || this.key !== key) {
      this.value = build();
      this.key = key;
    }
    return this.value;
  }

  invalidate(): void {
    this.value = undefined;
    this.key = undefined;
  }
}
