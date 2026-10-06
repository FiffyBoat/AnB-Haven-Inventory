const STORAGE_KEY = "anb-inventory-local-data-v1";
const SESSION_KEY = "anb-inventory-local-session-v1";
const BACKUP_FORMAT = "anb-inventory-backup";
const BACKUP_VERSION = 1;

const entityNames = [
  "Category", "CreditTransaction", "Customer", "MarketTrend", "Product", "ProductUnit",
  "Purchase", "PurchaseOrder", "Sale", "SaleReturn", "StockMovement", "Supplier", "User",
];

const now = () => new Date().toISOString();
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const id = () => crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const passwordHash = (password) => {
  let hash = 2166136261;
  for (const character of String(password)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

function emptyData() {
  return Object.fromEntries(entityNames.map((name) => [name, []]));
}

function seedStarterCatalog(data) {
  if (data.sample_catalog_seeded || data.Product.length > 0) return false;
  const catalog = [
    ["Samsung Galaxy A15 128GB", "ANB-SAM-A15", "Smartphones", "Samsung", "Galaxy A15", 1650, 1899, 6, 3, true],
    ["Samsung Galaxy A05 64GB", "ANB-SAM-A05", "Smartphones", "Samsung", "Galaxy A05", 1050, 1249, 8, 3, true],
    ["iPhone 13 128GB", "ANB-APP-IP13", "Smartphones", "Apple", "iPhone 13", 4400, 4950, 3, 2, true],
    ["Tecno Spark 20 128GB", "ANB-TEC-SP20", "Smartphones", "Tecno", "Spark 20", 1200, 1420, 7, 3, true],
    ["Infinix Hot 40i 128GB", "ANB-INF-H40I", "Smartphones", "Infinix", "Hot 40i", 1180, 1390, 6, 3, true],
    ["Oraimo FreePods 4", "ANB-ORA-FP4", "Audio", "Oraimo", "FreePods 4", 165, 220, 12, 5, false],
    ["Oraimo 20W Fast Charger", "ANB-ORA-20W", "Chargers", "Oraimo", "20W", 55, 80, 18, 8, false],
    ["Type-C Fast Charging Cable", "ANB-CAB-TYPEC", "Cables", "Generic", "Type-C", 15, 30, 25, 10, false],
    ["iPhone Lightning Cable", "ANB-CAB-LTG", "Cables", "Generic", "Lightning", 20, 40, 20, 10, false],
    ["Samsung A15 Clear Case", "ANB-CS-A15", "Phone Cases", "Generic", "Samsung A15", 12, 30, 15, 8, false],
    ["Power Bank 10000mAh", "ANB-PB-10K", "Power Banks", "Oraimo", "10000mAh", 105, 145, 10, 5, false],
    ["Wireless Bluetooth Speaker", "ANB-SPK-BT", "Audio", "Oraimo", "Bluetooth", 85, 125, 8, 4, false],
  ];
  const categories = [...new Set(catalog.map((item) => item[2]))];
  data.Category.push(...categories.map((name) => ({ id: id(), name, status: "active", created_date: now(), updated_date: now() })));
  data.Product.push(...catalog.map(([name, sku, category, brand, model, cost, price, stock, reorder, trackImei]) => ({
    id: id(), created_date: now(), updated_date: now(), name, sku, barcode: "", category, brand, model,
    description: `${brand} ${model}`, image_url: "", cost_price: cost, selling_price: price,
    current_stock: stock, reorder_level: reorder, track_imei: trackImei, track_serial: false, status: "active",
  })));
  data.sample_catalog_seeded = true;
  return true;
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      const data = { ...emptyData(), ...parsed };
      const owner = data.User.find((user) => user.id === "local-owner");
      if (owner && !owner.username) {
        Object.assign(owner, {
          username: "owner", password_hash: passwordHash("change-me"),
          must_change_password: true, password_reset_requested: false, updated_date: now(),
        });
        save(data);
      }
      if (seedStarterCatalog(data)) save(data);
      return data;
    }
  } catch {
    // Start clean when old browser data is corrupt.
  }
  const initial = emptyData();
  initial.User = [{
    id: "local-owner", username: "owner", full_name: "Business Owner", role: "admin",
    password_hash: passwordHash("change-me"), must_change_password: true,
    password_reset_requested: false, created_date: now(), updated_date: now(),
  }];
  seedStarterCatalog(initial);
  save(initial);
  return initial;
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clone(value) {
  return structuredClone(value);
}

function matches(item, filter = {}) {
  return Object.entries(filter).every(([key, value]) => item[key] === value);
}

function list(name, order, limit) {
  const values = clone(load()[name] || []);
  if (order) {
    const descending = order.startsWith("-");
    const key = descending ? order.slice(1) : order;
    values.sort((a, b) => {
      const left = a[key] ?? "";
      const right = b[key] ?? "";
      return (left > right ? 1 : left < right ? -1 : 0) * (descending ? -1 : 1);
    });
  }
  return Promise.resolve(limit ? values.slice(0, limit) : values);
}

function create(name, fields) {
  const data = load();
  const item = { id: id(), created_date: now(), updated_date: now(), ...clone(fields) };
  data[name].push(item);
  save(data);
  return Promise.resolve(clone(item));
}

function update(name, itemId, fields) {
  const data = load();
  const index = data[name].findIndex((item) => item.id === itemId);
  if (index < 0) return Promise.reject(new Error(`${name} not found`));
  data[name][index] = { ...data[name][index], ...clone(fields), updated_date: now() };
  save(data);
  return Promise.resolve(clone(data[name][index]));
}

function remove(name, itemId) {
  const data = load();
  data[name] = data[name].filter((item) => item.id !== itemId);
  save(data);
  return Promise.resolve();
}

function entity(name) {
  return {
    list: (order, limit) => list(name, order, limit),
    get: async (itemId) => {
      const item = load()[name].find((entry) => entry.id === itemId);
      if (!item) throw new Error(`${name} not found`);
      return clone(item);
    },
    filter: async (filter) => clone(load()[name].filter((item) => matches(item, filter))),
    create: (fields) => create(name, fields),
    update: (itemId, fields) => update(name, itemId, fields),
    delete: (itemId) => remove(name, itemId),
    bulkUpdate: async (updates) => Promise.all(updates.map(({ id: itemId, ...fields }) => update(name, itemId, fields))),
  };
}

function applyStockChange(data, product, delta, movementType, reference = {}, notes = "") {
  const previous = Number(product.current_stock) || 0;
  const next = previous + delta;
  if (next < 0) throw new Error(`Insufficient stock for ${product.name} (available: ${previous})`);
  product.current_stock = next;
  product.updated_date = now();
  data.StockMovement.push({
    id: id(), created_date: now(), updated_date: now(), product_id: product.id, product_name: product.name,
    movement_type: movementType, quantity: delta, previous_quantity: previous, new_quantity: next,
    reference_type: reference.type || "", reference_id: reference.id || "", notes,
    created_by_name: currentUser()?.full_name || "Unknown user",
  });
}

function currentUser() {
  const userId = sessionStorage.getItem(SESSION_KEY);
  const user = load().User.find((item) => item.id === userId);
  return user && user.status !== "inactive" ? clone(user) : null;
}

function requireOwner() {
  if (currentUser()?.role !== "admin") throw new Error("Only the owner can perform this action");
}

function validateBackup(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !backup.data || typeof backup.data !== "object") {
    throw new Error("This is not a valid A N B Inventory backup file");
  }
  for (const name of entityNames) {
    if (!Array.isArray(backup.data[name])) throw new Error(`Backup is missing ${name} records`);
  }
  if (!backup.data.User.some((user) => user.role === "admin" && user.status !== "inactive")) {
    throw new Error("Backup must contain an active owner account");
  }
}

