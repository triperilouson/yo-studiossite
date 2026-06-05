let cart = JSON.parse(localStorage.getItem("cart")) || [];

const container = document.getElementById("cart-items");

const totalElement = document.getElementById("cart-total");



function saveCart(){

    localStorage.setItem("cart", JSON.stringify(cart));

}



function renderCart(){



    container.innerHTML = "";



    let total = 0;



    cart.forEach((product,index) => {



        total +=

        Number(product.price.replace("$","")) * product.quantity;



        container.innerHTML += `

        <div class="cart-item">

            <img src="${product.preview}">



            <div class="cart-info">

                <p>${product.name}</p>

                <span>${product.price}</span>



                <div class="quantity-controls">

                    <button onclick="decreaseQuantity(${index})">

                        −

                    </button>



                    <span>

                        ${product.quantity}

                    </span>



                    <button onclick="increaseQuantity(${index})">

                        +

                    </button>

                </div>



                <button

                class="remove-button"

                onclick="removeItem(${index})">

                    REMOVE

                </button>

            </div>

        </div>

        `;

    });



    totalElement.innerHTML = `

        TOTAL — $${total}

    `;



    saveCart();

}



function increaseQuantity(index){

    cart[index].quantity++;

    renderCart();

}



function decreaseQuantity(index){

    if(cart[index].quantity > 1){

        cart[index].quantity--;

    }else{

        cart.splice(index,1);

    }



    renderCart();

}



function removeItem(index){

    cart.splice(index,1);

    renderCart();

}



renderCart();