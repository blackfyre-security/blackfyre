// REAL IMPL (BLACKFYRE 2026-06): in-memory, ioredis-API-compatible fallback store.
//
// Used by plugins/redis.ts ONLY when no distributed Redis is configured (REDIS_URL unset
// or the default localhost). It keeps the Redis-backed controls — rate limiter, SSO state,
// password-reset jti, webhook dedupe, SCIM token cache, SSE caps — FUNCTIONAL on a single
// instance instead of fail-closing (503) when there is no Redis to reach.
//
// Trade-off (documented on purpose): state is per-process. Under multiple concurrent Lambda
// instances these controls are per-instance (limits looser, dedupe/SSO-state correct only on
// the instance that wrote them) — degraded, NOT broken. Provision Redis + set REDIS_URL to
// get the strict, distributed, fail-closed behaviour back. The instant REDIS_URL points at a
// real store, plugins/redis.ts uses ioredis and this shim is never instantiated.
//
// Only the methods the codebase actually calls are implemented (verified by grep):
//   get, set (EX/PX/NX/XX), del, incr, decr, expire, ttl, pttl, exists, ping, quit, on.

interface Entry {
  value: string;
  expireAt: number | null; // epoch ms, or null for no expiry
}

export class InMemoryRedis {
  private store = new Map<string, Entry>();

  /** Return the live entry, lazily evicting it if its TTL has passed. */
  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expireAt !== null && e.expireAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async get(key: string): Promise<string | null> {
    const e = this.live(key);
    return e ? e.value : null;
  }

  // ioredis-style variadic set: set(key, value, "EX", sec | "PX", ms, "NX" | "XX")
  async set(key: string, value: unknown, ...args: unknown[]): Promise<"OK" | null> {
    let expireAt: number | null = null;
    let nx = false;
    let xx = false;
    for (let i = 0; i < args.length; i++) {
      const flag = String(args[i]).toUpperCase();
      if (flag === "EX") expireAt = Date.now() + Number(args[++i]) * 1000;
      else if (flag === "PX") expireAt = Date.now() + Number(args[++i]);
      else if (flag === "NX") nx = true;
      else if (flag === "XX") xx = true;
    }
    const exists = this.live(key) !== undefined;
    if (nx && exists) return null; // SET NX fails when the key already exists
    if (xx && !exists) return null; // SET XX fails when the key is absent
    this.store.set(key, { value: String(value), expireAt });
    return "OK";
  }

  async del(...keys: Array<string | string[]>): Promise<number> {
    let n = 0;
    for (const k of keys.flat()) if (this.store.delete(k)) n++;
    return n;
  }

  async incr(key: string): Promise<number> {
    const e = this.live(key);
    const next = (e ? parseInt(e.value, 10) || 0 : 0) + 1;
    this.store.set(key, { value: String(next), expireAt: e ? e.expireAt : null });
    return next;
  }

  async decr(key: string): Promise<number> {
    const e = this.live(key);
    const next = (e ? parseInt(e.value, 10) || 0 : 0) - 1;
    this.store.set(key, { value: String(next), expireAt: e ? e.expireAt : null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const e = this.live(key);
    if (!e) return 0;
    e.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const e = this.live(key);
    if (!e) return -2; // key does not exist
    if (e.expireAt === null) return -1; // exists, no TTL
    return Math.max(0, Math.ceil((e.expireAt - Date.now()) / 1000));
  }

  async pttl(key: string): Promise<number> {
    const e = this.live(key);
    if (!e) return -2;
    if (e.expireAt === null) return -1;
    return Math.max(0, e.expireAt - Date.now());
  }

  async exists(...keys: Array<string | string[]>): Promise<number> {
    let n = 0;
    for (const k of keys.flat()) if (this.live(k)) n++;
    return n;
  }

  async ping(): Promise<"PONG"> {
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    this.store.clear();
    return "OK";
  }

  disconnect(): void {
    this.store.clear();
  }

  // ioredis is an EventEmitter; the shim never emits connection events, so this is a no-op.
  on(): this {
    return this;
  }
}
