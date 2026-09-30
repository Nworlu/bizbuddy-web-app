import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { customerTotals } from "./finance";
import { diff, opKey, TABLES, type RemoteApi, type RemoteBusiness, type RemoteRow, type Table } from "./sync";
import type { BizData } from "./types";

type Store = typeof import("./store");
type Sync = typeof import("./sync");

beforeAll(() => vi.useFakeTimers({ now: new Date(2026, 8, 30, 12), toFake: ["Date"] }));
afterAll(() => vi.useRealTimers());

// A pretend Supabase: one account's shop, with the server's clock setting updated_at. -----------------

class FakeServer implements RemoteApi {
  business: RemoteBusiness | null = null;
  tables = Object.fromEntries(TABLES.map((t) => [t, new Map<string, RemoteRow>()])) as Record<Table, Map<string, RemoteRow>>;
  down = false;
  private tick = 0;

  private now() {
    this.tick += 1;
    return new Date(Date.UTC(2026, 8, 30, 12, 0, this.tick)).toISOString();
  }
  private check() {
    if (this.down) throw new Error("Failed to fetch");
  }
  async upsertBusiness(row: RemoteBusiness) {
    this.check();
    this.business = { ...row, updated_at: this.now() };
  }
  async getBusiness() {
    this.check();
    return this.business;
  }
  async upsert(table: Table, rows: RemoteRow[]) {
    this.check();
    for (const row of rows) this.tables[table].set(row.id, { ...row, updated_at: this.now() });
  }
  async pullSince(table: Table, since: string | null) {
    this.check();
    return [...this.tables[table].values()].filter((r) => !since || r.updated_at! >= since);
  }
  live(table: Table) {
    return [...this.tables[table].values()].filter((r) => !r.deleted);
  }
}

// Pretend phones: each has its own localStorage and its own copy of the store module. -------------------

async function newPhone() {
  const storage = new Map<string, string>();
  const win = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) },
    addEventListener() {},
    removeEventListener() {},
  };
  vi.stubGlobal("window", win);
  vi.resetModules();
  const store: Store = await import("./store");
  const sync: Sync = await import("./sync");
  /** Everything a phone does must run with its own storage in place. */
  function on<T>(fn: (store: Store) => T): T {
    vi.stubGlobal("window", win);
    return fn(store);
  }
  return {
    on,
    data: () => on((s) => s.syncIO.getData()),
    pending: () => on((s) => Object.keys(s.getSyncMeta()?.outbox ?? {}).length),
    async sync(server: FakeServer) {
      vi.stubGlobal("window", win);
      return sync.syncOnce(server, store.syncIO);
    },
  };
}

const ACCOUNT = { userId: "user-1", phone: "2348031234567" };

async function adaWithAccount(server: FakeServer) {
  const phone = await newPhone();
  phone.on((s) => {
    s.createBusiness({ name: "Ada's Fashion", ownerName: "Ada", phone: "08031234567", type: "Fashion" });
    s.linkShopToAccount(ACCOUNT);
  });
  await phone.sync(server);
  return phone;
}

// Pure pieces ------------------------------------------------------------------------------------------

describe("diff", () => {
  const base: BizData = { version: 1, business: { id: "b1", name: "Shop", ownerName: "Ada", type: "Fashion", createdAt: "x" }, customers: [], sales: [], payments: [], expenses: [] };

  it("finds added, changed, and deleted records", () => {
    const before: BizData = { ...base, customers: [{ id: "c1", name: "David", phone: "", createdAt: "x" }, { id: "c2", name: "Sarah", phone: "", createdAt: "x" }] };
    const after: BizData = { ...base, customers: [{ id: "c1", name: "David O", phone: "", createdAt: "x" }, { id: "c3", name: "Musa", phone: "", createdAt: "x" }] };
    const ops = diff(before, after);
    expect(ops.map((op) => [opKey(op), op.kind === "record" && op.deleted])).toEqual([
      ["customers:c1", false],
      ["customers:c3", false],
      ["customers:c2", true],
    ]);
  });

  it("finds a changed shop, and ignores one without a server id", () => {
    expect(diff(base, { ...base, business: { ...base.business!, name: "New name" } }).map(opKey)).toEqual(["business"]);
    const noId = { ...base.business!, id: undefined };
    expect(diff({ ...base, business: noId }, { ...base, business: { ...noId, name: "x" } })).toEqual([]);
  });

  it("finds nothing when nothing changed", () => {
    expect(diff(base, { ...base })).toEqual([]);
  });
});

