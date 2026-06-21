"use strict";

const state = { admin: null, products: [], overview: null };
const statusLine = document.getElementById("admin-status");
const dialog = document.getElementById("product-dialog");
const productForm = document.getElementById("product-form");
let inactivityTimer;

function setStatus(message, isError = false) {
    statusLine.textContent = message ? message.toUpperCase() : "";
    statusLine.classList.toggle("error", isError);
    if (message) setTimeout(() => { if (statusLine.textContent === message.toUpperCase()) statusLine.textContent = ""; }, 5000);
}

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function button(text, action, className = "") {
    const element = node("button", className, text);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
}

function switchView(name) {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
    document.querySelectorAll(".admin-view").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === name));
    document.getElementById("view-title").textContent = name === "dashboard" ? "OVERVIEW" : name.toUpperCase();
    if (name === "products") void loadProducts();
    if (name === "orders") void loadOrders();
    if (name === "users") void loadUsers();
    if (name === "audit") void loadAudit();
    if (name === "security") void loadOverview();
}

document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));

function healthItem(label, value) {
    const row = node("div", "health-item");
    row.append(node("span", "", label), node("span", "", value));
    return row;
}

async function loadOverview() {
    try {
        const overview = await YOApi.request("/admin/security/overview", { auth: true });
        state.overview = overview;
        document.getElementById("metric-online").textContent = overview.onlineUsers;
        document.getElementById("metric-products").textContent = overview.activeProducts;
        document.getElementById("metric-units").textContent = overview.availableUnits;
        document.getElementById("metric-low-stock").textContent = overview.lowStockVariants;
        document.getElementById("metric-orders").textContent = overview.pendingOrders;
        document.getElementById("metric-users").textContent = overview.activeUsers;
        document.getElementById("store-health").replaceChildren(
            healthItem("REGISTRATION", overview.settings.registrationEnabled ? "OPEN" : "LOCKED"),
            healthItem("FAILED PAYMENTS", String(overview.failedPayments)),
            healthItem("WEBHOOK ERRORS", String(overview.webhookErrors)),
            healthItem("DATABASE INVENTORY", `${overview.availableUnits} AVAILABLE`)
        );
        document.getElementById("security-signals").replaceChildren(
            healthItem("ACTIVE SESSIONS", `${overview.onlineUsers} USERS / ${overview.onlineWindowMinutes} MIN`),
            healthItem("LOCKED ACCOUNTS", String(overview.lockedUsers)),
            healthItem("LOW STOCK VARIANTS", String(overview.lowStockVariants)),
            healthItem("FAILED PAYMENTS", String(overview.failedPayments)),
            healthItem("WEBHOOK PROCESSING ERRORS", String(overview.webhookErrors))
        );
        const toggle = document.getElementById("registration-toggle");
        toggle.checked = overview.settings.registrationEnabled;
        toggle.disabled = state.admin?.role !== "SUPER_ADMIN";
        await loadSessions();
    } catch (error) { setStatus(error.message, true); }
}

function inventoryLine(variant) {
    const row = node("div", "inventory-line");
    const identity = node("span", "", `${variant.size} / ${variant.sku}`);
    const stock = document.createElement("input");
    stock.type = "number"; stock.min = "0"; stock.max = "1000000"; stock.value = variant.stock; stock.title = "Stock";
    const price = document.createElement("input");
    price.type = "number"; price.min = "0"; price.step = "0.01"; price.value = (variant.priceMinor / 100).toFixed(2); price.title = "Price ILS";
    const active = document.createElement("input");
    active.type = "checkbox"; active.checked = variant.isActive; active.title = "Active size";
    const save = button("SAVE", async () => {
        try {
            await YOApi.request(`/admin/products/variants/${variant.id}/inventory`, {
                method: "PATCH", auth: true,
                body: { stock: Number(stock.value), priceMinor: Math.round(Number(price.value) * 100), isActive: active.checked }
            });
            setStatus(`${variant.sku} inventory saved`);
            await Promise.all([loadProducts(), loadOverview()]);
        } catch (error) { setStatus(error.message, true); }
    });
    row.append(identity, stock, price, active, save);
    return row;
}

