/**
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>,
 *  lineovershoot: <float>,
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  dashOffset: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // to be set by renderer
 * }
 */
import {
  ShaderLib,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3
} from 'three';
UniformsLib.line = {
  worldUnits: {
    value: 1
  },
  startProjectionMul: {
    value: new Vector3(1, 1, 1)
  },
  startProjectionAdd: {
    value: new Vector3(0, 0, 0)
  },
  endProjectionMul: {
    value: new Vector3(1, 1, 1)
  },
  endProjectionAdd: {
    value: new Vector3(0, 0, 0)
  },
  linearProjection: {
    value: 0
  },
  linewidth: {
    value: 1
  },
  lineovershoot: {
    value: 0
  },
  resolution: {
    value: new Vector2(1, 1)
  },
  dashOffset: {
    value: 0
  },
  dashScale: {
    value: 1
  },
  dashSize: {
    value: 1
  },
  gapSize: {
    value: 1
  } // todo FIX - maybe change to totalSize
};
ShaderLib['line'] = {
  uniforms: UniformsUtils.merge([
    UniformsLib.common,
    UniformsLib.fog,
    UniformsLib.line
  ]),
  vertexShader:
    /* glsl */
    `
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform float lineovershoot;
		uniform vec2 resolution;

		#ifdef LINEAR_PROJECTION
			uniform vec3 startProjectionMul;
			uniform vec3 startProjectionAdd;

			uniform vec3 endProjectionMul;
			uniform vec3 endProjectionAdd;
		#endif

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef VARY_WIDTH
			attribute float instanceWidthStart;
			attribute float instanceWidthEnd;
		#endif

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment(const in vec4 start, inout vec4 end) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = (nearEstimate - start.z) / (end.z - start.z);

			end.xyz = mix(start.xyz, end.xyz, alpha);

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = (position.y < 0.5) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = (position.y < 0.5) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			#ifdef LINEAR_PROJECTION
			vec3 actualStart = instanceStart * startProjectionMul + startProjectionAdd;
			vec3 actualEnd = instanceEnd * endProjectionMul + endProjectionAdd;
			#else
			vec3 actualStart = instanceStart;
			vec3 actualEnd = instanceEnd;
			#endif

			vec4 start = modelViewMatrix * vec4(actualStart, 1.0);
			vec4 end = modelViewMatrix * vec4(actualEnd, 1.0);


			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv * (1.0+lineovershoot);

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = (projectionMatrix[ 2 ][ 3 ] == - 1.0); // 4th entry in the 3rd column

			if (perspective) {

				if (start.z < 0.0 && end.z >= 0.0) {

					trimSegment(start, end);

				} else if (end.z < 0.0 && start.z >= 0.0) {

					trimSegment(end, start);

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize(dir);

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize(end.xyz - start.xyz);
				vec3 tmpFwd = normalize(mix(start.xyz, end.xyz, 0.5));
				vec3 worldUp = normalize(cross(worldDir, tmpFwd));
				vec3 worldFwd = cross(worldDir, worldUp);
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if (position.y > 1.0 || position.y < 0.0) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = (position.y < 0.5) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				#ifdef VARY_WIDTH
				float startWidth = linewidth * instanceWidthStart;
				float endWidth = linewidth * instanceWidthEnd;
				#else
				float startWidth = linewidth;
				float endWidth = linewidth;
				#endif

				vec2 screenStart = resolution * (0.5 * clipStart.xy/clipStart.w + 0.5);
				vec2 screenEnd = resolution * (0.5 * clipEnd.xy/clipEnd.w + 0.5);
				vec2 xBasis = normalize(screenEnd - screenStart);
				vec2 yBasis = vec2(-xBasis.y, xBasis.x);

				if(actualStart==actualEnd) {
					yBasis = vec2(1.0,0.0);
					xBasis = vec2(0.0,-1.0);
				}

				vec2 pt0 = screenStart + startWidth * (position.y * yBasis + lineovershoot * position.x * xBasis);
				vec2 pt1 = screenEnd + endWidth * (position.y * yBasis + lineovershoot * position.x * xBasis);
				vec2 pt = mix(pt0, pt1, position.z);
				vec4 clipMix = mix(clipStart, clipEnd, position.z);
				vec4 clip = vec4(clipMix.w * (2.0 * pt/resolution - 1.0), clipMix.z, clipMix.w);

			#endif

			gl_Position = clip;

			vec4 mvPosition = mix(start, end, position.z); // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,
  fragmentShader:
    /* glsl */
    `
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot(p13, p43);
			float d4321 = dot(p43, p21);
			float d1321 = dot(p13, p21);
			float d4343 = dot(p43, p43);
			float d2121 = dot(p21, p21);

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp(mua, 0.0, 1.0);
			mub = (d1343 + d4321 * (mua)) / d4343;
			mub = clamp(mub, 0.0, 1.0);

			return vec2(mua, mub);

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if (vUv.y < - 1.0 || vUv.y > 1.0) discard; // discard endcaps

				if (mod(vLineDistance + dashOffset, dashSize + gapSize) > dashSize) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize(worldPos.xyz) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine(worldStart, worldEnd, vec3(0.0, 0.0, 0.0), rayEnd);

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length(delta);
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth(norm);
						alpha *= (1.0 - smoothstep(0.5 - dnorm, 0.5 + dnorm, norm));

					#else

						if (norm > 0.5) {

							discard;

						}

					#endif

				#endif

			#else

				// artifacts appear on some hardware if a derivative is taken within a conditional
				float a = vUv.x;
				float b = vUv.y;
				
				float len2 = a * a + b * b;

				#ifdef USE_ALPHA_TO_COVERAGE
					float dlen = fwidth(len2);
					alpha *= 1.0 - smoothstep(1.0 - dlen, 1.0 + dlen, len2);
				#else
					if (len2 > 1.0) discard;
				#endif

			#endif



			vec4 diffuseColor = vec4(diffuse, alpha);

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4(diffuseColor.rgb, alpha);

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`
};
class LineMaterial extends ShaderMaterial {
  constructor(parameters) {
    super({
      uniforms: UniformsUtils.clone(ShaderLib['line'].uniforms),
      vertexShader: ShaderLib['line'].vertexShader,
      fragmentShader: ShaderLib['line'].fragmentShader,
      clipping: true // required for clipping support
    });
    this.type = 'LineMaterial'
    this.isLineMaterial = true;
    this.setValues(parameters);
  }
  get color() {
    return this.uniforms.diffuse.value;
  }
  set color(value) {
    this.uniforms.diffuse.value = value;
  }
  get worldUnits() {
    return 'WORLD_UNITS' in this.defines;
  }
  set worldUnits(value) {
    if (value === true) {
      this.defines.WORLD_UNITS = '';
    } else {
      delete this.defines.WORLD_UNITS;
    }
  }
  get varyWidth() {
    return 'VARY_WIDTH' in this.defines;
  }
  set varyWidth(value) {
    if (value === true) {
      this.defines.VARY_WIDTH = '';
    } else {
      delete this.defines.VARY_WIDTH;
    }
  }
  get linearProjection() {
    return 'LINEAR_PROJECTION' in this.defines;
  }
  set linearProjection(value) {
    if (value === true) {
      this.defines.LINEAR_PROJECTION = '';
    } else {
      delete this.defines.LINEAR_PROJECTION;
    }
  }
  get linewidth() {
    return this.uniforms.linewidth.value;
  }
  set linewidth(value) {
    if (!this.uniforms.linewidth) return;
    this.uniforms.linewidth.value = value;
  }
  get lineovershoot() {
    return this.uniforms.lineovershoot.value;
  }
  set lineovershoot(value) {
    if (!this.uniforms.lineovershoot) return;
    this.uniforms.lineovershoot.value = value;
  }
  set startProjectionMul(v) {
    this.uniforms.startProjectionMul.value.copy(v)
  }
  set startProjectionAdd(v) {
    this.uniforms.startProjectionAdd.value.copy(v)
  }
  set endProjectionMul(v) {
    this.uniforms.endProjectionMul.value.copy(v)
  }
  set endProjectionAdd(v) {
    this.uniforms.endProjectionAdd.value.copy(v)
  }
  get startProjectionMul() {
    return this.uniforms.startProjectionMul
  }
  get startProjectionAdd() {
    return this.uniforms.startProjectionAdd
  }
  get endProjectionMul() {
    return this.uniforms.endProjectionMul
  }
  get endProjectionAdd() {
    return this.uniforms.endProjectionAdd
  }
  get dashed() {
    return 'USE_DASH' in this.defines;
  }
  set dashed(value) {
    if ((value === true) !== this.dashed) {
      this.needsUpdate = true;
    }
    if (value === true) {
      this.defines.USE_DASH = '';
    } else {
      delete this.defines.USE_DASH;
    }
  }
  get dashScale() {
    return this.uniforms.dashScale.value;
  }
  set dashScale(value) {
    this.uniforms.dashScale.value = value;
  }
  get dashSize() {
    return this.uniforms.dashSize.value;
  }
  set dashSize(value) {
    this.uniforms.dashSize.value = value;
  }
  get dashOffset() {
    return this.uniforms.dashOffset.value;
  }
  set dashOffset(value) {
    this.uniforms.dashOffset.value = value;
  }
  get gapSize() {
    return this.uniforms.gapSize.value;
  }
  set gapSize(value) {
    this.uniforms.gapSize.value = value;
  }
  get opacity() {
    return this.uniforms.opacity.value;
  }
  set opacity(value) {
    if (!this.uniforms) return;
    this.uniforms.opacity.value = value;
  }
  get resolution() {
    return this.uniforms.resolution.value;
  }
  set resolution(value) {
    this.uniforms.resolution.value.copy(value);
  }
  get alphaToCoverage() {
    return 'USE_ALPHA_TO_COVERAGE' in this.defines;
  }
  set alphaToCoverage(value) {
    if (!this.defines) return;
    if ((value === true) !== this.alphaToCoverage) {
      this.needsUpdate = true;
    }
    if (value === true) {
      this.defines.USE_ALPHA_TO_COVERAGE = '';
      this.extensions.derivatives = true;
    } else {
      delete this.defines.USE_ALPHA_TO_COVERAGE;
      this.extensions.derivatives = false;
    }
  }
}
export {
  LineMaterial
};