// The whole loop, through the real store ------------------------------------------------------------------

describe("backing up a shop", () => {
  it("sends the shop and every record when a phone links to a new account", async () => {
    const server = new FakeServer();
    const phone = await newPhone();
    phone.on((s) => {
      s.createBusiness({ name: "Ada's Fashion", ownerName: "Ada", phone: "", type: "Fashion" });
      s.recordSale({ customerName: "David Okafor", product: "Sneakers", totalAmount: 85000, amountPaid: 50000, method: "Cash", date: "2026-09-28" });
      s.recordExpense({ category: "Stock", amount: 120000, description: "", date: "2026-09-26" });
      // Books kept on the phone before the account existed.
      s.linkShopToAccount(ACCOUNT);
    });
    expect(phone.pending()).toBe(5); // shop, customer, sale, payment, expense
    await phone.sync(server);
    expect(phone.pending()).toBe(0);
    expect(server.business?.name).toBe("Ada's Fashion");
    expect(server.live("sales")).toHaveLength(1);
    expect(server.live("payments")[0]).toMatchObject({ amount: 50000, business_id: server.business!.id });
  });

  it("keeps changes made offline and sends them when the connection returns", async () => {
    const server = new FakeServer();
    const phone = await adaWithAccount(server);
    server.down = true;
    phone.on((s) => s.recordSale({ customerName: "Musa Bello", product: "Kaftan", totalAmount: 40000, amountPaid: 15000, method: "Cash", date: "2026-09-30" }));
    await expect(phone.sync(server)).rejects.toThrow();
    // Still on the phone, still queued, balance still right.
    expect(phone.pending()).toBe(3);
    const musa = phone.data().customers.find((c) => c.name === "Musa Bello")!;
    expect(customerTotals(musa.id, phone.data()).balance).toBe(25000);
    server.down = false;
    await phone.sync(server);
    expect(phone.pending()).toBe(0);
    expect(server.live("sales").map((r) => r.product)).toEqual(["Kaftan"]);
  });

  it("sends only the latest version of a record changed several times offline", async () => {
    const server = new FakeServer();
    const phone = await adaWithAccount(server);
    server.down = true;
    phone.on((s) => {
      const c = s.addCustomer({ name: "Bisi", phone: "" });
      s.updateCustomer({ customerId: c.id, name: "Bisi Adeyemi", phone: "0802 222 3333" });
    });
    expect(phone.pending()).toBe(1);
    server.down = false;
    await phone.sync(server);
    expect(server.live("customers").map((r) => r.name)).toEqual(["Bisi Adeyemi"]);
  });
});

describe("a second phone on the same account", () => {
  it("gets the whole shop when it logs in", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    ada.on((s) => s.recordSale({ customerName: "David Okafor", product: "Sneakers", totalAmount: 85000, amountPaid: 50000, method: "Cash", date: "2026-09-28" }));
    await ada.sync(server);

    const second = await newPhone();
    second.on((s) => s.joinAccount({ ...ACCOUNT, businessId: server.business!.id }));
    await second.sync(server);
    expect(second.data().business?.name).toBe("Ada's Fashion");
    const david = second.data().customers.find((c) => c.name === "David Okafor")!;
    expect(customerTotals(david.id, second.data()).balance).toBe(35000);
    expect(second.pending()).toBe(0); // pulled records aren't queued to be sent back
  });

  it("passes edits and deletes between phones", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    ada.on((s) => s.recordSale({ customerName: "David Okafor", product: "Sneakers", totalAmount: 85000, amountPaid: 0, method: "Cash", date: "2026-09-28" }));
    await ada.sync(server);
    const second = await newPhone();
    second.on((s) => s.joinAccount({ ...ACCOUNT, businessId: server.business!.id }));
    await second.sync(server);

    // The second phone records a payment and deletes an expense-free customer's sale edit.
    const saleId = second.data().sales[0].id;
    second.on((s) => s.recordPayment({ saleId, amount: 30000, method: "POS", date: "2026-09-30" }));
    await second.sync(server);
    await ada.sync(server);
    const david = ada.data().customers.find((c) => c.name === "David Okafor")!;
    expect(customerTotals(david.id, ada.data()).balance).toBe(55000);

    second.on((s) => s.deleteSale(saleId));
    await second.sync(server);
    await ada.sync(server);
    expect(ada.data().sales).toHaveLength(0);
    expect(ada.data().payments).toHaveLength(0);
  });

  it("an offline change reaches the server before the pull, so the pull doesn't undo it", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    ada.on((s) => s.addCustomer({ name: "Chinedu", phone: "" }));
    await ada.sync(server);
    const second = await newPhone();
    second.on((s) => s.joinAccount({ ...ACCOUNT, businessId: server.business!.id }));
    await second.sync(server);
    const id = second.data().customers[0].id;

    // Ada renames offline; meanwhile the second phone renames and syncs.
    server.down = true;
    ada.on((s) => s.updateCustomer({ customerId: id, name: "Chinedu Eze", phone: "" }));
    server.down = false;
    second.on((s) => s.updateCustomer({ customerId: id, name: "Chinedu E.", phone: "" }));
    await second.sync(server);
    // Ada's sync pushes her pending rename first, so hers is the latest; the pull doesn't undo it.
    await ada.sync(server);
    expect(ada.data().customers[0].name).toBe("Chinedu Eze");
    await second.sync(server);
    expect(second.data().customers[0].name).toBe("Chinedu Eze");
  });

  it("the shop's details follow too", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    const second = await newPhone();
    second.on((s) => s.joinAccount({ ...ACCOUNT, businessId: server.business!.id }));
    await second.sync(server);
    second.on((s) => s.updateBusiness({ name: "Ada's Fashion House", ownerName: "Ada", phone: "", type: "Fashion" }));
    await second.sync(server);
    await ada.sync(server);
    expect(ada.data().business?.name).toBe("Ada's Fashion House");
  });
});

