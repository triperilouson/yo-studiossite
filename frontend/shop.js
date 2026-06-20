fetch('./data/products.json')

.then(response => response.json())

.then(products => {

    const grid = document.getElementById("shop-grid");



    const filtered = products.filter(product =>

        product.category === CATEGORY

    );



    filtered.forEach(product => {

        grid.innerHTML += `

        <a href="product.html?id=${product.id}"

        class="shop-card">

            <img src="${product.preview}">

            <div class="shop-info">

                <p>${product.name}</p>

                <span>${product.price}</span>

            </div>

        </a>

        `;

    });

});
