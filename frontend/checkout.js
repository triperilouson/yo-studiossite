"use strict";

const placeOrder = document.getElementById("place-order");
const checkoutStatus = document.getElementById("checkout-status");
const quoteLine = document.getElementById("shipping-quote");
const contactForm = document.getElementById("checkout-contact");
const deliveryAddressForm = document.getElementById("delivery-address-form");
const addressList = document.getElementById("checkout-addresses");
const pickupPanel = document.getElementById("pickup-panel");

let selectedMethod = "DELIVERY";
let selectedAddressMode = "new";
let selectedAddressId = null;
let selectedPickupLocationId = null;
let activeIdempotencyKey = sessionStorage.getItem("yo_checkout_key");
let cartSnapshot = null;
let shippingOptions = { countries: [], pickupLocations: [] };

function setCheckoutStatus(text, isError = false) {
    checkoutStatus.textContent = text ? text.toUpperCase() : "";
    checkoutStatus.classList.toggle("error", isError);
}

function span(text) {
    const element = document.createElement("span");
    element.textContent = text;
    return element;
}

function selectedSavedAddress() {
    return selectedAddressMode === "saved" && selectedAddressId;
}

function inlineDeliveryAddress() {
    if (selectedSavedAddress()) return null;
    const contact = Object.fromEntries(new FormData(contactForm).entries());
    const values = Object.fromEntries(new FormData(deliveryAddressForm).entries());
    if (!contact.firstName || !contact.lastName || !contact.phone || !values.country || !values.city || !values.postalCode || !values.line1) {
        return null;
    }
    return {
        label: values.label?.trim() || "Checkout",
        fullName: `${contact.firstName.trim()} ${contact.lastName.trim()}`,
        phone: contact.phone.trim(),
        country: values.country,
        state: values.state?.trim() || undefined,
        city: values.city.trim(),
        postalCode: values.postalCode.trim(),
        line1: values.line1.trim(),
        line2: values.line2?.trim() || undefined
    };
}

function selection() {
    if (selectedMethod === "PICKUP") return { method: "PICKUP", pickupLocationId: selectedPickupLocationId };
    const address = inlineDeliveryAddress();
    if (address) {
        return {
            method: "DELIVERY",
            address,
            saveAddress: deliveryAddressForm.elements.saveAddress?.checked === true
        };
    }
    return { method: "DELIVERY", addressId: selectedAddressId };
}

async function refreshQuote() {
    const chosen = selection();
    if ((chosen.method === "DELIVERY" && !chosen.addressId && !chosen.address) || (chosen.method === "PICKUP" && !chosen.pickupLocationId)) {
        placeOrder.disabled = true;
        return;
    }
    try {
        const quote = await YOApi.request("/shipping/quote", { method: "POST", auth: true, body: chosen });
        const total = cartSnapshot.subtotalMinor + quote.shippingMinor;
        quoteLine.textContent = quote.method === "PICKUP"
            ? `PICKUP · FREE · ${quote.pickupLocation.name}`
            : `DELIVERY · ${YOApi.formatMoney(quote.shippingMinor, quote.currency)} · ${quote.estimatedMinDays}-${quote.estimatedMaxDays} DAYS`;
        document.getElementById("checkout-total").textContent = `TOTAL — ${YOApi.formatMoney(total, quote.currency)}`;
        placeOrder.disabled = !cartSnapshot.items.length;
        setCheckoutStatus("");
    } catch (error) {
        quoteLine.textContent = "";
        placeOrder.disabled = true;
        setCheckoutStatus(error.message, true);
    }
}

function toggleDeliveryForm() {
    deliveryAddressForm.classList.toggle("hidden", selectedAddressMode !== "new");
}

function addressChoice(address, index) {
    const label = document.createElement("label");
    label.className = "address-choice data-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "address";
    radio.value = address.id;
    radio.checked = address.isDefault || (selectedAddressMode === "saved" && selectedAddressId === address.id) || (selectedAddressMode !== "new" && index === 0);
    if (radio.checked) {
        selectedAddressMode = "saved";
        selectedAddressId = address.id;
    }
    radio.addEventListener("change", () => {
        selectedAddressMode = "saved";
        selectedAddressId = address.id;
        toggleDeliveryForm();
        void refreshQuote();
    });
    label.append(radio, span(`${address.label} — ${address.fullName}, ${address.line1}, ${address.city}, ${address.country}`));
    return label;
}

function newAddressChoice(checked) {
    const label = document.createElement("label");
    label.className = "address-choice data-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "address";
    radio.value = "new";
    radio.checked = checked;
    if (checked) {
        selectedAddressMode = "new";
        selectedAddressId = null;
    }
    radio.addEventListener("change", () => {
        selectedAddressMode = "new";
        selectedAddressId = null;
        toggleDeliveryForm();
        void refreshQuote();
    });
    label.append(radio, span("USE A NEW DELIVERY ADDRESS"));
    return label;
}

