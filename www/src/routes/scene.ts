import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import {LineSegments} from './lines/LineSegments.js'
import {LineMaterial} from './lines/LineMaterial.js'
import {LineSegmentsGeometry} from './lines/LineSegmentsGeometry.js'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry';

export const createScene = (el : HTMLCanvasElement) => {


  const labelsTextures = ["Re","Im","t","f"].map((l) => {
    const ctx = document.createElement('canvas').getContext('2d');
    if(ctx) {
      const texRes = 128
      ctx.canvas.width = texRes;
      ctx.canvas.height = texRes;
      ctx.translate(texRes/2,texRes/2)
      ctx.rotate(-Math.PI/2)
      ctx.translate(0,texRes/4)

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = "center"; 
      ctx.fillStyle = '#fff';
      ctx.font = Math.round(texRes*0.8) + "px Georgia"
      ctx.fillText(l,0,0)
      return new THREE.CanvasTexture(ctx.canvas);
    }
  })

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 1000);
  const boxGeoX = new THREE.BoxGeometry(10, 10, 10);
  const socketGeo = new THREE.BoxGeometry(10.05, 0.2, 10.05);
  boxGeoX.addGroup(0,6, 0)
  boxGeoX.addGroup(6,Infinity, 1)

  const boxGeo = new THREE.BoxGeometry();
  const labelGeo = new THREE.PlaneGeometry(.3,.3);
  const light = new THREE.AmbientLight("white", 4);

  const stretchHeight = 1/1.618

  const outlineGeo = new LineSegmentsGeometry(3, 1);
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


  const labelGeoNew = new LineSegmentsGeometry(3, 1, [LineSegmentsGeometry.squareCapStart(-3,3)]);
  labelGeoNew.setPositions([
    0,0.0,0,
    0,0.0,0,
    0,0.0,0
  ]);

    
   const curveGeo = new LineSegmentsGeometry(2, 0);

   curveGeo.setPositions([0,0,0,0]);
   curveGeo.addGroup(0,Infinity, 0)
   curveGeo.addGroup(0,Infinity, 1)
   curveGeo.addGroup(0,Infinity, 2)
   curveGeo.addGroup(0,Infinity, 3)
   curveGeo.addGroup(0,Infinity, 4)

   const curveGeoAlt = new LineSegmentsGeometry(2, 0);

   curveGeoAlt.setPositions([0,0,0,0]);
   curveGeoAlt.addGroup(0,Infinity, 0)
   curveGeoAlt.addGroup(0,Infinity, 1)
   curveGeoAlt.addGroup(0,Infinity, 2)
   curveGeoAlt.addGroup(0,Infinity, 3)
   curveGeoAlt.addGroup(0,Infinity, 4)



    const axisGeo = new LineSegmentsGeometry(3, 1, [LineSegmentsGeometry.roundCapStart, LineSegmentsGeometry.arrowCapEnd]);
    axisGeo.setPositions([
      -2.8,0,0,
      2.8,0,0,

      0,-2.8,0,
      0,2.8,0,

      0,0,4.5,
      0,0,-4.5,
    ]);



  let lineMats = []
  let polarMaterials = []
  let polarHide = []

  const rotations = [
    {rot: new THREE.Vector3(0, 0*Math.PI/2, 0), color:  0x00ffff, shadow: true, showAxis: true, curve: curveGeo, xAxisLabel: 2, reflector: new THREE.Vector3(1,1,-1)},
    {rot: new THREE.Vector3(0, 1*Math.PI/2, 0), color: 0x00ff00, shadow: true, showAxis: true, curve: curveGeoAlt, xAxisLabel: 3, reflector: new THREE.Vector3(1,1,1)},
    {rot: new THREE.Vector3(0, 2*Math.PI/2, 0), color: 0xff00ff, shadow: true, showAxis: true, curve: curveGeo, xAxisLabel: 2, reflector: new THREE.Vector3(1,1,1)},
    {rot: new THREE.Vector3(0, 3*Math.PI/2, 0), color: 0xff0000, shadow: true, showAxis: true, curve: curveGeoAlt, xAxisLabel: 3, reflector: new THREE.Vector3(1,1,-1)},
    {rot: new THREE.Vector3(0,0,+Math.PI/2), color: 0x0000ff, shadow: false, showAxis: false, curve: curveGeo, xAxisLabel: 2, reflector: new THREE.Vector3(1,1,1)},
    {rot: new THREE.Vector3(0,0,-Math.PI/2), skip: true},
  ]

  const axees = []

  let cubeSides = []
  let labels = []
  let sides = new THREE.Group();

  let i = 1;
  for(let {rot, color, shadow, showAxis, skip, curve, xAxisLabel, reflector} of rotations) {
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
    cubeMaterial.depthWrite = true
    cubeMaterial.depthTest = true;

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
      linewidth: 0.7, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: true,
      depthTest: true,
      depthWrite: true,
      transparent: true,
    });


    polarMaterials.push(axisMaterial)
    axisMaterial.polar = true;
    axisMaterial.polarSourceLength = 30;
    axisMaterial.polarRadiusScale = 0.2;
    axisMaterial.polarRadiusBase = 2.5;
    axisMaterial.stencilWrite = true;
    axisMaterial.stencilRef = i;
    axisMaterial.stencilFunc = THREE.EqualStencilFunc;

    const axis = new LineSegments(axisGeo, axisMaterial);
    axis.scale.y = 0.7

    axees.push(graphOuter)

    polarHide.push(axis)
    axis.renderOrder = i*2+5
    axisMaterial.depthTest = true

    const labelMatX = new LineMaterial({ color: 0x000000 });
    labelMatX.polar = false;
    labelMatX.polarSourceLength = 30;
    labelMatX.polarRadiusBase = 0;
    labelMatX.stencilWrite = true;
    labelMatX.stencilRef = i;
    labelMatX.alphaMap = labelsTextures[1]
    labelMatX.transparent = true
    labelMatX.stencilFunc = THREE.EqualStencilFunc;
    labelMatX.depthTest = false;
    labelMatX.depthWrite = false;
    labelMatX.linewidth = 6;
    labelMatX.textured = true;

    const labelMatY = new LineMaterial({ color: 0x000000 });
    labelMatY.polar = false;
    labelMatY.polarSourceLength = 30;
    labelMatY.polarRadiusBase = 2.5;
    labelMatY.stencilWrite = true;
    labelMatY.stencilRef = i;
    labelMatY.alphaMap = labelsTextures[0]
    labelMatY.transparent = true
    labelMatY.stencilFunc = THREE.EqualStencilFunc;
    labelMatY.depthTest = false;
    labelMatY.depthWrite = false;
    labelMatY.linewidth = 6;
    labelMatY.textured= true;

    const labelMatZ = new LineMaterial({ color: 0x000000 });
    labelMatZ.polar = false;
    labelMatZ.polarSourceLength = 30;
    labelMatZ.polarRadiusBase = 2.5;
    labelMatZ.stencilWrite = true;
    labelMatZ.stencilRef = i;
    labelMatZ.alphaMap = labelsTextures[xAxisLabel]
    labelMatZ.transparent = true
    labelMatZ.stencilFunc = THREE.EqualStencilFunc;
    labelMatZ.depthTest = false;
    labelMatZ.depthWrite = false;
    labelMatZ.linewidth = 6;
    labelMatZ.textured = true;

    const xLabel = new LineSegments(labelGeoNew, labelMatX);
    xLabel.renderOrder = i*2+150
    xLabel.position.x = 2.8;
    labels.push(xLabel)


    const yLabel = new LineSegments(labelGeoNew, labelMatY);
    yLabel.renderOrder = i*2+150
    yLabel.position.y = 2.8;
    labels.push(yLabel)

    const zLabel = new LineSegments(labelGeoNew, labelMatZ);
    zLabel.renderOrder = i*2+150
    zLabel.position.z = -4.5;
    labels.push(zLabel)


    polarHide.push(xLabel, yLabel, zLabel)

    if(showAxis) {
      axis.add(xLabel)
      axis.add(yLabel)
      axis.add(zLabel)

      graph.add(axis)
    }

    //graph.position.x = 8
    lineMats.push(axisMaterial)

    lineMats.push(labelMatX, labelMatY, labelMatZ)

    const outlineMat = new LineMaterial({
      color: color & line_color_mask_sub | line_color_mask_add,
      linewidth: 0.7, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: true,
    });

    outlineMat.depthTest = false
    outlineMat.depthWrite = true
    outlineMat.transparent = true
    outlineMat.stencilWrite = true;
    outlineMat.stencilRef = i;
    outlineMat.stencilFunc = THREE.EqualStencilFunc;
    lineMats.push(outlineMat)

    const outline = new LineSegments(outlineGeo, outlineMat);

    outline.renderOrder = i*2+1




    side.add(outline)

    const curveBarMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color| 0xffffff,
      linewidth: 1, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });


    polarMaterials.push(curveBarMaterial)
    curveBarMaterial.polar = true;
    curveBarMaterial.polarSourceLength = 4.3;
    curveBarMaterial.polarRadiusScale = 0.5;
    curveBarMaterial.polarRadiusBase = 2.5;
    curveBarMaterial.opacity = 0.7;
    curveBarMaterial.stencilWrite = true;
    curveBarMaterial.stencilRef = i;
    curveBarMaterial.stencilFunc = THREE.EqualStencilFunc;
    curveBarMaterial.linearProjected = true;
    curveBarMaterial.startProjectionMul = new THREE.Vector3(0,0,reflector.z);
    curveBarMaterial.startProjectionAdd = new THREE.Vector3(0,0,0);
    curveBarMaterial.endProjectionMul = new THREE.Vector3(reflector.x,reflector.y,reflector.z);
    curveBarMaterial.endProjectionAdd = new THREE.Vector3(0,0,0);

    const curveBars = new LineSegments(curve, curveBarMaterial);

    curveBars.renderOrder = i*2+6
    graph.add(curveBars)

    graphOuter.add(graph)
    graphOuter.rotation.y = rot.y

    lineMats.push(curveBarMaterial)


    const curveDotMaterial = new LineMaterial({
      // color: color & 0b00000000_01000000_01000000_01000000 | 0b00000000_10111111_10111111_10111111,
      color: color&0xa0a0a0| 0x070707,
      linewidth: 2.2, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });

    lineMats.push(curveDotMaterial)

    polarMaterials.push(curveDotMaterial)
    curveDotMaterial.polar = true;
    curveDotMaterial.polarSourceLength = 4.3;
    curveDotMaterial.polarRadiusScale = 0.5;
    curveDotMaterial.polarRadiusBase = 2.5;
    curveDotMaterial.stencilWrite = true;
    curveDotMaterial.stencilRef = i;
    curveDotMaterial.stencilFunc = THREE.EqualStencilFunc;
    curveDotMaterial.linearProjected = true;
    curveDotMaterial.startProjectionMul = reflector;
    curveDotMaterial.startProjectionAdd = new THREE.Vector3(0,0,0);
    curveDotMaterial.endProjectionMul = reflector;
    curveDotMaterial.endProjectionAdd = new THREE.Vector3(0,0,0);

    const curveDots = new LineSegments(curve, curveDotMaterial);

    curveDots.renderOrder = i*2+7
    graph.add(curveDots)

    const shadow1 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 1.0, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });

    lineMats.push(shadow1)

    shadow1.transparent = true
    shadow1.opacity = 0.05
    shadow1.stencilWrite = true;
    shadow1.stencilRef = i;
    shadow1.stencilFunc = THREE.EqualStencilFunc;
    shadow1.linearProjected = true;
    shadow1.startProjectionMul = new THREE.Vector3(0,reflector.y,reflector.z);
    shadow1.startProjectionAdd = new THREE.Vector3(-5,0,0);
    shadow1.endProjectionMul = new THREE.Vector3(0,reflector.y,reflector.z);
    shadow1.endProjectionAdd = new THREE.Vector3(-5,0,0);

    const shadow2 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 1.0, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });

    lineMats.push(shadow2)
    polarMaterials.push(shadow2)
    shadow2.polar = true;
    shadow2.polarSourceLength = 4.3;
    shadow2.polarRadiusScale = 0.5;
    shadow2.polarRadiusBase = 2.5;
    shadow2.transparent = true
    shadow2.opacity = 0.05
    shadow2.stencilWrite = true;
    shadow2.stencilRef = i;
    shadow2.stencilFunc = THREE.EqualStencilFunc;
    shadow2.linearProjected = true;
    shadow2.startProjectionMul = new THREE.Vector3(reflector.x,0,reflector.z);
    shadow2.startProjectionAdd = new THREE.Vector3(0,-5*stretchHeight,0);
    shadow2.endProjectionMul = new THREE.Vector3(reflector.x,0,reflector.z);
    shadow2.endProjectionAdd = new THREE.Vector3(0,-5*stretchHeight,0);

    const shadow3 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 1.0, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });

    lineMats.push(shadow3)

    shadow3.transparent = true
    shadow3.opacity = 0.05
    shadow3.stencilWrite = true;
    shadow3.stencilRef = i;
    shadow3.stencilFunc = THREE.EqualStencilFunc;
    shadow3.linearProjected = true;
    shadow3.startProjectionMul = new THREE.Vector3(reflector.x,reflector.y,0);
    shadow3.startProjectionAdd = new THREE.Vector3(0,0,5);
    shadow3.endProjectionMul = new THREE.Vector3(reflector.x,reflector.y,0);
    shadow3.endProjectionAdd = new THREE.Vector3(0,0,5);


    const shadow4 = new LineMaterial({
      color: color & 0b00000000_01110000_01110000_01110000,
      linewidth: 1.0, // in world units with size attenuation, pixels otherwise
      vertexColors: false,
      alphaToCoverage: false,
      depthTest: false,
      depthWrite: false,
      project2d: true,
      project2DStart: new THREE.Vector3(0,0,-4.3),
      project2DEnd: new THREE.Vector3(0,0,4.3),
    });

    lineMats.push(shadow4)

    shadow4.transparent = true
    shadow4.opacity = 0.05
    shadow4.stencilWrite = true;
    shadow4.stencilRef = i;
    shadow4.stencilFunc = THREE.EqualStencilFunc;
    shadow4.linearProjected = true;
    shadow4.startProjectionMul = new THREE.Vector3(reflector.x,reflector.y,0);
    shadow4.startProjectionAdd = new THREE.Vector3(0,0,-5);
    shadow4.endProjectionMul = new THREE.Vector3(reflector.x,reflector.y,0);
    shadow4.endProjectionAdd = new THREE.Vector3(0,0,-5);

    polarHide.push(shadow1, shadow3, shadow4)
    const curveShadows = new LineSegments(curve, [shadow1, shadow2, shadow3, shadow4]);

    curveShadows.renderOrder = i*2+1
    if(shadow)
      graph.add(curveShadows)

    sideOuter.add(graphOuter)

    sideOuter.add(side)

    sides.add(sideOuter);
    cubeSides.push({labelMatX,labelMatY,labelMatZ,curveDots, curveBars, sideOuter, cubeMaterial, face, shadow1, shadow2, shadow3, shadow4, curveBarMaterial, windowMaterial, curveDotMaterial, axisMaterial,outlineMat})
  }
  
  let currentFocus = null
  function focusSide(focus) {
    if(focus && cubeSides[focus].skip) {
      return
    }
    for(let s=0;s<cubeSides.length;s++) {
      cubeSides[s].sideOuter.visible = focus==null
      cubeSides[s].face.visible = focus==null
      cubeSides[s].cubeMaterial.stencilRef = s+2
      cubeSides[s].windowMaterial.stencilRef = s+2
      cubeSides[s].curveBarMaterial.stencilRef = s+2
      cubeSides[s].curveBars.visible = (focus!=null)
      cubeSides[s].curveDotMaterial.stencilRef = s+2
      cubeSides[s].axisMaterial.stencilRef = s+2
      cubeSides[s].outlineMat.stencilRef = s+2
      cubeSides[s].shadow1.stencilRef = s+2
      cubeSides[s].shadow2.stencilRef = s+2
      cubeSides[s].shadow3.stencilRef = s+2
      cubeSides[s].shadow4.stencilRef = s+2
      cubeSides[s].labelMatX.stencilRef = s+2
      cubeSides[s].labelMatY.stencilRef = s+2
      cubeSides[s].labelMatZ.stencilRef = s+2
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
      cubeSides[focus].labelMatX.stencilRef = 0
      cubeSides[focus].labelMatY.stencilRef = 0
      cubeSides[focus].labelMatZ.stencilRef = 0

      socket.visible = false

      controls.minDistance = 1
      controls.maxDistance = 12
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
  socket.position.y=-5*stretchHeight-0.1
  socket.renderOrder = 0
  scene.add(socket);

  camera.position.x = 20;
  camera.position.z = 6;
  camera.position.y = 4;


  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: el, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  
  const controls = new OrbitControls( camera, renderer.domElement );

  controls.addEventListener('end', (e) => {
    const newLength = camera.position.length()


    if(newLength < 8 && currentFocus === null) {
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

  const labelVec = new THREE.Vector3();
  const animate = () => {
    controls.update();
    dirLight.position.copy(camera.position).sub(new THREE.Vector3(5,-15,1))

    for(let label of labels) {
      label.lookAt(camera.getWorldPosition(labelVec))
    }

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
     curveGeo.setPositions(sig);
    },
    setSpectrum(sig) {
     curveGeoAlt.setPositions(sig);
    },
    setPolar(p) {
      for(let m of polarMaterials) {
        m.polarSkip = p?0:1
      }
      for(let m of polarHide) {
        m.visible = !p
      }
    }
  }
}
