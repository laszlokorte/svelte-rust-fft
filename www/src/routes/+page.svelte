<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  
  let el;
  let scene = null
  let fraction = 0
  let freq = 1
  let phase = 0
  let amplitude = 1
  let samples = 512

  $: if(scene) {
  	scene.setFraction(fraction)
  	scene.setSignal(Array(samples).fill(0).map((_,i) => [amplitude*Math.cos(Math.PI*4*(freq*(i/samples-0.5)+phase)), amplitude*Math.sin(Math.PI*4*(freq*(i/samples-0.5)+phase))]))
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
		background: #dffaff;
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
		font-family: monospace;
		font-size: 1.2em;
	}

	fieldset {
		border: none;
		margin: 0.5em 1em;
		padding: 0;
	}

	legend {
		font-weight: bold;
		background: #333;
		margin: 0 0 1em 0;
		padding: 2px 4px;
	}

	input {
		accent-color: white;
	}
</style>

<div class="container">
	<canvas class="canvas" bind:this={el}></canvas>
	<div class="controls">
		<fieldset>
			<legend>Controls</legend>

			<label>Samples: <input list="sample-list" type="range" min="16" max="512" step="1" bind:value={samples} name=""></label>
			<label>Amplitude: <input list="ampl-list" type="range" min="0" max="2" step="0.01" bind:value={amplitude} name=""></label>
			<label>Frequency: <input list="freq-list" type="range" min="-4" max="4" step="0.01" bind:value={freq} name=""></label>
			<label>Phase: <input list="phase-list" type="range" min="-0.5" max="0.5" step="0.01" bind:value={phase} name=""></label>
			<label>Fractional Transform: <input list="frac-list" type="range" min="-4" max="3" step="0.1" bind:value={fraction} name=""></label>

			<datalist id="sample-list">
				<option>8</option>
				<option>256</option>
			</datalist>

			<datalist id="ampl-list">
				<option>0</option>
				<option>1</option>
			</datalist>

			<datalist id="freq-list">
				<option>0</option>
				<option>1</option>
			</datalist>
			<datalist id="phase-list">
				<option>0</option>
			</datalist>
			<datalist id="frac-list">
				<option>-1</option>
				<option>-2</option>
				<option>-3</option>
				<option>-4</option>
			</datalist>
		</fieldset>
	</div>
</div>