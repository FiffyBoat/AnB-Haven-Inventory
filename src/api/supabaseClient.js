import { createClient } from "@supabase/supabase-js";

const CONFIG_STORAGE_KEY = "anb_supabase_config_v1";

// Helper to read stored config or fallback to Vite environment variables or URL parameters
export function getStoredSupabaseConfig() {
  if (typeof window === "undefined") {
    return {
      url: import.meta.env?.VITE_SUPABASE_URL || "",
      anonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || "",
    };
  }

  // 1. Check if configuration was passed in URL query parameters (Magic Connect Link)
  try {
    if (window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("sync_url") || params.get("supabase_url");
      const keyParam = params.get("sync_key") || params.get("supabase_key");
      if (urlParam && keyParam) {
        const cleanUrl = urlParam.trim().replace(/\/+$/, "");
        const cleanKey = keyParam.trim();
        localStorage.setItem(
          CONFIG_STORAGE_KEY,
          JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
        );

        // Clean the URL query parameters from browser address bar
        if (window.history?.replaceState && window.location?.pathname) {
          const cleanLocation = window.location.pathname + (window.location.hash || "");
          window.history.replaceState({}, document.title, cleanLocation);
        }

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("anb_supabase_config_changed"));
        }, 100);

        return { url: cleanUrl, anonKey: cleanKey };
      }
    }
  } catch (e) {
    console.warn("Could not parse URL sync parameters:", e);
  }

  // 2. Check local storage
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.url && parsed?.anonKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to parse stored Supabase config:", e);
  }

  // 3. Fallback to Vite environment variables
  return {
    url: (import.meta.env?.VITE_SUPABASE_URL || "").trim(),
    anonKey: (import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim(),
  };
}

export function saveSupabaseConfig(url, anonKey) {
  const cleanUrl = String(url || "").trim().replace(/\/+$/, "");
  const cleanKey = String(anonKey || "").trim();

  if (typeof window !== "undefined") {
    if (!cleanUrl && !cleanKey) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } else {
      localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
      );
    }
  }

  // Reset client instance
  clientInstance = null;
  window.dispatchEvent(new CustomEvent("anb_supabase_config_changed"));
}

export function clearSupabaseConfig() {
  saveSupabaseConfig("", "");
}

let clientInstance = null;

export function getSupabase() {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) return null;

  if (!clientInstance) {
    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error("Error initializing Supabase client:", err);
      clientInstance = null;
    }
  }
  return clientInstance;
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey);
}

/**
 * Returns a magic shareable link that automatically configures Supabase on another phone/laptop
 */
export function getMobileConnectLink() {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey || typeof window === "undefined") return "";
  const base = window.location.origin + window.location.pathname;
  return `${base}?sync_url=${encodeURIComponent(url)}&sync_key=${encodeURIComponent(anonKey)}`;
}

/**
 * Tests connection to Supabase and verifies if `anb_sync_records` table exists and counts rows.
 */
export async function testSupabaseConnection() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: "Supabase URL and Anon Key are not configured yet.",
    };
  }

  try {
    const { count, error } = await supabase
      .from("anb_sync_records")
      .select("id", { count: "exact", head: true });

    if (error) {
      // Check if table missing
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return {
          success: false,
          tableMissing: true,
          error: "Connected to Supabase, but the `anb_sync_records` table does not exist yet. Please run the SQL setup script.",
        };
      }
      return {
        success: false,
        error: error.message || "Failed to query Supabase.",
      };
    }

    return { success: true, count: count ?? 0 };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Network error while connecting to Supabase.",
    };
  }
}

export const SUPABASE_SQL_SETUP_SCRIPT = `-- A N B Haven Ventures Inventory & POS Cloud Sync Table
-- Run this in your Supabase Project -> SQL Editor

CREATE TABLE IF NOT EXISTS public.anb_sync_records (
  entity text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_date timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false,
  synced_by text DEFAULT NULL,
  PRIMARY KEY (entity, id)
);

-- Index for speedy incremental sync by entity and timestamp
CREATE INDEX IF NOT EXISTS idx_anb_sync_records_entity_updated 
  ON public.anb_sync_records (entity, updated_date);

-- Disable Row Level Security (RLS) so that the shop and remote devices can sync with the public Anon Key
ALTER TABLE public.anb_sync_records DISABLE ROW LEVEL SECURITY;

-- Grant table access to anon and authenticated roles
GRANT ALL ON TABLE public.anb_sync_records TO anon;
GRANT ALL ON TABLE public.anb_sync_records TO authenticated;
GRANT ALL ON TABLE public.anb_sync_records TO service_role;

-- Enable Supabase Realtime for instant multi-device live sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'anb_sync_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anb_sync_records;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
`;
