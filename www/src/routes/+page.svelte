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
  const decimalFormatSigned = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
  const intFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
  const samples = 512
  const signal = Signal.new(samples)
  const customRecording = new Float32Array(2*signal.get_len())

  const maxFreq = samples/2

  let el;
  let controlPanel;
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
  let showInfo = false
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
		r = (r+samples-1)%samples;
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
  	if(timeDomain.byteLength === 0) {
	  	timeDomain = new Float32Array(wasm.memory.buffer, signal.get_time(), 2*signal.get_len())
		  freqDomain = new Float32Array(wasm.memory.buffer, signal.get_freq(), 2*signal.get_len())
		  fracDomain = new Float32Array(wasm.memory.buffer, signal.get_frac(), 2*signal.get_len())
	  	
	  	scene.setSignal(timeDomain)
	  	scene.setSpectrum(freqDomain)
	  	scene.setFractional(fracDomain)
	  }
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

  function getPathA(cx,r){
	  return "M" + cx + ",";
	}
  function getPathB(cy,r){
	  return cy + "m" + (-r) + ",0a" + r + "," + r + " 0 1,0 " + (r * 2) + ",0a" + r + "," + r + " 0 1,0 " + (-r * 2) + ",0";
	}

  $: paintPath = customRecording.reduce((acc, n, i) => acc+(i%2==0?getPathA(n,.03):getPathB(n,.03)),"")
  $: paintPathEmpty = !Array.prototype.some.call(customRecording, (a) => a != 0)

  onMount(() => {
    scene = createScene(el, controlPanel)

    return scene.dispose
  });
</script>

