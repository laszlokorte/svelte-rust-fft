<script lang="ts">
  import { T, useStage, useTask, useThrelte } from '@threlte/core'
  import { Align, OrbitControls, MeshLineGeometry, MeshLineMaterial, Grid } from '@threlte/extras'
  import CssObject from './CssObject.svelte'
  import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
  import { ConeGeometry, BoxGeometry, MeshStandardMaterial, BufferGeometry, Vector3, CylinderGeometry } from 'three'

  export let cssTarget
  export let times;
  export let freqs;

  const { scene, size, autoRenderTask, camera } = useThrelte()
  const cssRenderer = new CSS2DRenderer({ element: cssTarget })
  $: cssRenderer.setSize($size.width, $size.height)


  const time_positions = new Array(times.length / 2).fill(null)
  const freq_positions = new Array(freqs.length / 2).fill(null)
  // 3D math squiggles
  $: for (let i = 0; i < time_positions.length; i+=1) {
    time_positions[(i)] = new Vector3((i-0.25*times.length)/30, times[(2*i)], times[(2*i)+1])
  }

  $: for (let i = 0; i < time_positions.length; i+=1) {
    freq_positions[(i)] = new Vector3((i-0.25*times.length)/30, 2*freqs[(2*i)]/times.length, 2*freqs[(2*i)+1]/times.length)
  }

  scene.matrixWorldAutoUpdate = false

  // To update the matrices *once* per frame, we'll use a task that is added
  // right before the autoRenderTask. This way, we can be sure that the
  // matrices are updated before the renderers run.
  useTask(
    () => {
      scene.updateMatrixWorld()
    },
    { before: autoRenderTask }
  )

  // The CSS2DRenderer needs to be updated after the autoRenderTask, so we
  // add a task that runs after it.
  useTask(
    () => {
      // Update the DOM
      cssRenderer.render(scene, camera.current)
    },
    {
      after: autoRenderTask,
      autoInvalidate: false
    }
  )

</script>

<T.PerspectiveCamera
  makeDefault
  position={[0, 20, 30]}
  fov={30}
>
  <OrbitControls  />
</T.PerspectiveCamera>


<T.AmbientLight
  color="white"
  itensity={1}
/>




<T.Mesh rotation.z={-Math.PI/2} position={[6, 0, 0]} geometry={new CylinderGeometry(0.03, 0.03, 12, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>


<T.Mesh rotation.y={-Math.PI/2} position={[0, 3, 0]} geometry={new CylinderGeometry(0.03, 0.03, 6, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>

<T.Mesh rotation.x={Math.PI/2} position={[0, 0, 2]} geometry={new CylinderGeometry(0.03, 0.03, 4, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>

<T.Mesh>
  <MeshLineGeometry
    points={time_positions}
  />
  <MeshLineMaterial
    depthTest={true}
    width={0.1}
    color={"#ff33aa"}
    attenuate={true}
  />
</T.Mesh>


<T.Mesh>
  <MeshLineGeometry
    points={freq_positions}
  />
  <MeshLineMaterial
    depthTest={true}
    width={0.1}
    color={"#33aaff"}
    attenuate={true}
  />
</T.Mesh>


<T.Mesh rotation.z={-Math.PI/2} position={[12, 0, 0]} geometry={new ConeGeometry(0.1, 0.5, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>

<T.Mesh rotation.y={-Math.PI/2} position={[0, 6, 0]} geometry={new ConeGeometry(0.1, 0.5, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>

<T.Mesh rotation.x={Math.PI/2} position={[0, 0, 4]} geometry={new ConeGeometry(0.1, 0.5, 10)} material={new MeshStandardMaterial({color: "white"})}>
</T.Mesh>


<CssObject
  position={[12, 0, 0]}
  center={[0.5, 0.5]}
>
  <span style="display: inline-block; transform: translateY(-2em)">Time</span>
</CssObject>

<CssObject
  position={[0, 6, 0]}
  center={[0.5, 0.5]}
>
  <span style="display: inline-block; transform: translateY(-2em)">Real</span>
</CssObject>

<CssObject
  position={[0, 0, 4]}
  center={[0.5, 0.5]}
>
 <span style="display: inline-block; transform: translateY(-2em)">Imaginary</span>
</CssObject>

<Grid 
infiniteGrid={true}
sectionColor="#333"
cellColor="#555"
sectionThickness="1"
cellThickness="1"
depthTest={false}
fadeStrength="1"
fadeDistance="40"
material.depthWrite={false}
material.depthTest={true}
material.forceSinglePass={true}
plane="xz"
></Grid>
