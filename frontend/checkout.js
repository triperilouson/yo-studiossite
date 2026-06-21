"use strict";

const placeOrder = document.getElementById("place-order");
const checkoutStatus = document.getElementById("checkout-status");
let selectedAddressId = null;
let activeIdempotencyKey = sessionStorage.getItem("yo_checkout_key");

function setCheckoutStatus(text) { checkoutStatus.textContent = text ? text.toUpperCase() : ""; }

async function loadCheckout() {
    try {
        const user = await YOApi.getCurrentUser();
        if (!user) {
            window.location.href = "auth.html?return=checkout.html";
            return;
        }
        const [cart, addresses] = await Promise.all([
            YOApi.getCart(),
            YOApi.request("/users/me/addresses", { auth: true })
        ]);
        const cartBox = document.getElementById("checkout-cart");
        cartBox.replaceChildren(...cart.items.map((item) => {
            const row = document.createElement("p");
            row.textContent = `${item.product.title} / ${item.size} × ${item.quantity}`;
            return row;
        }));
        document.getElementById("checkout-total").textContent = `TOTAL — ${YOApi.formatMoney(cart.subtotalMinor, cart.currency)}`;
        const addressesBox = document.getElementById("checkout-addresses");
        addressesBox.replaceChildren(...addresses.map((address) => {
            const label = document.createElement("label");
            label.className = "address-choice data-card";
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "address";
            radio.value = address.id;
            radio.checked = address.isDefault || (!selectedAddressId && addresses[0]?.id === address.id);
            if (radio.checked) selectedAddressId = address.id;
            radio.addEventListener("change", () => { selectedAddressId = address.id; placeOrder.disabled = false; });
            const text = document.createElement("span");
            text.textContent = `${address.label} — ${address.fullName}, ${address.line1}, ${address.city}`;
            label.append(radio, text);
            return label;
        }));
        if (!addresses.length) setCheckoutStatus("Add a delivery address before checkout");
        if (!cart.items.length) setCheckoutStatus("Your cart is empty");
        placeOrder.disabled = !addresses.length || !cart.items.length;
    } catch (error) { setCheckoutStatus(error.message); }
}

placeOrder.addEventListener("click", async () => {
    if (!selectedAddressId) return;
    placeOrder.disabled = true;
    setCheckoutStatus("Creating your order");
    if (!activeIdempotencyKey) {
        activeIdempotencyKey = crypto.randomUUID().replaceAll("-", "");
        sessionStorage.setItem("yo_checkout_key", activeIdempotencyKey);
    }
    try {
        const order = await YOApi.request("/orders/checkout", {
            method: "POST",
            auth: true,
            headers: { "Idempotency-Key": activeIdempotencyKey },
            body: { addressId: selectedAddressId }
        });
        setCheckoutStatus("Order created. Preparing secure payment");
        const payment = await YOApi.request(`/payments/orders/${order.id}/session`, { method: "POST", auth: true });
        if (!/^https:\/\//i.test(payment.checkoutUrl)) throw new Error("Invalid payment destination");
        sessionStorage.removeItem("yo_checkout_key");
        window.location.assign(payment.checkoutUrl);
    } catch (error) {
        setCheckoutStatus(error.message);
        placeOrder.disabled = false;
    }
});

void loadCheckout();
