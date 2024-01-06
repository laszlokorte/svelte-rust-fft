<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  
  const decimalFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const intFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })

  const maxFreq = Math.pow(2,6)-1

  let el;
  let scene = null
  let snap = false
  let fraction = 0
  let freq = 0
  let phase = 0
  let amplitude = 1
  let shape = 'rect'
  let timeShift = 0
  let timeStretch = 0
  const samples = 512

  const shapes = {
  	constant: (x) => 1,
  	dirac: (x) => x==0 ? 1 : 0,
  	rect: (x) => Math.abs(x*Math.PI*8)<=1 ? 1 : 0,
  	sinc: (x) => !isFinite(x)?0:x==0?1:Math.sin(Math.PI*2*x*4)/(Math.PI*2*x*4),
  	gauss: (x) => !isFinite(x)?0:Math.exp(-x*x*16*Math.PI*Math.PI),
  	sha: (x) => x%0.125==0 ? 1 : 0,
  }

  const transformPairs = {
  	'constant': 'dirac',
  	'dirac': 'constant',
  	'rect': 'sinc',
  	'sinc': 'rect',
  	'gauss': 'gauss',
  	'sha': 'sha',
  }

  function swapShape(evt) {
  	evt.preventDefault()
  	shape = transformPairs[shape]
  }

  $: timeStetchExp = Math.pow(2,timeStretch)
  $: if(scene) {
  	scene.setFraction(fraction)
  	scene.setSignal(Array(samples).fill(amplitude).map((a,i) => [a, (i/samples-0.5)]).map(([ampl,t]) => [ampl*shapes[shape](timeStetchExp*(t-timeShift/samples))* Math.cos(Math.PI*2*(freq*2*t+phase/360)), ampl*shapes[shape](timeStetchExp*(t-timeShift/samples))*Math.sin(Math.PI*2*(freq*2*t+phase/360))]))
  	
  	scene.setSpectrum(Array(samples).fill(amplitude).map((a,i) => [a, ((i-freq)/samples-0.5)]).map(([ampl, i]) => [ampl*shapes[transformPairs[shape]](i&&i/timeStetchExp)*Math.cos(Math.PI*2*(phase/360-2*i*timeShift)),ampl*shapes[transformPairs[shape]](i&&i/timeStetchExp)*Math.sin(Math.PI*2*(phase/360-2*i*timeShift))]))
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

			<label>Shape:<br>
				<select bind:value={shape}>
					{#each Object.keys(shapes) as shape}
				<option value={shape}>{shape}</option>
					{/each}
				</select></label>
				<output style="text-decoration: underline; cursor: pointer;" on:click={swapShape}>swap</output> 
				<br>

				<label>Time Shift: <output>{intFormat.format(timeShift)}</output>
					<input type="range" min="-{maxFreq}" max="{maxFreq}" step="1" bind:value={timeShift} name="">
				</label>
				<label>Time Stretch: <output>{intFormat.format(timeStretch)}</output>
					<input type="range" min="-3" max="3" step="1" bind:value={timeStretch} name="">
				</label>

			<hr>

			<label>Amplitude:  <output>{decimalFormat.format(amplitude)}</output>
				<input list={snap?"ampl-list":null} type="range" min="0" max="2" step="0.01" bind:value={amplitude} name=""></label>
			<label>Frequency:  <output>{intFormat.format(freq)}</output> 

				<input type="range" min="-{maxFreq}" max="{maxFreq}" step="1" bind:value={freq} name=""></label>
			<label>Phase: <output>{intFormat.format(phase)}°</output> 

				<input list={snap?"phase-list":null} type="range" min="-180" max="180" step="5" bind:value={phase} name=""></label>

			<hr>

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