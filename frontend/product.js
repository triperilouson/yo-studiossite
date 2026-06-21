"use strict";

const productSlug = new URLSearchParams(window.location.search).get("id");

async function updateCartCount() {
    const count = document.getElementById("cart-count");
    try {
        const cart = await YOApi.getCart();
        count.textContent = String(cart.items.reduce((total, item) => total + item.quantity, 0));
    } catch (error) {
        if (error.status !== 401) console.error(error);
        count.textContent = "0";
    }
}

function renderProduct(product) {
    const gallery = document.getElementById("product-gallery");
    const slides = product.images.map((source) => {
        const slide = document.createElement("div");
        slide.className = "product-slide";
        const image = document.createElement("img");
        image.src = YOApi.imageUrl(source.url);
        image.alt = source.alt || product.title;
        slide.appendChild(image);
        return slide;
    });
    gallery.replaceChildren(...slides);

    const overlay = document.getElementById("product-overlay");
    const season = document.createElement("p");
    season.textContent = product.season || "YO STUDIOS";
    const title = document.createElement("h1");
    title.textContent = product.title;
    const price = document.createElement("span");
    const description = document.createElement("div");
    description.className = "product-description";
    description.textContent = product.description;
    const sizes = document.createElement("div");
    sizes.className = "sizes";
    const addButton = document.createElement("button");
    addButton.className = "buy-button";
    addButton.type = "button";
    addButton.textContent = "ADD TO CART";
    let selectedVariant = null;

    product.variants.forEach((variant) => {
        const button = document.createElement("button");
        button.className = "size-btn";
        button.type = "button";
        button.textContent = variant.size;
        button.disabled = variant.available < 1;
        button.title = variant.available < 1 ? "Sold out" : `${variant.available} available`;
        button.addEventListener("click", () => {
            sizes.querySelectorAll(".size-btn").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            selectedVariant = variant;
            price.textContent = YOApi.formatMoney(variant.priceMinor, variant.currency);
        });
        sizes.appendChild(button);
    });

    const firstAvailable = product.variants.find((variant) => variant.available > 0) || product.variants[0];
    price.textContent = firstAvailable ? YOApi.formatMoney(firstAvailable.priceMinor, firstAvailable.currency) : "SOLD OUT";
    addButton.disabled = !product.variants.some((variant) => variant.available > 0);
    addButton.addEventListener("click", async () => {
        if (!selectedVariant) {
            addButton.textContent = "SELECT SIZE";
            setTimeout(() => { addButton.textContent = "ADD TO CART"; }, 1200);
            return;
        }
        addButton.disabled = true;
        try {
            await YOApi.addCartItem({ productId: product.id, size: selectedVariant.size, quantity: 1 });
            addButton.textContent = "ADDED";
            await updateCartCount();
        } catch (error) {
            if (error.status === 401) {
                window.location.href = `auth.html?return=${encodeURIComponent(`product.html?id=${product.slug}`)}`;
                return;
            }
            addButton.textContent = error.message.toUpperCase();
        } finally {
            setTimeout(() => {
                addButton.textContent = "ADD TO CART";
                addButton.disabled = false;
            }, 1500);
        }
    });

    overlay.replaceChildren(season, title, price, description, sizes, addButton);
    document.title = `YO — ${product.title}`;
}

async function loadProduct() {
    if (!productSlug) return;
    try {
        renderProduct(await YOApi.getProduct(productSlug));
        await updateCartCount();
    } catch (error) {
        const overlay = document.getElementById("product-overlay");
        const message = document.createElement("h1");
        message.textContent = error.status === 404 ? "PRODUCT NOT FOUND" : "PRODUCT UNAVAILABLE";
        overlay.replaceChildren(message);
        console.error(error);
    }
}

void loadProduct();
