use crate::iter_into_slice;
use rustfft::Fft;
use rustfft::{num_complex::Complex, FftPlanner};
use std::sync::Arc;

pub struct Convolver {
    fft_conv: Arc<dyn Fft<f32>>,
    pad_a: Vec<Complex<f32>>,
    pad_b: Vec<Complex<f32>>,
}

impl Convolver {
    pub fn new(length: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft_conv = planner.plan_fft_forward(length);
        let mut pad_a = vec![Complex::default(); length];
        let mut pad_b = vec![Complex::default(); length];

        fft_conv.process(&mut pad_a);
        fft_conv.process(&mut pad_b);

        Self {
            fft_conv: fft_conv,
            pad_a: pad_a,
            pad_b: pad_b,
        }
    }

    pub fn conv_spectral(
        &mut self,
        a: impl Iterator<Item = Complex<f32>>,
        b: impl Iterator<Item = Complex<f32>>,
        into: &mut [Complex<f32>],
    ) {
        self.pad_a.fill(Complex::default());
        self.pad_b.fill(Complex::default());

        iter_into_slice(a, &mut self.pad_a);
        iter_into_slice(b, &mut self.pad_b);

        self.fft_conv.process(&mut self.pad_a);
        self.fft_conv.process(&mut self.pad_b);

        iter_into_slice(
            self.pad_a.iter().zip(self.pad_b.iter()).map(|(a, b)| a * b),
            into,
        )
    }

    pub fn fft(&self, mut signal: &mut [Complex<f32>]) {
        self.fft_conv.process(&mut signal);
    }
}

pub fn conv_length(a_size: usize, b_size: usize) -> usize {
    let n = a_size + b_size - 1;

    2 << f32::ceil(f32::log2(n as f32)) as usize
}
