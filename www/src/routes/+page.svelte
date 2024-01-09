<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  import { Signal }  from 'fftwasm/fftwasm.js'
  import { memory }  from 'fftwasm/fftwasm_bg.wasm'
  
  
  const decimalFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const intFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
  const samples = 1024
  const signal = Signal.new(samples)

  const maxFreq = samples/2

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
  let circular = false
  const timeDomain = new Float32Array(memory.buffer, signal.get_time(), 2*signal.get_len())
  const freqDomain = new Float32Array(memory.buffer, signal.get_freq(), 2*signal.get_len())

	function sinc(x) {
		return x==0?1:Math.sin(x)/x
	}

  const shapes = {
  	constant: (x) => 1,
  	dirac: (x) => x==0 ? 1 : 0,
  	rect: (x) => Math.abs(16*x)<=1 ? 1 : 0,
  	sinc: (x,ts) => !isFinite(x)?0:sinc(x*8*Math.PI/2),
  	gauss: (x) => !isFinite(x)?0:Math.exp(-0.5*x*x*16*16*Math.sqrt(2)),
  	sha: (x) => (24*x)%1==0 ? 1 : 0,
  	saw: (x) => ((x*8)%1+1)%1,
  	tri: (x) => Math.abs(((Math.abs(x)*16)%2+2)%2-1),
  	exp: (x) => Math.exp(-Math.abs(16*x)),
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

  $: canSwap = !!transformPairs[shape]

  $: timeStetchExp = Math.pow(2,timeStretch+2)
  $: if(scene) {
  	for(let i=0;i<samples;i++) {
  		const t = (i/samples-0.5);
  		const mag = amplitude*shapes[shape](timeStetchExp*(t), timeStetchExp)
  		const phi = Math.PI*2*(freq*2*t+phase/360)

  		timeDomain[(2*i+2*timeShift+samples*2)%(samples*2)] = mag * Math.cos(phi)
  		timeDomain[(2*i+1+2*timeShift+samples*2)%(samples*2)] =  mag * Math.sin(phi)
  	}

  	// for(let i=0;i<samples;i++) {
  	// 	const t = (i-freq)/samples-0.5;
  	// 	const mag = amplitude*shapes[transformPairs[shape]](t&&t/timeStetchExp)
  	// 	const phi = Math.PI*2*(phase/360-2*t*timeShift)

  	// 	freqDomain[2*i] = mag * Math.cos(phi)
  	// 	freqDomain[2*i+1] =  mag * Math.sin(phi)
  	// }

  	signal.update_freq()

  	scene.setFraction(fraction)
  	scene.setSignal(timeDomain)
  	scene.setSpectrum(freqDomain)
  }
  $: {
  	if(scene) {
  		scene.setPolar(circular)
  	}
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
				{#if canSwap}
				<button type="button" on:click={swapShape} style="text-decoration: underline; cursor: pointer;">swap</button> 
				{/if}
				<br>

				<label>Time Shift: <output>{intFormat.format(timeShift)}</output>
					<input list="freq-list" type="range" min="-{samples}" max="{samples}" step="1" bind:value={timeShift} name="">
				</label>
				<label>Time Stretch: <output>{intFormat.format(timeStretch)}</output>
					<input type="range" min="-5" max="5" step="1" bind:value={timeStretch} name="">
				</label>

			<hr>

			<label>Amplitude:  <output>{decimalFormat.format(amplitude)}</output>
				<input list={snap?"ampl-list":null} type="range" min="0" max="2" step="0.01" bind:value={amplitude} name=""></label>
			<label>Frequency:  <output>{intFormat.format(freq)}</output> 

				<input list="freq-list" type="range" min="-{maxFreq}" max="{maxFreq}" step="1" bind:value={freq} name=""></label>
			<label>Phase: <output>{intFormat.format(phase)}°</output> 

				<input list={snap?"phase-list":null} type="range" min="-180" max="180" step="5" bind:value={phase} name=""></label>

			<hr>

			<label>Fractional Transform: <input list={snap?"frac-list":null} type="range" min="-4" max="3" step="0.1" bind:value={fraction} name=""></label>

			<hr>
			<label><input type="checkbox" bind:checked={circular}> Circular</label>


			<datalist id="ampl-list">
				<option>0</option>
				<option>1</option>
			</datalist>

			<datalist id="freq-list">
				<option>0</option>
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