import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x111111);



const camera = new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
1000
);

camera.position.set(0,2,5);



const renderer = new THREE.WebGLRenderer();

renderer.setSize(
window.innerWidth,
window.innerHeight
);

document.body.appendChild(
renderer.domElement
);



const light = new THREE.DirectionalLight(
0xffffff,
3
);

light.position.set(
5,
10,
5
);

scene.add(light);



const floor = new THREE.Mesh(

new THREE.PlaneGeometry(
50,
50
),

new THREE.MeshStandardMaterial({

color:0x222222

})

);

floor.rotation.x = -Math.PI/2;

scene.add(floor);



const keys = {};



document.addEventListener(
'keydown',
e => keys[e.key.toLowerCase()] = true
);

document.addEventListener(
'keyup',
e => keys[e.key.toLowerCase()] = false
);



function animate(){

    requestAnimationFrame(
        animate
    );



    if(keys["w"])
        camera.position.z -= 0.1;

    if(keys["s"])
        camera.position.z += 0.1;

    if(keys["a"])
        camera.position.x -= 0.1;

    if(keys["d"])
        camera.position.x += 0.1;



    renderer.render(
        scene,
        camera
    );

}

animate();