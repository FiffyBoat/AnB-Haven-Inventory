export const formatGhs = (n) =>
  "GH\u20B5 " +
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatInt = (n) => (Number(n) || 0).toLocaleString();

export const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return (
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
};

export const isToday = (d) => {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export const clientTxId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "tx-" + Date.now() + "-" + Math.random().toString(36).slice(2);