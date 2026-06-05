const params = new URLSearchParams(window.location.search);

const productId = params.get("id");



let cart = JSON.parse(localStorage.getItem("cart")) || [];



fetch('./data/products.json')

.then(response => response.json())

.then(products => {

    const product = products.find(p => p.id === productId);



    const gallery = document.getElementById("product-gallery");

    const overlay = document.getElementById("product-overlay");

    const cartCount = document.getElementById("cart-count");



    if(cartCount){

        cartCount.innerText = cart.length;

    }



    product.images.forEach(image => {

        gallery.innerHTML += `

        <div class="product-slide">

            <img src="${image}">

        </div>

        `;

    });



    overlay.innerHTML = `

        <p>${product.season}</p>

        <h1>${product.name}</h1>

        <span>${product.price}</span>

        <div class="product-description">

            ${product.description}

        </div>

        <button class="buy-button">

            ADD TO CART

        </button>

    `;



    const button = document.querySelector(".buy-button");



    button.addEventListener("click", () => {



        
        const existing = cart.find(item => item.id === product.id);



        if(existing){

            existing.quantity++;

        }else{

            cart.push({

                ...product,

                quantity:1

            });

        }


        localStorage.setItem("cart", JSON.stringify(cart));



        if(cartCount){

            cartCount.innerText = cart.length;

        }



        button.innerText = "ADDED";



        setTimeout(() => {

            button.innerText = "ADD TO CART";

        },1200);

    });

});