const $ = (id) => document.getElementById(id);

const migrationStatus = $("migration-status");
const csvPathEl = $("csv-path");
const migrationSummaryEl = $("migration-summary");
const tableView = $("table-view");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || "Unexpected error";
    throw new Error(message);
  }
  return data;
}

function showStatus(message, tone = "") {
  migrationStatus.textContent = message;
  migrationStatus.style.color = tone === "ok" ? "#2f7d32" : "#9b3c27";
}

function renderCards(container, items, renderer) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = '<div class="card">No hay resultados.</div>';
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = renderer(item);
    container.appendChild(card);
  });
}

function renderTransactionsTable(container, transactions) {
  container.innerHTML = "";
  if (!transactions.length) {
    container.innerHTML = '<div class="card">No hay transacciones.</div>';
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Transacción</th>
        <th>Fecha</th>
        <th>Cliente</th>
        <th>Proveedor</th>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Cantidad</th>
        <th>Total línea</th>
      </tr>
    </thead>
    <tbody>
      ${transactions
        .map(
          (row) => `
        <tr>
          <td>${row.transactionId}</td>
          <td>${row.date}</td>
          <td>${row.customerName}<br/><small>${row.customerEmail}</small></td>
          <td>${row.supplierName}<br/><small>${row.supplierEmail}</small></td>
          <td>${row.productName}<br/><small>${row.productSku}</small></td>
          <td>${row.category}</td>
          <td>${row.quantity}</td>
          <td>${Number(row.totalLineValue).toLocaleString("es-CO")}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;
  container.appendChild(table);
}

function groupTransactionItems(rows) {
  const grouped = new Map();
  for (const [index, row] of (rows || []).entries()) {
    const key = row.transactionId
      ? `${row.transactionId}::${row.date || ""}`
      : `${row.date || ""}::${row.customerEmail || ""}::${row.customerName || ""}::${index}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        transactionId: row.transactionId,
        date: row.date,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        transactionTotal: 0,
        items: [],
      });
    }
    const current = grouped.get(key);
    current.items.push({
      supplierName: row.supplierName,
      supplierEmail: row.supplierEmail,
      productName: row.productName,
      sku: row.productSku,
      category: row.category,
      quantity: row.quantity,
      totalLineValue: row.totalLineValue,
    });
    current.transactionTotal += Number(row.totalLineValue) || 0;
  }
  return Array.from(grouped.values());
}