function productCard(product) {
    const card = node("article", "product-admin-card");
    const top = node("div", "product-card-top");
    const image = document.createElement("img");
    image.src = YOApi.imageUrl(product.images[0]?.url);
    image.alt = product.images[0]?.alt || product.title;
    const info = node("div", "product-card-info");
    info.append(node("small", "", `${product.category.toUpperCase()} · ${product.season || "NO SEASON"}`), node("h3", "", product.title));
    const units = product.variants.reduce((sum, item) => sum + Math.max(0, item.stock - item.reservedStock), 0);
    info.append(node("p", "", `${product.variants.length} SIZES · ${units} AVAILABLE`));
    const status = node("span", `status-pill ${product.status.toLowerCase()}`, product.status);
    info.appendChild(status);
    top.append(image, info);
    const editor = node("div", "inventory-editor");
    const statusRow = node("div", "inventory-line");
    const statusSelect = document.createElement("select");
    ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].forEach((value) => {
        const option = new Option(value, value, value === product.status, value === product.status);
        statusSelect.add(option);
    });
    statusRow.append(node("span", "", "PRODUCT STATUS"), statusSelect, node("span", "", ""), node("span", "", ""), button("SAVE", async () => {
        try {
            await YOApi.request(`/admin/products/${product.id}`, { method: "PATCH", auth: true, body: { status: statusSelect.value } });
            setStatus(`${product.title} status saved`);
            await Promise.all([loadProducts(), loadOverview()]);
        } catch (error) { setStatus(error.message, true); }
    }));
    editor.appendChild(statusRow);
    product.variants.forEach((variant) => editor.appendChild(inventoryLine(variant)));
    card.append(top, editor);
    return card;
}

function renderProducts() {
    const search = document.getElementById("product-search").value.trim().toLowerCase();
    const status = document.getElementById("product-status-filter").value;
    const products = state.products.filter((product) => {
        const haystack = `${product.title} ${product.category} ${product.variants.map((v) => v.sku).join(" ")}`.toLowerCase();
        return (!search || haystack.includes(search)) && (!status || product.status === status);
    });
    const container = document.getElementById("admin-products");
    container.replaceChildren(...products.map(productCard));
    if (!products.length) container.append(node("p", "admin-status", "NO PRODUCTS MATCH THIS FILTER"));
}

async function loadProducts() {
    try { state.products = await YOApi.request("/admin/products", { auth: true }); renderProducts(); }
    catch (error) { setStatus(error.message, true); }
}

function tableRow(columns) {
    const row = node("article", "table-row");
    columns.forEach((column) => row.append(column));
    return row;
}

async function loadOrders() {
    try {
        const orders = await YOApi.request("/admin/orders", { auth: true });
        const next = { PENDING_PAYMENT: "CANCELLED", PAID: "SHIPPED", SHIPPED: "COMPLETED" };
        document.getElementById("admin-orders").replaceChildren(...orders.map((order) => {
            const action = next[order.status]
                ? button(`MARK ${next[order.status].replaceAll("_", " ")}`, async () => {
                    try {
                        await YOApi.request(`/admin/orders/${order.id}/status`, { method: "PATCH", auth: true, body: { status: next[order.status] } });
                        setStatus("Order status updated"); await Promise.all([loadOrders(), loadOverview()]);
                    } catch (error) { setStatus(error.message, true); }
                }) : node("span", "", "—");
            return tableRow([
                node("strong", "", `${order.id.slice(0, 8).toUpperCase()} · ${order.items.length} ITEMS`),
                node("span", "", order.status.replaceAll("_", " ")),
                node("span", "", YOApi.formatMoney(order.totalMinor, order.currency)), action
            ]);
        }));
    } catch (error) { setStatus(error.message, true); }
}

async function loadUsers() {
    try {
        const users = await YOApi.request("/admin/users", { auth: true });
        document.getElementById("admin-users").replaceChildren(...users.map((user) => {
            const role = document.createElement("select");
            ["USER", "ADMIN", "SUPER_ADMIN"].forEach((value) => role.add(new Option(value, value, value === user.role, value === user.role)));
            role.disabled = state.admin.role !== "SUPER_ADMIN";
            const active = document.createElement("input"); active.type = "checkbox"; active.checked = user.isActive; active.disabled = state.admin.role !== "SUPER_ADMIN";
            const action = state.admin.role === "SUPER_ADMIN" ? button("SAVE", async () => {
                try {
                    const currentPassword = window.prompt("Confirm with your SUPER_ADMIN password");
                    if (!currentPassword) return;
                    await YOApi.request(`/admin/users/${user.id}`, { method: "PATCH", auth: true, body: { role: role.value, isActive: active.checked, currentPassword } });
                    setStatus("User access updated"); await loadUsers();
                } catch (error) { setStatus(error.message, true); }
            }) : node("span", "", "READ ONLY");
            return tableRow([node("strong", "", user.email), role, active, action]);
        }));
    } catch (error) { setStatus(error.message, true); }
}

async function loadAudit() {
    try {
        const events = await YOApi.request("/admin/security/audit", { auth: true });
        document.getElementById("admin-audit").replaceChildren(...events.map((event) => tableRow([
            node("strong", "", event.action.replaceAll("_", " ")),
            node("span", "", event.actor?.email || "SYSTEM"),
            node("span", "", `${event.entityType}${event.entityId ? ` · ${event.entityId.slice(0, 12)}` : ""}`),
            node("small", "", new Date(event.createdAt).toLocaleString())
        ])));
    } catch (error) { setStatus(error.message, true); }
}

