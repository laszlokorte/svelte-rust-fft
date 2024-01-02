<script lang="ts">
  import { T } from '@threlte/core'
  import { Align, OrbitControls } from '@threlte/extras'

  export let times;
  export let freqs;

  const time_positions = new Float32Array(times.length / 2 * 3)
  const freq_positions = new Float32Array(freqs.length / 2 * 3)
  // 3D math squiggles
  $: for (let i = 0; i < times.length; i+=1) {
    time_positions[3*(i)] = i/60
    time_positions[3*(i)+1] = times[(2*i)]
    time_positions[3*(i)+2] = times[(2*i)+1]
  }

  $: for (let i = 0; i < freqs.length; i+=1) {
    freq_positions[3*(i)] = i/60
    freq_positions[3*(i)+1] = freqs[(2*i)] / freqs.length
    freq_positions[3*(i)+2] = freqs[(2*i)+1] / freqs.length
  }
</script>

<T.PerspectiveCamera
  makeDefault
  position={[50, 50, 50]}
  fov={30}
>
  <OrbitControls  />
</T.PerspectiveCamera>

<T.DirectionalLight
  position.y={10}
  position.z={10}
/>

<Align>
  <T.Points>
    <T.BufferGeometry>
      <T.BufferAttribute
        args={[time_positions, 3]}
        attach={(parent, self) => {
          parent.setAttribute('position', self)
          return () => {
            // cleanup function called when ref changes or the component unmounts
            // https://threlte.xyz/docs/reference/core/t#attach
          }
        }}
      />
    </T.BufferGeometry>
    <T.PointsMaterial size={0.25} color={"rgb(10, 130, 170)"} />
  </T.Points>

  <T.Points>
    <T.BufferGeometry>
      <T.BufferAttribute
        args={[freq_positions, 3]}
        attach={(parent, self) => {
          parent.setAttribute('position', self)
          return () => {
            // cleanup function called when ref changes or the component unmounts
            // https://threlte.xyz/docs/reference/core/t#attach
          }
        }}
      />
    </T.BufferGeometry>
    <T.PointsMaterial size={0.25} color={"rgb(170, 10, 130)"} />
  </T.Points>
</Align>