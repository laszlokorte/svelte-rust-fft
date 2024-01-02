mod utils;

use rustfft::Fft;
use std::sync::Arc;
use wasm_bindgen::prelude::*;
use rustfft::{FftPlanner, num_complex::Complex};

use std::f32::consts::PI;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    utils::set_panic_hook();
    alert("Hello");
}

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

        let time = vec![Complex{ re: 0.0f32, im: 0.0f32 }; length];
        let mut freq = time.clone();
        fft.process(&mut freq);

        Self {
            fft,
            time, 
            freq,
        }
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

    pub fn set_sin(&mut self, freq: f32) {
        let len = self.time.len() as f32;
        for (i, v) in self.time.iter_mut().enumerate() {
            let t = (i as f32) / len - 0.5;

            v.re = (freq * t * PI * 4.0).cos();
            v.im = (freq * t * PI * 4.0).sin();
        }

        self.freq.clone_from(&self.time);
        self.fft.process(&mut self.freq);
        self.freq.rotate_right(self.time.len()/2);
    }
}