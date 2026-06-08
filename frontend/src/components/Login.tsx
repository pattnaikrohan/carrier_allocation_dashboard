import React from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

import compassLogo from '../assets/compass_logo_final.svg';

const bgStyles = `
@keyframes float1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(80px, -60px) scale(1.1); }
  50% { transform: translate(-40px, 80px) scale(0.95); }
  75% { transform: translate(60px, 40px) scale(1.05); }
}
@keyframes float2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-100px, 60px) scale(1.08); }
  50% { transform: translate(60px, -80px) scale(0.92); }
  75% { transform: translate(-30px, -50px) scale(1.12); }
}
@keyframes float3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(50px, 100px) scale(1.15); }
  50% { transform: translate(-80px, -30px) scale(0.9); }
  75% { transform: translate(100px, -60px) scale(1.05); }
}
@keyframes shimmer {
  0% { transform: translateX(-100%) rotate(15deg); }
  100% { transform: translateX(200%) rotate(15deg); }
}
`;

export const Login: React.FC = () => {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginRedirect(loginRequest).catch(e => {
            console.error(e);
        });
    };

    return (
        <>
            <style>{bgStyles}</style>
            <div className="min-h-screen flex items-center justify-center relative font-['Inter',sans-serif] overflow-hidden bg-[#eef2ff]">
                
                {/* Deep base gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-200"></div>
                
                {/* Animated floating mesh blobs */}
                <div className="absolute w-[500px] h-[500px] top-[-15%] left-[-10%] rounded-full bg-gradient-to-br from-blue-400/40 to-cyan-300/30 blur-[80px]" style={{ animation: 'float1 20s ease-in-out infinite' }}></div>
                <div className="absolute w-[600px] h-[600px] bottom-[-20%] right-[-10%] rounded-full bg-gradient-to-tl from-indigo-500/35 to-purple-400/25 blur-[90px]" style={{ animation: 'float2 25s ease-in-out infinite' }}></div>
                <div className="absolute w-[400px] h-[400px] top-[30%] right-[20%] rounded-full bg-gradient-to-tr from-sky-400/30 to-blue-300/20 blur-[70px]" style={{ animation: 'float3 18s ease-in-out infinite' }}></div>
                <div className="absolute w-[350px] h-[350px] bottom-[10%] left-[15%] rounded-full bg-gradient-to-br from-violet-400/25 to-indigo-300/20 blur-[60px]" style={{ animation: 'float1 22s ease-in-out infinite reverse' }}></div>
                
                {/* Soft frosted overlay */}
                <div className="absolute inset-0 bg-white/30 backdrop-blur-[60px]"></div>
                
                {/* Fine grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#6366f10c_1px,transparent_1px),linear-gradient(to_bottom,#6366f10c_1px,transparent_1px)] bg-[size:40px_40px] opacity-60"></div>
                
                {/* Shimmer light sweep */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 -left-full w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'shimmer 8s ease-in-out infinite' }}></div>
                </div>

                {/* Card */}
                <div className="relative z-10 w-full max-w-[380px] px-5">
                    <div className="bg-white rounded-2xl p-8 md:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] flex flex-col items-center transition-all duration-500 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.03)]">
                        
                        {/* Logo */}
                        <div className="flex flex-col items-center mb-10 mt-4 w-full">
                            <img src={compassLogo} alt="Compass Logo" className="w-full max-w-[400px] object-contain scale-[1.5]" />
                        </div>
                        
                        {/* Headers */}
                        <div className="text-center mb-8 w-full">
                            <h1 className="text-2xl font-extrabold text-slate-900 mb-1.5 tracking-tight leading-none">
                                Carrier Allocation
                            </h1>
                            <p className="text-blue-600 font-semibold text-[10px] uppercase tracking-[0.2em]">
                                Enterprise Logistics Intelligence
                            </p>
                        </div>

                        {/* Login Button */}
                        <div className="w-full">
                            <button 
                                onClick={handleLogin}
                                className="group w-full py-3.5 px-5 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all duration-300 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-[1px] active:translate-y-0"
                            >
                                <div className="bg-white p-[3px] rounded-sm shadow-sm flex items-center justify-center">
                                    <svg className="transition-transform group-hover:scale-110 duration-200" width="15" height="15" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M0 0h10v10H0z" fill="#f25022"/>
                                        <path d="M11 0h10v10H11z" fill="#7fba00"/>
                                        <path d="M0 11h10v10H0z" fill="#00a4ef"/>
                                        <path d="M11 11h10v10H11z" fill="#ffb900"/>
                                    </svg>
                                </div>
                                Continue with Microsoft
                            </button>
                        </div>

                        {/* Tagline */}
                        <div className="mt-8 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.15em]">
                                Powered by AAW AI
                            </span>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
