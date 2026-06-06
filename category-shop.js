fetch('./data/products.json')

.then(response => response.json())

.then(products => {

    const grid = document.getElementById("shop-grid");

    grid.style.gridTemplateColumns =
    "repeat(8, 1fr)";

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
function setColumns(columns){

    const grid = document.getElementById("shop-grid");

    grid.style.gridTemplateColumns =
    `repeat(${columns}, 1fr)`;

    if(window.innerWidth < 900){

        if(columns == 2){
            grid.style.padding = "140px 20px 40px";
            grid.style.columnGap = "60px";
            grid.style.rowGap = "90px";
        }

        if(columns == 4){
            grid.style.padding = "140px 10px 40px";
            grid.style.columnGap = "40px";
            grid.style.rowGap = "60px";
        }

        if(columns == 6){
            grid.style.padding = "140px 5px 40px";
            grid.style.columnGap = "30px";
            grid.style.rowGap = "45px";
        }

        if(columns == 8){
            grid.style.padding = "140px 0px 40px";
            grid.style.columnGap = "20px";
            grid.style.rowGap = "30px";
        }

    }

}