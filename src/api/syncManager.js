import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

const QUEUE_STORAGE_KEY = "anb-sync-queue-v1";
const LAST_PULLED_KEY = "anb-sync-last-pulled-v1";

class SyncManager {
  constructor() {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncError = null;
    this.listeners = new Set();
    this.realtimeChannel = null;
    this.syncDebounceTimer = null;
    this.heartbeatTimer = null;

    // References to local store callbacks (injected by localStore)
    this.applyRemoteSyncCallback = null;
    this.getAllLocalDataCallback = null;

    this.queue = this.loadQueue();

    if (typeof window !== "undefined") {
      this.lastSyncTime = localStorage.getItem("anb-last-sync-time") || null;

      window.addEventListener("online", () => {
        this.isOnline = true;
        this.syncError = null;
        this.notifyListeners();
        this.triggerSync();
        this.setupRealtimeSubscription();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.notifyListeners();
      });

      window.addEventListener("anb_supabase_config_changed", () => {
        this.setupRealtimeSubscription();
        this.triggerSync();
      });

      // Background periodic heartbeat (every 45s when online)
      this.heartbeatTimer = setInterval(() => {
        if (this.isOnline && isSupabaseConfigured() && !this.isSyncing) {
          this.triggerSync();
        }
      }, 45000);

      // Initial setup: start cloud sync immediately on load
      const startSync = () => {
        this.setupRealtimeSubscription();
        if (this.isOnline && isSupabaseConfigured()) {
          this.triggerSync();
        }
      };

      if (typeof document !== "undefined" && document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startSync);
      } else {
        // Run on next tick so store callbacks are registered first
        setTimeout(startSync, 0);
      }
    }
  }

  registerLocalStoreCallbacks({ applyRemoteSync, getAllLocalData }) {
    this.applyRemoteSyncCallback = applyRemoteSync;
    this.getAllLocalDataCallback = getAllLocalData;
  }

  loadQueue() {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveQueue() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn("Failed to persist sync queue to localStorage:", e);
    }
    this.notifyListeners();
  }

  getPendingCount() {
    return this.queue.length;
  }

  getState() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.queue.length,
      lastSyncTime: this.lastSyncTime,
      syncError: this.syncError,
      isConfigured: isSupabaseConfigured(),
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error("Error in sync listener:", err);
      }
    });
  }

  /**
   * Enqueue a single mutation
   * @param {string} entity - Name of entity (Product, Sale, Customer, etc.)
   * @param {string} recordId - Unique ID of the record
   * @param {'UPSERT'|'DELETE'} action - Mutation type
   * @param {object} payload - Record data
   */
  enqueue(entity, recordId, action, payload = null) {
    if (!entity || !recordId) return;

    // Check if an entry for the same (entity, recordId) is already queued
    const existingIndex = this.queue.findIndex(
      (item) => item.entity === entity && item.recordId === recordId
    );

    const queueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entity,
      recordId,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.queue[existingIndex] = queueItem;
    } else {
      this.queue.push(queueItem);
    }

    this.saveQueue();

    // Debounce triggering sync so rapid successive changes (e.g. sale lines) bundle together
    this.debounceSync();
  }

  /**
   * Enqueue multiple mutations at once
   */
  enqueueBatch(items) {
    if (!Array.isArray(items) || items.length === 0) return;

    for (const item of items) {
      const { entity, recordId, action, payload } = item;
      const existingIndex = this.queue.findIndex(
        (q) => q.entity === entity && q.recordId === recordId
      );

      const queueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entity,
        recordId,
        action,
        payload,
        timestamp: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        this.queue[existingIndex] = queueItem;
      } else {
        this.queue.push(queueItem);
      }
    }

    this.saveQueue();
    this.debounceSync();
  }

  debounceSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      if (this.isOnline && isSupabaseConfigured()) {
        this.triggerSync();
      }
    }, 1500);
  }

  /**
   * Triggers a push and pull sync cycle.
   */
  async triggerSync() {
    if (this.isSyncing) return;
    if (!this.isOnline) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    this.isSyncing = true;
    this.syncError = null;
    this.notifyListeners();

    try {
      // Check if this device needs a complete initial download:
      // (e.g. fresh device, no LAST_PULLED_KEY, or local database has no sales while cloud has records)
      const lastPulled = typeof localStorage !== "undefined" ? localStorage.getItem(LAST_PULLED_KEY) : null;
      const localData = this.getAllLocalDataCallback ? this.getAllLocalDataCallback() : null;
      const localHasNoSales = !localData || !localData.Sale || localData.Sale.length === 0;

      if (!lastPulled || localHasNoSales) {
        const { count, error } = await supabase
          .from("anb_sync_records")
          .select("id", { count: "exact", head: true });

        if (!error) {
          if (count > 0) {
            // Cloud has records! Ensure this device downloads everything
            await this.downloadAllCloudData();
            if (this.queue.length > 0) {
              await this.pushQueue(supabase);
            }
            return;
          } else if (count === 0 && !this.lastSyncTime) {
            // Cloud table is empty! Upload local store so Supabase gets populated
            await this.uploadAllLocalDataToCloud();
            return;
          }
        }
      }

      // 1. Push pending local queue mutations to cloud
      await this.pushQueue(supabase);

      // 2. Pull remote changes down to local database
      await this.pullRemote(supabase);

      this.lastSyncTime = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("anb-last-sync-time", this.lastSyncTime);
      }
      this.syncError = null;
    } catch (err) {
      console.warn("Sync cycle encountered error:", err);
      this.syncError = err.message || "Sync failed";
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  async pushQueue(supabase) {
    if (this.queue.length === 0) return;

    // Process in batches of 50
    const batchSize = 50;
    while (this.queue.length > 0) {
      const currentBatch = this.queue.slice(0, batchSize);
      const recordsToUpsert = currentBatch.map((item) => ({
        entity: item.entity,
        id: item.recordId,
        data: item.payload || {},
        updated_date:
          item.payload?.updated_date ||
          item.timestamp ||
          new Date().toISOString(),
        deleted: item.action === "DELETE",
        synced_by: "client",
      }));

      const { error } = await supabase
        .from("anb_sync_records")
        .upsert(recordsToUpsert, { onConflict: "entity,id" });

      if (error) {
        throw new Error(`Push failed: ${error.message}`);
      }

      // Remove the successfully pushed batch
      const processedIds = new Set(currentBatch.map((b) => b.id));
      this.queue = this.queue.filter((item) => !processedIds.has(item.id));
      this.saveQueue();
    }
  }

  async pullRemote(supabase) {
    const lastPulled =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LAST_PULLED_KEY)
        : null;

    let query = supabase
      .from("anb_sync_records")
      .select("entity, id, data, updated_date, deleted")
      .order("updated_date", { ascending: true })
      .limit(500);

    if (lastPulled) {
      query = query.gt("updated_date", lastPulled);
    }

    const { data: remoteRecords, error } = await query;

    if (error) {
      throw new Error(`Pull failed: ${error.message}`);
    }

    if (remoteRecords && remoteRecords.length > 0) {
      if (this.applyRemoteSyncCallback) {
        this.applyRemoteSyncCallback(remoteRecords);
      }

      // Update the watermark to the latest record's updated_date
      const maxUpdated = remoteRecords.reduce((max, r) => {
        return !max || new Date(r.updated_date) > new Date(max)
          ? r.updated_date
          : max;
      }, lastPulled);

      if (maxUpdated && typeof localStorage !== "undefined") {
        localStorage.setItem(LAST_PULLED_KEY, maxUpdated);
      }

      // Broadcast event so UI reloads data
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("anb_data_synced", {
            detail: { count: remoteRecords.length },
          })
        );
      }
    }
  }

  /**
   * Immediately pulls all records for a specific entity (e.g. "User") directly from Supabase
   */
  async pullEntityDirectly(entityName) {
    const supabase = getSupabase();
    if (!supabase || !this.isOnline) return [];

    try {
      const { data: records, error } = await supabase
        .from("anb_sync_records")
        .select("entity, id, data, updated_date, deleted")
        .eq("entity", entityName);

      if (error) {
        console.warn(`Direct pull for ${entityName} failed:`, error.message);
        return [];
      }

      if (records && records.length > 0) {
        if (this.applyRemoteSyncCallback) {
          this.applyRemoteSyncCallback(records);
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("anb_data_synced", {
              detail: { entity: entityName, count: records.length },
            })
          );
        }
      }
      return records || [];
    } catch (err) {
      console.warn(`Direct pull error for ${entityName}:`, err);
      return [];
    }
  }

  /**
   * One-time upload of all existing local database items to Supabase
   */
  async uploadAllLocalDataToCloud() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured yet.");
    if (!this.getAllLocalDataCallback) throw new Error("Store is not ready.");

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const allData = this.getAllLocalDataCallback();
      const records = [];

      for (const [entityName, items] of Object.entries(allData)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item?.id) continue;
          records.push({
            entity: entityName,
            id: item.id,
            data: item,
            updated_date:
              item.updated_date || item.created_date || new Date().toISOString(),
            deleted: false,
            synced_by: "initial-upload",
          });
        }
      }

      // Push in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("anb_sync_records")
          .upsert(chunk, { onConflict: "entity,id" });

        if (error) throw new Error(`Upload error: ${error.message}`);
      }

      // Clear the queue since everything was pushed
      this.queue = [];
      this.saveQueue();
      this.lastSyncTime = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("anb-last-sync-time", this.lastSyncTime);
        localStorage.setItem(LAST_PULLED_KEY, this.lastSyncTime);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("anb_data_synced", {
            detail: { count: records.length },
          })
        );
      }

      return { totalUploaded: records.length };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Download all cloud data down to local database
   */
  async downloadAllCloudData() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured yet.");
    if (!this.applyRemoteSyncCallback) throw new Error("Store is not ready.");

    this.isSyncing = true;
    this.notifyListeners();

    try {
      let allRecords = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("anb_sync_records")
          .select("entity, id, data, updated_date, deleted")
          .range(from, from + pageSize - 1);

        if (error) throw new Error(`Download error: ${error.message}`);
        if (data && data.length > 0) {
          allRecords.push(...data);
          from += data.length;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (allRecords.length > 0) {
        this.applyRemoteSyncCallback(allRecords);

        // If this device was fresh without any local sales, clear any phantom queue items
        if (this.queue.length > 0) {
          const localData = this.getAllLocalDataCallback ? this.getAllLocalDataCallback() : null;
          const hasNoLocalSales = !localData || !localData.Sale || localData.Sale.length === 0;
          if (hasNoLocalSales) {
            this.queue = [];
            this.saveQueue();
          }
        }

        const maxUpdated = allRecords.reduce((max, r) => {
          return !max || new Date(r.updated_date) > new Date(max)
            ? r.updated_date
            : max;
        }, null);

        if (maxUpdated && typeof localStorage !== "undefined") {
          localStorage.setItem(LAST_PULLED_KEY, maxUpdated);
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("anb_data_synced", {
              detail: { count: allRecords.length },
            })
          );
        }
      }

      this.lastSyncTime = new Date().toISOString();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("anb-last-sync-time", this.lastSyncTime);
      }

      return { totalDownloaded: allRecords.length };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  setupRealtimeSubscription() {
    const supabase = getSupabase();
    if (!supabase) {
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
        this.realtimeChannel = null;
      }
      return;
    }

    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }

    try {
      this.realtimeChannel = supabase
        .channel("anb_sync_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "anb_sync_records" },
          (payload) => {
            const record = payload.new || payload.old;
            if (!record) return;

            // Apply incoming change locally
            if (this.applyRemoteSyncCallback) {
              this.applyRemoteSyncCallback([
                {
                  entity: record.entity,
                  id: record.id,
                  data: record.data,
                  updated_date: record.updated_date,
                  deleted: record.deleted,
                },
              ]);
            }

            // Fire event so open pages update
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("anb_data_synced", {
                  detail: { entity: record.entity, id: record.id },
                })
              );
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Could not establish Supabase Realtime channel:", err);
    }
  }
}

export const syncManager = new SyncManager();
