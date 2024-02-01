#![feature(iter_array_chunks)]
#![feature(iter_intersperse)]

mod convolver;
pub mod frft;
mod frft2;
mod iter;
mod sinc;
pub mod sinc_interp;
mod utils;

use crate::frft::Frft;
use crate::convolver::conv_length;
use crate::convolver::Convolver;
use crate::frft2::Frft2;
use crate::iter::iter_into_slice;
use rustfft::Fft;
use rustfft::{num_complex::Complex, FftPlanner};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct Signal {
    fft_integer: Arc<dyn Fft<f32>>,
    time: Vec<Complex<f32>>,
    freq: Vec<Complex<f32>>,
    frac: Vec<Complex<f32>>,

    frft2: Frft2,
    frft: Frft,
}

fn do_fft(fft: &Arc<dyn Fft<f32>>, source: &Vec<Complex<f32>>, target: &mut Vec<Complex<f32>>) {
    let len = source.len();

    target.clone_from(source);
    target.rotate_right(len / 2);
    fft.process(target);
    target.rotate_right(len / 2);
    let scale_nominator = source
        .iter()
        .map(|z| z.norm())
        .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less))
        .unwrap_or(1.0);
    let scale_denom = target
        .iter()
        .map(|z| z.norm())
        .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less))
        .unwrap_or(1.0);

    let scale = if scale_denom != 0.0 {
        scale_nominator / scale_denom
    } else {
        1.0
    };

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
        let _fft_conv_len = conv_length(length, sinc_len);

        let mut planner = FftPlanner::new();
        let fft_integer = planner.plan_fft_forward(length);

        let time = vec![Complex::default(); length];
        let freq = vec![Complex::default(); length];
        let frac = vec![Complex::default(); length];

        Self {
            fft_integer,
            frft2: Frft2::new(length),
            frft: Frft::new(length),
            time,
            freq,
            frac,
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
        do_fft(&self.fft_integer, &self.time, &mut self.freq);
    }

    pub fn update_time(&mut self) {
        do_fft(&self.fft_integer, &self.freq, &mut self.time);
    }

    pub fn update_frac(&mut self, fraction: f32) {
        self.frac.clone_from(&self.time);
        self.frft.process(&mut self.frac, fraction);

        let scale_nominator = self
            .time
            .iter()
            .cloned()
            .map(|z| z.norm())
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less))
            .unwrap_or(1.0);
        let scale_denom = self
            .frac
            .iter()
            .cloned()
            .map(|z| z.norm())
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Less))
            .unwrap_or(1.0);
        let scale = if scale_denom != 0.0 {
            scale_nominator / scale_denom
        } else {
            1.0
        };

        for v in self.frac.iter_mut() {
            v.re *= scale;
            v.im *= scale;
        }
    }
}
