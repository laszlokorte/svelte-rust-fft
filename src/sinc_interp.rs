use crate::sinc::sinc;

use crate::Complex;
use crate::Convolver;

pub struct Interpolator {
    convolver: Convolver,
    conv_result: Vec<Complex<f32>>,
}

impl Interpolator {
    pub fn new(length: usize) -> Self {
        Self {
            convolver: Convolver::new(6 * length),
            conv_result: vec![Complex::default(); 6 * length],
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
    pub fn interp<'s, 'c>(
        &'s mut self,
        signal: impl Iterator<Item = &'c Complex<f32>>,
    ) -> &'s [Complex<f32>] {
        let n = self.conv_result.len() / 6;
        let ni = n as i32;
        let interspersed = signal.cloned().intersperse(Complex::default()).skip(1);
        let sinc = ((-2 * ni)..(2 * ni)).map(|x| sinc(x as f32 / 2.0));
        self.convolver
            .conv(interspersed, sinc, &mut self.conv_result);

        &self.conv_result[(2 * n)..(4 * n)]
    }

    // expected python results
    // sincinterp(np.array([1, 2, 3]) -> [1.         1.27323954 2.         2.97089227 3.        ]
    // sincinterp(np.array([]) -> error
    // sincinterp(np.array([1]) -> []
    // sincinterp(np.array([1,2]) -> [1.         1.90985932 2.        ]
    // sincinterp(np.array([1,1]) -> [1.         1.27323954 1.        ]
    // sincinterp(np.array([0,0]) -> [0. 0. 0.]
    // sincinterp(np.array([1,0]) -> [1.00000000e+00 6.36619772e-01 4.44089210e-17]
    // sincinterp(np.array([0,1]) -> [8.88178420e-17 6.36619772e-01 1.00000000e+00]
    // sincinterp(np.array([0,1,0]) -> [1.85037171e-17 6.36619772e-01 1.00000000e+00 6.36619772e-01 1.85037171e-17]
    // sincinterp(np.array([1,1,1]) -> [1.         1.06103295 1.         1.06103295 1.        ]

    // expected matlab results
    // interp([1,2,3]) -> [1.0000,1.2732,2.0000,2.9709,3.0000]
    // interp([]) -> error
    // interp([0]) -> error
    // interp([1,2]) -> [1.0000, 1.9099, 2.0000]
    // interp([1,1]) -> [1.0000,1.2732, 1.0000]
    // interp([0,0]) -> [0,0,0]
    // interp([0,1,0]) -> [-5.5511e-17, 6.3662e-01, 1.0000e+00, 6.3662e-01, 1.3878e-17]
    // interp([1,1,1]) -> [1.0000, 1.0610, 1.0000, 1.0610, 1.0000]
}
