use crate::conv_length;

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
}

impl Frft {
    pub fn new(length: usize) -> Self {
        let sinc_len = 2 * length - 1;
        let _fft_conv_len = conv_length(length, sinc_len);

        let mut planner = FftPlanner::new();
        let fft_integer = planner.plan_fft_forward(length);

        Self { fft_integer }
    }

    pub fn process(&mut self, frac: &mut [Complex<f32>], fraction: f32) {
        let n = frac.len();
        let _f_n = n as f32;

        let mut a = (fraction + 4.0).rem_euclid(4.0);

        // % do special cases
        // if (a==0), Faf = f; return; end;
        // if (a==2), Faf = flipud(f); return; end;
        // if (a==1), Faf(shft,1) = fft(f(shft))/sN; return; end
        // if (a==3), Faf(shft,1) = ifft(f(shft))*sN; return; end
        if a == 0.0 {
        } else if a == 1.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(frac);
            frac.rotate_right(n / 2);
        } else if a == 2.0 {
            frac.reverse();
        } else if a == 3.0 {
            frac.rotate_right(n / 2);
            self.fft_integer.process(frac);
            frac.rotate_right(n / 2);
            frac.reverse();
        } else {
            // % reduce to interval 0.5 < a < 1.5
            // if (a>2.0), a = a-2; f = flipud(f); end
            // if (a>1.5), a = a-1; f(shft,1) = fft(f(shft))/sN; end
            // if (a<0.5), a = a+1; f(shft,1) = ifft(f(shft))*sN; end
            let mut do_rev = if a > 2.0 {
                a -= 2.0;
                true
            } else {
                false
            };

            if a > 1.5 {
                a -= 1.0;
                frac.rotate_right(n / 2);
                self.fft_integer.process(frac);
                frac.rotate_right(n / 2);
            }
            if a < 0.5 {
                a += 1.0;
                frac.rotate_right(n / 2);
                self.fft_integer.process(frac);
                frac.rotate_right(n / 2);

                do_rev = !do_rev;
            }

            if do_rev {
                frac.reverse();
            }

            // % the general case for 0.5 < a < 1.5
            // alpha = a*pi/2;
            // tana2 = tan(alpha/2);
            // sina = sin(alpha);
            // f = [zeros(N-1,1) ; interp(f) ; zeros(N-1,1)];
 

            // % chirp premultiplication
            // chrp = exp(-i*pi/N*tana2/4*(-2*N+2:2*N-2)'.^2);
            // f = chrp.*f;
            //
            // % chirp convolution
            // c = pi/N/sina/4;
            // Faf = fconv(exp(i*c*(-(4*N-4):4*N-4)'.^2),f);
            // Faf = Faf(4*N-3:8*N-7)*sqrt(c/pi);
            //
            // % chirp post multiplication
            // Faf = chrp.*Faf;
            //
            // % normalizing constant
            // Faf = exp(-i*(1-a)*pi/4)*Faf(N:2:end-N+1);
        }
    }
}
