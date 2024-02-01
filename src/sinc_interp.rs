use crate::sinc::sinc;

use crate::Convolver;
use crate::Complex;

pub struct Interpolator {
    convolver: Convolver,
    conv_result: Vec<Complex<f32>>,
}

impl Interpolator {
    pub fn new(length: usize) -> Self {
        Self {
            convolver: Convolver::new(6 * length),
            conv_result: vec![Complex::default();6 * length],
        }
    }

    // sinc from -2N to 2N , length 4N
    // splice zeros into signal of length N to get signal of length 2N
    // convolution needs to be of length 6N (4+2)N
    // from the result the first 2N and last 2N are discarded
    // yielding a result of length 6N-4N = 2N

    // ----
    // matlab code:
    // function xint=interp(x)
    // % sinc interpolation
    // N = length(x);
    // y = zeros(2*N-1,1);
    // y(1:2:2*N-1) = x;
    // xint = fconv(y(1:2*N-1), sinc([-(2*N-3):(2*N-3)]'/2));
    // xint = xint(2*N-2:end-2*N+3);
    // ---
    pub fn interp<'s, 'c>(&'s mut self, signal: impl Iterator<Item=&'c Complex<f32>>) -> &'s [Complex<f32>] {
        let n = self.conv_result.len();
        let ni = n as i32;
        let interspersed = signal.cloned().intersperse(Complex::default());
        let sinc = ((-2*ni-3)..(2*ni-3)).map(|x| sinc(x as f32));
        self.convolver.conv(interspersed, sinc, &mut self.conv_result);

        &self.conv_result[(2*n/6)..(4*n/6)]

        // a: impl Iterator<Item = Complex<f32>>,
        // b: impl Iterator<Item = Complex<f32>>,
        // mut into: &mut [Complex<f32>],
    }
}

