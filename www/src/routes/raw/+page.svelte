<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  
  let el;
  let scene = null
  let fraction = 0
  let freq = 0
  let phase = 0
  const samples = 256

  $: if(scene) {
  	scene.setFraction(fraction)
  	scene.setSignal(Array(samples).fill(0).map((_,i) => [Math.cos(Math.PI*2*(freq*(i/samples-0.5)+phase)), Math.sin(Math.PI*2*(freq*(i/samples-0.5)+phase))]))
  }

  onMount(() => {
    scene = createScene(el)

    return scene.dispose
  });
</script>

<style>
	:global(body) {
		margin: 0;
	}

	.canvas {
		position: absolute;
		inset: 0;
		display: block;
	}

	.container {
		position: absolute;
		inset: 0;
		display: block;
		display: grid;
		grid-template: 1fr;
		background: #eff;
	}

	.controls {
		width: min-content;
		z-index: 10;
		background: #333a;
		color: #fff;
		align-self: start;
		justify-self: start;
		margin: 1em;
		padding: 1em;
	}
</style>

<div class="container">
	<canvas class="canvas" bind:this={el}></canvas>
	<div class="controls">
		<fieldset>
			<legend>Controls</legend>

			<input type="range" min="-4" max="4" step="0.1" bind:value={fraction} name="">
			<input type="range" min="-4" max="4" step="0.1" bind:value={freq} name="">
			<input type="range" min="-0.5" max="0.5" step="0.01" bind:value={phase} name="">
		</fieldset>
	</div>
</div>