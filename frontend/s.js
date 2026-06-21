"use strict";

async function loadCollection() {
    const container = document.getElementById("looks-container");
    try {
        const products = await YOApi.getProducts();
        const collection = products.filter((product) => (product.season || "").toLowerCase().startsWith(COLLECTION_SEASON.toLowerCase()));
        collection.forEach((product) => {
            product.images.forEach((source, index) => {
                const section = document.createElement("section");
                section.className = "look";
                const image = document.createElement("img");
                image.src = YOApi.imageUrl(source.url);
                image.alt = source.alt || product.title;
                image.loading = index === 0 ? "eager" : "lazy";
                section.appendChild(image);
                if (index === 0) {
                    const info = document.createElement("div");
                    info.className = "look-info";
                    const season = document.createElement("p");
                    season.textContent = product.season || COLLECTION_SEASON;
                    const title = document.createElement("h2");
                    title.textContent = product.title;
                    const variant = product.variants[0];
                    const price = document.createElement("span");
                    price.textContent = variant ? YOApi.formatMoney(variant.priceMinor, variant.currency) : "";
                    info.append(season, title, price);
                    section.appendChild(info);
                }
                container.appendChild(section);
            });
        });
        if (!collection.length) {
            const empty = document.createElement("p");
            empty.className = "shop-message";
            empty.textContent = "COLLECTION COMING SOON";
            container.appendChild(empty);
        }
    } catch (error) {
        const message = document.createElement("p");
        message.className = "shop-message";
        message.textContent = "COLLECTION TEMPORARILY UNAVAILABLE";
        container.appendChild(message);
        console.error(error);
    }
}

window.addEventListener("scroll", () => {
    document.querySelectorAll(".look").forEach((look) => {
        const rect = look.getBoundingClientRect();
        const info = look.querySelector(".look-info");
        if (!info) return;
        info.classList.toggle("visible", rect.top < window.innerHeight * 0.8 && rect.bottom > window.innerHeight * 0.2);
    });
});

void loadCollection();
