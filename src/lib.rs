mod utils;

use rustfft::Fft;
use rustfft::{num_complex::Complex, FftPlanner};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use std::f32::consts::PI;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct Signal {
    fft: Arc<dyn Fft<f32>>,
    time: Vec<Complex<f32>>,
    freq: Vec<Complex<f32>>,
    frac: Vec<Complex<f32>>,
}


fn do_fft(fft: &Arc<dyn Fft<f32>>, source: &Vec<Complex<f32>>, mut target: &mut Vec<Complex<f32>>) {
    let len = source.len();

    target.clone_from(source);
    target.rotate_right(len / 2);
    fft.process(&mut target);
    target.rotate_right(len / 2);
    let scale_nominator = source.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0);
    let scale_denom = target.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0);

    let scale = if scale_denom != 0.0 { scale_nominator / scale_denom } else {1.0};

    for v in target.iter_mut() {
        v.re *= scale;
        v.im *= scale;
    }
}

#[wasm_bindgen]
impl Signal {
    pub fn new(length: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(length);

        let time = vec![Complex::default();length];
        let mut freq = vec![Complex::default();length];
        let frac = vec![Complex::default();length];
        fft.process(&mut freq);

        Self { fft, time, freq, frac }
    }

    pub fn get_time(&self) -> *const Complex<f32> {
        self.time.as_ptr()
    }

    pub fn get_freq(&self) -> *const Complex<f32> {
        self.freq.as_ptr()
    }

    pub fn get_frac(&self) -> *const Complex<f32> {
        self.frac.as_ptr()
    }

    pub fn get_len(&self) -> usize {
        self.time.len()
    }

    pub fn update_freq(&mut self) {
        do_fft(&self.fft, &self.time, &mut self.freq);
    }

    pub fn update_time(&mut self) {
        do_fft(&self.fft, &self.freq, &mut self.time);
    }


    pub fn update_frac(&mut self, fraction: f32) {
        let N = self.time.len();
        let fN = N as f32;
        // a = a % 4;

        let mut a = fraction.rem_euclid(4.0);

        if a == 0.0 {
            self.frac.clone_from(&self.time);
        } else if a == 1.0 {
            do_fft(&self.fft, &self.time, &mut self.frac);
        } else if a == 2.0 {
            self.frac.clone_from(&self.time);
            self.frac.reverse();
        } else if a == 3.0 {
            do_fft(&self.fft, &self.time, &mut self.frac);
            self.frac.reverse();
        } else {

            if a > 2.0 {
                a -= 2.0;
                self.frac.reverse();
            }
            if a > 1.5 {
                a -= 1.0;
                do_fft(&self.fft, &self.time, &mut self.frac);
                self.frac.reverse();
            }
            if a < 0.5 {
                a += 1.0;
                do_fft(&self.fft, &self.time, &mut self.frac);
            }
           
            let alpha = a * PI / 2.0;
            let s = PI / (fN + 1.0) / alpha.sin() / 4.0;
            let t = PI / (fN + 1.0) * (alpha / 2.0).tan() / 4.0;
            let cs = Complex::<f32>::new(0.0, -1.0 * (1.0 - a) * PI / 4.0).exp() / (s/PI).sqrt();

            let sincArray = (0..(2 * N - 2)).map(|i| -(2.0 * fN - 3.0) + 2.0 * i as f32).map(|x| sinc(x) * 0.5).collect::<Vec<_>>();

            let f1 = fast_conv(&self.frac, &sincArray);
            ifft(f1);
            f1.reverse();
            f1.slice(N, 2 * N - 1);


            let chrpA = (0..(2 * N - 1)).map(|i| -fN + 1.0 + i as f32).map(|x| Complex::<f32>::new(0.0, -1.0 * t * x*x).exp());
            let chrpB = (0..(4 * N - 1)).map(|i| -(2.0 * fN - 1.0) + i as f32).map(|x| Complex::<f32>::new(0.0, 1.0 * s * x*x).exp());

            let l0 = arrayMod(chrpA, 2, 0);
            let l1 = arrayMod(chrpA, 2, 1);
            let e1 = arrayMod(chrpB, 2, 0);
            let e0 = arrayMod(chrpB, 2, 1);


            let f0m = complZipArrays(self.frac, l0, complMul);
            let f1m = complZipArrays(f1, l1, complMul);
            let f0c = fast_conv(f0m, e0);
            let f1c = fast_conv(f1m, e1);

            let h0 = complZipArrays(f0c, f1c, complAdd);
            ifft(h0);

            for (i, l) in l0.enumerate() {
                self.frac[i] = complMul(cs, l, h0[N + i]) * f32::sqrt(fN)
            }
        }


        // const alpha = a * Math.PI / 2;
        // const s = Math.PI / (N + 1) / Math.sin(alpha) / 4;
        // const t = Math.PI / (N + 1) * Math.tan(alpha / 2) / 4;
        // const Cs = complScale(complExp(compl(0, -1 * (1 - a) * Math.PI / 4)), Math.sqrt(s / Math.PI));

        // const sincArry = Array.from({length: 2 * N - 2}, (_, i) => -(2 * N - 3) + 2 * i).map(sinc).map(x => complScale(x, 1/2))

        // const f1 = ifft(fconv(f0, sincArry)).reverse().slice(N, 2 * N - 1);
        

        //---

        // const chrpA = Array.from({length: 2 * N - 1}, (_, i) => complExp(compl(0, -1 * t * Math.pow(-N + 1 + i, 2))));
        // const l0 = arrayMod(chrpA, 2, 0)
        // const l1 = arrayMod(chrpA, 2, 1)
        // const f0m = complZipArrays(f0, l0, complMul);
        // const f1m = complZipArrays(f1, l1, complMul);
        
        // const chrpB = Array.from({length: 4 * N - 1}, (_, i) => complExp(compl(0, 1 * s * Math.pow(-(2 * N - 1) + i, 2))));
        // const e1 = arrayMod(chrpB, 2, 0);
        // const e0 = arrayMod(chrpB, 2, 1);
        // const f0c = fconv(f0m, e0);
        // const f1c = fconv(f1m, e1);
        // const h0 = ifft(complZipArrays(f0c, f1c, complAdd));

        // return l0.map((l, i) => complMul(Cs, l, h0[N + i])).map(x => complScale(x, Math.sqrt(N)))
    }
}


fn sinc(x: f32) -> Complex<f32> {
    Complex::default()
}

fn fast_conv(a: &Vec<Complex<f32>>, b: &Vec<Complex<f32>>) {

}