function addImageRow(values = {}, containerId = "gallery-image-rows", removable = true) {
    const row = document.getElementById("image-row-template").content.firstElementChild.cloneNode(true);
    const url = row.querySelector("[data-image-url]");
    const alt = row.querySelector("[data-image-alt]");
    const preview = row.querySelector(".image-preview");
    url.value = values.url || ""; alt.value = values.alt || "";
    const updatePreview = () => {
        const value = url.value.trim();
        preview.style.backgroundImage = value ? `url("${YOApi.imageUrl(value).replaceAll('"', "%22")}")` : "";
        preview.querySelector("span").textContent = value ? "" : "PREVIEW";
    };
    url.addEventListener("input", updatePreview); updatePreview();
    const remove = row.querySelector(".remove-row");
    remove.hidden = !removable;
    remove.addEventListener("click", () => row.remove());
    document.getElementById(containerId).appendChild(row);
}

function addVariantRow(values = {}) {
    const row = document.getElementById("variant-row-template").content.firstElementChild.cloneNode(true);
    row.querySelector("[data-variant-size]").value = values.size || "";
    row.querySelector("[data-variant-sku]").value = values.sku || "";
    row.querySelector("[data-variant-price]").value = values.price || "";
    row.querySelector("[data-variant-stock]").value = values.stock ?? "";
    row.querySelector("[data-variant-active]").checked = values.active !== false;
    row.querySelector(".remove-row").addEventListener("click", () => {
        if (document.querySelectorAll("#variant-rows .variant-row").length > 1) row.remove();
    });
    document.getElementById("variant-rows").appendChild(row);
}

function openProductDialog() {
    productForm.reset();
    document.getElementById("preview-image-row").replaceChildren();
    document.getElementById("gallery-image-rows").replaceChildren();
    document.getElementById("variant-rows").replaceChildren();
    addImageRow({}, "preview-image-row", false); addVariantRow({ size: "L", active: true });
    dialog.showModal();
}

document.getElementById("add-image-row").addEventListener("click", () => {
    const total = document.querySelectorAll("#preview-image-row .image-row, #gallery-image-rows .image-row").length;
    if (total >= 20) { setStatus("Maximum 20 images per product", true); return; }
    addImageRow();
});
document.getElementById("add-variant-row").addEventListener("click", () => addVariantRow());
document.getElementById("open-product-modal").addEventListener("click", openProductDialog);
document.querySelectorAll("[data-open-products]").forEach((item) => item.addEventListener("click", openProductDialog));
document.getElementById("close-product-modal").addEventListener("click", () => dialog.close());
document.getElementById("product-search").addEventListener("input", renderProducts);
document.getElementById("product-status-filter").addEventListener("change", renderProducts);

productForm.elements.title.addEventListener("input", () => {
    if (!productForm.elements.slug.dataset.touched) {
        productForm.elements.slug.value = productForm.elements.title.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
});
productForm.elements.slug.addEventListener("input", () => { productForm.elements.slug.dataset.touched = "true"; });

productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = document.getElementById("create-product"); submit.disabled = true;
    try {
        const values = Object.fromEntries(new FormData(productForm).entries());
        const images = [...document.querySelectorAll("#preview-image-row .image-row, #gallery-image-rows .image-row")].map((row, position) => ({
            url: row.querySelector("[data-image-url]").value.trim(),
            alt: row.querySelector("[data-image-alt]").value.trim(), position
        }));
        const variants = [...document.querySelectorAll("#variant-rows .variant-row")].map((row) => ({
            size: row.querySelector("[data-variant-size]").value.trim(),
            sku: row.querySelector("[data-variant-sku]").value.trim(),
            priceMinor: Math.round(Number(row.querySelector("[data-variant-price]").value) * 100),
            currency: "ILS", stock: Number(row.querySelector("[data-variant-stock]").value),
            isActive: row.querySelector("[data-variant-active]").checked
        }));
        const body = { title: values.title, slug: values.slug, category: values.category, description: values.description, status: values.status, images, variants };
        if (values.season) body.season = values.season;
        await YOApi.request("/admin/products", { method: "POST", auth: true, body });
        dialog.close(); setStatus("Product created in database");
        await Promise.all([loadProducts(), loadOverview(), loadAudit()]);
    } catch (error) { setStatus(error.message, true); }
    finally { submit.disabled = false; }
});

