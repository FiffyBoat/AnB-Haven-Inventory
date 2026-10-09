import { describe, it, expect, beforeEach } from "vitest";
import { syncManager } from "./syncManager";
import { localStore } from "./localStore";
import {
  saveSupabaseConfig,
  getStoredSupabaseConfig,
  isSupabaseConfigured,
  clearSupabaseConfig,
} from "./supabaseClient";

if (typeof globalThis.localStorage === "undefined") {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

if (typeof globalThis.sessionStorage === "undefined") {
  const sess = {};
  globalThis.sessionStorage = {
    getItem: (k) => sess[k] ?? null,
    setItem: (k, v) => { sess[k] = String(v); },
    removeItem: (k) => { delete sess[k]; },
    clear: () => { Object.keys(sess).forEach((k) => delete sess[k]); },
  };
}

if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe("Offline Sync Manager & Queue", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    syncManager.queue = [];
    syncManager.saveQueue();
    clearSupabaseConfig();
  });

  it("enqueues an upsert mutation into the offline queue", () => {
    syncManager.enqueue("Product", "prod-1", "UPSERT", { name: "Samsung A15", price: 1800 });
    expect(syncManager.getPendingCount()).toBe(1);
    const item = syncManager.queue[0];
    expect(item.entity).toBe("Product");
    expect(item.recordId).toBe("prod-1");
    expect(item.action).toBe("UPSERT");
    expect(item.payload.name).toBe("Samsung A15");
  });

  it("deduplicates subsequent updates to the same record in the offline queue", () => {
    syncManager.enqueue("Product", "prod-1", "UPSERT", { name: "Samsung A15", price: 1800 });
    syncManager.enqueue("Product", "prod-1", "UPSERT", { name: "Samsung A15", price: 1850 });
    expect(syncManager.getPendingCount()).toBe(1);
    expect(syncManager.queue[0].payload.price).toBe(1850);
  });

  it("enqueues batch mutations correctly", () => {
    syncManager.enqueueBatch([
      { entity: "Product", recordId: "prod-1", action: "UPSERT", payload: { name: "Phone" } },
      { entity: "Sale", recordId: "sale-1", action: "UPSERT", payload: { total: 200 } },
      { entity: "StockMovement", recordId: "sm-1", action: "UPSERT", payload: { qty: -1 } },
    ]);
    expect(syncManager.getPendingCount()).toBe(3);
  });

  it("supports listener subscriptions for sync state changes", () => {
    let capturedState = null;
    const unsubscribe = syncManager.subscribe((state) => {
      capturedState = state;
    });

    expect(capturedState).toBeDefined();
    expect(capturedState.pendingCount).toBe(0);

    syncManager.enqueue("Category", "cat-1", "UPSERT", { name: "Audio" });
    expect(capturedState.pendingCount).toBe(1);

    unsubscribe();
  });

  it("saves and retrieves custom Supabase configuration properly", () => {
    saveSupabaseConfig("https://example.supabase.co", "anon-key-12345");
    expect(isSupabaseConfigured()).toBe(true);
    const config = getStoredSupabaseConfig();
    expect(config.url).toBe("https://example.supabase.co");
    expect(config.anonKey).toBe("anon-key-12345");

    clearSupabaseConfig();
  });

  it("automatically enqueues when localStore creates a product", async () => {
    const initialQueueCount = syncManager.getPendingCount();
    const product = await localStore.entities.Product.create({
      name: "Test Earphones",
      sku: "TEST-EAR-01",
      selling_price: 50,
      cost_price: 30,
      current_stock: 10,
    });

    expect(product.id).toBeDefined();
    expect(syncManager.getPendingCount()).toBeGreaterThan(initialQueueCount);

    const queued = syncManager.queue.find((q) => q.recordId === product.id);
    expect(queued).toBeDefined();
    expect(queued.entity).toBe("Product");
    expect(queued.payload.name).toBe("Test Earphones");
  });

  it("saves daily closing audit with remaining quantities and enqueues for sync", async () => {
    const closingPayload = {
      date: "2026-10-08",
      financials: { sales: 500, cash: 300, momo: 200 },
      cashier_breakdown: [{ name: "Kwame", sales: 500 }],
      items: [
        {
          product_id: "prod-100",
          product_name: "Power Bank 10000mAh",
          expected_remaining: 10,
          actual_remaining: 8,
          variance: -2,
          shortage_value: 290,
          sold_today: 1,
        },
      ],
      total_items_sold: 1,
      total_remaining_stock: 8,
      total_variance_count: 2,
      total_shortage_value: 290,
      notes: "Audited at 8pm closing",
    };

    const res = await localStore.functions.invoke("saveDailyClosingLog", closingPayload);
    expect(res.data.error).toBeUndefined();
    expect(res.data.closing_record).toBeDefined();
    expect(res.data.closing_record.closing_date).toBe("2026-10-08");
    expect(res.data.closing_record.total_remaining_stock).toBe(8);
    expect(res.data.closing_record.total_variance_count).toBe(2);

    const queued = syncManager.queue.find((q) => q.entity === "DailyClosingLog");
    expect(queued).toBeDefined();
    expect(queued.recordId).toBe(res.data.closing_record.id);

    const fetched = await localStore.entities.DailyClosingLog.filter({ closing_date: "2026-10-08" });
    expect(fetched.length).toBe(1);
    expect(fetched[0].items[0].actual_remaining).toBe(8);
  });
});
