window.addEventListener("load", () => {

    const loader = document.getElementById("loader");

    setTimeout(() => {

        loader.classList.add("hide");

    }, 3200);

});



// PAGE TRANSITIONS

const links = document.querySelectorAll(".transition-link");

const windAudio = document.getElementById("wind-audio");

links.forEach(link => {

    link.addEventListener("click", function(e){

        e.preventDefault();

        const destination = this.href;

        const transition = document.getElementById("transition");



        // START AUDIO

        if(windAudio){

            windAudio.volume = 0.12;

            windAudio.play().catch(err => {
                console.log(err);
            });

        }



        // START TRANSITION

        transition.classList.add("active");



        // WAIT BEFORE PAGE CHANGE

        setTimeout(() => {

            window.location.href = destination;

        }, 5000);

    });

});