describe("never losing books", () => {
  it("won't log in over books that aren't in an account", async () => {
    const phone = await newPhone();
    phone.on((s) => s.createBusiness({ name: "Tunde Gadgets", ownerName: "Tunde", phone: "", type: "Electronics" }));
    expect(() => phone.on((s) => s.joinAccount({ ...ACCOUNT, businessId: "b" }))).toThrow();
    expect(phone.data().business?.name).toBe("Tunde Gadgets");
  });

  it("logging in replaces the sample shop", async () => {
    const phone = await newPhone();
    phone.on((s) => s.loadDemoData());
    phone.on((s) => s.joinAccount({ ...ACCOUNT, businessId: null }));
    expect(phone.data().demo).toBeUndefined();
    expect(phone.data().sales).toHaveLength(0);
  });

  it("the sample shop is never sent, and can't be opened while signed in", async () => {
    const phone = await newPhone();
    phone.on((s) => s.loadDemoData());
    expect(() => phone.on((s) => s.linkShopToAccount(ACCOUNT))).toThrow();
    const server = new FakeServer();
    await adaWithAccount(server);
    const signedIn = await adaWithAccount(server);
    expect(() => signedIn.on((s) => s.loadDemoData())).toThrow();
    expect(() => signedIn.on((s) => s.resetAll())).toThrow();
  });

  it("a record changed while it was being sent stays queued", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    const c = ada.on((s) => s.addCustomer({ name: "Bisi", phone: "" }));
    // Rename the customer in the middle of the upload.
    const upsert = server.upsert.bind(server);
    server.upsert = async (table, rows) => {
      await upsert(table, rows);
      ada.on((s) => s.updateCustomer({ customerId: c.id, name: "Bisi Adeyemi", phone: "" }));
      server.upsert = upsert;
    };
    await ada.sync(server);
    expect(ada.pending()).toBe(1);
    await ada.sync(server);
    expect(server.live("customers").map((r) => r.name)).toEqual(["Bisi Adeyemi"]);
  });

  it("a change made while a pull is in progress isn't overwritten by the pulled copy", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    const c = ada.on((s) => s.addCustomer({ name: "Bisi", phone: "" }));
    await ada.sync(server);
    // The shop owner renames the customer while the pull is on its way back.
    const pullSince = server.pullSince.bind(server);
    let renamed = false;
    server.pullSince = async (table, since) => {
      const rows = await pullSince(table, since);
      if (!renamed) {
        renamed = true;
        ada.on((s) => s.updateCustomer({ customerId: c.id, name: "Bisi Adeyemi", phone: "" }));
      }
      return rows;
    };
    await ada.sync(server);
    expect(ada.data().customers.find((x) => x.id === c.id)?.name).toBe("Bisi Adeyemi");
    expect(ada.pending()).toBe(1);
  });

  it("logging out clears the phone", async () => {
    const server = new FakeServer();
    const ada = await adaWithAccount(server);
    ada.on((s) => s.unlinkPhone());
    expect(ada.data().business).toBeNull();
    expect(ada.on((s) => s.getSyncMeta())).toBeNull();
  });
});
