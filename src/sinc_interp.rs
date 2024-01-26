use crate::Convolver;
use crate::Complex;

pub struct Interpolator {
    convolver: Convolver,
}

impl Interpolator {
    pub fn new(length: usize) -> Self {
        Self {
            convolver: Convolver::new(length),
        }
    }

    // function xint=interp(x)
    // % sinc interpolation
    // N = length(x);
    // y = zeros(2*N-1,1);
    // y(1:2:2*N-1) = x;
    // xint = fconv(y(1:2*N-1), sinc([-(2*N-3):(2*N-3)]'/2));
    // xint = xint(2*N-2:end-2*N+3);
    pub fn interp(signal: impl Iterator<Item=Complex<f32>>, into: &mut [Complex<f32>]) {

    }
}

