use crate::iter_into_slice;
use crate::sinc_interp::Interpolator;
use crate::Convolver;
use std::f32::consts::PI;

use crate::Complex;
use crate::Fft;
use crate::FftPlanner;

use crate::Arc;

/// Implementation based on the matlab code
/// provided at https://nalag.cs.kuleuven.be/research/software/FRFT/
/// https://nalag.cs.kuleuven.be/research/software/FRFT/frft.m
///
/// function Faf = frft(f, a)
/// f = f(:);
/// N = length(f);
/// shft = rem((0:N-1)+fix(N/2),N)+1;
/// sN = sqrt(N);
/// a = mod(a,4);
///
/// % do special cases
/// if (a==0), Faf = f; return; end;
/// if (a==2), Faf = flipud(f); return; end;
/// if (a==1), Faf(shft,1) = fft(f(shft))/sN; return; end
/// if (a==3), Faf(shft,1) = ifft(f(shft))*sN; return; end
///
/// % reduce to interval 0.5 < a < 1.5
/// if (a>2.0), a = a-2; f = flipud(f); end
/// if (a>1.5), a = a-1; f(shft,1) = fft(f(shft))/sN; end
/// if (a<0.5), a = a+1; f(shft,1) = ifft(f(shft))*sN; end
///
/// % the general case for 0.5 < a < 1.5
/// alpha = a*pi/2;
/// tana2 = tan(alpha/2);
/// sina = sin(alpha);
/// f = [zeros(N-1,1) ; interp(f) ; zeros(N-1,1)];
///
/// % chirp premultiplication
/// chrp = exp(-i*pi/N*tana2/4*(-2*N+2:2*N-2)'.^2);
/// f = chrp.*f;
///
/// % chirp convolution
/// c = pi/N/sina/4;
/// Faf = fconv(exp(i*c*(-(4*N-4):4*N-4)'.^2),f);
/// Faf = Faf(4*N-3:8*N-7)*sqrt(c/pi);
///
/// % chirp post multiplication
/// Faf = chrp.*Faf;
///
/// % normalizing constant
/// Faf = exp(-i*(1-a)*pi/4)*Faf(N:2:end-N+1);
///
/// %%%%%%%%%%%%%%%%%%%%%%%%%
/// function xint=interp(x)
/// % sinc interpolation
///
/// N = length(x);
/// y = zeros(2*N-1,1);
/// y(1:2:2*N-1) = x;
/// xint = fconv(y(1:2*N-1), sinc([-(2*N-3):(2*N-3)]'/2));
/// xint = xint(2*N-2:end-2*N+3);
///
/// %%%%%%%%%%%%%%%%%%%%%%%%%
/// function z = fconv(x,y)
/// % convolution by fft
///
/// N = length([x(:);y(:)])-1;
/// P = 2^nextpow2(N);
/// z = ifft( fft(x,P) .* fft(y,P));
/// z = z(1:N);

pub struct Frft {
    fft_integer: Arc<dyn Fft<f32>>,
    interpolator: Interpolator,
    convolver: Convolver,
    conv_res: Vec<Complex<f32>>,
}

impl Frft {
    pub fn new(length: usize) -> Self {
        let mut planner = FftPlanner::new();
        let fft_integer = planner.plan_fft_forward(length);
        let interpolator = Interpolator::new(length);
        let convolver = Convolver::new(length);
        let conv_res = vec![Complex::default(); 9 * length];

        Self {
            fft_integer,
            interpolator,
            convolver,
            conv_res,
        }
    }

    pub fn process(&mut self, signal: &mut [Complex<f32>], fraction: f32) {
        let _ = self.process_internal(signal, fraction);
    }

    pub fn process_scaled(&mut self, signal: &mut [Complex<f32>], fraction: f32) {
        let scale = f32::sqrt(self.process_internal(signal, fraction));

        for v in signal.iter_mut() {
            v.re *= scale;
            v.im *= scale;
        }
    }

