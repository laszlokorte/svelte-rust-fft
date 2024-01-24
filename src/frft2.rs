use crate::conv_length;
use crate::iter_into_slice;
use crate::sinc::sinc;
use crate::Convolver;
use crate::FftPlanner;
use rustfft::num_complex::Complex;
use rustfft::Fft;
use std::f32::consts::PI;
use std::sync::Arc;

pub struct Frft2 {
    fft_integer: Arc<dyn Fft<f32>>,
    convolver: Convolver,

    f1: Vec<Complex<f32>>,
    f0c: Vec<Complex<f32>>,
    f1c: Vec<Complex<f32>>,
    h0: Vec<Complex<f32>>,
}

impl Frft2 {
    pub fn new(length: usize) -> Self {
        let sinc_len = 2 * length - 1;
        let fft_conv_len = conv_length(length, sinc_len);

        let mut planner = FftPlanner::new();
        let fft_integer = planner.plan_fft_forward(length);

        Self {
            fft_integer,
            convolver: Convolver::new(fft_conv_len),
            f1: vec![Complex::default(); fft_conv_len],
            f0c: vec![Complex::default(); fft_conv_len],
            f1c: vec![Complex::default(); fft_conv_len],
            h0: vec![Complex::default(); fft_conv_len],
        }
    }

    pub fn process(&mut self, mut frac: &mut [Complex<f32>], fraction: f32) {
        let n = frac.len();
        let f_n = n as f32;

        let mut a = (fraction + 4.0).rem_euclid(4.0);

        if a == 0.0 {
            return;
        } else if a == 1.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(&mut frac);
            frac.rotate_right(n / 2);
        } else if a == 2.0 {
            frac.reverse();
        } else if a == 3.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(&mut frac);
            frac.rotate_right(n / 2);
            frac.reverse();
        } else {
            let mut do_rev = if a > 2.0 {
                a -= 2.0;
                true
            } else {
                false
            };

            if a > 1.5 {
                a -= 1.0;
                frac.rotate_right(n / 2);
                self.fft_integer.process(&mut frac);
                frac.rotate_right(n / 2);
            }
            if a < 0.5 {
                a += 1.0;
                frac.rotate_right(n / 2);
                self.fft_integer.process(&mut frac);
                frac.rotate_right(n / 2);

                do_rev = !do_rev;
            }

            if do_rev {
                frac.reverse();
            }

            let alpha = a * PI / 2.0;
            let s = PI / (f_n + 1.0) / alpha.sin() / 4.0;
            let t = PI / (f_n + 1.0) * (alpha / 2.0).tan() / 4.0;
            let cs = Complex::<f32>::new(0.0, -1.0 * (1.0 - a) * PI / 4.0).exp() / (s / PI).sqrt();

            let sinc_iter = (0..(2 * n - 1))
                .map(|i| -(2.0 * f_n - 3.0) + 2.0 * i as f32)
                .map(|x| sinc(x) * 0.5);
            //let sinc_len = 2 * n - 1;

            self.convolver
                .conv_spectral((&frac).iter().cloned(), sinc_iter, &mut self.f1);

            //ifft(f1);
            //f1.reverse();
            self.convolver.fft(&mut self.f1);
            let f1_slice = &self.f1[n..(2 * n - 1)];

            let chirp_a = (0..(2 * n - 1))
                .map(|i| -f_n + 1.0 + i as f32)
                .map(|x| Complex::<f32>::new(0.0, -1.0 * t * x * x).exp());
            let chirp_b = (0..(4 * n - 1))
                .map(|i| -(2.0 * f_n - 1.0) + i as f32)
                .map(|x| Complex::<f32>::new(0.0, 1.0 * s * x * x).exp());

            let l0 = chirp_a.clone().step_by(2);
            let l1 = chirp_a.skip(1).step_by(2);
            let e0 = chirp_b.clone().step_by(2);
            let e1 = chirp_b.skip(1).step_by(2);

            let f0m_iter = (&frac).iter().zip(l0.clone()).map(|(a, b)| a * b);
            let f1m_iter = f1_slice.iter().zip(l1).map(|(a, b)| a * b);

            self.convolver.conv_spectral(f0m_iter, e0, &mut self.f0c);
            self.convolver.conv_spectral(f1m_iter, e1, &mut self.f1c);

            iter_into_slice(
                self.f0c.iter().zip(self.f1c.iter()).map(|(a, b)| a + b),
                &mut self.h0,
            );
            self.convolver.fft(&mut self.h0);
            self.h0.reverse();

            for (i, l) in l0.enumerate() {
                frac[i] = cs * l * self.h0[n + i] * f32::sqrt(f_n);
            }
        }
    }
}
