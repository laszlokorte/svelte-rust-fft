import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import {LineSegments2} from './lines/LineSegments2.js'
import {LineMaterial} from './lines/LineMaterial.js'
import {LineSegmentsGeometry} from './lines/LineSegmentsGeometry.js'

export const createScene = (el : HTMLCanvasElement) => {

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
  const boxGeoX = new THREE.BoxGeometry(10, 10, 10);
  boxGeoX.addGroup(0,6, 0)
  boxGeoX.addGroup(6,Infinity, 1)

  const boxGeo = new THREE.BoxGeometry();
  const light = new THREE.AmbientLight("white", 1);


  const outlineGeo = new LineSegmentsGeometry();
  outlineGeo.setPositions([
    -5,-5,-5,5,-5,-5,
    -5,-5,5,5,-5,5,
    -5,-5,5,-5,-5,-5,
    5,-5,5,5,-5,-5,


    -5,5,-5,5,5,-5,
    -5,5,5,5,5,5,
    -5,5,5,-5,5,-5,
    5,5,5,5,5,-5,

    -5,5,-5,-5,-5,-5,
    5,5,-5,5,-5,-5,
    -5,5,5,-5,-5,5,
    5,5,5,5,-5,5,
  ]);

  outlineGeo.setWidths([
    1,1,1,10,
    1,1,1,1,
    1,1,1,1,1
  ]);




  const curveGeo = new LineSegmentsGeometry();
    curveGeo.setPositions(Array(128).fill(1).map((v,i,a) => [v, i/a.length]).flatMap(([a,x]) => 
      [0,0,(x-0.5)*9.5,
       Math.cos(x*Math.PI*4),-a*Math.sin(x*Math.PI*4),(x-0.5)*9.5]));
    
   const curve2Geo = new LineSegmentsGeometry();
   curve2Geo.setPositions(Array(128).fill(1).map((v,i,a) => [v, i/a.length]).flatMap(([a,x]) => 
      [Math.cos(x*Math.PI*4),-a*Math.sin(x*Math.PI*4),(x-0.5)*9.5,
       Math.cos(x*Math.PI*4),-a*Math.sin(x*Math.PI*4),(x-0.5)*9.5]));


   const curve2GeoShadow = new LineSegmentsGeometry();
   curve2GeoShadow.setPositions(Array(128).fill(1).map((v,i,a) => [v, i/a.length]).flatMap(([a,x]) => 
      [Math.cos(x*Math.PI*4),-a*Math.sin(x*Math.PI*4),5,
       Math.cos(x*Math.PI*4),-a*Math.sin(x*Math.PI*4),5,

      -5,-a*Math.sin(x*Math.PI*4),(x-0.5)*9.5,
      -5,-a*Math.sin(x*Math.PI*4),(x-0.5)*9.5,

      Math.cos(x*Math.PI*4),-5*0.7,(x-0.5)*9.5,
      Math.cos(x*Math.PI*4),-5*0.7,(x-0.5)*9.5
       ]));



    const axisGeo = new LineSegmentsGeometry();
    axisGeo.setPositions([
      -2.8,0,0,
      2.8,0,0,
      2.8,0,0,
      3,0,0,

      0,-2.8,0,
      0,2.8,0,
      0,2.8,0,
      0,3,0,

      0,0,4.8,
      0,0,-4.8,
      0,0,-4.8,
      0,0,-5,
    ]);

    axisGeo.setWidths([
      1,1,4,1,
      1,1,4,1,
      1,1,4,1
    ]);



  let lineMats = []

  const rotations = [
    {rot: new THREE.Vector3(0, 0*Math.PI/2, 0), color:  0x00ffff},
    {rot: new THREE.Vector3(0, 1*Math.PI/2, 0), color: 0x00ff00},
    {rot: new THREE.Vector3(0, 2*Math.PI/2, 0), color: 0xff00ff},
    {rot: new THREE.Vector3(0, 3*Math.PI/2, 0), color: 0xffff00},
    {rot: new THREE.Vector3(0,0,-Math.PI/2), color: 0xff0000},
    {rot: new THREE.Vector3(0,0,+Math.PI/2), color: 0x0000ff},
  ]

  const axees = []

  let sides = new THREE.Group();

  let i = 1;
  for(let {rot, color} of rotations) {
    let sideOuter = new THREE.Group();
    let sideInner = new THREE.Group();
    let side = new THREE.Group();
    let graph = new THREE.Group();
    let graphOuter = new THREE.Group();
    i++;
    const color_mask_sub = 0b00000000_11000111_11000111_11000111
    const color_mask_add = 0b00000000_10111101_10111101_10111101
    const line_color_mask_sub = 0b00000000_01110111_01110111_01110111
    const line_color_mask_add = 0b00000000_00111111_00111111_00111111
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: color & color_mask_sub | color_mask_add });
    const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const nullMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    nullMaterial.depthWrite = false;
    nullMaterial.depthTest = false;
    nullMaterial.colorWrite = false;
    nullMaterial.stencilWrite = false;
    nullMaterial.side = THREE.BackSide;

    faceMaterial.depthWrite = false;
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
    cubeMaterial.depthWrite = false
    cubeMaterial.depthTest = false;

    const cube = new THREE.Mesh(boxGeoX, [cubeMaterial, cubeMaterial]);
    const face = new THREE.Mesh(boxGeoX, [faceMaterial, nullMaterial]);

    face.renderOrder = i*2
    cube.renderOrder = i*2+1



    sideInner.add(face);
    sideInner.add(cube);

    sideInner.rotation.x = rot.x
    sideInner.rotation.y = rot.y
    sideInner.rotation.z = rot.z

    side.add(sideInner)

    side.scale.y = 0.7

    const axisMaterial = new LineMaterial({
      color: color & 0b00000000_00010111_00010111_00010111,
      linewidth: 2, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
    });


    axisMaterial.varyWidth = true;
    axisMaterial.stencilWrite = true;
    axisMaterial.stencilRef = i;
    axisMaterial.stencilFunc = THREE.EqualStencilFunc;

    const axis = new LineSegments2(axisGeo, axisMaterial);
    axis.computeLineDistances();

    axees.push(graphOuter)

    axis.renderOrder = i*2+3
    axisMaterial.depthTest = true
    graph.add(axis)

    //graph.position.x = 8
    lineMats.push(axisMaterial)


    const outlineMat = new LineMaterial({
      color: color & line_color_mask_sub | line_color_mask_add,
      linewidth: 1.3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
    });

    outlineMat.depthTest = true
    outlineMat.depthWrite = true
    outlineMat.transparent = true
    outlineMat.stencilWrite = true;
    outlineMat.stencilRef = i;
    outlineMat.stencilFunc = THREE.EqualStencilFunc;
    lineMats.push(outlineMat)

    const outline = new LineSegments2(outlineGeo, outlineMat);
    outline.computeLineDistances();

    outline.renderOrder = i*2+2




    side.add(outline)

    const curveMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: 0xf0f0f0 | color,
      linewidth: 2, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });


    curveMaterial.stencilWrite = true;
    curveMaterial.stencilRef = i;
    curveMaterial.stencilFunc = THREE.EqualStencilFunc;

    const curve = new LineSegments2(curveGeo, curveMaterial);
    curve.computeLineDistances();

    curve.renderOrder = i*2+3
    graph.add(curve)

    graphOuter.add(graph)
    graphOuter.rotation.y = rot.y

    lineMats.push(curveMaterial)


    const curve2Material = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color,
      linewidth: 5, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    lineMats.push(curve2Material)

    curve2Material.stencilWrite = true;
    curve2Material.stencilRef = i;
    curve2Material.stencilFunc = THREE.EqualStencilFunc;

    const curve2 = new LineSegments2(curve2Geo, curve2Material);
    curve2.computeLineDistances();

    curve2.renderOrder = i*2+4
    graph.add(curve2)

    const curve2MaterialShadow = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: true,
    });

    lineMats.push(curve2MaterialShadow)

    curve2MaterialShadow.transparent = true
    curve2MaterialShadow.opacity = 0.3
    curve2MaterialShadow.stencilWrite = true;
    curve2MaterialShadow.stencilRef = i;
    curve2MaterialShadow.stencilFunc = THREE.EqualStencilFunc;

    const curve2shadow = new LineSegments2(curve2GeoShadow, curve2MaterialShadow);
    curve2shadow.computeLineDistances();

    curve2shadow.renderOrder = i*2+4
    graph.add(curve2shadow)



    sideOuter.add(graphOuter)


    // side.add(outlineMesh)
    sideOuter.add(side)

    sides.add(sideOuter);
  }


  
  const dirLight = new THREE.DirectionalLight( "white", 5);
  dirLight.position.x = 7
  dirLight.position.y = 11
  dirLight.position.z = 13

  scene.add(light);
  scene.add(sides);
  scene.add(dirLight);


  camera.position.z = 20;
  camera.position.y = 0.1;


  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: el, alpha: true });

  const controls = new OrbitControls( camera, renderer.domElement );

  controls.minDistance = 10
  controls.maxDistance = 40
  controls.enablePan  = false

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
  };

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    for(let lm of lineMats) {
      lm.resolution.set(window.innerWidth, window.innerHeight);
    }
  };

  resize();

  renderer.setAnimationLoop(animate);


  window.addEventListener('resize', resize);

  return {
    dispose: () => {
      window.removeEventListener('resize', resize);
      renderer.dispose()
    },
    setFraction(frac) {
      axees[5].rotation.y = frac * Math.PI/2
    }
  }
}