document.getElementById("registration-toggle").addEventListener("change", async (event) => {
    try {
        await YOApi.request("/admin/security/settings", { method: "PATCH", auth: true, body: { registrationEnabled: event.currentTarget.checked } });
        setStatus(`Registration ${event.currentTarget.checked ? "enabled" : "locked"}`);
        await Promise.all([loadOverview(), loadAudit()]);
    } catch (error) { event.currentTarget.checked = !event.currentTarget.checked; setStatus(error.message, true); }
});

async function loadSessions() {
    const sessions = await YOApi.request("/admin/security/sessions", { auth: true });
    document.getElementById("admin-sessions").replaceChildren(...sessions.map((session) => {
        const row = healthItem(session.isCurrent ? "THIS DEVICE" : "OTHER DEVICE", `${new Date(session.lastSeenAt).toLocaleString()} · ${(session.userAgent || "UNKNOWN CLIENT").slice(0, 80)}`);
        if (!session.isCurrent) row.appendChild(button("REVOKE", async () => {
            await YOApi.request(`/admin/security/sessions/${session.id}`, { method: "DELETE", auth: true });
            setStatus("Session revoked"); await loadSessions();
        }));
        return row;
    }));
}

document.getElementById("revoke-other-sessions").addEventListener("click", async () => {
    await YOApi.request("/admin/security/sessions/revoke-others", { method: "POST", auth: true });
    setStatus("All other sessions revoked"); await Promise.all([loadSessions(), loadAudit()]);
});

async function logout() { await YOApi.logout(); window.location.replace("auth.html?return=admin.html"); }
document.getElementById("admin-logout").addEventListener("click", logout);
function resetInactivity() { clearTimeout(inactivityTimer); inactivityTimer = setTimeout(logout, 15 * 60_000); }
["pointerdown", "keydown", "scroll"].forEach((name) => window.addEventListener(name, resetInactivity, { passive: true }));

async function bootAdmin() {
    document.getElementById("admin-date").textContent = new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" }).format(new Date()).toUpperCase();
    try {
        state.admin = await YOApi.getCurrentUser();
        if (!state.admin || !["ADMIN", "SUPER_ADMIN"].includes(state.admin.role)) {
            window.location.replace("auth.html?return=admin.html"); return;
        }
        document.getElementById("admin-email").textContent = state.admin.email;
        document.getElementById("admin-role").textContent = state.admin.role;
        document.getElementById("mfa-status").textContent = state.admin.adminMfaEnabled ? "ENABLED · REQUIRED AT EVERY NEW LOGIN" : "DISABLED · ENABLE BEFORE PRODUCTION";
        document.getElementById("mfa-enable").hidden = state.admin.adminMfaEnabled;
        document.getElementById("mfa-disable").hidden = !state.admin.adminMfaEnabled;
        document.getElementById("admin-gate").remove();
        document.getElementById("admin-shell").classList.remove("hidden");
        resetInactivity();
        await Promise.all([loadOverview(), loadProducts()]);
        setInterval(loadOverview, 30_000);
    } catch (error) {
        document.getElementById("admin-gate").querySelector("p").textContent = error.message.toUpperCase();
    }
}

void bootAdmin();

document.getElementById("mfa-enable").addEventListener("click", async () => {
    const currentPassword = window.prompt("Confirm your current password");
    if (!currentPassword) return;
    try {
        const enrollment = await YOApi.request("/admin/security/mfa/enroll", { method: "POST", auth: true, body: { currentPassword } });
        const output = document.getElementById("mfa-enrollment");
        output.hidden = false;
        output.textContent = `SECRET: ${enrollment.secret}\n\nAUTHENTICATOR URI:\n${enrollment.uri}`;
        const code = window.prompt("Add the secret to your authenticator app, then enter its 6-digit code");
        if (!code) return;
        await YOApi.request("/admin/security/mfa/confirm", { method: "POST", auth: true, body: { currentPassword, code } });
        state.admin.adminMfaEnabled = true;
        document.getElementById("mfa-status").textContent = "ENABLED · REQUIRED AT EVERY NEW LOGIN";
        document.getElementById("mfa-enable").hidden = true;
        document.getElementById("mfa-disable").hidden = false;
        output.hidden = true; output.textContent = "";
        setStatus("Two-factor authentication enabled");
    } catch (error) { setStatus(error.message, true); }
});

document.getElementById("mfa-disable").addEventListener("click", async () => {
    const currentPassword = window.prompt("Confirm your current password");
    const code = window.prompt("Enter the current 6-digit authenticator code");
    if (!currentPassword || !code) return;
    try {
        await YOApi.request("/admin/security/mfa/disable", { method: "POST", auth: true, body: { currentPassword, code } });
        await YOApi.logout(); window.location.replace("auth.html?return=admin.html");
    } catch (error) { setStatus(error.message, true); }
});
