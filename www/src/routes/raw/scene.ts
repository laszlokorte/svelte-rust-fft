import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import {LineSegments2} from './lines/LineSegments2.js'
import {LineMaterial} from './lines/LineMaterial.js'
import {LineSegmentsGeometry} from './lines/LineSegmentsGeometry.js'

export const createScene = (el : HTMLCanvasElement) => {

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 1000);
  const boxGeoX = new THREE.BoxGeometry(10, 10, 10);
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
    
   const curve2Geo = new LineSegmentsGeometry();

   const curve2GeoShadow = new LineSegmentsGeometry();
    curveGeo.setPositions([0,0,0,0,0,0]);
   curve2Geo.setPositions([0,0,0,0,0,0]);

   curve2GeoShadow.setPositions([0,0,0,0,0,0]);




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
    {rot: new THREE.Vector3(0, 0*Math.PI/2, 0), color:  0x00ffff, shadow: true, showAxis: true},
    {rot: new THREE.Vector3(0, 1*Math.PI/2, 0), color: 0x00ff00, shadow: true, showAxis: true},
    {rot: new THREE.Vector3(0, 2*Math.PI/2, 0), color: 0xff00ff, shadow: true, showAxis: true},
    {rot: new THREE.Vector3(0, 3*Math.PI/2, 0), color: 0xff0000, shadow: true, showAxis: true},
    {rot: new THREE.Vector3(0,0,-Math.PI/2), color: 0xffff00, shadow: false, showAxis: false},
    {rot: new THREE.Vector3(0,0,+Math.PI/2), color: 0x0000ff, shadow: false, showAxis: false},
  ]

  const axees = []

  let cubeSides = []
  let sides = new THREE.Group();

  let i = 1;
  for(let {rot, color, shadow, showAxis} of rotations) {
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

    const curveMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color| 0xffffff,
      linewidth: 3, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: true
    });


    curveMaterial.opacity = 0.7;
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
      color: color&0xa0a0a0| 0x070707,
      linewidth: 6, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      dashed: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: true
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
      depthTest: true,
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

    curve2shadow.renderOrder = i*2+1
    if(shadow)
      graph.add(curve2shadow)

    sideOuter.add(graphOuter)

    sideOuter.add(side)

    sides.add(sideOuter);
    cubeSides.push({sideOuter, cubeMaterial, face, curve2MaterialShadow, curveMaterial, windowMaterial, curve2Material, axisMaterial,outlineMat})
  }
  
  let currentFocus = null
  function focusSide(focus) {
    for(let s=0;s<cubeSides.length;s++) {
      cubeSides[s].sideOuter.visible = focus==null
      cubeSides[s].face.visible = focus==null
      cubeSides[s].cubeMaterial.stencilRef = s+2
      cubeSides[s].windowMaterial.stencilRef = s+2
      cubeSides[s].curveMaterial.stencilRef = s+2
      cubeSides[s].curve2Material.stencilRef = s+2
      cubeSides[s].axisMaterial.stencilRef = s+2
      cubeSides[s].outlineMat.stencilRef = s+2
      cubeSides[s].curve2MaterialShadow.stencilRef = s+2
    }

    if(focus!=null) {
      cubeSides[focus].sideOuter.visible = true
      cubeSides[focus].face.visible = false
      cubeSides[focus].cubeMaterial.stencilRef = 0
      cubeSides[focus].windowMaterial.stencilRef = 0
      cubeSides[focus].curveMaterial.stencilRef = 0
      cubeSides[focus].curve2Material.stencilRef = 0
      cubeSides[focus].axisMaterial.stencilRef = 0
      cubeSides[focus].outlineMat.stencilRef = 0
      cubeSides[focus].curve2MaterialShadow.stencilRef = 0

      controls.minDistance = 1
      controls.maxDistance = 9
    } else {
      controls.minDistance = 6
      controls.maxDistance = 20
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
      axees[5].rotation.y = frac * Math.PI/2
    },
    setSignal(sig) {
     curveGeo.setPositions(sig.map((v,i,a) => [v, i/a.length]).flatMap(([[re, im],t]) => 
        [0,0,(t-0.5)*9.5,
         im,re,(t-0.5)*9.5]));
     curve2Geo.setPositions(sig.map((v,i,a) => [v, i/a.length]).flatMap(([[re, im],t]) => 
        [im,re,(t-0.5)*9.5,
         im,re,(t-0.5)*9.5]));

     curve2GeoShadow.setPositions(sig.map((v,i,a) => [v, i/a.length]).flatMap(([[re, im],t]) => 
        [im,re,5,
         im,re,5,

         im,re,-5,
         im,re,-5,

        -5,re,(t-0.5)*9.5,
        -5,re,(t-0.5)*9.5,

        im,-5*stretchHeight,(t-0.5)*9.5,
        im,-5*stretchHeight,(t-0.5)*9.5,

        im,5*stretchHeight,(t-0.5)*9.5,
        im,5*stretchHeight,(t-0.5)*9.5,
         ]));

    }
  }
}
