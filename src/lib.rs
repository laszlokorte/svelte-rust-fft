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
    fft_integer: Arc<dyn Fft<f32>>,
    convolver: Convolver,
    time: Vec<Complex<f32>>,
    freq: Vec<Complex<f32>>,
    frac: Vec<Complex<f32>>,

    f1: Vec<Complex<f32>>,
    f0c: Vec<Complex<f32>>,
    f1c: Vec<Complex<f32>>,
    h0: Vec<Complex<f32>>,
}


fn do_fft(fft: &Arc<dyn Fft<f32>>, source: &Vec<Complex<f32>>, mut target: &mut Vec<Complex<f32>>) {
    let len = source.len();

    target.clone_from(source);
    target.rotate_right(len / 2);
    fft.process(&mut target);
    target.rotate_right(len / 2);
    let scale_nominator = source.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less)).unwrap_or(1.0);
    let scale_denom = target.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less)).unwrap_or(1.0);

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

        let sinc_len = 2 * length - 1;
        let fft_conv_len = conv_length(length, sinc_len);

        let mut planner = FftPlanner::new();
        let fft_integer = planner.plan_fft_forward(length);

        let time = vec![Complex::default();length];
        let freq = vec![Complex::default();length];
        let frac = vec![Complex::default();length];

        Self { 
            fft_integer,
            convolver: Convolver::new(fft_conv_len),
            time, 
            freq, 
            frac,
            f1: vec![Complex::default();fft_conv_len],
            f0c: vec![Complex::default();fft_conv_len],
            f1c: vec![Complex::default();fft_conv_len],
            h0: vec![Complex::default();fft_conv_len],
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

    pub fn get_f1len(&self) -> usize {
        self.f1.len()
    }

    pub fn update_freq(&mut self) {
        do_fft(&self.fft_integer, &self.time, &mut self.freq);
    }

    pub fn update_time(&mut self) {
        do_fft(&self.fft_integer, &self.freq, &mut self.time);
    }


    pub fn update_frac(&mut self, fraction: f32) {
        let n = (&self.time).len();
        let f_n = n as f32;
        // a = a % 4;

        let mut a = (fraction + 4.0).rem_euclid(4.0);
        if a == 0.0 {
            self.frac.clone_from(&self.time);
        } else if a == 1.0 {
            do_fft(&self.fft_integer, &self.time, &mut self.frac);
        } else if a == 2.0 {
            self.frac.clone_from(&self.time);
            self.frac.reverse();
        } else if a == 3.0 {
            do_fft(&self.fft_integer, &self.time, &mut self.frac);
            self.frac.reverse();
        } else {
            self.frac.clone_from(&self.time);

            let mut do_rev = if a > 2.0 {
                a -= 2.0;
                true
            } else {
                false
            };

            if a > 1.5 {
                a -= 1.0;
                do_fft(&self.fft_integer, &self.time, &mut self.frac);
            }
            if a < 0.5 {
                a += 1.0;
                do_fft(&self.fft_integer, &self.time, &mut self.frac);
         
                do_rev = !do_rev;
            }

            if do_rev {
                self.frac.reverse();
            }
           
            let alpha = a * PI / 2.0;
            let s = PI / (f_n + 1.0) / alpha.sin() / 4.0;
            let t = PI / (f_n + 1.0) * (alpha / 2.0).tan() / 4.0;
            let cs = Complex::<f32>::new(0.0, -1.0 * (1.0 - a) * PI / 4.0).exp() / (s/PI).sqrt();

            let sinc_iter = (0..(2 * n - 1)).map(|i| -(2.0 * f_n - 3.0) + 2.0 * i as f32).map(|x| sinc(x) * 0.5);
            //let sinc_len = 2 * n - 1;

            self.convolver.conv_spectral((&self.frac).iter().cloned(), sinc_iter, &mut self.f1);


            //ifft(f1);
            //f1.reverse();
            self.convolver.fft(&mut self.f1);
            let f1_slice = &self.f1[n..(2 * n - 1)];


            let chirp_a = (0..(2 * n - 1)).map(|i| -f_n + 1.0 + i as f32).map(|x| Complex::<f32>::new(0.0, -1.0 * t * x*x).exp());
            let chirp_b = (0..(4 * n - 1)).map(|i| -(2.0 * f_n - 1.0) + i as f32).map(|x| Complex::<f32>::new(0.0, 1.0 * s * x*x).exp());

            let l0 = chirp_a.clone().step_by(2);
            let l1 = chirp_a.skip(1).step_by(2);
            let e0 = chirp_b.clone().step_by(2);
            let e1 = chirp_b.skip(1).step_by(2);

            let f0m_iter = (&self.frac).iter().zip(l0.clone()).map(|(a,b)| a*b);
            let f1m_iter = f1_slice.iter().zip(l1).map(|(a,b)| a*b);

            self.convolver.conv_spectral(f0m_iter, e0, &mut self.f0c);
            self.convolver.conv_spectral(f1m_iter, e1, &mut self.f1c);



            iter_into_slice(self.f0c.iter().zip(self.f1c.iter()).map(|(a,b)| a+b), &mut self.h0);
            self.convolver.fft(&mut self.h0);
            self.h0.reverse();

            for (i, l) in l0.enumerate() {
                self.frac[i] = cs * l * self.h0[n + i] * f32::sqrt(f_n);
            }

            let scale_nominator = (&self.time).iter().cloned().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less)).unwrap_or(1.0);
            let scale_denom = (&self.frac).iter().cloned().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less)).unwrap_or(1.0);

            let scale = if scale_denom != 0.0 { scale_nominator / scale_denom } else {1.0};

            for v in (&mut self.frac).iter_mut() {
                v.re *= scale;
                v.im *= scale;
            }
        }
    }
}


fn sinc(x: f32) -> Complex<f32> {
    Complex::new(f32::sin(PI * x) / (PI * x), 0.0)
}

struct Convolver {
    fft_conv: Arc<dyn Fft<f32>>,
    pad_a: Vec<Complex<f32>>,
    pad_b: Vec<Complex<f32>>,
}

impl Convolver {
    fn new(length: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft_conv = planner.plan_fft_forward(length);
        let mut pad_a = vec![Complex::default();length];
        let mut pad_b = vec![Complex::default();length];

        fft_conv.process(&mut pad_a);
        fft_conv.process(&mut pad_b);

        Self {
            fft_conv: fft_conv,
            pad_a: pad_a,
            pad_b: pad_b,
        }
    }


    fn conv_spectral(&mut self, a: impl Iterator<Item=Complex<f32>>, b: impl Iterator<Item=Complex<f32>>, into: &mut [Complex<f32>]) {
        self.pad_a.fill(Complex::default());
        self.pad_b.fill(Complex::default());

        iter_into_slice(a, &mut self.pad_a);
        iter_into_slice(b, &mut self.pad_b);



        self.fft_conv.process(&mut self.pad_a);
        self.fft_conv.process(&mut self.pad_b);

        iter_into_slice(self.pad_a.iter().zip(self.pad_b.iter()).map(|(a,b)| a*b), into)
    }

    fn fft(&self, mut signal: &mut [Complex<f32>]) {
        self.fft_conv.process(&mut signal);
    }
}

fn conv_length(a_size: usize, b_size: usize) -> usize {
    let n = a_size + b_size - 1;
    
    2 << f32::ceil(f32::log2(n as f32)) as usize
}

fn iter_into_slice<T>(iter: impl Iterator<Item=T>, slice: &mut[T]) {
    for (old, it) in slice.iter_mut().zip(iter) {
        *old = it
    }
}