function renderTransactionGroups(container, transactions) {
  container.innerHTML = "";
  if (!transactions.length) {
    container.innerHTML = '<div class="card">No hay transacciones.</div>';
    return;
  }
  transactions.forEach((transaction) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${transaction.transactionId}</h3>
      <p>${transaction.date || ""}</p>
      ${transaction.customerName || transaction.customerEmail ? `<p>${transaction.customerName || ""}${transaction.customerEmail ? ` · ${transaction.customerEmail}` : ""}</p>` : ""}
      <div class="badge">Total: ${Number(transaction.transactionTotal || 0).toLocaleString("es-CO")}</div>
      <table class="table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Proveedor</th>
            <th>Categoría</th>
            <th>Cantidad</th>
            <th>Total línea</th>
          </tr>
        </thead>
        <tbody>
          ${(transaction.items || [])
            .map(
              (item) => `
            <tr>
              <td>${item.productName}<br/><small>${item.sku}</small></td>
              <td>${item.supplierName}<br/><small>${item.supplierEmail}</small></td>
              <td>${item.category || ""}</td>
              <td>${item.quantity}</td>
              <td>${Number(item.totalLineValue || 0).toLocaleString("es-CO")}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
    container.appendChild(card);
  });
}

function renderGenericTable(container, columns, rows) {
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = '<div class="card">No hay datos.</div>';
    return;
  }
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        ${columns.map((col) => `<th>${col.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          ${columns.map((col) => `<td>${row[col.key] ?? ""}</td>`).join("")}
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;
  container.appendChild(table);
}

function renderHistoryCards(container, histories) {
  container.innerHTML = "";
  if (!histories.length) {
    container.innerHTML = '<div class="card">No hay historiales.</div>';
    return;
  }
  histories.forEach((history) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${history.customerName || "Cliente"}</h3>
      <p>${history.customerEmail}</p>
      <details>
        <summary>Ver JSON completo</summary>
        <pre class="json">${JSON.stringify(history, null, 2)}</pre>
      </details>
    `;
    container.appendChild(card);
  });
}

async function loadSimulacroInfo() {
  try {
    const data = await api("/api/simulacro");
    csvPathEl.textContent = data.csvPath;
  } catch (error) {
    csvPathEl.textContent = "No disponible";
  }
}

$("btn-migrate").addEventListener("click", async () => {
  const clearBefore = $("clear-before").checked;
  showStatus("Ejecutando migración...");
  try {
    const data = await api("/api/simulacro/migrate", {
      method: "POST",
      body: JSON.stringify({ clearBefore }),
    });
    migrationSummaryEl.textContent = `Clientes ${data.result.customers} · Proveedores ${data.result.suppliers} · Transacciones ${data.result.transactions}`;
    showStatus("Migración completada", "ok");
  } catch (error) {
    showStatus(error.message || "Error en migración");
  }
});

$("supplier-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("supplier-name").value.trim();
  const container = $("supplier-results");
  container.innerHTML = '<div class="card">Buscando...</div>';
  try {
    const query = name ? `?name=${encodeURIComponent(name)}` : "";
    const data = await api(`/api/suppliers${query}`);
    renderCards(container, data.suppliers, (supplier) => `
      <h3>${supplier.name}</h3>
      <p>${supplier.email}</p>
    `);
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("supplier-id-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("supplier-id").value.trim();
  const container = $("supplier-id-results");
  container.innerHTML = '<div class="card">Consultando...</div>';
  try {
    const data = await api(`/api/suppliers/${encodeURIComponent(id)}`);
    container.innerHTML = `
      <div class="card">
        <h3>${data.supplier.name}</h3>
        <p>${data.supplier.email}</p>
        <p>ID: ${data.supplier.id}</p>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("supplier-update-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("supplier-update-id").value.trim();
  const name = $("supplier-update-name").value.trim();
  const email = $("supplier-update-email").value.trim();
  const container = $("supplier-id-results");
  container.innerHTML = '<div class="card">Actualizando...</div>';
  try {
    const payload = {};
    if (name) payload.name = name;
    if (email) payload.email = email;
    const data = await api(`/api/suppliers/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    container.innerHTML = `
      <div class="card">
        <h3>Proveedor actualizado</h3>
        <p>${data.supplier.name}</p>
        <p>${data.supplier.email}</p>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("customer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = $("customer-query").value.trim();
  const container = $("customer-results");
  container.innerHTML = '<div class="card">Buscando...</div>';
  try {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    const data = await api(`/api/customers${query}`);
    renderCards(container, data.customers, (customer) => `
      <h3>${customer.name}</h3>
      <p>${customer.email}</p>
      <p>${customer.phone || ""}</p>
      <p>${customer.address || ""}</p>
    `);
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("history-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("history-email").value.trim();
  const container = $("history-results");
  container.innerHTML = '<div class="card">Buscando...</div>';
  try {
    const data = await api(`/api/customers/${encodeURIComponent(email)}/history`);
    const summary = data.summary || {};
    container.innerHTML = `
      <div class="card">
        <h3>${data.customer.name}</h3>
        <p>${data.customer.email}</p>
        <div class="badge">Transacciones: ${summary.totalTransactions || 0}</div>
        <div class="badge">Total comprado: ${Number(summary.totalSpent || 0).toLocaleString("es-CO")}</div>
        <div class="badge">Categoría frecuente: ${summary.mostFrequentCategory || "N/A"}</div>
      </div>
    `;
    const tableContainer = document.createElement("div");
    container.appendChild(tableContainer);
    renderTransactionGroups(tableContainer, data.transactions || []);
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("transaction-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const customerEmail = $("transaction-customer").value.trim();
  const supplierEmail = $("transaction-supplier").value.trim();
  const startDate = $("transaction-start").value;
  const endDate = $("transaction-end").value;
  const container = $("transaction-results");
  container.innerHTML = '<div class="card">Buscando...</div>';
  try {
    const params = new URLSearchParams();
    if (customerEmail) params.set("customerEmail", customerEmail);
    if (supplierEmail) params.set("supplierEmail", supplierEmail);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await api(`/api/transactions${query}`);
    const grouped = groupTransactionItems(data.transactions || []);
    renderTransactionGroups(container, grouped);
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

async function loadTable(title, loader) {
  tableView.innerHTML = `<div class="card">Cargando ${title}...</div>`;
  try {
    const data = await loader();
    return data;
  } catch (error) {
    tableView.innerHTML = `<div class="card">${error.message}</div>`;
    return null;
  }
}

$("load-suppliers").addEventListener("click", async () => {
  const data = await loadTable("proveedores", () => api("/api/suppliers"));
  if (!data) return;
  renderGenericTable(
    tableView,
    [
      { key: "id", label: "ID" },
      { key: "name", label: "Nombre" },
      { key: "email", label: "Email" },
    ],
    data.suppliers || []
  );
});

$("load-products").addEventListener("click", async () => {
  const data = await loadTable("productos", () => api("/api/products"));
  if (!data) return;
  renderGenericTable(
    tableView,
    [
      { key: "id", label: "ID" },
      { key: "sku", label: "SKU" },
      { key: "name", label: "Nombre" },
      { key: "category", label: "Categoría" },
      { key: "baseUnitPrice", label: "Precio base" },
    ],
    data.products || []
  );
});

$("load-customers").addEventListener("click", async () => {
  const data = await loadTable("clientes", () => api("/api/customers?limit=200"));
  if (!data) return;
  renderGenericTable(
    tableView,
    [
      { key: "id", label: "ID" },
      { key: "name", label: "Nombre" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Teléfono" },
      { key: "address", label: "Dirección" },
    ],
    data.customers || []
  );
});

$("load-categories").addEventListener("click", async () => {
  const data = await loadTable("categorías", () => api("/api/categories"));
  if (!data) return;
  renderGenericTable(
    tableView,
    [
      { key: "id", label: "ID" },
      { key: "name", label: "Nombre" },
    ],
    data.categories || []
  );
});

$("load-transactions").addEventListener("click", async () => {
  const data = await loadTable("transacciones", () =>
    api("/api/transactions?limit=200")
  );
  if (!data) return;
  const grouped = groupTransactionItems(data.transactions || []);
  renderTransactionGroups(tableView, grouped);
});

$("load-histories").addEventListener("click", async () => {
  const data = await loadTable("historiales", () => api("/api/histories?limit=200"));
  if (!data) return;
  renderHistoryCards(tableView, data.histories || []);
});

$("load-supplier-changes").addEventListener("click", async () => {
  const data = await loadTable("logs de suppliers", () =>
    api("/api/suppliers/changes?limit=200")
  );
  if (!data) return;
  const rows = (data.logs || []).map((log) => ({
    recordId: log.recordId,
    operation: log.operation,
    before: `${log.before?.name || ""} · ${log.before?.email || ""}`,
    after: `${log.after?.name || ""} · ${log.after?.email || ""}`,
    changedAt: log.changedAt ? new Date(log.changedAt).toLocaleString("es-CO") : "",
  }));
  renderGenericTable(
    tableView,
    [
      { key: "recordId", label: "Supplier ID" },
      { key: "operation", label: "Operación" },
      { key: "before", label: "Antes" },
      { key: "after", label: "Después" },
      { key: "changedAt", label: "Fecha cambio" },
    ],
    rows
  );
});

$("report-sales-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const startDate = $("report-start").value;
  const endDate = $("report-end").value;
  const container = $("report-results");
  container.innerHTML = '<div class="card">Consultando...</div>';
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await api(`/api/reports/sales${query}`);
    container.innerHTML = `
      <div class="card">
        <h3>Recaudación total</h3>
        <div class="badge">${Number(data.report.totalSales || 0).toLocaleString("es-CO")}</div>
      </div>
    `;
    const tableContainer = document.createElement("div");
    container.appendChild(tableContainer);
    renderGenericTable(
      tableContainer,
      [
        { key: "supplierName", label: "Proveedor" },
        { key: "transactionCount", label: "Transacciones" },
        { key: "totalAmount", label: "Total" },
      ],
      data.report.bySupplier || []
    );
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("supplier-analysis-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const startDate = $("supplier-analysis-start").value;
  const endDate = $("supplier-analysis-end").value;
  const container = $("report-results");
  container.innerHTML = '<div class="card">Consultando...</div>';
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await api(`/api/reports/supplier-analysis${query}`);
    renderGenericTable(
      container,
      [
        { key: "supplierName", label: "Proveedor" },
        { key: "totalItems", label: "Items vendidos" },
        { key: "totalInventoryValue", label: "Valor inventario" },
      ],
      data.suppliers || []
    );
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

$("top-products-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const category = $("top-products-category").value.trim();
  const limit = $("top-products-limit").value.trim();
  const container = $("report-results");
  container.innerHTML = '<div class="card">Consultando...</div>';
  try {
    const params = new URLSearchParams();
    params.set("category", category);
    if (limit) params.set("limit", limit);
    const data = await api(`/api/reports/top-products?${params.toString()}`);
    renderGenericTable(
      container,
      [
        { key: "sku", label: "SKU" },
        { key: "productName", label: "Producto" },
        { key: "category", label: "Categoría" },
        { key: "totalQuantity", label: "Cantidad vendida" },
        { key: "totalRevenue", label: "Ingresos" },
      ],
      data.products || []
    );
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message}</div>`;
  }
});

loadSimulacroInfo();
