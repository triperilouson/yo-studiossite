"use strict";

const cartContainer = document.getElementById("cart-items");
const totalElement = document.getElementById("cart-total");
const checkoutButton = document.querySelector(".checkout-info .buy-button");

function message(text, href, linkText) {
    const wrapper = document.createElement("div");
    wrapper.className = "shop-message";
    const line = document.createElement("p");
    line.textContent = text;
    wrapper.appendChild(line);
    if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = linkText;
        wrapper.appendChild(link);
    }
    cartContainer.replaceChildren(wrapper);
}

function control(label, action, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", action);
    return button;
}

async function loadCart() {
    try {
        renderCart(await YOApi.getCart());
    } catch (error) {
        totalElement.textContent = "";
        checkoutButton.disabled = true;
        if (error.status === 401) message("SIGN IN TO VIEW YOUR CART", "auth.html?return=cart.html", "LOGIN");
        else message("CART IS TEMPORARILY UNAVAILABLE");
    }
}

function renderCart(cart) {
    const fragment = document.createDocumentFragment();
    cart.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "cart-item";
        const image = document.createElement("img");
        image.src = YOApi.imageUrl(item.product.images[0]?.url);
        image.alt = item.product.images[0]?.alt || item.product.title;
        const info = document.createElement("div");
        info.className = "cart-info";
        const name = document.createElement("p");
        name.textContent = item.product.title;
        const size = document.createElement("span");
        size.textContent = `SIZE — ${item.size}`;
        const price = document.createElement("span");
        price.textContent = YOApi.formatMoney(item.unitPriceMinor, item.currency);
        const quantity = document.createElement("div");
        quantity.className = "quantity-controls";
        const value = document.createElement("span");
        value.textContent = String(item.quantity);
        quantity.append(
            control("−", async () => {
                if (item.quantity === 1) await YOApi.removeCartItem(item.id);
                else await YOApi.updateCartItem(item.id, item.quantity - 1);
                await loadCart();
            }),
            value,
            control("+", async () => {
                await YOApi.updateCartItem(item.id, item.quantity + 1);
                await loadCart();
            }, item.quantity >= 10 || item.quantity >= item.available)
        );
        const remove = control("REMOVE", async () => {
            await YOApi.removeCartItem(item.id);
            await loadCart();
        });
        remove.className = "remove-button";
        info.append(name, size, document.createElement("br"), price, quantity, remove);
        row.append(image, info);
        fragment.appendChild(row);
    });
    cartContainer.replaceChildren(fragment);
    if (!cart.items.length) message("YOUR CART IS EMPTY", "tshirts.html", "VIEW COLLECTION");
    totalElement.textContent = `TOTAL — ${YOApi.formatMoney(cart.subtotalMinor, cart.currency)}`;
    checkoutButton.disabled = !cart.items.length;
}

checkoutButton.addEventListener("click", () => { window.location.href = "checkout.html"; });
void loadCart();