function createSale(body) {
  const data = load();
  const user = currentUser();
  if (!user) throw new Error("Sign in to complete a sale");
  const inputs = Array.isArray(body.items) ? body.items : [];
  if (!inputs.length) throw new Error("Cart is empty");
  if (body.client_transaction_id) {
    const existing = data.Sale.find((sale) => sale.client_transaction_id === body.client_transaction_id);
    if (existing) return { sale: clone(existing), duplicate: true };
  }
  const lines = inputs.map((input) => {
    const product = data.Product.find((item) => item.id === input.product_id);
    const quantity = Math.floor(Number(input.quantity) || 0);
    if (!product || product.status !== "active") throw new Error("Product not found or inactive");
    if (quantity <= 0 || (Number(product.current_stock) || 0) < quantity) throw new Error(`Insufficient stock for ${product.name}`);
    const units = (input.unit_ids || []).map((unitId) => data.ProductUnit.find((unit) => unit.id === unitId));
    if ((product.track_imei || product.track_serial) && (units.length !== quantity || units.some((unit) => !unit || unit.product_id !== product.id || unit.status !== "IN_STOCK"))) {
      throw new Error(`Select ${quantity} available unit(s) for ${product.name}`);
    }
    const unitPrice = round2(product.selling_price);
    const discount = Math.min(Math.max(0, round2(input.discount)), unitPrice * quantity);
    return { product, quantity, units, unit_price: unitPrice, unit_cost: round2(product.cost_price), discount, total: round2(unitPrice * quantity - discount) };
  });
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0));
  const lineDiscounts = round2(lines.reduce((sum, line) => sum + line.discount, 0));
  const saleDiscount = Math.min(Math.max(0, round2(body.sale_discount)), subtotal - lineDiscounts);
  const total = round2(subtotal - lineDiscounts - saleDiscount);
  const payments = (Array.isArray(body.payments) ? body.payments : []).map((payment) => ({ method: String(payment.method || "CASH"), amount: round2(payment.amount), provider: payment.provider || "", reference: payment.reference || "" })).filter((payment) => payment.amount > 0);
  const amountPaid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (amountPaid > total) throw new Error("Amount paid cannot exceed the sale total");
  const creditAmount = round2(total - amountPaid);
  const customer = body.customer_id ? data.Customer.find((item) => item.id === body.customer_id) : null;
  if (creditAmount && !customer) throw new Error("Credit sale requires a customer");
  if (customer && customer.credit_limit > 0 && round2(customer.current_balance) + creditAmount > customer.credit_limit) throw new Error("Customer credit limit exceeded");
  const sale = {
    id: id(), created_date: now(), updated_date: now(), sale_number: `INV-${Date.now().toString(36).toUpperCase()}`,
    client_transaction_id: body.client_transaction_id || "", customer_id: customer?.id || "", customer_name: customer?.name || "Walk-in Customer",
    cashier_id: user.id, cashier_name: user.full_name || user.email, subtotal, discount: saleDiscount, total, amount_paid: amountPaid, credit_amount: creditAmount, payments, status: "COMPLETED",
    items: lines.map((line) => ({ product_id: line.product.id, product_name: line.product.name, unit_id: line.units.length === 1 ? line.units[0].id : "", identifier: line.units.map((unit) => unit.imei_1 || unit.serial_number).join(", "), quantity: line.quantity, unit_price: line.unit_price, unit_cost: line.unit_cost, discount: line.discount, total: line.total })),
  };
  lines.forEach((line) => {
    applyStockChange(data, line.product, -line.quantity, "SALE", { type: "SALE", id: sale.id }, `Sale ${sale.sale_number}`);
    line.units.forEach((unit) => { unit.status = "SOLD"; unit.sale_id = sale.id; unit.updated_date = now(); });
  });
  if (creditAmount) {
    customer.current_balance = round2(customer.current_balance) + creditAmount;
    customer.updated_date = now();
    data.CreditTransaction.push({ id: id(), created_date: now(), updated_date: now(), customer_id: customer.id, customer_name: customer.name, transaction_type: "CREDIT_SALE", amount: creditAmount, balance_after: customer.current_balance, sale_id: sale.id, description: `Credit from sale ${sale.sale_number}`, created_by_name: user.full_name });
  }
  data.Sale.push(sale);
  save(data);
  return { sale: clone(sale) };
}

