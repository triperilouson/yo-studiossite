"use strict";

const placeOrder = document.getElementById("place-order");
const checkoutStatus = document.getElementById("checkout-status");
const quoteLine = document.getElementById("shipping-quote");
let selectedMethod = "DELIVERY";
let selectedAddressId = null;
let selectedPickupLocationId = null;
let activeIdempotencyKey = sessionStorage.getItem("yo_checkout_key");
let cartSnapshot = null;
const contactForm = document.getElementById("checkout-contact");

function setCheckoutStatus(text, isError = false) {
    checkoutStatus.textContent = text ? text.toUpperCase() : "";
    checkoutStatus.classList.toggle("error", isError);
}

function selection() {
    return selectedMethod === "DELIVERY"
        ? { method: "DELIVERY", addressId: selectedAddressId }
        : { method: "PICKUP", pickupLocationId: selectedPickupLocationId };
}

async function refreshQuote() {
    const chosen = selection();
    if ((chosen.method === "DELIVERY" && !chosen.addressId) || (chosen.method === "PICKUP" && !chosen.pickupLocationId)) {
        placeOrder.disabled = true; return;
    }
    try {
        const quote = await YOApi.request("/shipping/quote", { method: "POST", auth: true, body: chosen });
        const total = cartSnapshot.subtotalMinor + quote.shippingMinor;
        quoteLine.textContent = quote.method === "PICKUP"
            ? `PICKUP · FREE · ${quote.pickupLocation.name}`
            : `DELIVERY · ${YOApi.formatMoney(quote.shippingMinor, quote.currency)} · ${quote.estimatedMinDays}–${quote.estimatedMaxDays} DAYS`;
        document.getElementById("checkout-total").textContent = `TOTAL — ${YOApi.formatMoney(total, quote.currency)}`;
        placeOrder.disabled = !cartSnapshot.items.length;
        setCheckoutStatus("");
    } catch (error) {
        quoteLine.textContent = ""; placeOrder.disabled = true; setCheckoutStatus(error.message, true);
    }
}

function addressChoice(address, index) {
    const label = document.createElement("label"); label.className = "address-choice data-card";
    const radio = document.createElement("input"); radio.type = "radio"; radio.name = "address"; radio.value = address.id;
    radio.checked = address.isDefault || (!selectedAddressId && index === 0);
    if (radio.checked) selectedAddressId = address.id;
    radio.addEventListener("change", () => { selectedAddressId = address.id; void refreshQuote(); });
    const text = document.createElement("span");
    text.textContent = `${address.label} — ${address.fullName}, ${address.line1}, ${address.city}, ${address.country}`;
    label.append(radio, text); return label;
}

function pickupChoice(location, index) {
    const label = document.createElement("label"); label.className = "address-choice data-card";
    const radio = document.createElement("input"); radio.type = "radio"; radio.name = "pickup"; radio.value = location.id;
    radio.checked = index === 0; if (radio.checked) selectedPickupLocationId = location.id;
    radio.addEventListener("change", () => { selectedPickupLocationId = location.id; void refreshQuote(); });
    const text = document.createElement("span"); text.textContent = `${location.name} — ${location.city}, ${location.address}`;
    label.append(radio, text); return label;
}

async function loadCheckout() {
    try {
        const user = await YOApi.getCurrentUser();
        if (!user) { window.location.href = "auth.html?return=checkout.html"; return; }
        const [cart, addresses, shipping] = await Promise.all([
            YOApi.getCart(), YOApi.request("/users/me/addresses", { auth: true }), YOApi.request("/shipping/options")
        ]);
        cartSnapshot = cart;
        contactForm.elements.firstName.value = user.firstName || "";
        contactForm.elements.lastName.value = user.lastName || "";
        contactForm.elements.email.value = user.email || "";
        contactForm.elements.phone.value = user.phone || "";
        document.getElementById("checkout-cart").replaceChildren(...cart.items.map((item) => {
            const row = document.createElement("p"); row.textContent = `${item.product.title} / ${item.size} × ${item.quantity}`; return row;
        }));
        document.getElementById("checkout-total").textContent = `SUBTOTAL — ${YOApi.formatMoney(cart.subtotalMinor, cart.currency)}`;
        document.getElementById("checkout-addresses").replaceChildren(...addresses.map(addressChoice));
        document.getElementById("pickup-panel").replaceChildren(...shipping.pickupLocations.map(pickupChoice));
        if (!addresses.length) setCheckoutStatus("Add a supported delivery address or choose pickup");
        if (!cart.items.length) setCheckoutStatus("Your cart is empty");
        await refreshQuote();
    } catch (error) { setCheckoutStatus(error.message, true); }
}

document.querySelectorAll('input[name="shipping-method"]').forEach((radio) => radio.addEventListener("change", (event) => {
    selectedMethod = event.currentTarget.value;
    document.getElementById("delivery-panel").classList.toggle("hidden", selectedMethod !== "DELIVERY");
    document.getElementById("pickup-panel").classList.toggle("hidden", selectedMethod !== "PICKUP");
    void refreshQuote();
}));

placeOrder.addEventListener("click", async () => {
    if (!contactForm.reportValidity()) return;
    placeOrder.disabled = true; setCheckoutStatus("Creating your order");
    if (!activeIdempotencyKey) {
        activeIdempotencyKey = crypto.randomUUID().replaceAll("-", "");
        sessionStorage.setItem("yo_checkout_key", activeIdempotencyKey);
    }
    try {
        const contact = Object.fromEntries(new FormData(contactForm).entries());
        const order = await YOApi.request("/orders/checkout", {
            method: "POST", auth: true, headers: { "Idempotency-Key": activeIdempotencyKey },
            body: { ...selection(), ...contact }
        });
        setCheckoutStatus("Order created. Preparing secure payment");
        const payment = await YOApi.request(`/payments/orders/${order.id}/session`, { method: "POST", auth: true });
        if (!/^https:\/\//i.test(payment.checkoutUrl)) throw new Error("Invalid payment destination");
        sessionStorage.removeItem("yo_checkout_key"); window.location.assign(payment.checkoutUrl);
    } catch (error) { setCheckoutStatus(error.message, true); placeOrder.disabled = false; }
});

void loadCheckout();