function pickupChoice(location, index) {
    const label = document.createElement("label");
    label.className = "address-choice data-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pickup";
    radio.value = location.id;
    radio.checked = index === 0;
    if (radio.checked) selectedPickupLocationId = location.id;
    radio.addEventListener("change", () => {
        selectedPickupLocationId = location.id;
        void refreshQuote();
    });
    label.append(radio, span(`${location.name} — ${location.city}, ${location.address}`));
    return label;
}

function renderCountries() {
    const countrySelect = deliveryAddressForm.elements.country;
    countrySelect.replaceChildren(...shippingOptions.countries.map((country) => new Option(`${country.name} / ${country.code}`, country.code)));
}

async function loadCheckout() {
    try {
        const user = await YOApi.getCurrentUser();
        if (!user) {
            window.location.href = "auth.html?return=checkout.html";
            return;
        }
        const [cart, addresses, shipping] = await Promise.all([
            YOApi.getCart(),
            YOApi.request("/users/me/addresses", { auth: true }),
            YOApi.request("/shipping/options")
        ]);
        cartSnapshot = cart;
        shippingOptions = shipping;
        contactForm.elements.firstName.value = user.firstName || "";
        contactForm.elements.lastName.value = user.lastName || "";
        contactForm.elements.email.value = user.email || "";
        contactForm.elements.phone.value = user.phone || "";
        deliveryAddressForm.elements.label.value = "HOME";
        renderCountries();
        document.getElementById("checkout-cart").replaceChildren(...cart.items.map((item) => {
            const row = document.createElement("p");
            row.textContent = `${item.product.title} / ${item.size} × ${item.quantity}`;
            return row;
        }));
        document.getElementById("checkout-total").textContent = `SUBTOTAL — ${YOApi.formatMoney(cart.subtotalMinor, cart.currency)}`;
        selectedAddressMode = addresses.length ? "saved" : "new";
        selectedAddressId = null;
        addressList.replaceChildren(...addresses.map(addressChoice), newAddressChoice(!addresses.length));
        toggleDeliveryForm();
        pickupPanel.replaceChildren(...shipping.pickupLocations.map(pickupChoice));
        if (!addresses.length) setCheckoutStatus("Enter a delivery address below or choose pickup");
        if (!cart.items.length) setCheckoutStatus("Your cart is empty");
        await refreshQuote();
    } catch (error) {
        setCheckoutStatus(error.message, true);
    }
}

document.querySelectorAll('input[name="shipping-method"]').forEach((radio) => radio.addEventListener("change", (event) => {
    selectedMethod = event.currentTarget.value;
    document.getElementById("delivery-panel").classList.toggle("hidden", selectedMethod !== "DELIVERY");
    pickupPanel.classList.toggle("hidden", selectedMethod !== "PICKUP");
    void refreshQuote();
}));

[contactForm, deliveryAddressForm].forEach((form) => {
    form.addEventListener("input", () => { if (selectedMethod === "DELIVERY") void refreshQuote(); });
    form.addEventListener("change", () => { if (selectedMethod === "DELIVERY") void refreshQuote(); });
});

placeOrder.addEventListener("click", async () => {
    if (!contactForm.reportValidity()) return;
    if (selectedMethod === "DELIVERY" && selectedAddressMode === "new" && !deliveryAddressForm.reportValidity()) return;
    placeOrder.disabled = true;
    setCheckoutStatus("Creating your order");
    if (!activeIdempotencyKey) {
        activeIdempotencyKey = crypto.randomUUID().replaceAll("-", "");
        sessionStorage.setItem("yo_checkout_key", activeIdempotencyKey);
    }
    try {
        const contact = Object.fromEntries(new FormData(contactForm).entries());
        const order = await YOApi.request("/orders/checkout", {
            method: "POST",
            auth: true,
            headers: { "Idempotency-Key": activeIdempotencyKey },
            body: { ...selection(), ...contact }
        });
        setCheckoutStatus("Order created. Preparing secure payment");
        const payment = await YOApi.request(`/payments/orders/${order.id}/session`, { method: "POST", auth: true });
        if (!/^https:\/\//i.test(payment.checkoutUrl)) throw new Error("Invalid payment destination");
        sessionStorage.removeItem("yo_checkout_key");
        window.location.assign(payment.checkoutUrl);
    } catch (error) {
        setCheckoutStatus(error.message, true);
        placeOrder.disabled = false;
    }
});

void loadCheckout();
