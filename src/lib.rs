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
}

#[wasm_bindgen]
impl Signal {
    pub fn new(length: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(length);

        let time = vec![
            Complex {
                re: 0.0f32,
                im: 0.0f32
            };
            length
        ];
        let mut freq = time.clone();
        fft.process(&mut freq);

        Self { fft, time, freq }
    }

    pub fn get_time(&self) -> *const Complex<f32> {
        self.time.as_ptr()
    }

    pub fn get_freq(&self) -> *const Complex<f32> {
        self.freq.as_ptr()
    }

    pub fn get_len(&self) -> usize {
        self.time.len()
    }

    pub fn update_freq(&mut self) {
        self.freq.clone_from(&self.time);
        self.freq.rotate_right(self.time.len() / 2);
        self.fft.process(&mut self.freq);
        self.freq.rotate_right(self.time.len() / 2);
        let scale = self.time.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0) 
        / self.freq.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0);

        for v in self.freq.iter_mut() {
            v.re *= scale;
            v.im *= scale;
        }
    }

    pub fn update_time(&mut self) {
        self.time.clone_from(&self.freq);
        self.time.rotate_right(self.freq.len() / 2);
        self.fft.process(&mut self.time);
        self.time.rotate_right(self.freq.len() / 2);
        let scale = self.freq.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0) 
        / self.time.iter().map(|z|z.norm()).max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(1.0);

        for v in self.time.iter_mut() {
            v.re *= scale;
            v.im *= scale;
        }
    }
}