    fn chirps(
        &self,
        i_n: i32,
        a: f32,
    ) -> (
        impl Iterator<Item = Complex<f32>> + Clone,
        impl Iterator<Item = Complex<f32>> + Clone,
    ) {
        let f_n = i_n as f32;
        let alpha = a * PI / 2.0;
        let tana2 = f32::tan(alpha / 2.0);
        let sina = f32::sin(alpha);
        let c = PI / f_n / sina / 4.0;

        // chrp_a = exp(-i*pi/N*tana2/4*(-2*N+2:2*N-2)'.^2);
        let chirp_a = ((-2 * i_n)..(2 * i_n)).map(move |x| {
            Complex::<f32>::new(0.0, -PI / f_n * tana2 / 4.0 * ((x * x) as f32)).exp()
        });
        // chirp_b = exp(i*c*(-(4*N-4):4*N-4)'.^2)
        let chirp_b = ((-4 * i_n)..(4 * i_n))
            .map(move |x| Complex::<f32>::new(0.0, c * ((x * x) as f32)).exp());

        (chirp_a, chirp_b)
    }

    fn preprocess(&self, frac: &mut [Complex<f32>], fraction: f32) -> (f32, Option<f32>) {
        let n = frac.len();
        let f_n = n as f32;
        let mut a = (fraction + 4.0).rem_euclid(4.0);

        if a == 0.0 {
            (1.0, None)
        } else if a == 1.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(frac);
            frac.rotate_right(n / 2);

            return (1.0 / f_n, None);
        } else if a == 2.0 {
            frac.reverse();
            frac.rotate_right(1);

            return (1.0, None);
        } else if a == 3.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(frac);
            frac.rotate_right(n / 2);
            frac.reverse();
            frac.rotate_right(1);

            return (1.0 / f_n, None);
        } else {
            let mut scale_factor = 1.0;

            let mut do_rev = if a > 2.0 {
                a -= 2.0;
                frac.rotate_right(1);
                true
            } else {
                false
            };

            if a > 1.5 {
                a -= 1.0;
                frac.rotate_right(n / 2);
                self.fft_integer.process(frac);
                frac.rotate_right(n / 2);
                frac.rotate_left(1);

                scale_factor /= f_n;
            }
            if a < 0.5 {
                a += 1.0;

                if do_rev {
                    frac.rotate_left(1);
                }
                frac.rotate_right(n / 2);
                self.fft_integer.process(frac);
                frac.rotate_right(n / 2);
                frac.rotate_left(1);

                do_rev = !do_rev;

                scale_factor *= f_n;
            } else if do_rev {
                frac.rotate_left(1);
            }

            if do_rev {
                frac.reverse();
                frac.rotate_right(1);
            }

            return (scale_factor, Some(a));
        }
    }

    fn process_internal(&mut self, frac: &mut [Complex<f32>], fraction: f32) -> f32 {
        let n = frac.len();
        let i_n = n as i32;
        let f_n = n as f32;

        let (scale_factor, adjusted_a) = self.preprocess(frac, fraction);

        if let Some(a) = adjusted_a {
            // % the general case for 0.5 < a < 1.5
            // alpha = a*pi/2;
            // tana2 = tan(alpha/2);
            // sina = sin(alpha);
            // f = [zeros(N-1,1) ; interp(f) ; zeros(N-1,1)];
            let alpha = a * PI / 2.0;
            let sina = f32::sin(alpha);
            let c = PI / f_n / sina / 4.0;
            let sqrt_c_pi = f32::sqrt(c / PI);
            let (chirp_a, chirp_b) = self.chirps(i_n, a);

            let interped_f = self.interpolator.interp(frac.iter());

            // % chirp premultiplication
            // f = chrp_a.*f;
            let f1 = chirp_a.clone().zip(interped_f).map(|(a, b)| a * b);

            // % chirp convolution
            // c = pi/N/sina/4;
            // Faf = fconv(chirp_b,f);
            // Faf = Faf(4*N-3:8*N-7)*sqrt(c/pi);
            self.convolver.conv(chirp_b, f1.clone(), &mut self.conv_res);

            // % chirp post multiplication
            // Faf = chrp_a.*Faf;
            let f2 = self
                .conv_res
                .iter()
                .zip(chirp_a)
                .map(|(a, b)| a * b * sqrt_c_pi);

            iter_into_slice(f2, frac);

            // % normalizing constant
            // Faf = exp(-i*(1-a)*pi/4)*Faf(N:2:end-N+1);
        }

        scale_factor
    }
}
