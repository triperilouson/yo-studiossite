"use strict";

async function loadShop() {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;
    try {
        const products = await YOApi.getProducts();
        products.forEach((product) => {
            const card = document.createElement("a");
            card.className = "shop-card";
            card.href = `product.html?id=${encodeURIComponent(product.slug)}`;
            const image = document.createElement("img");
            image.src = YOApi.imageUrl(product.images[0]?.url);
            image.alt = product.images[0]?.alt || product.title;
            const info = document.createElement("div");
            info.className = "shop-info";
            const title = document.createElement("p");
            title.textContent = product.title;
            const price = document.createElement("span");
            const variant = product.variants[0];
            price.textContent = variant ? YOApi.formatMoney(variant.priceMinor, variant.currency) : "SOLD OUT";
            info.append(title, price);
            card.append(image, info);
            grid.appendChild(card);
        });
    } catch (error) {
        console.error(error);
    }
}

void loadShop();
