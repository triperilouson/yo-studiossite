(function () {
    "use strict";

    async function renderAccountLink() {
        if (!window.YOApi || document.querySelector(".account-button")) return;
        const link = document.createElement("a");
        link.className = "account-button";
        link.href = "auth.html";
        link.textContent = "LOGIN";
        link.setAttribute("aria-label", "Customer account");
        if (document.querySelector(".cart-button")) link.classList.add("with-cart");
        document.body.appendChild(link);
        try {
            const user = await YOApi.getCurrentUser();
            if (user) {
                link.href = "account.html";
                link.textContent = "ACCOUNT";
            }
        } catch {
            link.title = "Account service is temporarily unavailable";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderAccountLink);
    } else {
        void renderAccountLink();
    }
})();
