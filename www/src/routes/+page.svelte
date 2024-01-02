<svelte.head>
	<title>Discrete Fourier Transform in Svelte+ThreeJS+Rust+WASM</title>
</svelte.head>

<script lang="ts">
	import { Canvas } from '@threlte/core'
	import Scene from './Scene.svelte'
	import * as fft from "fftwasm";
	import {memory} from "fftwasm/fftwasm_bg.wasm";

	let signal = fft.Signal.new(2048)

	let freq = 0;
	
	let times = new Float32Array(memory.buffer, signal.get_time(), signal.get_len()*2);
	let freqs = new Float32Array(memory.buffer, signal.get_freq(), signal.get_len()*2);

	$: {
		signal.set_sin(freq)
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
	}

	.controls {
		grid-area: 1 / 1;
		z-index: 10;
	}
</style>

<div class="scene-container">
  <Canvas>
    <Scene times={times} freqs={freqs} />
  </Canvas>

  <nav class="controls">
  	<fieldset>
  		<legend>Controls</legend>

  		<input type="range" min="-100" max="100" step="1" bind:value={freq} name="frequency">
  	</fieldset>
  </nav>
</div>