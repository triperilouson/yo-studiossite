fetch(DATA_FILE)

.then(response => response.json())

.then(products => {

    const container = document.getElementById("looks-container");

    products.forEach(product => {

        product.images.forEach((image,index) => {

            const section = document.createElement("section");

            section.className = "look";



            section.innerHTML = `

                <img src="${image}">

                ${index === 0 ? `

                <div class="look-info">

                    <p>${product.season}</p>

                    <h2>${product.name}</h2>

                    <span>${product.price}</span>

                </div>

                ` : ``}

            `;



            container.appendChild(section);

        });

    });

});



// SCROLL ACTIVATION

window.addEventListener("scroll", () => {

    const looks = document.querySelectorAll(".look");

    looks.forEach(look => {

        const rect = look.getBoundingClientRect();

        const info = look.querySelector(".look-info");



        if(!info) return;



        if(

            rect.top < window.innerHeight * 0.8 &&
            rect.bottom > window.innerHeight * 0.2

        ){

            info.classList.add("visible");

        }else{

            info.classList.remove("visible");

        }

    });

});