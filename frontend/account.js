"use strict";

const accountStatus = document.getElementById("account-status");
const profileForm = document.getElementById("profile-form");
const addressList = document.getElementById("address-list");
const orderList = document.getElementById("order-list");

function setStatus(text) {
    accountStatus.textContent = text ? text.toUpperCase() : "";
}

function addressCard(address) {
    const card = document.createElement("article");
    card.className = "data-card";
    const title = document.createElement("h3");
    title.textContent = `${address.label}${address.isDefault ? " — DEFAULT" : ""}`;
    const lines = document.createElement("p");
    lines.textContent = [address.fullName, address.line1, address.line2, `${address.city} ${address.postalCode}`, address.country, address.phone]
        .filter(Boolean).join(" · ");
    const remove = document.createElement("button");
    remove.className = "text-button";
    remove.type = "button";
    remove.textContent = "REMOVE";
    remove.addEventListener("click", async () => {
        try {
            await YOApi.request(`/users/me/addresses/${address.id}`, { method: "DELETE", auth: true });
            await loadAddresses();
        } catch (error) { setStatus(error.message); }
    });
    card.append(title, lines, remove);
    return card;
}

async function loadAddresses() {
    const addresses = await YOApi.request("/users/me/addresses", { auth: true });
    addressList.replaceChildren(...addresses.map(addressCard));
    if (!addresses.length) addressList.textContent = "NO SAVED ADDRESSES";
}

function orderCard(order) {
    const card = document.createElement("article");
    card.className = "data-card order-card";
    const title = document.createElement("h3");
    title.textContent = `${new Date(order.createdAt).toLocaleDateString()} — ${order.status.replaceAll("_", " ")}`;
    const total = document.createElement("p");
    total.textContent = YOApi.formatMoney(order.totalMinor, order.currency);
    const items = document.createElement("p");
    items.textContent = order.items.map((item) => `${item.titleSnapshot} / ${item.sizeSnapshot} × ${item.quantity}`).join(" · ");
    card.append(title, total, items);
    return card;
}

async function loadOrders() {
    const orders = await YOApi.request("/users/me/orders", { auth: true });
    orderList.replaceChildren(...orders.map(orderCard));
    if (!orders.length) orderList.textContent = "NO ORDERS YET";
}

async function loadAccount() {
    try {
        const user = await YOApi.getCurrentUser();
        if (!user) {
            window.location.href = "auth.html?return=account.html";
            return;
        }
        profileForm.elements.firstName.value = user.firstName;
        profileForm.elements.lastName.value = user.lastName;
        profileForm.elements.phone.value = user.phone || "";
        profileForm.elements.email.value = user.email;
        if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) document.getElementById("admin-link").classList.remove("hidden");
        await Promise.all([loadAddresses(), loadOrders()]);
    } catch (error) { setStatus(error.message); }
}

profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(profileForm).entries());
    const body = { firstName: values.firstName, lastName: values.lastName };
    if (values.phone) body.phone = values.phone;
    try {
        await YOApi.request("/users/me", { method: "PATCH", auth: true, body });
        setStatus("Profile saved");
    } catch (error) { setStatus(error.message); }
});

document.getElementById("address-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = {
        label: values.label,
        fullName: values.fullName,
        phone: values.phone,
        country: values.country,
        city: values.city,
        postalCode: values.postalCode,
        line1: values.line1,
        isDefault: values.isDefault === "on"
    };
    if (values.state) body.state = values.state;
    if (values.line2) body.line2 = values.line2;
    try {
        await YOApi.request("/users/me/addresses", { method: "POST", auth: true, body });
        event.currentTarget.reset();
        setStatus("Address added");
        await loadAddresses();
    } catch (error) { setStatus(error.message); }
});

document.getElementById("logout-button").addEventListener("click", async () => {
    await YOApi.logout();
    window.location.href = "index.html";
});

void loadAccount();
