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
  let snap = false
  let fraction = 0.99
  let freq = 0
  let phase = 0
  let amplitude = 1
  let shape = 'rect'
  let timeShift = 0
  let timeStretch = 0
  let circular = false
  const customRecording = new Float32Array(2*signal.get_len())
  let timeDomain = new Float32Array(wasm.memory.buffer, signal.get_time(), 2*signal.get_len())
  let freqDomain = new Float32Array(wasm.memory.buffer, signal.get_freq(), 2*signal.get_len())
  let fracDomain = new Float32Array(wasm.memory.buffer, signal.get_frac(), 2*signal.get_len())

	function sinc(x) {
		return x==0?1:Math.sin((Math.PI/2)*x)/((Math.PI/2)*x)
	}

	let r = 0, rx, ry, ra, rc = 0, rbs
	let recField
	function record(evt) {
		if(!recField) return
		let x = (evt.clientX - recField.offsetLeft) / recField.offsetWidth
		let y = (evt.clientY - recField.offsetTop) / recField.offsetHeight

		rx = 2*(x*2 - 1)
		ry = -2*(y*2 - 1)
	}

	function recordClear() {
		r = samples/2
		customRecording.fill(0);
		customRecording[0] = 0
	}
	recordClear()

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
  	chirp: (x) => Math.cos(x*x/4*Math.PI),
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

  $: if(timeDomain.byteLength === 0) {
  	timeDomain = new Float32Array(wasm.memory.buffer, signal.get_time(), 2*signal.get_len())
	  freqDomain = new Float32Array(wasm.memory.buffer, signal.get_freq(), 2*signal.get_len())
	  fracDomain = new Float32Array(wasm.memory.buffer, signal.get_frac(), 2*signal.get_len())
  }

  $: if(scene) {

  	scene.setSignal(timeDomain)
  	scene.setSpectrum(freqDomain)
  	scene.setFractional(fracDomain)

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



	  timeDomain = new Float32Array(wasm.memory.buffer, signal.get_time(), 2*signal.get_len())
	  freqDomain = new Float32Array(wasm.memory.buffer, signal.get_freq(), 2*signal.get_len())
	  fracDomain = new Float32Array(wasm.memory.buffer, signal.get_frac(), 2*signal.get_len())

	  
  	scene.setSignal(timeDomain)
  	scene.setSpectrum(freqDomain)
  	scene.setFractional(fracDomain)

  	scene.setFractionalRotation(fraction * Math.PI/2)
  }
  $: {
  	if(scene) {
  		scene.setPolar(circular)
  	}
  }

  $: if(scene) {
  	scene.setSignal(timeDomain)
  	scene.setSpectrum(freqDomain)
  	scene.setFractional(fracDomain)
  }

  $: paintPath = customRecording.reduce((acc, n, i) => acc+(i%2==0?' ':',')+decimalFormat.format(n), "").replace(/(^(0\.00,0\.00 )*|( 0\.00,0\.00)*$)/g,'').split(/[\s^](?:0\.00,0\.00 )*0\.00,0\.00/, 2).reverse().join()
  $: paintPathEmpty = !Array.prototype.some.call(customRecording, (a) => a != 0)

  onMount(() => {
    scene = createScene(el)

    return scene.dispose
  });
</script>

<svelte:window on:mousemove={record} on:mouseup={recordStop} on:keydown={(evt) => {snap = !evt.ctrlKey}} on:keyup={(evt) => {snap = !evt.ctrlKey}} />

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
		align-content: stretch;
		justify-content: stretch;
	}

	.recorder > * {
		pointer-events: none;
		user-select: none;
		opacity: 0.4;
		grid-column: 1 / span 1; 
		grid-row: 1 / span 1;
		align-self: stretch; 
		justify-self: stretch;
		text-align: center;  
		display: grid;
	  align-content: center;
	  justify-content: center;
	  width: 100%;
	  height: 100%;
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
					<option value={"---"} disabled="disabled">---</option>
					<option value={""}>custom</option>
					</select>
					{#if !!transformPairs[shape]}
					<button type="button" on:click={swapShape} style="cursor: pointer;">⊶ {transformPairs[shape]}</button> 
					{/if}
					{#if !shape}
					<button type="button" on:click={recordClear} style="cursor: pointer;">clear</button> 
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
				<div bind:this={recField} class="recorder" on:contextmenu|preventDefault on:mousedown={recordStart}>
					{#if !paintPathEmpty}
					<svg viewBox="-2 -2 4 4" width="100" height="100">
						<polyline transform="rotate(-90, 0, 0)" points={paintPath} fill="none" stroke-width="0.04" stroke="white" />
					</svg>
					{:else}
					<span>Click and<br>Drag here</span>
					{/if}
				</div>
				{/if}
				
			<hr>

			<label>
				<span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Fractional Transform: </span>
				<input list={snap?"frac-list":null} type="range" min="-4" max="4" step="0.01" bind:value={fraction} name=""></label>
				{decimalFormat.format(fraction)}
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