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

    const names = document.querySelectorAll(".shop-info p");
    const prices = document.querySelectorAll(".shop-info span");
    const infos = document.querySelectorAll(".shop-info");

    if(columns == 2){

        grid.style.columnGap = "60px";
        grid.style.rowGap = "120px";

        infos.forEach(el=>{
            el.style.marginTop = "24px";
        });

        names.forEach(el=>{
            el.style.fontSize = "18px";
            el.style.letterSpacing = "4px";
            el.style.marginBottom = "14px";
        });

        prices.forEach(el=>{
            el.style.fontSize = "14px";
        });

    }

    if(columns == 4){

        grid.style.columnGap = "40px";
        grid.style.rowGap = "80px";

        infos.forEach(el=>{
            el.style.marginTop = "18px";
        });

        names.forEach(el=>{
            el.style.fontSize = "13px";
            el.style.letterSpacing = "3px";
            el.style.marginBottom = "10px";
        });

        prices.forEach(el=>{
            el.style.fontSize = "12px";
        });

    }

    if(columns == 6){

        grid.style.columnGap = "25px";
        grid.style.rowGap = "50px";

        infos.forEach(el=>{
            el.style.marginTop = "12px";
        });

        names.forEach(el=>{
            el.style.fontSize = "11px";
            el.style.letterSpacing = "2px";
            el.style.marginBottom = "8px";
        });

        prices.forEach(el=>{
            el.style.fontSize = "10px";
        });

    }

    if(columns == 8){

        grid.style.columnGap = "15px";
        grid.style.rowGap = "30px";

        infos.forEach(el=>{
            el.style.marginTop = "8px";
        });

        names.forEach(el=>{
            el.style.fontSize = "9px";
            el.style.letterSpacing = "1.5px";
            el.style.marginBottom = "6px";
        });

        prices.forEach(el=>{
            el.style.fontSize = "8px";
        });

    }

}