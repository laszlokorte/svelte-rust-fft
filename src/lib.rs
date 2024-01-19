#![feature(iter_array_chunks)]

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

    f1: Vec<Complex<f32>>,
    f0c: Vec<Complex<f32>>,
    f1c: Vec<Complex<f32>>,
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
        utils::set_panic_hook();

        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(length);

        let time = vec![Complex::default();length];
        let mut freq = vec![Complex::default();length];
        let frac = vec![Complex::default();length];
        fft.process(&mut freq);

        Self { fft, time, freq, frac,
            f1: Default::default(),
            f0c: Default::default(),
            f1c: Default::default(),
        }
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
        let n = self.time.len();
        let f_n = n as f32;
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
            let s = PI / (f_n + 1.0) / alpha.sin() / 4.0;
            let t = PI / (f_n + 1.0) * (alpha / 2.0).tan() / 4.0;
            let cs = Complex::<f32>::new(0.0, -1.0 * (1.0 - a) * PI / 4.0).exp() / (s/PI).sqrt();

            let sinc_iter = (0..(2 * n - 2)).map(|i| -(2.0 * f_n - 3.0) + 2.0 * i as f32).map(|x| sinc(x) * 0.5);
            let sinc_len = 2 * n - 2;

            fast_conv(&self.fft, self.frac.len(), sinc_len, self.frac.iter().cloned(), sinc_iter, &mut self.f1);
            //ifft(f1);
            //f1.reverse();
            self.fft.process(&mut self.f1);
            let f1_slice = &self.f1[n..(2 * n - 1)];


            let chirp_a = (0..(2 * n - 1)).map(|i| -f_n + 1.0 + i as f32).map(|x| Complex::<f32>::new(0.0, -1.0 * t * x*x).exp());
            let chirp_b = (0..(4 * n - 1)).map(|i| -(2.0 * f_n - 1.0) + i as f32).map(|x| Complex::<f32>::new(0.0, 1.0 * s * x*x).exp());

            let (l0, l1) : (Vec<_>, Vec<_>) = chirp_a.array_chunks().map(|[a,b]| (a,b)).unzip();
            let (e0, e1) : (Vec<_>, Vec<_>) = chirp_b.array_chunks().map(|[a,b]| (a,b)).unzip();


            let f0m_iter = self.frac.iter().zip(l0.iter()).map(|(a,b)| a*b);
            let f1m_iter = f1_slice.iter().zip(l1).map(|(a,b)| a*b);

            fast_conv(&self.fft, self.frac.len(), e0.len(), f0m_iter, e0.iter().cloned(), &mut self.f0c);
            fast_conv(&self.fft, f1_slice.len(), e1.len(), f1m_iter, e1.iter().cloned(), &mut self.f1c);

            let mut h0 : Vec<_> = self.f0c.iter().zip(self.f1c.iter()).map(|(a,b)| a+b).collect();
            self.fft.process(&mut h0);
            h0.reverse();

            for (i, l) in l0.iter().enumerate() {
                self.frac[i] = cs * l * h0[n + i] * f32::sqrt(f_n)
            }
        }
    }
}


fn sinc(x: f32) -> Complex<f32> {
    Complex::new(f32::sin(PI * x) / (PI * x), 0.0)
}

fn fast_conv(fft: &Arc<dyn Fft<f32>>, a_size: usize, b_size: usize, a: impl Iterator<Item=Complex<f32>>, b: impl Iterator<Item=Complex<f32>>, into: &mut [Complex<f32>]) {
    let n = a_size + b_size - 1;
    let p = 2 << f32::ceil(f32::log2(n as f32)) as usize;
    let mut padded_a = padded(a, p);
    let mut padded_b = padded(b, p);
    fft.process(&mut padded_a);
    fft.process(&mut padded_b);

    iter_into_slice(padded_a.iter().zip(padded_b.iter()).map(|(a,b)| a*b), into)
}

fn padded(orig: impl Iterator<Item=Complex<f32>>, target_length: usize) -> Vec<Complex<f32>> {
    let mut padded = vec![Complex::default();target_length];

    iter_into_slice(orig, &mut padded);

    padded
}


fn iter_into_slice<T>(iter: impl Iterator<Item=T>, slice: &mut[T]) {
    for (old, it) in slice.iter_mut().zip(iter) {
        *old = it
    }
}