<svelte:head>
	<title>Discrete Fourier Transform in Svelte+ThreeJS+Rust+WASM</title>
</svelte:head>

<script lang="ts">
	import { Canvas } from '@threlte/core'
	import Scene from './Scene.svelte'
	import * as fft from "fftwasm";
	import {memory} from "fftwasm/fftwasm_bg.wasm";

	let cssTarget = null

	let signal = fft.Signal.new(2048)

	let freq = 5;
	let phase = 0;
	let ampl = 1;
	
	let times = new Float32Array(memory.buffer, signal.get_time(), signal.get_len()*2);
	let freqs = new Float32Array(memory.buffer, signal.get_freq(), signal.get_len()*2);

	$: {
		signal.set_sin(freq, phase, ampl)
		times = new Float32Array(memory.buffer, signal.get_time(), signal.get_len()*2);
		freqs = new Float32Array(memory.buffer, signal.get_freq(), signal.get_len()*2);
	}
</script>

<style>
	.scene-container {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template: 1fr;
		background: #111;
		color: #fff;
	}

	.scene-container > :global(*) {
		grid-area: 1 / 1;
	}

	.controls {
		z-index: 10;
		max-width: min-content;
		margin: 1em;
	}

	.css-canvas {
		pointer-events: none;
		position: absolute;
		inset: 0;
	}
</style>

<div class="scene-container">
  <Canvas>
    <Scene cssTarget={cssTarget} times={times} freqs={freqs} />
  </Canvas>

  <div bind:this={cssTarget} class="css-canvas"></div>

  <nav class="controls">
  	<fieldset>
  		<legend>Controls</legend>

  		<label>
  			Frequency:
  			<input type="range" min="-100" max="100" step="1" bind:value={freq} name="frequency">
  		</label>
  		<label>
  			Phase:
  			<input type="range" min="-1" max="1" step="0.01" bind:value={phase} name="phase">
  		</label>
  		<label>
  			Amplitude:
  			<input type="range" min="-5" max="5" step="0.1" bind:value={ampl} name="ampl">
  		</label>
  	</fieldset>
  </nav>
</div>