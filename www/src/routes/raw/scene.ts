import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';

export const createScene = (el : HTMLCanvasElement) => {

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 1000);
  const boxGeoX = new THREE.BoxGeometry(10, 10, 10);
  boxGeoX.addGroup(0,6, 0)
  boxGeoX.addGroup(6,Infinity, 1)

  const boxGeo = new THREE.BoxGeometry();
  const light = new THREE.AmbientLight("white", 0.3);


  let renderer : THREE.Renderer;

  const rotations = [
    {rot: new THREE.Vector3(0, 0*Math.PI/2, 0), color: 0xdd7777},
    {rot: new THREE.Vector3(0, 1*Math.PI/2, 0), color: 0x77dd77},
    {rot: new THREE.Vector3(0, 2*Math.PI/2, 0), color: 0x7777dd},
    {rot: new THREE.Vector3(0, 3*Math.PI/2, 0), color: 0xdddd77},
    {rot: new THREE.Vector3(0,0,-Math.PI/2), color: 0x77dddd},
    {rot: new THREE.Vector3(0,0,+Math.PI/2), color: 0xdd77dd},
  ]

  let sides = new THREE.Group();

  let i = 1;
  for(let {rot, color} of rotations) {
    let sideOuter = new THREE.Group();
    let side = new THREE.Group();
    i++;
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: color });
    const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const nullMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    nullMaterial.depthWrite = false;
    nullMaterial.depthTest = false;
    nullMaterial.colorWrite = false;
    nullMaterial.stencilWrite = false;
    nullMaterial.side = THREE.BackSide;

    faceMaterial.depthWrite = true;
    faceMaterial.depthTest = false;
    faceMaterial.colorWrite = true;
    faceMaterial.stencilWrite = true;
    faceMaterial.stencilRef = i;
    faceMaterial.stencilFunc = THREE.AlwaysStencilFunc;
    faceMaterial.stencilZPass = THREE.ReplaceStencilOp;
    faceMaterial.side = THREE.FrontSide;

    cubeMaterial.stencilWrite = true;
    cubeMaterial.stencilRef = i;
    cubeMaterial.stencilFunc = THREE.EqualStencilFunc;
    cubeMaterial.side = THREE.BackSide;

    const cube = new THREE.Mesh(boxGeoX, [nullMaterial, cubeMaterial]);
    const face = new THREE.Mesh(boxGeoX, [faceMaterial, nullMaterial]);

    face.renderOrder = i*2
    cube.renderOrder = i*2+1

    const light = new THREE.DirectionalLight( "white", 1);
    light.position.x = 1
    light.position.y = 2
    light.position.z = 3

    side.add(face);
    side.add(cube);
    side.add(light);

    side.rotation.x = rot.x
    side.rotation.y = rot.y
    side.rotation.z = rot.z

    sideOuter.scale.y = 0.7

    

    const curveMat = new MeshLineMaterial( { color: color&0xafa0a0, lineWidth: 0.03, sizeAttenuation : 1 } );

    curveMat.stencilWrite = true;
    curveMat.stencilRef = i;
    curveMat.stencilFunc = THREE.EqualStencilFunc;

    // Create the final object to add to the scene
    const linex = new MeshLine();
    linex.setPoints([-5,0,0,5,0,0]);
    const liney = new MeshLine();
    liney.setPoints([0,-4,0,0,4,0]);
    const linez = new MeshLine();
    linez.setPoints([0,0,-3,0,0,3]);

    const splineObjectX = new THREE.Mesh( linex, curveMat );
    const splineObjectY = new THREE.Mesh( liney, curveMat );
    const splineObjectZ = new THREE.Mesh( linez, curveMat );

    splineObjectX.renderOrder = i*2+2
    splineObjectY.renderOrder = i*2+2
    splineObjectZ.renderOrder = i*2+2

    splineObjectX.rotation.y = Math.PI/2
    splineObjectY.rotation.y = Math.PI/2
    splineObjectZ.rotation.y = Math.PI/2

    side.add(splineObjectX)
    side.add(splineObjectY)
    side.add(splineObjectZ)

    splineObjectX.renderOrder = 2*i + 4
    splineObjectY.renderOrder = 2*i + 4
    splineObjectZ.renderOrder = 2*i + 4

     const outline = new MeshLine();
    outline.setPoints([
      -5,-5,-5,
      -5,-5,5,
      -5,-5,5,
      -5,5,5,
      -5,-5,5,
      5,-5,5,
      5,-5,5,
      5,5,5,
      5,-5,5,
      5,-5,-5,
      5,-5,-5,
      5,5,-5,
      5,-5,-5,
      -5,-5,-5,
      -5,-5,-5,
      -5,5,-5,
      -5,5,-5,
      -5,5,5,
      -5,5,5,
      5,5,5,
      5,5,5,
      5,5,-5,
      5,5,-5,
      -5,5,-5,
      -5,5,-5,
     ]);

    const outlineMat = new MeshLineMaterial( { depthTest: false, color: color&0xfcfcfc, lineWidth: 0.004, sizeAttenuation : 0 } )

    outlineMat.stencilWrite = true;
    outlineMat.stencilRef = i;
    outlineMat.stencilFunc = THREE.EqualStencilFunc;

    const outlineMesh = new THREE.Mesh( outline, outlineMat );
    outlineMesh.renderOrder = i*2+3



    side.add(outlineMesh)
    sideOuter.add(side)

    sides.add(sideOuter);
  }



  scene.add(light);
  scene.add(sides);


  camera.position.z = 20;
  camera.position.y = 0.1;

  let animationFrame;


  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: el });
  

  const controls = new OrbitControls( camera, renderer.domElement );

  controls.minDistance = 15

  const animate = () => {
    animationFrame = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };

  resize();
  animate();



  window.addEventListener('resize', resize);

  return () => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(animationFrame)
  }
}
