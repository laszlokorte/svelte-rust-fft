import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import {LineSegments2} from './lines/LineSegments2.js'
import {LineMaterial} from './lines/LineMaterial.js'
import {LineSegmentsGeometry} from './lines/LineSegmentsGeometry.js'

export const createScene = (el : HTMLCanvasElement) => {

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 1000);
  const boxGeoX = new THREE.BoxGeometry(10, 10, 10);
  const socketGeo = new THREE.BoxGeometry(10.05, 0.2, 10.05);
  boxGeoX.addGroup(0,6, 0)
  boxGeoX.addGroup(6,Infinity, 1)

  const boxGeo = new THREE.BoxGeometry();
  const light = new THREE.AmbientLight("white", 4);

  const stretchHeight = 0.5

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

   curveGeo.setPositions([0,0,0,0,0,0]);
   curveGeo.addGroup(0,Infinity, 0)
   curveGeo.addGroup(0,Infinity, 1)
   curveGeo.addGroup(0,Infinity, 2)
   curveGeo.addGroup(0,Infinity, 3)
   curveGeo.addGroup(0,Infinity, 4)



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
      0.8,0.8,4,0,
      0.8,0.8,4,0,
      0.8,0.8,4,0
    ]);



  let lineMats = []

  const rotations = [
    {rot: new THREE.Vector3(0, 0*Math.PI/2, 0), color:  0x00ffff, shadow: true, showAxis: true, curveRot: 0},
    {rot: new THREE.Vector3(0, 1*Math.PI/2, 0), color: 0x00ff00, shadow: true, showAxis: true, curveRot: Math.PI},
    {rot: new THREE.Vector3(0, 2*Math.PI/2, 0), color: 0xff00ff, shadow: true, showAxis: true, curveRot: 0},
    {rot: new THREE.Vector3(0, 3*Math.PI/2, 0), color: 0xff0000, shadow: true, showAxis: true, curveRot: 0},
    {rot: new THREE.Vector3(0,0,+Math.PI/2), color: 0x0000ff, shadow: false, showAxis: false, curveRot: 0},
    {rot: new THREE.Vector3(0,0,-Math.PI/2), skip: true},
  ]

  const axees = []

  let cubeSides = []
  let sides = new THREE.Group();

  let i = 1;
  for(let {rot, color, shadow, showAxis, skip, curveRot} of rotations) {
    if(skip) continue;

    let sideOuter = new THREE.Group();
    let sideInner = new THREE.Group();
    let side = new THREE.Group();
    let graph = new THREE.Group();
    let graphOuter = new THREE.Group();
    i++;
    const color_mask_sub = 0b00000000_01000111_01000111_01000111
    const color_mask_add = 0b00000000_10100000_10100000_10100000
    const line_color_mask_sub = 0b00000000_01110111_01110111_01110111
    const line_color_mask_add = 0b00000000_00111111_00111111_00111111
    const window_color_mask_sub = 0b00000000_00110111_00110111_00110111
    const window_color_mask_add = 0b00000000_11000000_11000000_11000000
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: color & color_mask_sub | color_mask_add });
    const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
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

    windowMaterial.stencilWrite = true;
    windowMaterial.stencilRef = i;
    windowMaterial.stencilFunc = THREE.EqualStencilFunc;
    windowMaterial.side = THREE.BackSide;
    windowMaterial.depthWrite = true
    windowMaterial.depthTest = true;

    const cube = new THREE.Mesh(boxGeoX, [nullMaterial, cubeMaterial]);
    const face = new THREE.Mesh(boxGeoX, [faceMaterial, nullMaterial]);

    face.renderOrder = i*2
    cube.renderOrder = i*2+1



    sideInner.add(face);
    sideInner.add(cube);

    sideInner.rotation.x = rot.x
    sideInner.rotation.y = rot.y
    sideInner.rotation.z = rot.z

    side.add(sideInner)

    side.scale.y = stretchHeight

    const axisMaterial = new LineMaterial({
      color: color & 0b00000000_00010111_00010111_00010111,
      linewidth: 2, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });


    axisMaterial.varyWidth = true;
    axisMaterial.stencilWrite = true;
    axisMaterial.stencilRef = i;
    axisMaterial.stencilFunc = THREE.EqualStencilFunc;

    const axis = new LineSegments2(axisGeo, axisMaterial);
    axis.computeLineDistances();
    axis.scale.y = 0.7

    axees.push(graphOuter)

    axis.renderOrder = i*2+5
    axisMaterial.depthTest = true

    if(showAxis)
      graph.add(axis)

    //graph.position.x = 8
    lineMats.push(axisMaterial)


    const outlineMat = new LineMaterial({
      color: color & line_color_mask_sub | line_color_mask_add,
      linewidth: 1.1, // in world units with size attenuation, pixels otherwise
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

    outline.renderOrder = i*2+5




    side.add(outline)

    const curveBarMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color| 0xffffff,
      linewidth: 2, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });


    curveBarMaterial.opacity = 0.7;
    curveBarMaterial.stencilWrite = true;
    curveBarMaterial.stencilRef = i;
    curveBarMaterial.stencilFunc = THREE.EqualStencilFunc;
    curveBarMaterial.linearProjection = true;
    curveBarMaterial.startProjectionMul = new THREE.Vector3(0,0,1);
    curveBarMaterial.startProjectionAdd = new THREE.Vector3(0,0,0);
    curveBarMaterial.endProjectionMul = new THREE.Vector3(1,1,1);
    curveBarMaterial.endProjectionAdd = new THREE.Vector3(0,0,0);

    const curveBars = new LineSegments2(curveGeo, curveBarMaterial);
    curveBars.computeLineDistances();

    curveBars.renderOrder = i*2+3
    graph.add(curveBars)

    graphOuter.add(graph)
    graphOuter.rotation.y = rot.y

    lineMats.push(curveBarMaterial)


    const curveDotMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color&0xa0a0a0| 0x070707,
      linewidth: 6, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });

    lineMats.push(curveDotMaterial)

    curveDotMaterial.stencilWrite = true;
    curveDotMaterial.stencilRef = i;
    curveDotMaterial.stencilFunc = THREE.EqualStencilFunc;

    const curveDots = new LineSegments2(curveGeo, curveDotMaterial);
    curveDots.computeLineDistances();

    curveDots.renderOrder = i*2+4
    graph.add(curveDots)

    const shadow1 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
    });

    lineMats.push(shadow1)

    shadow1.transparent = true
    shadow1.opacity = 0.05
    shadow1.stencilWrite = true;
    shadow1.stencilRef = i;
    shadow1.stencilFunc = THREE.EqualStencilFunc;
    shadow1.linearProjection = true;
    shadow1.startProjectionMul = new THREE.Vector3(0,1,1);
    shadow1.startProjectionAdd = new THREE.Vector3(-5,0,0).applyEuler(new THREE.Euler(0,curveRot,0));
    shadow1.endProjectionMul = new THREE.Vector3(0,1,1);
    shadow1.endProjectionAdd = new THREE.Vector3(-5,0,0).applyEuler(new THREE.Euler(0,curveRot,0));


    const shadow2 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
    });

    lineMats.push(shadow2)

    shadow2.transparent = true
    shadow2.opacity = 0.05
    shadow2.stencilWrite = true;
    shadow2.stencilRef = i;
    shadow2.stencilFunc = THREE.EqualStencilFunc;
    shadow2.linearProjection = true;
    shadow2.startProjectionMul = new THREE.Vector3(1,0,1);
    shadow2.startProjectionAdd = new THREE.Vector3(0,-2.5,0);
    shadow2.endProjectionMul = new THREE.Vector3(1,0,1);
    shadow2.endProjectionAdd = new THREE.Vector3(0,-2.5,0);

    const shadow3 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
    });

    lineMats.push(shadow3)

    shadow3.transparent = true
    shadow3.opacity = 0.05
    shadow3.stencilWrite = true;
    shadow3.stencilRef = i;
    shadow3.stencilFunc = THREE.EqualStencilFunc;
    shadow3.linearProjection = true;
    shadow3.startProjectionMul = new THREE.Vector3(1,1,0);
    shadow3.startProjectionAdd = new THREE.Vector3(0,0,5);
    shadow3.endProjectionMul = new THREE.Vector3(1,1,0);
    shadow3.endProjectionAdd = new THREE.Vector3(0,0,5);


    const shadow4 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
    });

    lineMats.push(shadow4)

    shadow4.transparent = true
    shadow4.opacity = 0.05
    shadow4.stencilWrite = true;
    shadow4.stencilRef = i;
    shadow4.stencilFunc = THREE.EqualStencilFunc;
    shadow4.linearProjection = true;
    shadow4.startProjectionMul = new THREE.Vector3(1,1,0);
    shadow4.startProjectionAdd = new THREE.Vector3(0,0,-5);
    shadow4.endProjectionMul = new THREE.Vector3(1,1,0);
    shadow4.endProjectionAdd = new THREE.Vector3(0,0,-5);


    const curveShadows = new LineSegments2(curveGeo, [shadow1, shadow2, shadow3, shadow4]);
    curveShadows.computeLineDistances();

    curveShadows.renderOrder = i*2+1
    if(shadow)
      graph.add(curveShadows)

    sideOuter.add(graphOuter)

    sideOuter.add(side)


    curveBars.rotation.y = -curveRot
    curveDots.rotation.y = -curveRot
    curveShadows.rotation.y = -curveRot

    sides.add(sideOuter);
    cubeSides.push({curveDots, curveBars, sideOuter, cubeMaterial, face, shadow1, shadow2, shadow3, shadow4, curveBarMaterial, windowMaterial, curveDotMaterial, axisMaterial,outlineMat})
  }
  
  let currentFocus = null
  function focusSide(focus) {
    for(let s=0;s<cubeSides.length;s++) {
      cubeSides[s].sideOuter.visible = focus==null
      cubeSides[s].face.visible = focus==null
      cubeSides[s].cubeMaterial.stencilRef = s+2
      cubeSides[s].windowMaterial.stencilRef = s+2
      cubeSides[s].curveBarMaterial.stencilRef = s+2
      cubeSides[s].curveBarMaterial.opacity = (focus!=null ? 0.5 : 0.2)
      cubeSides[s].curveDotMaterial.stencilRef = s+2
      cubeSides[s].axisMaterial.stencilRef = s+2
      cubeSides[s].outlineMat.stencilRef = s+2
      cubeSides[s].shadow1.stencilRef = s+2
      cubeSides[s].shadow2.stencilRef = s+2
      cubeSides[s].shadow3.stencilRef = s+2
      cubeSides[s].shadow4.stencilRef = s+2
    }

    if(focus!=null) {
      cubeSides[focus].sideOuter.visible = true
      cubeSides[focus].face.visible = false
      cubeSides[focus].cubeMaterial.stencilRef = 0
      cubeSides[focus].windowMaterial.stencilRef = 0
      cubeSides[focus].curveBarMaterial.stencilRef = 0
      cubeSides[focus].curveDotMaterial.stencilRef = 0
      cubeSides[focus].axisMaterial.stencilRef = 0
      cubeSides[focus].outlineMat.stencilRef = 0
      cubeSides[focus].shadow1.stencilRef = 0
      cubeSides[focus].shadow2.stencilRef = 0
      cubeSides[focus].shadow3.stencilRef = 0
      cubeSides[focus].shadow4.stencilRef = 0

      socket.visible = false

      controls.minDistance = 1
      controls.maxDistance = 9
    } else {
      controls.minDistance = 6
      controls.maxDistance = 20
      socket.visible = true
    }

    currentFocus = focus
  }

  
  const dirLight = new THREE.DirectionalLight( "white", 3);
  dirLight.position.x = 7
  dirLight.position.y = 11
  dirLight.position.z = 13
  scene.add(dirLight);

  scene.add(light);
  scene.add(sides);

  const socketMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  socketMat.depthTest = false
  socketMat.depthWrite = false

  const socket = new THREE.Mesh(socketGeo, socketMat);
  socket.position.y=-2.6
  socket.renderOrder = 0
  scene.add(socket);

  camera.position.z = 20;
  camera.position.y = 0.1;


  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: el, alpha: true });

  const controls = new OrbitControls( camera, renderer.domElement );

  controls.addEventListener('end', (e) => {
    const newLength = camera.position.length()


    if(newLength < 7 && currentFocus === null) {
      focusSide(indexOfSmallest(refRotations.map((x) => x.dot(new THREE.Vector3(1,1/stretchHeight,1).multiply(camera.position)))))
    } else if(newLength > 8 && currentFocus === indexOfSmallest(refRotations.map((x) => x.dot(new THREE.Vector3(1,1/stretchHeight,1).multiply(camera.position))))) {
      focusSide(null)
    }
  })

  focusSide(null)
  controls.enablePan  = false

  const refRotations = rotations.map((r) => (new THREE.Vector3(-1,0,0)).applyEuler(new THREE.Euler(r.rot.x, r.rot.y, r.rot.z)))


  function indexOfSmallest(a) {
   var lowest = 0;
   for (var i = 1; i < a.length; i++) {
    if (a[i] < a[lowest]) lowest = i;
   }
   return lowest;
  }

  const animate = () => {
    controls.update();
    dirLight.position.copy(camera.position).sub(new THREE.Vector3(5,-15,1))

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
      axees[4].rotation.y = frac * Math.PI/2
    },
    setSignal(sig) {
     curveGeo.setPositions(sig.map((v,i,a) => [v, i/a.length]).flatMap(([[re, im],t]) => 
        [im,re,(t-0.5)*9.5,
         im,re,(t-0.5)*9.5]));
    }
  }
}