<svelte:window on:mousemove={record} on:mouseup={recordStop} />

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}

	.canvas {
		grid-area: canvas;
		display: block;
	}

	.container {
		position: absolute;
		inset: 0;
		display: block;
		display: grid;
		grid-template-columns: [canvas-start controls-start] 1fr [controls-end] 10fr [canvas-end];
		grid-template-rows: [controls-start canvas-start] 1fr [controls-end canvas-end];
		background: #dffaff;
		place-content: stretch;
	}

	.controls {
		width: min-content;
		z-index: 10;
		background: #000a;
		color: #fff;
		align-self: start;
		justify-self: start;
		margin: 1em;
		padding: 1em;
		font-family: monospace;
		font-size: 1.2em;
		max-height: 80vh;
		overflow: auto;
		grid-area: controls;
	}

	fieldset {
		border: none;
		margin: 0.5em 1em;
		padding: 0;
		min-width: 12em;
	}

	hr {
		border: none;
		border-bottom: 1px solid #0004;
	}

	label {
		user-select: none;
	}

	output {
		display: inline-block;
		width: 4em;
		margin-left: auto;
		text-align: right;
	}

	legend {
		font-weight: bold;
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

	input[type=range] {
		width: 100%;
	}

	.checkbox-list {
		display: flex;
		flex-direction: column;
	}

	.info-button {
		display: inline-block;
		padding: 0.2em;
		background: none;
		font: inherit;
		border: none;
		color: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.help-container {
		position: absolute;
		inset: 0;
		background: #000a;
		display: grid;
		place-content: stretch;
	}

	.help-box {
		background: #fff;
		width: 90vw;
		min-height: 50vh;
		margin: 4em 1em;
		display: block;
		justify-self: center;
		align-self: start;
		color: #000;
		padding: 1em;
		max-height: 60vh;
		overflow: auto;
	}
</style>

<div class="container">
	<canvas class="canvas" bind:this={el}></canvas>
	<div class="controls" bind:this={controlPanel}>
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
					<label for="control_amplitude"><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Amplitude:  <output>{decimalFormat.format(amplitude)}</output></span>
						<input list={snap?"ampl-list":null} type="range" min="0" max="2" step="0.01" bind:value={amplitude} id="control_amplitude"></label><br>
						<hr>
						<label for="control_timeShift"><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Time Shift: <output>{intFormat.format(timeShift)}</output></span>
							<input list={snap?"freq-list":null} type="range" min="-{samples*3/4}" max="{samples*3/4}" step="1" bind:value={timeShift} id="control_timeShift">
						</label>
						<label for="control_timeStretch"><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Time Stretch: <output>{((true||snap)?intFormat:decimalFormat).format(timeStretch)}</output></span>
							<input type="range" min="-5" max="5" step={(true||snap)?1:0.01} bind:value={timeStretch} id="control_timeStretch">
						</label>

					<hr>

					<label for="control_freq"><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Linear Phase:  <output>{intFormat.format(freq)}</output> </span>

						<input list={snap?"freq-list":null} type="range" min="-{maxFreq*3/4}" max="{maxFreq*3/4}" step="1" bind:value={freq} id="control_freq"></label>
					<label for="control_phase"><span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Constant Phase: <output>{intFormat.format(phase)}°</output> </span>

						<input list={snap?"phase-list":null} type="range" min="-180" max="180" step="5" bind:value={phase} id="control_phase"></label>


				</div>
				{:else}
				<div role="presentation" bind:this={recField} class="recorder" on:contextmenu|preventDefault on:mousedown={recordStart}>
					{#if !paintPathEmpty}
					<svg viewBox="-2 -2 4 4" width="100" height="100">
						<path transform="rotate(-90, 0, 0)" d={paintPath} fill="white" stroke="none" />
					</svg>
					{:else}
					<span>Click and<br>Drag here</span>
					{/if}
				</div>
				{/if}
				
			<hr>

			<label for="control_fraction">
				<span style:display="flex" style:gap="0.2em" style:white-space="nowrap">Fractional DFT: <output>{decimalFormatSigned.format(fraction)}</output></span>
				<input list={snap?"frac-list":null} type="range" min="-4" max="4" step="0.01" bind:value={fraction} id="control_fraction"></label>
			<hr>
			<strong>View</strong><br>
			<div class="checkbox-list">
				<label><input type="checkbox" bind:checked={circular}> Cyclic axis</label>
				<label><input type="checkbox" bind:checked={snap}> Snap Controls</label>
			</div>
			<hr>

			<small>&sdot;<button type="button" class="info-button" on:click={() => showInfo = true} on:keydown={() => showInfo = true}>Info</button></small>
			<br>
			<small>&sdot;<a class="info-button" href="//tools.laszlokorte.de" target="_blank">More educational tools</a></small>

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

		{#if showInfo}
		<div class="help-container" aria-hidden="true" on:click={() => showInfo = false} role="button" tabindex="-1">
			<div tabindex="-1" class="help-box" aria-hidden="true" on:click|stopPropagation on:keydown|stopPropagation>
				<button tabindex="-1" type="button" class="info-button" on:click={() => showInfo = false} on:keydown={() => showInfo = false}>Close</button>

				<h2>Fourier Transform Cube</h2>

				<p>
					The goal of this tool is to build an intuitive and interactive understanding of the properties of the Fourier Transform. The Fourier transform is a mathematical tool to analyze complex signals like audio waves be decomposing them into simpler parts. Below some interesting aspects of the Fourier Transform are pointed out. To fully understand how the Fourier Transform works some more mathematical rigor is required and there are many explanations that can be found online or in text books. 
				</p>

				<p>
					But even after studying and understanding the formal details it might be helpful take a step back and take a more playful look at what is happening. This is where is tool comes in.
				</p>

				<p>
					The front side of the cube shows the plot of a complex valued signal. Due to symmetry it does not matter much which side you chose as the front. The neighbouring faces show the same signal but transformed into the frequency domain. The fourier transform is a 4-cyclic operation. After applying it 4 times it yields the original signal again. In this sense the 4 sides of the cube represent the same signal from 4 different perspectives.
				</p>

				<p>
					The top face of cube shows another plot of the signal but this one can interpolate between all the 4 perspectives. The Fractional Fourier Transform allows to apply the Fourier Transform a fractional number of times. By moving the <em>Fractional DFT</em> slider one can observe how the time domain signal slowly morphes into the frequency domain representation.
				</p>


				<h3>Fourier Transform</h3>
				<p>
					The Fourier Transform is a linear transformation that decomposes a signal <code>f(t)</code> into harmonically oscillating components <code>F(w)</code>, ie. it determines what <code>A&sdot;cos(w&sdot;t)</code> and <code>B&sdot;sin(w&sdot;t)</code> functions need to be summed together to trconstruct the signal <code>f(t)</code>. <code>sin</code> is an odd function and <code>cos</code> is an even function. The sum of only odd functions is itself an odd function. The sum of only even functions is an even function. To construct any signal that is neither even nor odd sin and cos components need to be mixed. 
				</p>

				<p>
					Both functions <code>A&sdot;cos(w&sdot;t)</code> and <code>B&sdot;sin(w&sdot;t)</code> can be precombined into a single expression by making use of eulers identity <code>exp(i&sdot;w&sdot;t) = cos(w&sdot;t) + i&sdot;sin(w&sdot;t)</code>. This simplifies and unifies all the calculations. So in the general case the Fourier transform decomposes a signal <code>f(t)</code> into a weighted sum of <code>exp(i&sdot;w&sdot;t)</code> terms.
				</p>

				<p>
					Interestingly the fourier transform is a 4-cyclic operation. This means that applying the the transform 4 times in a row will lead back to the original signal. This is why this visualization is built around a cube. One side of the cube shows the original signal in its time domain. The right neighbouring side shows the fourier transformed signal in its frequency domain. The backside (right to the face right to the original) shows the result of applying the fourier transform again and the fourth side (left to the front, or right to the back side when seen from behind) will show the result of applying the fourier transform 3 times.
				</p>

				<p>
					Notice how opposite sides of the cube show almost the same signal. This is called the <em>time reversal</em> property of the fourier transform: applying the transformation twice has the same effect as reversing the signal along the time axis.
				</p>

				<h3>Discrete Fourier Transform</h3>

				<p>
					Actually are 4 different kinds of fourier transforms. Which one is the correct one to use depends on 2 factors:
				</p>

				<ul>
					<li>Is the signal periodic or aperiodic</li>
					<li>Is the time dimension continous (real valued) or discrete</li>
				</ul>

				<p>
					In total these two factors yield 4 combinations:
				</p>

				<table cellpadding="20">
					<thead>
						<tr>
							<th></th>
							<th>periodic</th>
							<th>aperiodic</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<th>discrete</th>
							<td align="center" bgcolor="#ffffcc">Discrete<br>Fourier Transform<br>(DFT)</td>
							<td align="center">Discrete Time<br>Fourier Transform<br>(DTFT)</td>
						</tr>
						<tr>
							<th>continous</th>
							<td align="center">Fourier<br>Series<br>(FS)</td>
							<td align="center">Fourie<br>Transform<br>(FT)</td>
						</tr>
					</tbody>
				</table>

				<p>On real world computer systems (like this one) only discrete periodic signals can be represented. Continous time signals would require infinite resolution and non-periodic signals would require infintie memory. Finite signals, like 3 minute music recording are simply assumed to be periodic. This implicit assumtion is made by trying to decompose the signal into finitely many periodic sin(t)/cos(t)/exp(it) components in the first place.</p>

				<p>
					So when calculating the Fourier Transform on a computer it is implicitly assumed to be the Discrete Fourier Transform (DFT).
				</p>

				<p>
					The assumption of the signal being cyclic is emphasized by the <em>Cyclic Axis</em> option.
				</p>

				<p>
					For discrete time signals the frequency domain periodic as shown by the table below:
				</p>

				<table width="400">
					<thead>
						<tr>
							<th>time domain</th>
							<th>frequency domain</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td align="center">periodic</td>
							<td align="center">discrete</td>
						</tr>
						<tr>
							<td align="center">discrete</td>
							<td align="center">periodic</td>
						</tr>
						<tr>
							<td align="center">a-periodic</td>
							<td align="center">continous</td>
						</tr>
						<tr>
							<td align="center">continous</td>
							<td align="center">a-periodic</td>
						</tr>
					</tbody>
				</table>

				<h3>Fourier Transform Pairs</h3>

				<p>
					Applying a Fourier Transform translates a signal from the time domain into the frequency domain. In the time domain the signal maps each point in time to scalar value (a real or complex number) representing an an intensity. In the frequency domain the fourier transformed signal maps each frequency (the so called frequency bin) to a scalar value (real or complex) representing how strong a sin/cos/exp function of that frequency would need to be to reconstruct the signal (the so called coefficients).
				</p>

				<p>
					But not only signals themself can be fourier transformed. It can also be reasoned about how modifying a signal in time domain (eg. scaling or offsetting it) will effect its frequency representation. The relations between modifications in time domain and in frequency domain can be summarized as:
				</p>

				<table cellpadding="20" width="500">
					<thead>
						<tr>
							<th>In time domain</th>
							<th>In frequency domain</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Scaling the signals magnitude by a factor <code>x</code></td>
							<td>Scaling the signals frequences magnitues by <code>x</code></td>
						</tr>
						<tr>
							<td>Adding a constant angle <code>w</code> to the signals complex values at each point in time.</td>
							<td>Adding a constant angle <code>w</code> to the signals complex coefficients at each frequency bin.</td>
						</tr>
						<tr>
							<td>Stretching the signal along the time axis.</td>
							<td>Compressing the coefficients in the frequency domain along the frequency axis.</td>
						</tr>
						<tr>
							<td>Compressing the signal along the time axis.</td>
							<td>Stretching the coefficients in the frequency domain along the frequency axis.</td>
						</tr>
						<tr>
							<td>Shifting the signal forwards or backwards along the time axis by <code>t</code> time steps.</td>
							<td>Adding an angle <code>t*f</code> to each frequency coefficient proportial to the bins frequency <code>f</code></td>
						</tr>
						<tr>
							<td>Adding an angle <code>t*w</code> to each signals value at time <code>t</code></td>
							<td>Shifting the signals frequency coefficients upwards or downwards along the frequency axis by <code>w</code> time steps.</td>
						</tr>
					</tbody>
				</table>

				<p>
					These symmetries can be observed by modifying the signals parameters while looking at the cube from different sizes.
				</p>

				<h3>Fractional Fourier Transform</h3>

				<p>
					The fourier transform is a 4-cyclic operation. Applying the fourier transform 0,1,2, or 3 times can be though of as looking at the signal from 4 different perspectives.
				</p>
				<p>
					Depending of the perspective the signal span either across the time axis or across the frequency axis. We can think of these two axis as spanning a plane on which the signal exists. This plane is the so called time-frequency-plane. The fourier transform rotates the signal inside this plane by 90 degree.
				</p>
				<p>
					When thinking of the fourier transform as an 90 degree rotation in some abstract space the question comes up if we could also rotate by angles other than 90 degrees. This would correspond to applying the fourier transform not 0,1,2, or 3 times but instead 0.1 or 1.25 times.
				</p>

				<p>
					This is actually possible by using the fractional fourier transform. The fractional fourier transform is an extension of the classical fourier transform.
				</p>

				<p>
					The fractional fourier transform allows to smoothly interpolate between the time and the frequency domain. You can see this when looking at the top facing side of the cube and moving the <em>Fraction DFT</em> slider from 0 to 1.
				</p>

			</div>

		</div>
		{/if}
	</div>
</div>