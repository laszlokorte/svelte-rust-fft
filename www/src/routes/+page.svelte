<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  
  let el;
  let scene = null
  let snap = false
  let fraction = 0
  let freq = 1
  let phase = 0
  let amplitude = 1
  const samples = 512

  $: if(scene) {
  	scene.setFraction(fraction)
  	scene.setSignal(Array(samples).fill(amplitude).map((a,i) => [a, (i/samples-0.5)]).map(([amp,t]) => [amp*Math.cos(Math.PI*2*(freq*2*t+phase/360)), amp*Math.sin(Math.PI*2*(freq*2*t+phase/360))]))
  	scene.setSpectrum(Array(samples).fill(amplitude).map((a,i) => (samples/2-i)==freq?a:0).map((ampl, i) => [ampl*Math.cos(Math.PI*2*phase/360),ampl*Math.sin(Math.PI*2*phase/360)]))
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
			<legend style="white-space: nowrap;">Controls /<label><input type="checkbox" bind:checked={snap}>Snap</label></legend>

			<label>Amplitude: <input list={snap?"ampl-list":null} type="range" min="0" max="2" step="0.01" bind:value={amplitude} name=""></label>
			<label>Frequency: <input type="range" min="-12" max="12" step="1" bind:value={freq} name=""></label>
			<label>Phase: <input list={snap?"phase-list":null} type="range" min="-180" max="180" step="5" bind:value={phase} name=""></label>
			<label>Fractional Transform: <input list={snap?"frac-list":null} type="range" min="-4" max="3" step="0.1" bind:value={fraction} name=""></label>



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