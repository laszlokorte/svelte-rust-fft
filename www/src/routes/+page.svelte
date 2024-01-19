<svelte:head>
	<title>Fourier Cube</title>
</svelte:head>

<script>
  import { onMount } from 'svelte';
  import { createScene } from "./scene";
  import { Signal, __wbg_set_wasm }  from 'fftwasm/fftwasm_bg.js'
  import * as wasm   from 'fftwasm/fftwasm_bg.wasm'

  __wbg_set_wasm(wasm)
  
  
  const decimalFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const intFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
  const samples = 1024
  const signal = Signal.new(samples)

  const maxFreq = samples/2

  let el;
  let scene = null
  let snap = true
  let fraction = 0
  let freq = 0
  let phase = 0
  let amplitude = 1
  let shape = 'constant'
  let timeShift = 0
  let timeStretch = 0
  let circular = false
  const customRecording = new Float32Array(2*signal.get_len())
  customRecording.fill(0)
  const timeDomain = new Float32Array(wasm.memory.buffer, signal.get_time(), 2*signal.get_len())
  const freqDomain = new Float32Array(wasm.memory.buffer, signal.get_freq(), 2*signal.get_len())
  const fracDomain = new Float32Array(wasm.memory.buffer, signal.get_frac(), 2*signal.get_len())

	function sinc(x) {
		return x==0?1:Math.sin((Math.PI/2)*x)/((Math.PI/2)*x)
	}

	let r, rx, ry, ra, rc = 0, rbs
	function record(evt) {
		let x = (evt.clientX - evt.currentTarget.offsetLeft) / evt.currentTarget.offsetWidth
		let y = (evt.clientY - evt.currentTarget.offsetTop) / evt.currentTarget.offsetHeight

		rx = 2*(x*2 - 1)
		ry = -2*(y*2 - 1)
	}

	function recordDo() {
		r = (r+1)%samples;
		ra = requestAnimationFrame(recordDo)
		if((rbs & 4) == 4) {
			customRecording[2*r] = Math.sign(ry) * Math.sqrt(Math.abs(ry))
			customRecording[2*r+1] = Math.sign(rx) * Math.sqrt(Math.abs(rx))
		} else {
			customRecording[2*r] = ry
			customRecording[2*r+1] = rx
		}
	}

	function recordStart(evt) {
		if(rc++ > 0) return
		rbs |= (1<<evt.button)
		r = samples/2
		recordDo()
	}

	function recordStop(evt) {
		if(rc < 1) return
		rbs = rbs & ~(1<<evt.button)
		if(--rc > 0) return
		cancelAnimationFrame(ra)
		ra = null
	}

  const shapes = {
  	constant: (x) => 1,
  	dirac: (x) => x==0 ? 1 : 0,
  	dirac_pair: (x, minx) => ((minx < 1 && x==0) || Math.abs(x)==1) ? 1 : 0,
  	cos: (x) => Math.cos(Math.PI/2*x),
  	rect: (x) => Math.abs(x)<=1 ? 1 : 0,
  	sinc: (x) => !isFinite(x)?0:sinc(x),
  	gauss: (x) => !isFinite(x)?0:Math.exp(-0.5*x*x*Math.sqrt(2)),
  	sha: (x) => (1.5*x)%1==0 ? 1 : 0,
  	saw: (x) => ((x/2+0.5)%1+1)%1,
  	tri: (x) => Math.abs(((Math.abs(x))%2+2)%2-1),
  	exp: (x) => Math.exp(-Math.abs(x)/(Math.sqrt(2)*0.5)),
  	couchy: (x) => (Math.sqrt(2)*0.5)/(x*x+(Math.sqrt(2)*0.5)),
  }

  const transformPairs = {
  	'constant': 'dirac',
  	'dirac': 'constant',
  	'dirac_pair': 'cos',
  	'cos': 'dirac_pair',
  	'rect': 'sinc',
  	'sinc': 'rect',
  	'gauss': 'gauss',
  	'sha': 'sha',
  	'exp': 'couchy',
  	'couchy': 'exp',
  }

  function swapShape(evt) {
  	evt.preventDefault()
  	shape = transformPairs[shape]
  }

  $: timeStetchExp = Math.pow(2,timeStretch+2)

  $: if(scene) {
  	scene.setSignal(timeDomain)
  	scene.setSpectrum(freqDomain)
  	scene.setFractional(fracDomain)
  }

  $: if(scene) {
  	if(shape !== "") {
	  	for(let i=0;i<samples;i++) {
	  		const t = (i/samples-0.5);
	  		const mag = amplitude*shapes[shape](timeStetchExp*t*16, samples/(timeStetchExp*16))
	  		const phi = Math.PI*2*(freq*2*t+phase/360)

	  		timeDomain[(2*i+2*timeShift+samples*2)%(samples*2)] = mag * Math.cos(phi)
	  		timeDomain[(2*i+1+2*timeShift+samples*2)%(samples*2)] =  mag * Math.sin(phi)
	  	}
  	} else {
  		for(let i=0;i<samples;i++) {
  			timeDomain[2*i] = customRecording[2*i]
  			timeDomain[2*i+1] = customRecording[2*i+1]
  		}
  	}

  	signal.update_freq()
  	signal.update_frac(fraction)

  	scene.setFractionalRotation(fraction * Math.PI/2)
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

<svelte:window on:mouseup={recordStop} on:keydown={(evt) => {snap = !evt.ctrlKey}} on:keyup={(evt) => {snap = !evt.ctrlKey}} />

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

	.recorder {
		width: 100%;
		aspect-ratio: 1;
		background: #000a;
		border: 2px solid #fffa;
		display: grid;
		align-content: center;
		justify-content: center;
	}

	.recorder > * {
		pointer-events: none;
		user-select: none;
	}
</style>

<div class="container">
	<canvas class="canvas" bind:this={el}></canvas>
	<div class="controls">
		<fieldset>
			<legend style="white-space: nowrap;">Discrete Fourier<br>Transform</legend>

				<label for="signal_shape">Shape:</label><br>
				<span style:display="flex" style:gap="0.2em">
					<select id="signal_shape" bind:value={shape}>
						{#each Object.keys(shapes) as s}
					<option value={s}>{s}</option>
						{/each}
					<option value={""}>Custom</option>
					</select>
					{#if !!transformPairs[shape]}
					<button type="button" on:click={swapShape} style="cursor: pointer;">⊶ {transformPairs[shape]}</button> 
					{/if}
				</span>
				{#if shape}
				<div>
					
					<br>
					<label><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Amplitude:  <output>{decimalFormat.format(amplitude)}</output></span>
						<input list={snap?"ampl-list":null} type="range" min="0" max="2" step="0.01" bind:value={amplitude} name=""></label><br>
						<hr>
						<label><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Time Shift: <output>{intFormat.format(timeShift)}</output></span>
							<input list={snap?"freq-list":null} type="range" min="-{samples*3/4}" max="{samples*3/4}" step="1" bind:value={timeShift} name="">
						</label>
						<label><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Time Stretch: <output>{(snap?intFormat:decimalFormat).format(timeStretch)}</output></span>
							<input type="range" min="-5" max="5" step={snap?1:0.01} bind:value={timeStretch} name="">
						</label>

					<hr>

					<label><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Linear Phase:  <output>{intFormat.format(freq)}</output> </span>

						<input list={snap?"freq-list":null} type="range" min="-{maxFreq*3/4}" max="{maxFreq*3/4}" step="1" bind:value={freq} name=""></label>
					<label><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Constant Phase: <output>{intFormat.format(phase)}°</output> </span>

						<input list={snap?"phase-list":null} type="range" min="-180" max="180" step="5" bind:value={phase} name=""></label>


				</div>
				{:else}
				<div class="recorder" on:mousemove={record} on:contextmenu|preventDefault on:mousedown={recordStart}>
					<span>Click and<br>Drag here</span>
				</div>
				{/if}
				
			<hr>

			<label>
				<span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Fractional Transform: </span>
				<input list={snap?"frac-list":null} type="range" min="-4" max="4" step="0.1" bind:value={fraction} name=""></label>

			<hr>
			<strong>View</strong><br>
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
				<option>0</option>
				<option>-1</option>
				<option>-2</option>
				<option>-3</option>
				<option>-4</option>
			</datalist>
		</fieldset>
	</div>
</div>