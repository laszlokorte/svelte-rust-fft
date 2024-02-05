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
        // alpha
        // 2.0420352248333655
        // tana2
        // 1.6318516871287894
        // sina
        // 0.8910065241883679
        // c
        // 0.05509206036067469
        let f_n = i_n as f32;
        let alpha = a * PI / 2.0;
        let tana2 = f32::tan(alpha / 2.0);
        let sina = f32::sin(alpha);
        let c = PI / f_n / sina / 4.0;

        // chrp_a = exp(-i*pi/N*tana2/4*(-2*N+2:2*N-2)'.^2);
        let chirp_a = ((-2 * i_n + 2)..(2 * i_n - 1)).map(move |x| {
            Complex::<f32>::new(0.0, -PI / f_n * tana2 / 4.0 * ((x * x) as f32)).exp()
        });
        // chirp_b = exp(i*c*(-(4*N-4):4*N-4)'.^2)
        let chirp_b = ((-4 * i_n + 4)..(4 * i_n - 3))
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
                //.skip(4 * n - 3)
                .zip(chirp_a)
                .map(|(a, b)| a * b * sqrt_c_pi);

            iter_into_slice(f2.step_by(2), frac);

            // % normalizing constant
            // Faf = exp(-i*(1-a)*pi/4)*Faf(N:2:end-N+1);
        }

        scale_factor
    }
}

#[cfg(test)]
mod tests {
    use crate::Complex;
    use crate::Frft;
    use assert_approx_eq::assert_approx_eq;

    #[test]
    fn frft_chirp() {
        let frft = Frft::new(16);
        let (mut c1, mut c2) = frft.chirps(16, 1.3);

        assert_eq!(61, c1.clone().count());
        assert_eq!(121, c2.clone().count());

        let f1 = c1.next().unwrap();
        let f2 = c2.next().unwrap();
        let l1 = c1.last().unwrap();
        let l2 = c2.last().unwrap();

        let a1f = Complex::new(-0.986_642_1, -0.16290265);
        let a2f = Complex::new(-0.91668974, -0.3995997);
        let a1l = Complex::new(-0.986_642_1, -0.16290265);
        let a2l = Complex::new(-0.91668974, -0.3995997);

        assert_approx_eq!(a1f.re, f1.re, 1e-4);
        assert_approx_eq!(a1f.im, f1.im, 1e-4);
        assert_approx_eq!(a2f.re, f2.re, 1e-4);
        assert_approx_eq!(a2f.im, f2.im, 1e-4);

        assert_approx_eq!(a1l.re, l1.re, 1e-4);
        assert_approx_eq!(a1l.im, l1.im, 1e-4);
        assert_approx_eq!(a2l.re, l2.re, 1e-4);
        assert_approx_eq!(a2l.im, l2.im, 1e-4);
    }

    #[test]
    fn frft_interp() {
        let mut frft = Frft::new(16);

        let signal = [
            Complex::new(1.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
        ];

        let expected = [
            Complex::new(1.00000000, 0.0),
            Complex::new(6.366_197_5e-1, 0.0),
            Complex::new(2.867_917_2e-17, 0.0),
            Complex::new(-2.122_065_9e-1, 0.0),
            Complex::new(7.617_711_4e-17, 0.0),
            Complex::new(1.273_239_6e-1, 0.0),
            Complex::new(1.222_953e-16, 0.0),
            Complex::new(-9.094_568e-2, 0.0),
            Complex::new(-8.340_492e-17, 0.0),
            Complex::new(7.073_553e-2, 0.0),
            Complex::new(6.906_047e-18, 0.0),
            Complex::new(-5.787_452_3e-2, 0.0),
            Complex::new(-1.092_892_7e-16, 0.0),
            Complex::new(4.897_075e-2, 0.0),
            Complex::new(3.905_563e-17, 0.0),
            Complex::new(-4.244_132e-2, 0.0),
            Complex::new(-6.206_417_6e-18, 0.0),
            Complex::new(3.744_822_4e-2, 0.0),
            Complex::new(-3.947_459_7e-17, 0.0),
            Complex::new(-3.350_630_4e-2, 0.0),
            Complex::new(-6.249_739e-17, 0.0),
            Complex::new(3.031_522_8e-2, 0.0),
            Complex::new(1.147_813_2e-16, 0.0),
            Complex::new(-2.767_912_1e-2, 0.0),
            Complex::new(-1.706_778e-18, 0.0),
            Complex::new(2.546_479_2e-2, 0.0),
            Complex::new(-4.586_234_7e-17, 0.0),
            Complex::new(-2.357_851e-2, 0.0),
            Complex::new(-1.490_011_2e-17, 0.0),
            Complex::new(2.195_240_6e-2, 0.0),
            Complex::new(-3.863_543e-17, 0.0),
        ];

        let interped_f = frft.interpolator.interp(signal.iter());

        dbg!(interped_f);

        assert_eq!(31, interped_f.len());
        for (e, r) in expected.iter().zip(interped_f.iter()) {
            assert_approx_eq!(e.re, r.re, 1e-4);
            assert_approx_eq!(e.im, r.im, 1e-4);
        }
    }

    #[test]
    fn frft_03() {
        let mut frft = Frft::new(16);
        let mut signal = [
            Complex::new(1.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
            Complex::new(0.0, 0.0),
        ];

        let expected = [
            Complex::new(-0.04139014, 0.21485908),
            Complex::new(-0.15800667, 0.01220657),
            Complex::new(0.1289293, -0.19462559),
            Complex::new(-0.10956088, 0.15421447),
            Complex::new(0.09545444, -0.06652694),
            Complex::new(-0.06943505, 0.00793037),
            Complex::new(0.04457944, 0.01806855),
            Complex::new(-0.03091022, -0.02609895),
            Complex::new(0.03091022, 0.02609895),
            Complex::new(-0.04457944, -0.01806855),
            Complex::new(0.06943505, -0.00793037),
            Complex::new(-0.09545444, 0.06652694),
            Complex::new(0.10956088, -0.15421447),
            Complex::new(-0.1289293, 0.19462559),
            Complex::new(0.15800667, -0.01220657),
            Complex::new(0.04139014, -0.21485908),
        ];

        frft.process_scaled(&mut signal, 0.3);
        for (e, r) in expected.iter().zip(signal.iter()) {
            assert_approx_eq!(e.re, r.re, 1e-4);
            assert_approx_eq!(e.im, r.im, 1e-4);
        }
    }
}