function createPurchase(body) {
  requireOwner();
  const data = load();
  const supplier = data.Supplier.find((item) => item.id === body.supplier_id);
  const inputs = Array.isArray(body.items) ? body.items : [];
  if (!supplier || !inputs.length) throw new Error("Select a supplier and at least one product");
  const purchaseNumber = `PUR-${Date.now().toString(36).toUpperCase()}`;
  const items = inputs.map((input) => {
    const product = data.Product.find((item) => item.id === input.product_id);
    const quantity = Math.floor(Number(input.quantity) || 0);
    const unitCost = round2(input.unit_cost);
    const identifiers = (input.unit_identifiers || []).map((value) => String(value).trim()).filter(Boolean);
    if (!product || quantity <= 0 || unitCost < 0) throw new Error("Invalid purchase item");
    if ((product.track_imei || product.track_serial) && identifiers.length !== quantity) throw new Error(`Enter ${quantity} IMEI/serial values for ${product.name}`);
    identifiers.forEach((identifier) => {
      if (data.ProductUnit.some((unit) => unit.imei_1 === identifier || unit.serial_number === identifier)) throw new Error(`${identifier} is already registered`);
    });
    applyStockChange(data, product, quantity, "PURCHASE", { type: "PURCHASE", id: purchaseNumber }, `Purchase ${purchaseNumber} from ${supplier.name}`);
    if (unitCost > 0) product.cost_price = unitCost;
    identifiers.forEach((identifier) => data.ProductUnit.push({ id: id(), created_date: now(), updated_date: now(), product_id: product.id, product_name: product.name, imei_1: product.track_imei ? identifier : "", serial_number: product.track_serial ? identifier : "", status: "IN_STOCK" }));
    return { product_id: product.id, product_name: product.name, quantity, unit_cost: unitCost, total_cost: round2(quantity * unitCost), unit_identifiers: identifiers };
  });
  const purchase = { id: id(), created_date: now(), updated_date: now(), purchase_number: purchaseNumber, supplier_id: supplier.id, supplier_name: supplier.name, items, total: round2(items.reduce((sum, item) => sum + item.total_cost, 0)), payment_status: ["PAID", "PARTIAL", "UNPAID"].includes(body.payment_status) ? body.payment_status : "UNPAID", notes: body.notes || "", created_by_name: currentUser()?.full_name || "Unknown user" };
  data.Purchase.push(purchase);
  save(data);
  return { purchase: clone(purchase) };
}

function adjustStock(body) {
  requireOwner();
  const data = load();
  const product = data.Product.find((item) => item.id === body.product_id);
  const delta = Math.floor(Number(body.delta) || 0);
  if (!product || !delta) throw new Error("Select a product and a non-zero adjustment");
  const allowed = ["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "LOST", "OPENING_STOCK"];
  applyStockChange(data, product, delta, allowed.includes(body.reason) ? body.reason : delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", { type: "ADJUSTMENT" }, body.notes || "");
  save(data);
  return { product_id: product.id, new_quantity: product.current_stock };
}

function reconcileStockCount(body) {
  requireOwner();
  const data = load();
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const notes = String(body.notes || "Physical stock count").trim();
  if (!entries.length) throw new Error("Enter at least one physical stock count");
  const changes = entries.map((entry) => {
    const product = data.Product.find((item) => item.id === entry.product_id);
    const counted = Math.floor(Number(entry.counted_quantity));
    const expected = Math.floor(Number(entry.expected_quantity));
    if (!product || product.status !== "active" || product.track_imei || product.track_serial) throw new Error("One or more products cannot be reconciled by quantity");
    if (!Number.isInteger(counted) || counted < 0) throw new Error(`Enter a valid count for ${product.name}`);
    if ((Number(product.current_stock) || 0) !== expected) throw new Error(`${product.name} changed while this count was open. Refresh and recount it.`);
    return { product, counted, delta: counted - expected };
  });
  const adjusted = changes.filter((change) => change.delta !== 0);
  if (!adjusted.length) return { adjusted: 0 };
  adjusted.forEach((change) => applyStockChange(data, change.product, change.delta, change.delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", { type: "STOCK_COUNT", id: "" }, notes));
  save(data);
  return { adjusted: adjusted.length };
}

function recordCreditPayment(body) {
  const data = load();
  const customer = data.Customer.find((item) => item.id === body.customer_id);
  const amount = round2(body.amount);
  if (!customer || amount <= 0) throw new Error("Enter a valid customer and payment amount");
  const balance = round2(customer.current_balance);
  if (amount > balance) throw new Error("Payment cannot exceed the outstanding balance");
  customer.current_balance = round2(balance - amount);
  customer.updated_date = now();
  data.CreditTransaction.push({ id: id(), created_date: now(), updated_date: now(), customer_id: customer.id, customer_name: customer.name, transaction_type: "CREDIT_PAYMENT", amount, balance_after: customer.current_balance, description: body.description || "Credit repayment", created_by_name: currentUser()?.full_name || "Unknown user" });
  save(data);
  return { customer_id: customer.id, balance: customer.current_balance };
}

function returnSale(body) {
  requireOwner();
  const data = load();
  const sale = data.Sale.find((item) => item.id === body.sale_id);
  const selections = Array.isArray(body.items) ? body.items : [];
  const reason = String(body.reason || "").trim();
  if (!sale || sale.status !== "COMPLETED") throw new Error("Completed sale not found");
  if (!reason) throw new Error("Enter a reason for the return");
  const lines = selections.map((selection) => {
    const index = Number(selection.item_index);
    const item = sale.items?.[index];
    const quantity = Math.floor(Number(selection.quantity) || 0);
    const available = (Number(item?.quantity) || 0) - (Number(item?.returned_quantity) || 0);
    if (!item || quantity <= 0 || quantity > available) throw new Error("Return quantity exceeds the quantity sold");
    return { index, item, quantity, lineTotal: (Number(item.total) || 0) * quantity / (Number(item.quantity) || 1) };
  });
  if (!lines.length) throw new Error("Select at least one item to return");
  const totalLineValue = (sale.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const requestedValue = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const refundedBefore = data.SaleReturn.filter((entry) => entry.sale_id === sale.id).reduce((sum, entry) => sum + (Number(entry.refund_amount) || 0), 0);
  const refundAmount = Math.min(round2(requestedValue * ((Number(sale.total) || 0) / (totalLineValue || 1))), round2((Number(sale.total) || 0) - refundedBefore));
  if (refundAmount <= 0) throw new Error("This sale has already been fully refunded");
  const refundMethod = ["CASH", "MOBILE_MONEY", "CREDIT_BALANCE"].includes(body.refund_method) ? body.refund_method : "CASH";
  const returnRecord = { id: id(), created_date: now(), updated_date: now(), sale_id: sale.id, sale_number: sale.sale_number, customer_id: sale.customer_id || "", customer_name: sale.customer_name || "Walk-in Customer", refund_amount: refundAmount, refund_method: refundMethod, reason, restock: body.restock !== false, approved_by_name: currentUser()?.full_name || "Owner", items: [] };
  if (refundMethod === "CREDIT_BALANCE") {
    const customer = data.Customer.find((item) => item.id === sale.customer_id);
    if (!customer || (Number(customer.current_balance) || 0) < refundAmount) throw new Error("Customer balance is too low for a credit-balance refund");
    customer.current_balance = round2(customer.current_balance - refundAmount);
    customer.updated_date = now();
    data.CreditTransaction.push({ id: id(), created_date: now(), updated_date: now(), customer_id: customer.id, customer_name: customer.name, transaction_type: "CREDIT_ADJUSTMENT", amount: refundAmount, balance_after: customer.current_balance, sale_id: sale.id, description: `Return against sale ${sale.sale_number}`, created_by_name: currentUser()?.full_name || "Owner" });
  }
  for (const line of lines) {
    line.item.returned_quantity = (Number(line.item.returned_quantity) || 0) + line.quantity;
    const product = data.Product.find((item) => item.id === line.item.product_id);
    if (body.restock !== false && product) {
      applyStockChange(data, product, line.quantity, "SALE_RETURN", { type: "SALE_RETURN", id: returnRecord.id }, `Return ${returnRecord.id}: ${reason}`);
      if (line.item.unit_id) {
        const unit = data.ProductUnit.find((item) => item.id === line.item.unit_id);
        if (unit) { unit.status = "IN_STOCK"; unit.sale_id = ""; unit.updated_date = now(); }
      }
    } else if (line.item.unit_id) {
      const unit = data.ProductUnit.find((item) => item.id === line.item.unit_id);
      if (unit) { unit.status = "RETURNED"; unit.updated_date = now(); }
    }
    returnRecord.items.push({ sale_item_index: line.index, product_id: line.item.product_id, product_name: line.item.product_name, quantity: line.quantity, refund_amount: round2(line.lineTotal * ((Number(sale.total) || 0) / (totalLineValue || 1))) });
  }
  sale.returned_amount = round2((Number(sale.returned_amount) || 0) + refundAmount);
  sale.updated_date = now();
  data.SaleReturn.push(returnRecord);
  save(data);
  return { return_record: clone(returnRecord) };
}

const functions = { createSale, createPurchase, adjustStock, reconcileStockCount, recordCreditPayment, returnSale };

export const localStore = {
  entities: Object.fromEntries(entityNames.map((name) => [name, entity(name)])),
  functions: { invoke: async (name, body) => {
    try {
      if (!functions[name]) throw new Error(`Unknown local function: ${name}`);
      return { data: functions[name](body) };
    } catch (error) {
      return { data: { error: error.message } };
    }
  } },
  users: {
    createAccount: async ({ full_name, username, password, role }) => {
      requireOwner();
      const cleanUsername = String(username || "").trim().toLowerCase();
      if (!full_name?.trim() || !cleanUsername || String(password).length < 6) throw new Error("Enter a name, username, and a password of at least 6 characters");
      const data = load();
      if (data.User.some((user) => user.username?.toLowerCase() === cleanUsername)) throw new Error("That username is already in use");
      const user = { id: id(), created_date: now(), updated_date: now(), full_name: full_name.trim(), username: cleanUsername, role: role === "admin" ? "admin" : "user", status: "active", password_hash: passwordHash(password), must_change_password: false, password_reset_requested: false };
      data.User.push(user);
      save(data);
      return clone(user);
    },
    requestPasswordReset: async (username) => {
      const data = load();
      const user = data.User.find((item) => item.username?.toLowerCase() === String(username).trim().toLowerCase());
      if (!user) throw new Error("No account matches that username");
      user.password_reset_requested = true;
      user.updated_date = now();
      save(data);
    },
    setPassword: async (userId, password) => {
      requireOwner();
      if (String(password).length < 6) throw new Error("Password must have at least 6 characters");
      const data = load();
      const user = data.User.find((item) => item.id === userId);
      if (!user) throw new Error("Employee account not found");
      user.password_hash = passwordHash(password);
      user.password_reset_requested = false;
      user.must_change_password = false;
      user.updated_date = now();
      save(data);
    },
    revokeAccount: async (userId) => {
      requireOwner();
      const data = load();
      const user = data.User.find((item) => item.id === userId);
      if (!user) throw new Error("Employee account not found");
      if (user.id === currentUser()?.id) throw new Error("You cannot remove your own access");
      user.status = "inactive";
      user.password_reset_requested = false;
      user.updated_date = now();
      save(data);
    },
  },
  auth: {
    me: async () => currentUser(),
    login: async (username, password) => {
      const user = load().User.find((item) => item.username?.toLowerCase() === String(username).trim().toLowerCase());
      if (!user || user.password_hash !== passwordHash(password)) throw new Error("Incorrect username or password");
      if (user.status === "inactive") throw new Error("This account no longer has access");
      sessionStorage.setItem(SESSION_KEY, user.id);
      return clone(user);
    },
    logout: () => sessionStorage.removeItem(SESSION_KEY),
  },
  backups: {
    create: () => ({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      created_at: now(),
      data: clone(load()),
    }),
    restore: async (backup) => {
      requireOwner();
      validateBackup(backup);
      const restored = { ...emptyData(), ...clone(backup.data) };
      save(restored);
      sessionStorage.removeItem(SESSION_KEY);
    },
  },
  reset: () => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
};
